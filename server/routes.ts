import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { randomBytes } from "crypto";
import Stripe from "stripe";
import admin from "firebase-admin";
import { openai } from "./replit_integrations/audio/client";
import { 
  sendEmail, 
  estimateSubmittedEmail,
  depositRequestEmail, 
  depositReceivedEmail,
  bookingRequestAdminEmail,
  bookingConfirmationEmail,
  rescheduleConfirmationEmail,
  finalPaymentEmail, 
  caseClosedEmail,
  newEstimateAdminAlert,
  ADMIN_EMAIL
} from "./email";
import { sendWhatsAppMessage, sendWhatsAppPaymentLink, updateAccessToken, downloadWhatsAppMedia, WHATSAPP_VERIFY_TOKEN } from "./whatsapp";

const APP_URL = process.env.APP_URL || "http://localhost:5000";

// ── Firebase Cloud Messaging push notification helper ─────────────────────────
// Uses Firebase Admin SDK (FCM V1 API) — no legacy server key needed.
// Requires FIREBASE_SERVICE_ACCOUNT env var: the full JSON content of your
// Firebase service account key file (from Project Settings → Service accounts →
// Generate new private key).
let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return false;
  try {
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseInitialized = true;
    console.log("[FCM] Firebase Admin initialized ✓");
    return true;
  } catch (e) {
    console.error("[FCM] Failed to initialize Firebase Admin:", e);
    return false;
  }
}

async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  if (tokens.length === 0) return;
  if (!initFirebase()) {
    // Not configured — skip silently
    return;
  }

  const results = await Promise.allSettled(
    tokens.map((token) =>
      admin.messaging().send({
        token,
        notification: { title, body },
        data: data || {},
        android: { priority: "high", notification: { sound: "default" } },
      })
    )
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[FCM] Push failed for token ${i}:`, r.reason);
    }
  });
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

async function createStripePaymentLink(
  description: string,
  amountSGD: number,
  metadata: Record<string, string>,
  successUrl: string
): Promise<string | null> {
  if (!stripe) return null;
  try {
    // Embed session ID in success URL so the page can verify payment on return
    const successWithSession = successUrl.includes("?")
      ? `${successUrl}&payment_success=1&session_id={CHECKOUT_SESSION_ID}`
      : `${successUrl}?payment_success=1&session_id={CHECKOUT_SESSION_ID}`;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sgd",
            product_data: { name: description },
            unit_amount: Math.round(amountSGD * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successWithSession,
      cancel_url: successUrl,
      metadata,
    });
    return session.url;
  } catch (err) {
    console.error("Stripe payment link error:", err);
    return null;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // -- Stripe Webhook (must be before any body-parsing middleware for this route) --
  app.post("/api/webhooks/stripe", async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe) {
      return res.status(500).json({ message: "Stripe not configured" });
    }

    let event: Stripe.Event;

    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } catch (err: any) {
        console.error("Stripe webhook signature verification failed:", err.message);
        return res.status(400).json({ message: `Webhook error: ${err.message}` });
      }
    } else {
      // No secret configured — accept without verification (dev only)
      event = req.body as Stripe.Event;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { quoteId, type } = session.metadata || {};

      if (!quoteId || !type) {
        return res.status(200).json({ received: true });
      }

      const id = parseInt(quoteId);
      const amountPaid = ((session.amount_total ?? 0) / 100).toFixed(2);

      try {
        const quote = await storage.updateQuotePayment(id, type as "deposit" | "final", amountPaid);

        if (!quote || !quote.customer) {
          return res.status(200).json({ received: true });
        }

        if (type === "deposit") {
          await sendEmail({
            to: quote.customer.email,
            subject: `[${quote.referenceNo}] Deposit Received — Slot Confirmed!`,
            html: depositReceivedEmail(quote),
          });
          console.log(`Stripe webhook: deposit paid for ${quote.referenceNo} (SGD ${amountPaid})`);
        }

        if (type === "final") {
          await sendEmail({
            to: quote.customer.email,
            subject: `[${quote.referenceNo}] Payment Received — Case Closed`,
            html: caseClosedEmail(quote),
          });
          console.log(`Stripe webhook: final payment for ${quote.referenceNo} (SGD ${amountPaid})`);
        }
      } catch (err) {
        console.error("Stripe webhook: error processing payment:", err);
      }
    }

    res.status(200).json({ received: true });
  });

  // -- Auth Routes --
  app.post(api.auth.login.path, async (req, res) => {
    let parsed: { username: string; password: string };
    try {
      parsed = api.auth.login.input.parse(req.body);
    } catch {
      return res.status(400).json({ message: "Username and password are required" });
    }
    try {
      const { username, password } = parsed;
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      const bcrypt = await import("bcryptjs");
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      req.session.userId = user.id;
      await new Promise<void>((resolve) => req.session.save(e => {
        if (e) console.error("[session] save error:", e);
        resolve();
      }));
      const { password: _pw, ...safeUser } = user;
      res.json(safeUser);
    } catch (e) {
      console.error("[login] unexpected error:", e);
      res.status(500).json({ message: "Login failed, please try again" });
    }
  });

  app.get(api.auth.me.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {});
    res.json({ message: "Logged out" });
  });

  // -- Staff Routes --
  app.get(api.staff.list.path, async (req, res) => {
    const staff = await storage.getStaffMembers();
    res.json(staff);
  });

  // Create staff member (admin only)
  app.post("/api/admin/staff", async (req, res) => {
    try {
      const { username, password, name } = z.object({
        username: z.string().min(2),
        password: z.string().min(6),
        name: z.string().min(2),
      }).parse(req.body);
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ message: "Username already taken" });
      const bcrypt = await import("bcryptjs");
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hashed, name, role: 'staff' });
      res.json(user);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Update staff member
  app.patch("/api/admin/staff/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const data = z.object({
        name: z.string().min(2).optional(),
        username: z.string().min(2).optional(),
        password: z.string().min(6).optional(),
        teamId: z.number().nullable().optional(),
        // HR fields
        phone: z.string().optional().nullable(),
        email: z.string().email().optional().nullable(),
        nricFin: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(),
        emergencyName: z.string().optional().nullable(),
        emergencyPhone: z.string().optional().nullable(),
      }).parse(req.body);
      // Check username uniqueness (excluding current user)
      if (data.username) {
        const existing = await storage.getUserByUsername(data.username);
        if (existing && existing.id !== id) return res.status(409).json({ message: "Username already taken" });
      }
      // Hash password if provided
      const bcrypt = await import("bcryptjs");
      const updateData: any = { ...data };
      delete updateData.password;
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
      }
      const updated = await storage.updateUser(id, updateData);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Delete staff member
  app.delete("/api/admin/staff/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      if (id === req.session.userId) return res.status(400).json({ message: "Cannot delete your own account" });
      await storage.deleteUser(id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // -- Team Routes --
  app.get("/api/teams", async (_req, res) => {
    const data = await storage.getTeams();
    res.json(data);
  });

  app.post("/api/teams", async (req, res) => {
    try {
      const data = z.object({ name: z.string().min(1), color: z.string().optional() }).parse(req.body);
      const team = await storage.createTeam({ name: data.name, color: data.color || "#6366f1" });
      res.json(team);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/teams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = z.object({ name: z.string().min(1).optional(), color: z.string().optional() }).parse(req.body);
      const updated = await storage.updateTeam(id, data);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/teams/:id", async (req, res) => {
    try {
      await storage.deleteTeam(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/teams/:id/assign", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const { userId } = z.object({ userId: z.number() }).parse(req.body);
      await storage.assignUserToTeam(userId, teamId);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/staff/:id/unassign-team", async (req, res) => {
    try {
      await storage.assignUserToTeam(parseInt(req.params.id), null);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // -- Attendance Routes --
  app.get("/api/attendance/today", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const log = await storage.getTodayAttendance(req.session.userId);
    res.json(log || null);
  });

  app.post("/api/attendance/clock-in", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { lat, lng } = z.object({
        lat: z.string({ required_error: "GPS location is required to clock in." }),
        lng: z.string({ required_error: "GPS location is required to clock in." }),
      }).parse(req.body);
      if (!lat || !lng) return res.status(400).json({ message: "GPS location is required to clock in." });
      // Check if already clocked in today
      const existing = await storage.getTodayAttendance(req.session.userId);
      if (existing && !existing.clockOutAt) return res.status(409).json({ message: "Already clocked in" });
      const log = await storage.clockIn(req.session.userId, lat, lng);
      res.json(log);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/attendance/clock-out", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { lat, lng } = z.object({
        lat: z.string({ required_error: "GPS location is required to clock out." }),
        lng: z.string({ required_error: "GPS location is required to clock out." }),
      }).parse(req.body);
      if (!lat || !lng) return res.status(400).json({ message: "GPS location is required to clock out." });
      const log = await storage.clockOut(req.session.userId, lat, lng);
      if (!log) return res.status(404).json({ message: "No active clock-in found" });
      res.json(log);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/admin/attendance", async (req, res) => {
    try {
      const { from, to, userId } = req.query;
      const parseDate = (s: unknown) => {
        if (!s) return undefined;
        const d = new Date(s as string);
        return isNaN(d.getTime()) ? undefined : d;
      };
      const logs = await storage.getAttendanceLogs(
        parseDate(from),
        parseDate(to),
        userId ? parseInt(userId as string) : undefined,
      );
      res.json(logs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/attendance", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { userId, clockInAt, clockOutAt, notes } = z.object({
        userId: z.number(),
        clockInAt: z.string(),
        clockOutAt: z.string().nullable().optional(),
        notes: z.string().optional(),
      }).parse(req.body);
      const log = await storage.createAttendanceLog({
        userId,
        clockInAt: new Date(clockInAt),
        clockOutAt: clockOutAt ? new Date(clockOutAt) : null,
        notes,
      });
      res.json(log);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/admin/attendance/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const { clockInAt, clockOutAt, notes } = z.object({
        clockInAt: z.string().optional(),
        clockOutAt: z.string().nullable().optional(),
        notes: z.string().optional(),
      }).parse(req.body);
      const updated = await storage.updateAttendanceLog(id, {
        clockInAt: clockInAt ? new Date(clockInAt) : undefined,
        clockOutAt: clockOutAt === null ? null : clockOutAt ? new Date(clockOutAt) : undefined,
        notes,
      });
      if (!updated) return res.status(404).json({ message: "Record not found" });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/admin/attendance/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAttendanceLog(id);
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // -- Site Analytics Tracking (public — no auth required) --
  function detectDevice(ua?: string): string {
    if (!ua) return 'desktop';
    const u = ua.toLowerCase();
    if (/tablet|ipad/.test(u)) return 'tablet';
    if (/mobile|iphone|android|blackberry|opera mini|opera mobi|windows phone/.test(u)) return 'mobile';
    return 'desktop';
  }

  async function lookupGeoAndUpdate(eventId: number, ip: string): Promise<void> {
    try {
      const clean = ip.replace(/^::ffff:/, '');
      if (!clean || clean === '127.0.0.1' || clean.startsWith('::1') || clean.startsWith('10.') || clean.startsWith('192.168.')) return;
      const r = await fetch(`http://ip-api.com/json/${clean}?fields=status,country,countryCode,city,lat,lon`);
      if (!r.ok) return;
      const d = await r.json() as any;
      if (d.status !== 'success') return;
      await storage.updateSiteEventGeo(eventId, {
        country: d.country,
        countryCode: d.countryCode,
        city: d.city,
        latitude: String(d.lat),
        longitude: String(d.lon),
      });
    } catch {}
  }

  app.post("/api/track", async (req, res) => {
    try {
      const body = z.object({
        event: z.string(),
        page: z.string().optional(),
        label: z.string().optional(),
        referrer: z.string().optional(),
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        utmCampaign: z.string().optional(),
        sessionId: z.string().optional(),
      }).parse(req.body);
      const deviceType = detectDevice(req.headers['user-agent']);
      const evt = await storage.addSiteEvent({ ...body, deviceType });
      res.json({ ok: true });
      // Async geo lookup after response is sent — doesn't block the user
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';
      lookupGeoAndUpdate(evt.id, ip);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/admin/analytics", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 7));
      const data = await storage.getSiteAnalytics(days);
      res.json(data);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // -- Android crash reporter (unauthenticated — fires from native crash handler) --
  app.post("/api/crash-report", (req, res) => {
    const report = req.body?.crash ?? JSON.stringify(req.body);
    console.error("[ANDROID CRASH REPORT]", report);
    res.json({ ok: true });
  });

  // -- GPS Track Routes --
  app.post("/api/staff/gps-track", async (req, res) => {
    // Accept session userId OR staffId from body (native background service fallback)
    const resolvedUserId = req.session.userId ?? (req.body?.staffId ? parseInt(req.body.staffId) : undefined);
    if (!resolvedUserId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { lat, lng, accuracy, speed, heading, recordedAt } = z.object({
        lat: z.string(),
        lng: z.string(),
        accuracy: z.string().optional(),
        speed: z.string().optional(),
        heading: z.string().optional(),
        recordedAt: z.string().optional(),
        staffId: z.any().optional(),
      }).parse(req.body);
      const pt = await storage.addGpsTrackPoint({
        userId: resolvedUserId,
        lat, lng, accuracy, speed, heading,
        recordedAt: recordedAt ? new Date(recordedAt) : undefined,
      });
      res.json(pt);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Register / update FCM push notification token for the logged-in staff member
  app.post("/api/staff/fcm-token", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
      await storage.updateFcmToken(req.session.userId, token);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/admin/staff/:userId/gps-track", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const userId = parseInt(req.params.userId);
      const date = req.query.date as string || new Date().toISOString().split("T")[0];
      const dateFrom = new Date(date + "T00:00:00");
      const dateTo   = new Date(date + "T23:59:59");
      const points = await storage.getGpsTrackPoints(userId, dateFrom, dateTo);
      res.json(points);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Live locations: last GPS point today for every currently-clocked-in staff member
  app.get("/api/admin/live-locations", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const dateFrom = new Date(todayStr + "T00:00:00");
      const dateTo   = new Date(todayStr + "T23:59:59");
      // Get all attendance logs for today where staff are still clocked in
      const logs = await storage.getAttendanceLogs(dateFrom, dateTo);
      const activeUserIds = logs.filter((l: any) => !l.clockOutAt).map((l: any) => l.userId);
      // Fetch last GPS point for each active user
      const result: Record<number, any> = {};
      await Promise.all(activeUserIds.map(async (uid: number) => {
        const pts = await storage.getGpsTrackPoints(uid, dateFrom, dateTo);
        if (pts.length > 0) {
          const last = pts[pts.length - 1];
          result[uid] = { lat: last.lat, lng: last.lng, recordedAt: last.recordedAt };
        }
      }));
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // -- Amendment Routes --
  app.post("/api/attendance/amendment", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { attendanceLogId, requestedClockIn, requestedClockOut, reason } = z.object({
        attendanceLogId: z.number(),
        requestedClockIn: z.string().optional(),
        requestedClockOut: z.string().optional(),
        reason: z.string().min(5),
      }).parse(req.body);

      const log = await storage.getAttendanceLog(attendanceLogId);
      if (!log) return res.status(404).json({ message: "Record not found" });

      const amendment = await storage.createAmendment({
        attendanceLogId,
        userId: req.session.userId,
        originalClockIn: log.clockInAt,
        originalClockOut: log.clockOutAt,
        requestedClockIn: requestedClockIn ? new Date(requestedClockIn) : undefined,
        requestedClockOut: requestedClockOut ? new Date(requestedClockOut) : undefined,
        reason,
        status: 'pending',
      });
      res.json(amendment);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/attendance/amendments", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const amendments = await storage.getAmendmentsByUser(req.session.userId);
    res.json(amendments);
  });

  app.get("/api/admin/attendance/amendments", async (req, res) => {
    const amendments = await storage.getPendingAmendments();
    res.json(amendments);
  });

  app.patch("/api/admin/attendance/amendments/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const id = parseInt(req.params.id);
      const { status, adminNote } = z.object({
        status: z.enum(["approved", "rejected"]),
        adminNote: z.string().default(""),
      }).parse(req.body);
      const updated = await storage.reviewAmendment(id, status, adminNote, req.session.userId);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // -- Leave Routes --
  app.post("/api/leave", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const data = z.object({
        leaveType: z.enum(["annual", "medical", "unpaid", "other"]),
        startDate: z.string(),
        endDate: z.string(),
        totalDays: z.number().min(0.5),
        reason: z.string().optional(),
      }).parse(req.body);
      const leave = await storage.createLeaveRequest({ ...data, userId: req.session.userId, totalDays: String(data.totalDays) });
      res.json(leave);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/leave", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const leaves = await storage.getLeaveRequestsByUser(req.session.userId);
    res.json(leaves);
  });

  app.get("/api/leave/balance", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
    const balance = await storage.getLeaveBalance(req.session.userId, year);
    res.json(balance);
  });

  app.get("/api/admin/leave", async (req, res) => {
    const status = req.query.status as string | undefined;
    const leaves = await storage.getAllLeaveRequests(status);
    res.json(leaves);
  });

  app.patch("/api/admin/leave/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const id = parseInt(req.params.id);
      const { status, adminNote } = z.object({
        status: z.enum(["approved", "rejected"]),
        adminNote: z.string().default(""),
      }).parse(req.body);
      const updated = await storage.reviewLeaveRequest(id, status, adminNote, req.session.userId);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // -- Pay Settings --
  app.patch("/api/admin/pay-settings/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const data = z.object({
        payType: z.enum(["hourly", "monthly"]).optional(),
        monthlyRate: z.string().optional(),
        hourlyRate: z.string().optional(),
        overtimeRate: z.string().optional(),
        annualLeaveEntitlement: z.number().int().min(0).max(30).optional(),
      }).parse(req.body);
      const updated = await storage.updatePaySettings(userId, data);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // -- Payslip Routes --
  app.get("/api/admin/payslips", async (req, res) => {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const slips = await storage.getAllPayslips(userId);
    res.json(slips);
  });

  app.get("/api/staff/payslips", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const slips = await storage.getPayslipsByUser(req.session.userId);
    const me = await storage.getUserById(req.session.userId);
    const monthlyRate = parseFloat(me?.monthlyRate as string || "0");
    res.json(slips.map(s => ({ ...s, isMonthlyBased: monthlyRate > 0 })));
  });

  app.post("/api/admin/payslips/generate", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { userId, periodStart, periodEnd, notes } = z.object({
        userId: z.number(),
        periodStart: z.string(),
        periodEnd: z.string(),
        notes: z.string().optional(),
      }).parse(req.body);

      // Fetch attendance logs for period
      const logs = await storage.getAttendanceLogs(
        new Date(periodStart + "T00:00:00"),
        new Date(periodEnd + "T23:59:59"),
        userId,
      );

      // Fetch user pay settings
      const staffMember = await storage.getUserById(userId);
      if (!staffMember) return res.status(404).json({ message: "Staff not found" });

      const monthlyRate = parseFloat(staffMember.monthlyRate as string || "0");
      const hourlyRate  = parseFloat(staffMember.hourlyRate  as string || "0");
      const overtimeRate = parseFloat((staffMember as any).overtimeRate as string || "0") ||
                           (hourlyRate * 1.5);

      // Auto-detect: if monthly salary is set, treat as monthly-based regardless of payType flag
      const isMonthly = monthlyRate > 0;

      // Calculate hours per day (cap regular at 8h/day, remainder is OT)
      let regularHours = 0, overtimeHours = 0, mealAllowanceDays = 0;
      for (const log of logs) {
        if (log.clockOutAt) {
          const hrs = (new Date(log.clockOutAt).getTime() - new Date(log.clockInAt).getTime()) / 3600000;
          const dailyOt = Math.max(0, hrs - 8);
          regularHours  += Math.min(hrs, 8);
          overtimeHours += dailyOt;
          // Meal allowance: S$8 per day when OT > 3h (applied once per day)
          if (dailyOt > 3) mealAllowanceDays++;
        }
      }
      const mealAllowance = mealAllowanceDays * 8;

      let basicPay = 0, regularPay = 0, overtimePay = 0, grossPay = 0;
      if (isMonthly) {
        // Basic salary (fixed) + regular hrs × hourly rate + OT hrs × OT rate + meal allowance
        basicPay    = monthlyRate;
        regularPay  = regularHours * hourlyRate;
        overtimePay = overtimeHours * overtimeRate;
        grossPay    = basicPay + regularPay + overtimePay + mealAllowance;
      } else {
        // Purely hourly: regular hrs × hourly rate + OT hrs × OT rate + meal allowance
        basicPay    = 0;
        regularPay  = regularHours * hourlyRate;
        overtimePay = overtimeHours * overtimeRate;
        grossPay    = regularPay + overtimePay + mealAllowance;
      }

      // Fetch unpaid leave deductions in period
      const allLeaves = await storage.getAllLeaveRequests('approved');
      const unpaidLeaves = allLeaves.filter(l =>
        l.userId === userId &&
        l.leaveType === 'unpaid' &&
        l.startDate >= periodStart &&
        l.startDate <= periodEnd
      );
      const unpaidDays = unpaidLeaves.reduce((s, l) => s + parseFloat(l.totalDays as string), 0);
      // Daily rate: monthly salary ÷ 26 working days, or hourly × 8
      const dailyRate = isMonthly ? monthlyRate / 26 : hourlyRate * 8;
      const leaveDeduction = unpaidDays * dailyRate;
      grossPay -= leaveDeduction;

      const payslip = await storage.generatePayslip({
        userId,
        periodStart,
        periodEnd,
        regularHours: regularHours.toFixed(2),
        overtimeHours: overtimeHours.toFixed(2),
        basicPay: basicPay.toFixed(2),
        regularPay: regularPay.toFixed(2),
        overtimePay: overtimePay.toFixed(2),
        mealAllowance: mealAllowance.toFixed(2),
        leaveDeduction: leaveDeduction.toFixed(2),
        grossPay: Math.max(0, grossPay).toFixed(2),
        notes,
        generatedBy: req.session.userId,
      });
      res.json(payslip);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/admin/payslips/:id", async (req, res) => {
    try {
      await storage.deletePayslip(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Staff own attendance logs
  app.get("/api/staff/attendance", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const logs = await storage.getAttendanceLogs(undefined, undefined, req.session.userId);
    res.json(logs);
  });

  // Today's team roster — accessible to any logged-in staff member
  app.get("/api/staff/team/today", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      // Use Singapore time (UTC+8) for day boundaries
      const SGT = 8 * 3600000;
      const sgtNow = new Date(Date.now() + SGT);
      const y = sgtNow.getUTCFullYear(), mo = sgtNow.getUTCMonth(), d = sgtNow.getUTCDate();
      const from = new Date(Date.UTC(y, mo, d, 0, 0, 0) - SGT);
      const to   = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999) - SGT);
      const [allStaff, logs] = await Promise.all([
        storage.getStaffMembers(),
        storage.getAttendanceLogs(from, to),
      ]);
      const staffOnly = allStaff.filter((s: any) => s.role === "staff");
      const roster = staffOnly.map((s: any) => {
        const log = logs.find((l: any) => l.userId === s.id) || null;
        return {
          id: s.id,
          name: s.name,
          username: s.username,
          clockInAt: log?.clockInAt ?? null,
          clockOutAt: log?.clockOutAt ?? null,
          clockInLat: log?.clockInLat ?? null,
          clockInLng: log?.clockInLng ?? null,
        };
      });
      res.json(roster);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Staff-specific quotes (team-aware)
  app.get("/api/staff/quotes", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const quotes = await storage.getQuotesForStaff(req.session.userId);
    res.json(quotes);
  });

  // -- Catalog Routes --
  app.get(api.catalog.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const items = await storage.getCatalogItems(search);
    res.json(items);
  });

  // -- Slot Availability (blocked + held by active quotes + per-slot capacity usage) --
  app.get("/api/slots/availability", async (req, res) => {
    try {
      const [blocked, held, capacities] = await Promise.all([
        storage.getBlockedSlots(),
        storage.getHeldSlots(),
        storage.getSlotCapacities(),
      ]);
      res.json({ blocked, held, capacities });
    } catch {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // -- Blocked Slots Routes --
  // Public: customer fetches blocked slots to enforce in booking UI
  app.get("/api/blocked-slots", async (req, res) => {
    try {
      const slots = await storage.getBlockedSlots();
      res.json(slots);
    } catch {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Admin: create a blocked slot
  app.post("/api/admin/blocked-slots", async (req, res) => {
    try {
      const { date, timeSlot, reason } = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be yyyy-MM-dd"),
        timeSlot: z.string().nullable().optional(),
        reason: z.string().optional(),
      }).parse(req.body);
      const slot = await storage.createBlockedSlot({ date, timeSlot: timeSlot || null, reason: reason || null });
      res.json(slot);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid input" });
    }
  });

  // Admin: permanently delete a quote/job case
  app.delete("/api/admin/quotes/:id", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    try {
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      await storage.deleteQuote(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: remove a blocked slot
  app.delete("/api/admin/blocked-slots/:id", async (req, res) => {
    try {
      await storage.deleteBlockedSlot(Number(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // -- Temporary: Admin clear all data (for test resets) --
  app.delete("/api/admin/clear-all-data", async (req, res) => {
    try {
      await storage.clearAllData();
      res.json({ success: true, message: "All data cleared" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // -- Quotes Routes --
  app.get(api.quotes.list.path, async (req, res) => {
    const status = req.query.status as string | undefined;
    const quotes = await storage.getQuotes(status);
    res.json(quotes);
  });

  // Look up a quote by reference number — used for /status/:refNo redirects
  app.get("/api/quotes/by-ref/:refNo", async (req, res) => {
    try {
      const quotes = await storage.getQuotes();
      const quote = quotes.find(q => q.referenceNo === req.params.refNo);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json({ id: quote.id });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/quotes/schedule", async (req, res) => {
    try {
      const pending = await storage.getQuotesByStatuses(['booking_requested']);
      const confirmed = await storage.getQuotesByStatuses(['booked', 'assigned', 'in_progress']);
      res.json({ pending, confirmed });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get(api.quotes.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const quote = await storage.getQuote(id);
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    res.json(quote);
  });

  // AI quote from text description
  app.post(api.quotes.createFromCustomer.path, async (req, res) => {
    try {
      const input = api.quotes.createFromCustomer.input.parse(req.body);
      let aiParsedItems: any[] = [];
      let totalEstimate = 0;
      let aiConfidence = 100;
      let requiresReview = false;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an AI assistant for a furniture installation company in Singapore. 
              Extract furniture items and required services from the user's description.
              Valid service types are: 'install', 'dismantle', 'relocate'.
              Estimate a reasonable unit price (in SGD, numerical value only) based on typical Singapore market rates.
              Return a JSON object with an 'items' array. Each item should have:
              - 'detectedName': string (e.g. 'IKEA Pax Wardrobe')
              - 'serviceType': string ('install', 'dismantle', or 'relocate')
              - 'quantity': number
              - 'estimatedUnitPrice': number
              - 'confidence': number (0-100)
              Return ONLY valid JSON.`
            },
            { role: "user", content: input.itemsDescription }
          ],
          response_format: { type: "json_object" }
        });

        const parsedContent = JSON.parse(response.choices[0].message.content || '{"items":[]}');
        aiParsedItems = parsedContent.items || [];
        let lowestConfidence = 100;
        const catalogItems = await storage.getCatalogItems();

        aiParsedItems = aiParsedItems.map((item: any) => {
          totalEstimate += (item.estimatedUnitPrice * item.quantity);
          if (item.confidence < lowestConfidence) lowestConfidence = item.confidence;
          const matchedCatalogItem = catalogItems.find(c => 
            c.serviceType === item.serviceType && 
            item.detectedName.toLowerCase().includes(c.name.toLowerCase())
          );
          return {
            originalDescription: input.itemsDescription,
            detectedName: item.detectedName,
            serviceType: item.serviceType as string,
            quantity: item.quantity,
            unitPrice: (matchedCatalogItem?.basePrice || item.estimatedUnitPrice).toString(),
            subtotal: ((matchedCatalogItem ? Number(matchedCatalogItem.basePrice) : item.estimatedUnitPrice) * item.quantity).toString(),
            catalogItemId: matchedCatalogItem?.id
          };
        });

        aiConfidence = lowestConfidence;
        requiresReview = aiConfidence < 80 || aiParsedItems.length === 0;
      } catch (err) {
        console.error("AI parsing failed", err);
        requiresReview = true;
        aiConfidence = 0;
        aiParsedItems = [{
          originalDescription: input.itemsDescription,
          detectedName: "Custom Item (Needs Review)",
          serviceType: "install",
          quantity: 1,
          unitPrice: "0",
          subtotal: "0"
        }];
      }

      const referenceNo = `TMG-${randomBytes(4).toString('hex').toUpperCase()}`;

      // ── Minimum charge: SGD 180 ──────────────────────────────────────────────
      const MIN_CHARGE_LEGACY = 180;
      const minAdj = totalEstimate < MIN_CHARGE_LEGACY ? MIN_CHARGE_LEGACY - totalEstimate : 0;
      const grandTotalLegacy = totalEstimate + minAdj;
      if (minAdj > 0) {
        aiParsedItems.push({
          originalDescription: "Minimum Charge Adjustment",
          detectedName: "Minimum Charge Adjustment",
          serviceType: "adjustment",
          quantity: 1,
          unitPrice: minAdj.toFixed(2),
          subtotal: minAdj.toFixed(2),
        });
      }
      // ────────────────────────────────────────────────────────────────────────

      const depositAmount = (grandTotalLegacy * 0.50).toFixed(2);
      const finalAmount = (grandTotalLegacy * 0.50).toFixed(2);

      const quote = await storage.createQuote(
        input.customer,
        {
          referenceNo,
          serviceAddress: input.serviceAddress,
          status: 'submitted',
          subtotal: totalEstimate.toFixed(2),
          total: grandTotalLegacy.toFixed(2),
          depositAmount,
          finalAmount,
          aiConfidenceScore: aiConfidence,
          requiresManualReview: requiresReview,
          paymentStatus: 'unpaid'
        },
        aiParsedItems
      );

      // Alert admin on new estimate submission (awaited so it completes before response)
      try {
        const alertHtml = newEstimateAdminAlert(quote);
        const alertOk = await sendEmail({
          to: ADMIN_EMAIL,
          subject: `🔔 New Estimate Request — ${quote.referenceNo} from ${quote.customer?.name}`,
          html: alertHtml,
        });
        if (alertOk) console.log(`[email] admin alert sent to ${ADMIN_EMAIL} for ${quote.referenceNo}`);
        else console.error(`[email] admin alert FAILED for ${quote.referenceNo}`);
      } catch (alertErr) {
        console.error("[email] admin alert error:", alertErr);
      }

      res.status(201).json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update status (generic)
  app.patch(api.quotes.updateStatus.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.quotes.updateStatus.input.parse(req.body);
      
      const quote = await storage.updateQuoteStatus(
        id,
        input.status,
        {
          actorType: 'admin',
          note: input.note,
          photoUrl: input.photoUrl,
          gpsLat: input.gpsLat ? input.gpsLat.toString() : undefined,
          gpsLng: input.gpsLng ? input.gpsLng.toString() : undefined
        },
        input.assignedStaffId,
        input.assignedTeamId
      );
      
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // Send push notification when a job is assigned to staff
      if (input.assignedStaffId) {
        const tokens = await storage.getFcmTokensByUserIds([input.assignedStaffId]);
        if (tokens.length > 0) {
          const addr = quote.serviceAddress?.split(",")[0] || "New job";
          await sendPushNotification(
            tokens,
            "Job Assigned — TMG Install",
            `You've been assigned to ${addr}`,
            { jobId: String(quote.id), path: `/staff/jobs/${quote.id}` }
          );
        }
      }

      // Send push notification when job status changes to in_progress (staff arrival confirmed)
      if (input.status === "booked" || input.status === "assigned") {
        const staffIds: number[] = [];
        if (quote.assignedStaffId) staffIds.push(quote.assignedStaffId);
        if (staffIds.length > 0) {
          const tokens = await storage.getFcmTokensByUserIds(staffIds);
          if (tokens.length > 0) {
            const date = quote.scheduledAt
              ? new Date(quote.scheduledAt).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })
              : "your scheduled date";
            await sendPushNotification(
              tokens,
              "Job Confirmed — TMG Install",
              `Job ${quote.referenceNo} confirmed for ${date}`,
              { jobId: String(quote.id), path: `/staff/jobs/${quote.id}` }
            );
          }
        }
      }

      // Send deposit request email when admin approves
      if (input.status === "deposit_requested" && quote.customer) {
        const depositAmt = parseFloat(quote.depositAmount || "0") || parseFloat(quote.total) * 0.3;
        const quotePageUrl = `${APP_URL}/quotes/${quote.id}`;
        const stripeUrl = await createStripePaymentLink(
          `Deposit for ${quote.referenceNo} — TMG Install`,
          depositAmt,
          { quoteId: String(quote.id), type: "deposit", referenceNo: quote.referenceNo },
          quotePageUrl
        );
        const paymentLink = stripeUrl || quotePageUrl;
        const emailHtml = depositRequestEmail(quote, paymentLink);
        await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Deposit Payment Required — TMG Install`,
          html: emailHtml,
        });
      }
      
      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Customer pays deposit (mock)
  app.patch(api.quotes.updatePayment.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.quotes.updatePayment.input.parse(req.body);
      const quote = await storage.updateQuotePayment(id, input.paymentType, input.amount);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      
      // After deposit paid, send slot confirmation email
      if (input.paymentType === 'deposit' && quote.customer) {
        const emailHtml = depositReceivedEmail(quote);
        await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Deposit Received — Slot Confirmed!`,
          html: emailHtml,
        });
      }

      // After final payment, send case closed email
      if (input.paymentType === 'final' && quote.customer) {
        const emailHtml = caseClosedEmail(quote);
        await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Payment Received — Case Closed`,
          html: emailHtml,
        });
      }

      res.json(quote);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Create on-demand Stripe checkout session (for quote page button)
  app.get("/api/quotes/:id/checkout", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const type = (req.query.type as string) || "deposit";
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      const quotePageUrl = `${APP_URL}/quotes/${quote.id}`;
      let amount: number;
      let description: string;

      if (type === "deposit") {
        amount = parseFloat(quote.depositAmount || "0") || parseFloat(quote.total) * 0.3;
        description = `Deposit for ${quote.referenceNo} — TMG Install`;
      } else {
        amount = parseFloat(quote.finalAmount || "0") || parseFloat(quote.total) * 0.7;
        description = `Final Payment for ${quote.referenceNo} — TMG Install`;
      }

      const stripeUrl = await createStripePaymentLink(
        description,
        amount,
        { quoteId: String(quote.id), type, referenceNo: quote.referenceNo },
        quotePageUrl
      );

      if (!stripeUrl) return res.status(500).json({ message: "Stripe not configured" });
      res.json({ url: stripeUrl });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Verify Stripe session and update quote status (webhook-free fallback)
  app.post("/api/quotes/:id/verify-payment", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { session_id } = z.object({ session_id: z.string() }).parse(req.body);

      if (!stripe) return res.status(500).json({ message: "Stripe not configured" });

      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Payment not completed" });
      }

      const { type } = session.metadata || {};
      if (!type) return res.status(400).json({ message: "Missing payment type" });

      const amountPaid = ((session.amount_total ?? 0) / 100).toFixed(2);

      // Check if webhook already processed this payment (to avoid double email)
      const existingQuote = await storage.getQuote(id);
      const alreadyProcessedByWebhook =
        type === "deposit" ? !!existingQuote?.depositPaidAt : !!existingQuote?.finalPaidAt;

      const quote = await storage.updateQuotePayment(id, type as "deposit" | "final", amountPaid);

      if (!quote || !quote.customer) return res.status(200).json({ status: "ok" });

      if (!alreadyProcessedByWebhook) {
        if (type === "deposit") {
          await sendEmail({
            to: quote.customer.email,
            subject: `[${quote.referenceNo}] Deposit Received — Slot Confirmed!`,
            html: depositReceivedEmail(quote),
          });
          console.log(`Payment verified (no-webhook): deposit paid for ${quote.referenceNo}`);
        }

        if (type === "final") {
          await sendEmail({
            to: quote.customer.email,
            subject: `[${quote.referenceNo}] Payment Received — Case Closed`,
            html: caseClosedEmail(quote),
          });
          console.log(`Payment verified (no-webhook): final paid for ${quote.referenceNo}`);
        }
      } else {
        console.log(`Payment verify: webhook already processed ${type} for ${quote.referenceNo} — skipping email`);
      }

      res.json({ status: "ok", quote });
    } catch (err: any) {
      console.error("Payment verification error:", err);
      res.status(400).json({ message: err.message || "Verification failed" });
    }
  });

  // Customer requests booking slot
  app.post("/api/quotes/:id/booking-request", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { scheduledAt, timeWindow } = z.object({
        scheduledAt: z.string(),
        timeWindow: z.string()
      }).parse(req.body);

      const existingQuote = await storage.getQuote(id);
      if (!existingQuote) return res.status(404).json({ message: "Quote not found" });

      // Only allow if deposit is paid and no pending/confirmed booking
      if (!['deposit_paid', 'booking_requested'].includes(existingQuote.status)) {
        return res.status(400).json({ message: "Booking can only be requested after deposit is paid" });
      }

      // Block second request if already pending
      if (existingQuote.status === 'booking_requested') {
        return res.status(400).json({ message: "A booking request is already pending admin confirmation" });
      }

      const quote = await storage.requestBooking(id, new Date(scheduledAt), timeWindow);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // Notify admin
      const adminEmailHtml = bookingRequestAdminEmail(quote);
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[${quote.referenceNo}] New Booking Request — ${quote.customer?.name}`,
        html: adminEmailHtml,
      });

      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Admin confirms booking
  app.post("/api/quotes/:id/booking-confirm", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quote = await storage.confirmBooking(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // Send booking confirmation email to customer
      if (quote.customer) {
        const emailHtml = bookingConfirmationEmail(quote);
        await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Booking Confirmed ✅ — TMG Install`,
          html: emailHtml,
        });
      }

      res.json(quote);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Customer reschedules booking
  app.post("/api/quotes/:id/booking-reschedule", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { scheduledAt, timeWindow } = z.object({
        scheduledAt: z.string(),
        timeWindow: z.string()
      }).parse(req.body);

      const existingQuote = await storage.getQuote(id);
      if (!existingQuote) return res.status(404).json({ message: "Quote not found" });

      // Must be booked (confirmed) to reschedule
      if (!['booked'].includes(existingQuote.status)) {
        return res.status(400).json({ message: "Can only reschedule a confirmed booking" });
      }

      // Check reschedule count
      if ((existingQuote.rescheduledCount || 0) >= 1) {
        return res.status(400).json({ message: "Free reschedule already used. Please contact us on WhatsApp." });
      }

      // Check 48hr cutoff (per Terms of Service)
      if (existingQuote.scheduledAt) {
        const hoursDiff = (new Date(existingQuote.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursDiff < 48) {
          return res.status(400).json({ message: "Reschedule requests must be made at least 48 hours before your appointment. A S$30 fee applies for late rescheduling — please contact us on WhatsApp." });
        }
      }

      const quote = await storage.rescheduleBooking(id, new Date(scheduledAt), timeWindow);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // Send reschedule confirmation to customer
      if (quote.customer) {
        const emailHtml = rescheduleConfirmationEmail(quote);
        await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Reschedule Request Received`,
          html: emailHtml,
        });
      }

      // Notify admin
      const adminEmailHtml = bookingRequestAdminEmail(quote);
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[${quote.referenceNo}] Reschedule Request — ${quote.customer?.name}`,
        html: adminEmailHtml,
      });

      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Legacy booking update (kept for backward compatibility)
  app.patch(api.quotes.updateBooking.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.quotes.updateBooking.input.parse(req.body);
      const quote = await storage.requestBooking(id, new Date(input.scheduledAt), input.timeWindow);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json(quote);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Staff: Arrived check-in (GPS + photos)
  app.post("/api/quotes/:id/arrived", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { gpsLat, gpsLng, photoUrls, note } = z.object({
        gpsLat: z.number(),
        gpsLng: z.number(),
        photoUrls: z.array(z.string()).min(1, "At least one photo is required"),
        note: z.string().optional()
      }).parse(req.body);

      const quote = await storage.updateQuoteStatus(id, 'in_progress', {
        actorType: 'staff',
        note: note || 'Staff arrived at location',
        photoUrl: JSON.stringify(photoUrls),
        gpsLat: gpsLat.toString(),
        gpsLng: gpsLng.toString()
      });

      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Staff: Completed check-out (GPS + photos)
  app.post("/api/quotes/:id/completed-checkout", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { gpsLat, gpsLng, photoUrls, note } = z.object({
        gpsLat: z.number(),
        gpsLng: z.number(),
        photoUrls: z.array(z.string()).min(1, "At least one completion photo is required"),
        note: z.string().optional()
      }).parse(req.body);

      const quote = await storage.updateQuoteStatus(id, 'completed', {
        actorType: 'staff',
        note: note || 'Job completed',
        photoUrl: JSON.stringify(photoUrls),
        gpsLat: gpsLat.toString(),
        gpsLng: gpsLng.toString()
      });

      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Admin: Edit quote before deposit
  app.patch("/api/quotes/:id/edit", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getQuote(id);
      if (!existing) return res.status(404).json({ message: "Quote not found" });

      // Only allow editing before deposit is paid
      const editableStatuses = ['submitted', 'under_review', 'approved', 'deposit_requested'];
      if (!editableStatuses.includes(existing.status)) {
        return res.status(400).json({ message: "Quote can only be edited before deposit is paid" });
      }

      const { customerUpdates, quoteUpdates, items } = z.object({
        customerUpdates: z.object({
          name: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          companyName: z.string().optional(),
        }).optional(),
        quoteUpdates: z.object({
          serviceAddress: z.string().optional(),
          pickupAddress: z.string().optional(),
          dropoffAddress: z.string().optional(),
          transportFee: z.string().optional(),
          selectedServices: z.string().optional(),
          notes: z.string().optional(),
        }).optional(),
        items: z.array(z.object({
          catalogItemId: z.number().optional(),
          originalDescription: z.string(),
          detectedName: z.string().optional(),
          serviceType: z.string(),
          quantity: z.number().min(1),
          unitPrice: z.string(),
          subtotal: z.string(),
        })).optional(),
      }).parse(req.body);

      const updated = await storage.editQuote(id, { customerUpdates, quoteUpdates, items });
      if (!updated) return res.status(404).json({ message: "Quote not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Admin: Request final payment
  app.post("/api/quotes/:id/request-final-payment", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quote = await storage.getQuote(id);
      
      if (!quote || !quote.customer) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const finalAmount = parseFloat(quote.finalAmount || "0") || parseFloat(quote.total);
      const quotePageUrl = `${APP_URL}/quotes/${quote.id}`;
      const stripeUrl = await createStripePaymentLink(
        `Final Payment for ${quote.referenceNo} — TMG Install`,
        finalAmount,
        { quoteId: String(quote.id), type: "final", referenceNo: quote.referenceNo },
        quotePageUrl
      );
      const paymentLink = stripeUrl || quotePageUrl;
      
      const emailHtml = finalPaymentEmail(quote, paymentLink);
      const emailSent = await sendEmail({
        to: quote.customer.email,
        subject: `[${quote.referenceNo}] Final Payment Due — TMG Install`,
        html: emailHtml,
      });

      const updated = await storage.updateQuoteStatus(id, "final_payment_requested", {
        actorType: "admin",
        note: "Final payment request sent to customer"
      });

      res.json({ success: emailSent, quote: updated });
    } catch (err) {
      console.error("Error requesting final payment:", err);
      res.status(500).json({ message: "Failed to request final payment" });
    }
  });

  // Admin: Manual close
  app.post("/api/quotes/:id/close", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
      const quote = await storage.updateQuoteStatus(id, 'closed', {
        actorType: 'admin',
        note: reason || 'Case manually closed by admin'
      });
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json(quote);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // AI photo item detection — furniture-only, confidence-filtered
  app.post("/api/catalog/detect-items", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;
      if (!imageBase64) return res.status(400).json({ message: "Image required" });

      // Fetch unique catalog names organised by category for better GPT matching
      const allItems = await storage.getCatalogItems();
      const byCategory: Record<string, string[]> = {};
      allItems.forEach(item => {
        const cat = item.category || "General";
        if (!byCategory[cat]) byCategory[cat] = [];
        const n = item.name;
        if (!byCategory[cat].includes(n)) byCategory[cat].push(n);
      });
      const catalogList = Object.entries(byCategory)
        .map(([cat, names]) => `${cat}: ${names.join(" | ")}`)
        .join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a professional furniture identification assistant for TMG Install, a Singapore furniture installation and relocation company.

Your ONLY task is to identify pieces of FURNITURE and large FIXTURES visible in photos — specifically items that typically require professional installation, dismantling, assembly, or relocation.

ALWAYS INCLUDE these furniture categories:
- Beds and bed frames (single, super single, double, queen, king, bunk bed, loft bed, hydraulic storage bed, murphy/wall bed, tatami platform bed)
- Wardrobes and clothes storage (sliding door, hinged door, walk-in, built-in, IKEA PAX, IKEA Hemnes, IKEA Kleppstad, etc.)
- Sofas and seating furniture (2-seater, 3-seater, L-shaped/corner sofa, recliner, chaise lounge, sofa bed, armchair, accent chair)
- Tables (dining table, coffee table, side table, console/hallway table, office desk, L-shaped desk, conference table, sit-stand desk, extendable dining table)
- Chairs (dining chairs, office chairs, ergonomic chairs, bar stools — count each one individually)
- Storage furniture (bookshelf, display cabinet, shoe cabinet, shoe rack, tall shoe cabinet, drawer chest, filing cabinet, sideboard, buffet cabinet, china cabinet)
- Gym equipment (treadmill, elliptical machine, rowing machine, exercise bike, spin bike, power rack, weight bench, dumbbell rack, multi-station gym)
- Large kitchen appliances ONLY when they require moving (refrigerator, washing machine, dryer, dishwasher)
- Kids furniture (bunk bed, loft bed with desk, kids wardrobe, baby crib, toy storage unit, kids study desk with hutch)
- IKEA furniture — identify model if visible (PAX, KALLAX, BILLY, MALM, HEMNES, BESTA, MICKE, LACK, ALEX, POÄNG, KIVIK, IVAR, TROFAST, STUVA, VITTSJO)
- Bathroom fixtures (mirror cabinet, mirror medicine cabinet, washroom mirror cabinet, bathroom vanity unit, over-toilet storage cabinet, bathroom shelving, towel rack — IKEA LILLÅNGEN, GODMORGON, HEMNES mirror cabinets)
- Wall-mounted items (floating shelf, wall cabinet, curtain track/rod, full-length mirror, TV wall mounting bracket)
- Office furniture: identify desk SHAPE carefully — if a desk has two surfaces forming an L or corner, it is an "L-Shaped Executive Desk" (NOT "Office Desk"); a straight single-surface desk is "Office Desk". Panel partitions surrounding workstations are "Office Panel / Partition". Locker unit, reception counter, credenza, monitor arm, conference table, sit-stand height-adjustable desk.
- Outdoor furniture (garden/patio furniture set, outdoor bench)
- Meeting pods and phone booths
- Specialty items (dressing table, bedside table, bar cabinet, entertainment feature wall unit)

STRICTLY DO NOT LIST any of the following — return nothing for these:
- Televisions, monitors, screens, projectors, or any consumer electronics
- Computers, laptops, tablets, phones, printers, routers, or IT equipment
- Decorative items: picture frames, artwork, vases, figurines, candles, ornaments
- Plants, flowers, trees, or any living or artificial plants
- Small household items: cushions, pillows, blankets, lamps, clocks, books, magazines, boxes, bags, luggage
- Kitchen small appliances: microwave, kettle, toaster, blender, rice cooker, coffee machine, pots, pans, utensils
- Curtains, drapes, rugs, carpets, or textiles (curtain RODS/TRACKS are OK to include)
- People, animals, pets, or any living creatures
- Walls, floors, ceilings, doors, windows, stairs, railings, or architectural surfaces
- Food, beverages, bottles, or consumables
- Mattresses, bedding, pillows, or linen (only the BED FRAME itself, not the mattress on top)
- Lighting fixtures (ceiling lights, floor lamps, table lamps — unless it's a structural lamp that requires installation)

COUNTING RULES:
- Count individual chairs separately: 4 dining chairs around a table → quantity: 4
- For a matching set of identical items, estimate total quantity visible
- Large multi-piece items (L-shaped sofa, king bed) = quantity: 1 even if they have multiple sections
- OFFICE WORKSTATIONS: each workstation = 1 desk. Count them by the number of individual work areas/seats, not by panel count. If the desk surface is L-shaped or corner-shaped, use "L-Shaped Executive Desk". Count surrounding partition panels SEPARATELY as "Office Panel / Partition" — a typical workstation has 3–6 panels around it.
- If quantity is unclear, default to 1

CONFIDENCE RULES — include the confidence field:
- "high": item is clearly visible, easily identifiable as furniture
- "medium": item is partially visible or slightly ambiguous but likely furniture
- Do NOT include any item with low confidence or that you are guessing at
- Only list items you are genuinely confident are furniture requiring professional service

CATALOG MATCHING:
Map every detected item to the closest name from this catalog. Use the most specific match available.

CATALOG (organised by category):
${catalogList}

If an item is not in the catalog, use a concise descriptive name (e.g., "Piano", "Pool Table", "Foosball Table").

You MUST respond with ONLY valid JSON — no prose, no markdown, no explanation:
[{"name": "exact catalog name or description", "quantity": 1, "confidence": "high"}]`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Examine this image carefully.

List ONLY the furniture pieces, gym equipment, bathroom fixtures, or large fixtures that are clearly visible and would require professional installation, dismantling, assembly, or relocation service.

INCLUDE bathroom fixtures when visible: mirror cabinets, washroom mirror cabinets (IKEA LILLÅNGEN, GODMORGON, HEMNES), bathroom vanity units, over-toilet storage cabinets, bathroom shelving, and towel racks.

DO NOT list: TVs, monitors, electronics, plants, decorations, small items, people, walls, floors, mattresses, or bedding.

For each furniture item, map to the closest catalog name. Count chairs and identical repeated pieces individually.

IMPORTANT for OFFICE PHOTOS: Look at each desk carefully — if the desk surface wraps around into an L or corner shape, call it "L-Shaped Executive Desk". Count partition panels separately from the desks. Count each individual workstation seat as one desk unit.

Only include items with "high" or "medium" confidence. List up to 15 distinct furniture items.

Respond with ONLY a JSON array (no prose, no markdown):
[{"name": "catalog name or description", "quantity": 1, "confidence": "high"}]`
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" }
              }
            ]
          }
        ],
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content || "";
      console.log("[detect-items] raw GPT response:", content);

      let detected: { name: string; quantity: number }[] = [];
      if (content) {
        try {
          let cleaned = content.replace(/```(?:json)?\n?/g, "").replace(/\n?```/g, "").trim();
          const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
          if (arrayMatch) cleaned = arrayMatch[0];
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed)) {
            detected = parsed
              .filter((item: any) =>
                typeof item === "object" &&
                item !== null &&
                typeof item.name === "string" &&
                item.name.trim().length > 0 &&
                // Only keep high or medium confidence items — filter out low/unknown
                (item.confidence === "high" || item.confidence === "medium" || !item.confidence)
              )
              .map((item: any) => ({
                name: item.name.trim(),
                quantity: Math.max(1, Math.min(50, Number(item.quantity) || 1)),
              }));
          }
        } catch (parseErr) {
          console.error("[detect-items] JSON parse failed:", parseErr, "raw:", content);
          detected = [];
        }
      }

      console.log("[detect-items] detected items:", detected);
      res.json({ detected });
    } catch (err) {
      console.error("Photo detection error:", err);
      res.status(500).json({ message: "Failed to detect items from photo", detected: [] });
    }
  });

  // ── Route distance calculation (OneMap geocode → OSRM route) ──────────────
  app.post(api.distance.calculate.path, async (req, res) => {
    try {
      const { pickupAddress, dropoffAddress, pickupLat, pickupLng, dropoffLat, dropoffLng } =
        api.distance.calculate.input.parse(req.body);

      // Geocode address to lat/lng using OneMap (if not already provided)
      async function geocode(address: string, hint?: { lat?: number; lng?: number }) {
        if (hint?.lat && hint?.lng) return { lat: hint.lat, lng: hint.lng };
        const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(address)}&returnGeom=Y&getAddrDetails=N&pageNum=1`;
        const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = await r.json();
        const first = data?.results?.[0];
        if (!first) return null;
        return { lat: parseFloat(first.LATITUDE), lng: parseFloat(first.LONGITUDE) };
      }

      const [from, to] = await Promise.all([
        geocode(pickupAddress, { lat: pickupLat, lng: pickupLng }),
        geocode(dropoffAddress, { lat: dropoffLat, lng: dropoffLng }),
      ]);

      if (!from || !to) {
        return res.json({ distanceKm: 0, routeFound: false, error: "Could not geocode one or both addresses" });
      }

      // Route distance via OSRM (free, no API key, covers Singapore)
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
      const routeRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(8000) });
      const routeData = await routeRes.json();

      if (routeData.code !== "Ok" || !routeData.routes?.[0]) {
        return res.json({ distanceKm: 0, routeFound: false, error: "Route calculation failed" });
      }

      const distanceKm = Math.round((routeData.routes[0].distance / 1000) * 10) / 10;
      return res.json({ distanceKm, routeFound: true });
    } catch (err: any) {
      console.error("Distance calculation error:", err);
      return res.json({ distanceKm: 0, routeFound: false, error: "Distance service unavailable" });
    }
  });

  // ── Wizard-based quote creation ────────────────────────────────────────────
  app.post(api.quotes.wizard.path, async (req, res) => {
    try {
      const input = api.quotes.wizard.input.parse(req.body);

      // Validate slot if provided
      if (input.preferredDate && input.preferredTimeWindow) {
        const available = await storage.isSlotAvailable(input.preferredDate, input.preferredTimeWindow);
        if (!available) {
          return res.status(409).json({
            message: "That time slot was just taken by another customer. Please choose a different slot.",
            field: "preferredTimeWindow",
          });
        }
      }

      // Labor subtotal from item prices
      const laborSubtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const discount = input.discount || 0;
      const logisticsFee = input.logisticsFee || 0;
      const rawTotal = laborSubtotal - discount + logisticsFee;

      // ── Minimum charge: SGD 180 ──────────────────────────────────────────────
      const MIN_CHARGE = 180;
      const minAdjustment = rawTotal < MIN_CHARGE ? MIN_CHARGE - rawTotal : 0;
      const grandTotal = rawTotal + minAdjustment;
      // ────────────────────────────────────────────────────────────────────────

      const depositAmount = (grandTotal * 0.50).toFixed(2);
      const finalAmount = (grandTotal * 0.50).toFixed(2);
      const referenceNo = `TMG-${Date.now().toString(36).toUpperCase()}`;

      // Hold expiry: 48 hours from submission
      const slotHeldUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const allItems = [
        ...input.items.map(item => ({
          catalogItemId: item.catalogItemId,
          originalDescription: item.itemName,
          detectedName: item.itemName,
          serviceType: item.serviceType,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          subtotal: (item.unitPrice * item.quantity).toFixed(2),
        })),
        ...(input.customItems || []).map(item => ({
          catalogItemId: undefined as number | undefined,
          originalDescription: item.description,
          detectedName: item.description,
          serviceType: item.serviceType,
          quantity: item.quantity,
          unitPrice: "0",
          subtotal: "0",
        })),
        // Minimum charge adjustment — only added when job total is below SGD 180
        ...(minAdjustment > 0 ? [{
          catalogItemId: undefined as number | undefined,
          originalDescription: "Minimum Charge Adjustment",
          detectedName: "Minimum Charge Adjustment",
          serviceType: "adjustment",
          quantity: 1,
          unitPrice: minAdjustment.toFixed(2),
          subtotal: minAdjustment.toFixed(2),
        }] : []),
      ];

      const quote = await storage.createQuote(
        input.customer,
        {
          referenceNo,
          serviceAddress: input.serviceAddress,
          pickupAddress: input.pickupAddress,
          dropoffAddress: input.dropoffAddress,
          accessDifficulty: input.accessDifficulty,
          floorsInfo: input.floorsInfo,
          selectedServices: JSON.stringify(input.selectedServices),
          subtotal: laborSubtotal.toFixed(2),
          discount: discount.toFixed(2),
          transportFee: logisticsFee.toFixed(2),
          total: grandTotal.toFixed(2),
          depositAmount,
          finalAmount,
          status: "submitted",
          requiresManualReview: false,
          aiConfidenceScore: 100,
          distanceKm: input.distanceKm != null ? input.distanceKm.toFixed(1) : null,
          detectionPhotoUrl: input.detectedPhotoUrl || null,
          // Slot chosen in wizard
          preferredDate: input.preferredDate || null,
          preferredTimeWindow: input.preferredTimeWindow || null,
          slotHeldUntil: (input.preferredDate && input.preferredTimeWindow) ? slotHeldUntil : null,
          bookingRequestedAt: (input.preferredDate && input.preferredTimeWindow) ? new Date() : null,
        },
        allItems
      );

      // Alert admin on new estimate submission
      try {
        const alertHtml = newEstimateAdminAlert(quote);
        await sendEmail({
          to: ADMIN_EMAIL,
          subject: `🔔 New Estimate Request — ${quote.referenceNo} from ${quote.customer?.name}`,
          html: alertHtml,
        });
      } catch (alertErr) {
        console.error("Admin alert email error:", alertErr);
      }

      // Send customer confirmation email
      try {
        if (quote.customer?.email) {
          await sendEmail({
            to: quote.customer.email,
            subject: `Estimate Received — ${quote.referenceNo} | TMG Install`,
            html: estimateSubmittedEmail(quote),
          });
        }
      } catch (custEmailErr) {
        console.error("Customer estimate confirmation email error:", custEmailErr);
      }

      res.status(201).json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Wizard quote error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── WhatsApp Webhook Verification (GET) ───────────────────────────────────
  app.get("/api/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("[WhatsApp] Webhook verified ✓");
      return res.status(200).send(challenge);
    }
    console.warn("[WhatsApp] Webhook verification failed — token mismatch");
    return res.status(403).json({ message: "Forbidden" });
  });

  // ── WhatsApp Incoming Message Handler (POST) ──────────────────────────────
  app.post("/api/webhooks/whatsapp", async (req, res) => {
    res.status(200).json({ status: "ok" }); // Always ack quickly

    try {
      const body = req.body;
      if (body.object !== "whatsapp_business_account") return;

      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      if (!value?.messages?.length) return;

      const msg = value.messages[0];
      const from: string = msg.from; // sender phone e.g. "6591234567"
      const msgType: string = msg.type || "text";
      const text: string = (msg.text?.body || "").trim();
      const textLower = text.toLowerCase();

      const session = await storage.getWhatsAppSession(from);
      const state = session?.state ?? "start";

      const isGreeting = ["restart", "start over", "new quote", "start"].includes(textLower) || textLower.startsWith("hi") || textLower.startsWith("hello") || textLower.startsWith("hey");

      // ── Smart resume: if user has an existing session, offer to continue ────
      if (isGreeting && session && (session.collectedName || session.collectedAddress)) {
        const isExplicitRestart = ["restart", "start over", "new quote"].includes(textLower);
        if (!isExplicitRestart && text.length < 15) {
          // Brief greeting with existing session — offer resume
          const progress = session.state.replace(/_/g, " ");
          await sendWhatsAppMessage(from,
            `👋 Welcome back, *${session.collectedName || "there"}*!\n\nYou have a quote in progress (${progress}). Would you like to:\n\n• Type *continue* — pick up where you left off\n• Type *restart* — start a new quote`
          );
          return;
        }
      }

      if (!session || isGreeting || textLower === "continue" && !session) {
        // ── One-shot intake: try to extract name + address from the greeting ──
        let extractedName: string | null = null;
        let extractedAddress: string | null = null;
        let extractedItems: string | null = null;

        if (text.length > 15 && !isGreeting) {
          try {
            const extractRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 300,
              response_format: { type: "json_object" },
              messages: [{
                role: "system",
                content: `A customer just sent their first WhatsApp message to TMG Install, a furniture installation company in Singapore.
Extract any details they provided. Return JSON:
{
  "name": string or null,
  "address": string or null,
  "items": string or null
}
- name: their personal name (not company name). Null if not clearly stated.
- address: full Singapore address/location. Null if not stated. Accept postal codes (S123456).
- items: formatted bullet list of furniture items mentioned (one • per line with service type in brackets if stated). Null if no furniture mentioned.

Message: "${text}"`
              }]
            });
            const extracted = JSON.parse(extractRes.choices[0]?.message?.content || "{}");
            extractedName = extracted.name || null;
            extractedAddress = extracted.address || null;
            extractedItems = extracted.items || null;
          } catch {}
        }

        // Determine where to start based on what we extracted
        const startState = extractedAddress && extractedName && extractedItems
          ? "awaiting_items_verify"
          : extractedAddress && extractedName
            ? "awaiting_items"
            : extractedAddress
              ? "awaiting_name"  // unusual but possible
              : extractedName
                ? "awaiting_address"
                : "awaiting_name";

        await storage.upsertWhatsAppSession(from, {
          state: startState,
          collectedName: extractedName,
          collectedAddress: extractedAddress,
          collectedItems: extractedItems,
          previousItems: null,
          preferredDate: null,
        });

        if (extractedName && extractedAddress && extractedItems) {
          await sendWhatsAppMessage(from,
            `👋 Hi *${extractedName}*! Got it — let me confirm what you've told me:\n\n` +
            `📍 *Address:* ${extractedAddress}\n` +
            `🛋️ *Items:*\n${extractedItems}\n\n` +
            `Does this look right?\n• Reply *YES* to proceed\n• Tell me what to correct\n• Send a photo to add more items`
          );
        } else if (extractedAddress && extractedName) {
          await sendWhatsAppMessage(from,
            `👋 Hi *${extractedName}*! I've noted your address: *${extractedAddress}*.\n\n` +
            `What furniture do you need help with?\n\n📸 *Send a photo* and I'll identify everything, or *type the list* below.\n\n` +
            `_e.g. 1 queen bed frame (install), 3-door wardrobe (dismantle)_`
          );
        } else if (extractedName) {
          await sendWhatsAppMessage(from,
            `👋 Hi *${extractedName}*! Welcome to *TMG Install*.\n\n📍 What's the *job address*? That's where we'll be doing the work.\n\n_e.g. Blk 261 Serangoon Central #05-01, S550261_`
          );
        } else {
          await sendWhatsAppMessage(from,
            `👋 Hi! Welcome to *TMG Install* — professional furniture *installation, dismantling & relocation* all across Singapore. 🛋️\n\nI'll get you a quote in just a few steps. What's your *full name*? 😊`
          );
        }
        return;
      }

      if (textLower === "continue" && session) {
        const stateLabel: Record<string, string> = {
          awaiting_name: "we still need your name",
          awaiting_address: "we still need your job address",
          awaiting_items: "we still need the furniture list",
          awaiting_items_verify: "please confirm the furniture list",
          awaiting_date: "when would you like this done?",
          awaiting_confirmation: "please confirm your full request",
        };
        let continueMsg = `Welcome back! 😊 Here's where we are:\n\n`;
        if (session.collectedName) continueMsg += `👤 *Name:* ${session.collectedName}\n`;
        if (session.collectedAddress) continueMsg += `📍 *Address:* ${session.collectedAddress}\n`;
        if (session.collectedItems && session.collectedItems !== "__scanning__") continueMsg += `🛋️ *Items:*\n${session.collectedItems}\n`;
        if (session.preferredDate) continueMsg += `📅 *Date:* ${session.preferredDate}\n`;
        continueMsg += `\n_Next step: ${stateLabel[session.state] || "let's continue"}_`;
        await sendWhatsAppMessage(from, continueMsg);
        return;
      }

      // ── Global correction & help commands (GPT-powered, work from any state) ──
      // Only intercept if the user has at least provided their name (session in progress)
      // and the message looks like a command rather than a direct answer to the current question
      const mightBeGlobalCmd = session?.collectedName && text.length > 2 && !["awaiting_name"].includes(state);
      if (mightBeGlobalCmd && !["yes", "no", "ok", "confirm", "anytime", "restart", "start over", "continue"].includes(textLower)) {
        try {
          const globalRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 100,
            response_format: { type: "json_object" },
            messages: [{
              role: "system",
              content: `You are a WhatsApp bot for TMG Install. The customer is mid-flow in a furniture quote.
Current state: ${state}
Current data: Name="${session.collectedName || ""}", Address="${session.collectedAddress || ""}", Items="${session.collectedItems || ""}"

Customer said: "${text}"

Is this message a GLOBAL COMMAND (a request to change name/address/items/date, or ask for help/pricing)?
Or is it a NORMAL REPLY to the current question (not a command)?

Return JSON: { "isCommand": boolean, "command": "change_name"|"change_address"|"change_items"|"change_date"|"help"|"pricing"|"none" }
- isCommand: true ONLY if clearly asking to change something or asking for help/pricing info
- command: which command it is (or "none" if isCommand is false)

Do NOT classify as command if the message is answering the current state question (e.g. providing an address when state=awaiting_address, providing items when state=awaiting_items, giving a date when state=awaiting_date).`
            }]
          });
          const gc = JSON.parse(globalRes.choices[0]?.message?.content || "{}");
          if (gc.isCommand && gc.command && gc.command !== "none") {
            if (gc.command === "change_name") {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_name" });
              await sendWhatsAppMessage(from, `Sure! What's the correct name? 😊`);
              return;
            } else if (gc.command === "change_address" && !["awaiting_address"].includes(state)) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_address" });
              await sendWhatsAppMessage(from, `No problem! What's the correct job address? 📍`);
              return;
            } else if (gc.command === "change_items" && !["awaiting_items"].includes(state)) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedItems: null, previousItems: session.collectedItems });
              await sendWhatsAppMessage(from, `Sure! What items do you need help with?\n\n📸 *Send a photo* or *type the list* below.\n\n_e.g._\n• 1 king bed frame (install)\n• 3-door wardrobe (dismantle)`);
              return;
            } else if (gc.command === "change_date" && !["awaiting_date"].includes(state)) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_date" });
              await sendWhatsAppMessage(from, `📅 When would you prefer to have this done?\n\n_e.g. This Saturday, next week, 20 April 2026, or reply *anytime* if flexible._`);
              return;
            } else if (gc.command === "help") {
              const hasAddress = !!session?.collectedAddress;
              const hasItems = !!(session?.collectedItems && session.collectedItems !== "__scanning__");
              let helpMsg = `Here's what you can do at any time:\n\n`;
              helpMsg += `• Type *change name* — update your name\n`;
              if (hasAddress) helpMsg += `• Type *change address* — fix the job address\n`;
              if (hasItems) helpMsg += `• Type *change items* — update the furniture list\n`;
              helpMsg += `• Type *change date* — update your preferred date\n`;
              helpMsg += `• Type *hi* or *start over* — restart from the beginning\n\n`;
              helpMsg += `_Currently: ${state.replace(/_/g, " ")}_`;
              await sendWhatsAppMessage(from, helpMsg);
              return;
            } else if (gc.command === "pricing") {
              await sendWhatsAppMessage(from,
                `*TMG Install* offers these services across Singapore:\n\n` +
                `🔧 *Installation* — assembly of new furniture (IKEA, flat-pack, etc.)\n` +
                `🔨 *Dismantling* — safe disassembly of existing furniture\n` +
                `🚚 *Relocation* — moving furniture within or between locations\n\n` +
                `Pricing is based on the items and service type. Minimum charge is *S$180*.\n\n` +
                `Complete your quote and our team will confirm the exact price! 😊`
              );
              return;
            }
          }
        } catch {
          // GPT check failed — fall through to keyword-based fallback
        }
      }

      // ── Keyword-based fallback commands ──────────────────────────────────────
      if (textLower.startsWith("help") && session?.collectedName) {
        const helpMsg =
          `Here's what you can do at any time:\n\n` +
          `• *change name* — update your name\n` +
          `• *change address* — fix the job address\n` +
          `• *change items* — update the furniture list\n` +
          `• *change date* — update your preferred date\n` +
          `• *hi* or *start over* — restart from the beginning`;
        await sendWhatsAppMessage(from, helpMsg);
        return;
      }

      if (state === "awaiting_name") {
        if (text.length < 2) {
          await sendWhatsAppMessage(from, `What's your *full name*? I just need something to address you by. 😊`);
          return;
        }
        // Use GPT to extract the actual name from natural language
        let extractedName = text;
        try {
          const nameRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 60,
            response_format: { type: "json_object" },
            messages: [{
              role: "system",
              content: `The customer was asked for their name. Extract their personal name from their message.
Return JSON: { "name": string or null, "address": string or null }
- name: their first name or full name only. Null if no name can be identified.
- address: if they also mentioned a Singapore address in the same message, extract it. Otherwise null.
Message: "${text}"`
            }]
          });
          const parsed = JSON.parse(nameRes.choices[0]?.message?.content || "{}");
          if (parsed.name) extractedName = parsed.name;
          // Bonus: if they also gave their address, save it too
          if (parsed.address) {
            await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedName: extractedName, collectedAddress: parsed.address });
            await sendWhatsAppMessage(from,
              `Nice to meet you, *${extractedName}*! 😊 I've also noted your address: *${parsed.address}*.\n\nNow, what furniture do you need help with?\n\n📸 *Send a photo* and I'll identify the items — or just *type the list* below.`
            );
            return;
          }
        } catch {}

        const alreadyHasAddress = !!session?.collectedAddress;
        const alreadyHasItemsToo = !!(session?.collectedItems && session.collectedItems !== "__scanning__");
        await storage.upsertWhatsAppSession(from, { collectedName: extractedName });

        if (alreadyHasItemsToo) {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_confirmation" });
          await sendWhatsAppMessage(from,
            `✅ Got it, *${extractedName}*! Here's your updated summary:\n\n` +
            `👤 *Name:* ${extractedName}\n` +
            `📍 *Address:* ${session!.collectedAddress}\n` +
            `🛋️ *Items:*\n${session!.collectedItems}\n\n` +
            `Ready to submit? Reply *YES* to send to our team.`
          );
        } else if (alreadyHasAddress) {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_items" });
          await sendWhatsAppMessage(from,
            `Got it, *${extractedName}*! 👍\n\nWhat furniture do you need help with?\n\n📸 *Send a photo* and I'll detect the items, or *type the list* below.`
          );
        } else {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_address" });
          await sendWhatsAppMessage(from,
            `Nice to meet you, *${extractedName}*! 😊\n\n📍 What's the *job address*? This is where we'll be doing the work.\n\n_e.g. Blk 261 Serangoon Central #05-01, S550261_`
          );
        }
        return;
      }

      if (state === "awaiting_address") {
        if (text.length < 4) {
          await sendWhatsAppMessage(from, `Could you give me the *full address*? Include the block/unit number if applicable. 📍`);
          return;
        }
        // Use GPT to extract and clean the Singapore address
        let extractedAddress = text;
        try {
          const addrRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 100,
            response_format: { type: "json_object" },
            messages: [{
              role: "system",
              content: `The customer was asked for their Singapore job address. Extract and clean the address from their message.
Return JSON: { "address": string or null, "valid": boolean }
- address: cleaned Singapore address (include block, street, unit, postal if given). Null if no address found.
- valid: true if it looks like a real Singapore location (has street/block/building name), false if too vague.
Message: "${text}"`
            }]
          });
          const parsed = JSON.parse(addrRes.choices[0]?.message?.content || "{}");
          if (parsed.address) extractedAddress = parsed.address;
          if (parsed.valid === false) {
            await sendWhatsAppMessage(from,
              `Hmm, I need a bit more detail for the address. Could you include the *block number, street name*, or *postal code*? 📍\n\n_e.g. Blk 261 Serangoon Central #05-01, S550261_`
            );
            return;
          }
        } catch {}

        const alreadyHasItems = session?.collectedItems && session.collectedItems !== "__scanning__";
        if (alreadyHasItems) {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_confirmation", collectedAddress: extractedAddress });
          await sendWhatsAppMessage(from,
            `✅ Address updated to *${extractedAddress}*! Here's your revised summary:\n\n` +
            `👤 *Name:* ${session.collectedName}\n` +
            `📍 *Address:* ${extractedAddress}\n` +
            `🛋️ *Items:*\n${session.collectedItems}\n\n` +
            `Shall I send this to our team? Reply *YES* to submit.`
          );
        } else {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedAddress: extractedAddress });
          await sendWhatsAppMessage(from,
            `Got it! 📍 *${extractedAddress}*\n\nNow, what furniture do you need help with?\n\n📸 *Send a photo* and I'll identify the items automatically — or *type the list* below.\n\nMention if it's for *installation, dismantling, or relocation* too!\n\n_e.g._\n• 1 king bed frame (install)\n• 3-door PAX wardrobe (dismantle)\n• L-shaped sofa (relocate)`
          );
        }
        return;
      }

      if (state === "awaiting_items") {
        const name = session.collectedName!;
        const address = session.collectedAddress!;

        // ── Image sent: analyze with OpenAI Vision ────────────────────────
        if (msgType === "image" && msg.image?.id) {
          // ── Step 1: Atomic claim — only the FIRST webhook handler wins ────────
          // All 4 photos in an album arrive simultaneously. claimPhotoScan does a
          // single-row UPDATE WHERE state='awaiting_items'. PostgreSQL guarantees
          // only one concurrent caller can succeed. Losers call appendPhotoToScanQueue
          // (raw SQL concat — no read-then-write) and return silently.
          const isPrimaryScanner = await storage.claimPhotoScan(from, msg.image.id);
          if (!isPrimaryScanner) {
            // Not first — atomically append our ID to the queue and exit
            await storage.appendPhotoToScanQueue(from, msg.image.id);
            return;
          }

          // Send ONE acknowledgment — no matter how many photos follow
          await sendWhatsAppMessage(from, `Got it! Give me a moment to scan your photo(s)... 🔍`);

          // ── Step 2: Wait 5 s so all concurrently-sent photos can append ───────
          await new Promise(resolve => setTimeout(resolve, 5000));

          // ── Step 3: Re-read session to collect ALL photo IDs ─────────────────
          const latestSession = await storage.getWhatsAppSession(from);
          const queueStr = latestSession?.collectedItems ?? `__scanning__:${msg.image.id}`;
          const allIds = queueStr.startsWith("__scanning__:")
            ? [...new Set(queueStr.slice("__scanning__:".length).split(",").filter(Boolean))]
            : [msg.image.id];

          // ── Helper: scan one media ID ─────────────────────────────────────────
          async function scanPhoto(mediaId: string): Promise<string | null> {
            const media = await downloadWhatsAppMedia(mediaId);
            if (!media) return null;
            const visionRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 800,
              messages: [
                {
                  role: "system",
                  content: `You are an expert furniture identification assistant for TMG Install, a professional furniture installation company in Singapore.

Your task: Carefully examine the photo and list ALL furniture items that require professional installation, assembly, dismantling, or relocation.

Rules:
- COUNT each piece individually (e.g. if you see 4 chairs, write "4 dining chairs")
- Identify the TYPE precisely: bed frame (specify size if visible), wardrobe (number of doors), sofa (number of seats), desk (L-shaped or straight), etc.
- Identify BRAND/MODEL if visible (IKEA PAX, IKEA MALM, etc.)
- Include ALL visible furniture — don't skip anything
- DO NOT include TVs, electronics, decorative items, or small accessories
- Format: one bullet per line starting with quantity then item name, e.g. "• 1 queen bed frame"

If no installable furniture is visible, respond only with: NO_FURNITURE`,
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Identify all furniture items in this photo that need professional installation, assembly, dismantling, or relocation." },
                    { type: "image_url", image_url: { url: `data:${media.mimeType};base64,${media.base64}`, detail: "high" } },
                  ] as any,
                },
              ],
            });
            const raw = (visionRes.choices[0]?.message?.content || "").trim();
            return (!raw || raw.includes("NO_FURNITURE")) ? null : raw;
          }

          // ── Step 4: Scan ALL queued photos in parallel ────────────────────────
          try {
            const results = await Promise.all(allIds.map(id => scanPhoto(id).catch(() => null)));
            const validResults = results.filter((r): r is string => !!r);

            if (validResults.length === 0) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedItems: null });
              await sendWhatsAppMessage(from,
                `Hmm, I couldn't spot any furniture in ${allIds.length > 1 ? "those photos" : "that photo"}. No worries — just *type out the items* you need help with, like:\n• 1 king bed frame\n• 3-door wardrobe\n• Dining table + 4 chairs`
              );
              return;
            }

            // Merge all results, de-duplicate bullet lines
            const seenLines = new Set<string>();
            const mergedLines: string[] = [];
            for (const result of validResults) {
              for (const line of result.split("\n")) {
                const cleaned = line.trim();
                if (!cleaned) continue;
                const key = cleaned.toLowerCase().replace(/[•\-\*]\s*/, "").trim();
                if (!seenLines.has(key)) {
                  seenLines.add(key);
                  mergedLines.push(cleaned.startsWith("•") ? cleaned : `• ${cleaned}`);
                }
              }
            }
            const allDetected = mergedLines.join("\n");

            // ── Step 5: Save and send ONE combined summary ────────────────────
            await storage.upsertWhatsAppSession(from, { state: "awaiting_items_verify", collectedItems: allDetected });
            await sendWhatsAppMessage(from,
              `Here's what I found in your photo${allIds.length > 1 ? "s" : ""}:\n\n${allDetected}\n\n` +
              `Does this look right?\n` +
              `• Reply *YES* to proceed\n` +
              `• *Type a correction or addition* if anything's off\n` +
              `• Send *another photo* to add more items\n` +
              `• Reply *NO* to redo the list`
            );
            return;
          } catch (err) {
            console.error("[WhatsApp] Image analysis error:", err);
            await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedItems: null });
            await sendWhatsAppMessage(from,
              `Sorry, had a bit of trouble with that photo. Could you *type out the furniture items* instead? 🙏`
            );
            return;
          }
        }

        // ── Text input: use GPT to parse and format the item list ─────────
        if (text.length < 3) {
          await sendWhatsAppMessage(from,
            `What furniture do you need help with? 😊\n\n📸 *Send a photo* and I'll detect the items — or just *type the list* below.\n\n_e.g. 1 queen bed frame (install), 3-door wardrobe (dismantle)_`
          );
          return;
        }

        let formattedItems = text;
        try {
          const itemsRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 300,
            response_format: { type: "json_object" },
            messages: [{
              role: "system",
              content: `You are a quoting assistant for TMG Install, a furniture installation company in Singapore.
The customer is being asked what furniture items they need help with.

FIRST check: is this a general acknowledgment/done signal with NO actual furniture mentioned?
Examples of done signals: "ok that's all", "nothing else", "done", "that's it", "all good", "ok", "sure", "yeah", "yes", "no more", "nothing more"
If yes → return { "done": true, "items": null, "needsServiceType": false }

Otherwise, parse the furniture description and return JSON:
{ "done": false, "items": string, "needsServiceType": boolean }
- items: formatted bullet list (one • per line). Each line: "• [quantity] [item name] ([service type])"
  - If service type is mentioned (install/dismantle/relocate), include it in brackets
  - If not mentioned, leave out the brackets (don't guess)
  - Quantity if mentioned, otherwise just the item name
- needsServiceType: true if NO service type was mentioned at all

Customer message: "${text}"`
            }]
          });
          const parsed = JSON.parse(itemsRes.choices[0]?.message?.content || "{}");

          if (parsed.done) {
            await sendWhatsAppMessage(from,
              `What furniture items do you need help with? 😊\n\n` +
              `📸 *Send a photo* and I'll detect the items — or type the list below.\n\n` +
              `_e.g. 1 queen bed frame (install), 3-door wardrobe (dismantle)_`
            );
            return;
          }

          if (parsed.items) formattedItems = parsed.items;

          await storage.upsertWhatsAppSession(from, { state: "awaiting_items_verify", collectedItems: formattedItems });
          await sendWhatsAppMessage(from,
            `Got it! Here's what I have:\n\n${formattedItems}\n\n` +
            (parsed.needsServiceType
              ? `Is this for *installation, dismantling, or relocation*? You can type it or just reply *YES* if you're not sure and our team will confirm.\n\n`
              : ``) +
            `Does this look right?\n• Reply *YES* to proceed\n• *Type any corrections* if needed\n• Send a *photo* to add more items`
          );
        } catch {
          // Fallback
          await storage.upsertWhatsAppSession(from, { state: "awaiting_items_verify", collectedItems: formattedItems });
          await sendWhatsAppMessage(from,
            `Got it! Here's what I have:\n\n${formattedItems}\n\nDoes this look right?\n• Reply *YES* to proceed\n• *Type any corrections* if needed`
          );
        }
        return;
      }

      // ── Customer rechecks AI-detected items (from photo) ────────────────────
      if (state === "awaiting_items_verify") {
        const name = session.collectedName!;
        const address = session.collectedAddress!;
        const existingItems = session.collectedItems || "";

        // ── Additional photo sent: merge detections ───────────────────────
        if (msgType === "image" && msg.image?.id) {
          // ── Still scanning first batch: silently append to queue ─────────────
          // The primary scanner (3-second wait loop) will pick this up automatically
          if (existingItems.startsWith("__scanning__")) {
            // Use atomic SQL append — avoids the read-then-write race condition
            // that drops IDs when multiple photos arrive in the same millisecond
            await storage.appendPhotoToScanQueue(from, msg.image.id);
            // No message — the primary scanner will send ONE combined result
            return;
          }

          // ── Scanning complete: user sent an additional photo to add more ─────
          try {
            const media = await downloadWhatsAppMedia(msg.image.id);
            if (!media) throw new Error("Could not download image");

            await sendWhatsAppMessage(from, `Got your extra photo — scanning it now... 🔍`);

            const visionRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 800,
              messages: [
                {
                  role: "system",
                  content: `You are an expert furniture identification assistant for TMG Install, a professional furniture installation company in Singapore.
Identify ALL furniture items visible that need professional installation, assembly, or relocation.
Rules:
- COUNT each piece individually
- Identify type precisely (size, doors, shape)
- Identify BRAND/MODEL if visible
- DO NOT include TVs, electronics, decorative items
- Format: one bullet per line, e.g. "• 1 queen bed frame"
If no installable furniture visible, respond only with: NO_FURNITURE`,
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Identify all furniture items in this photo." },
                    { type: "image_url", image_url: { url: `data:${media.mimeType};base64,${media.base64}`, detail: "high" } },
                  ] as any,
                },
              ],
            });

            const newDetected = (visionRes.choices[0]?.message?.content || "").trim();

            if (!newDetected || newDetected.includes("NO_FURNITURE")) {
              await sendWhatsAppMessage(from,
                `Hmm, couldn't spot any furniture in that one. Here's what I have so far:\n\n${existingItems}\n\n• Reply *YES* to confirm\n• *Type corrections or additions* if needed\n• Send *another photo* to add more\n• Reply *NO* to redo the list`
              );
              return;
            }

            // Merge new results into existing list, deduplicate
            const seenLines = new Set<string>();
            const mergedLines: string[] = [];
            for (const line of [...existingItems.split("\n"), ...newDetected.split("\n")]) {
              const cleaned = line.trim();
              if (!cleaned) continue;
              const key = cleaned.toLowerCase().replace(/[•\-\*]\s*/, "").trim();
              if (!seenLines.has(key)) {
                seenLines.add(key);
                mergedLines.push(cleaned.startsWith("•") ? cleaned : `• ${cleaned}`);
              }
            }
            const mergedItems = mergedLines.join("\n");

            await storage.upsertWhatsAppSession(from, { collectedItems: mergedItems });
            await sendWhatsAppMessage(from,
              `Here's the updated list from all your photos:\n\n${mergedItems}\n\n` +
              `• Reply *YES* if this is complete\n` +
              `• *Type any corrections or additions*\n` +
              `• Send *another photo* to add more\n` +
              `• Reply *NO* to redo the list`
            );
            return;
          } catch (err) {
            console.error("[WhatsApp] Image merge error:", err);
            await sendWhatsAppMessage(from,
              `Oops, had trouble with that photo. Here's what I have so far:\n\n${existingItems}\n\nReply *YES* to confirm, or type any corrections.`
            );
            return;
          }
        }

        const detectedItems = existingItems && existingItems !== "__scanning__" ? existingItems : "";
        const previousItems = session.previousItems || "";

        // ── Quick exact-match shortcuts ───────────────────────────────────────
        if (textLower === "yes" || textLower === "ok" || textLower === "correct" || textLower === "looks good" || textLower === "confirm") {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_date", collectedItems: detectedItems });
          await sendWhatsAppMessage(from,
            `Great! One last question — 📅 *When would you like this done?*\n\n` +
            `_e.g. This Saturday, next week, 15 April 2026_\n\n` +
            `Reply *anytime* if you're flexible and our team will contact you to schedule.`
          );
          return;
        }

        if (text.length < 2) {
          await sendWhatsAppMessage(from,
            `Reply *YES* to confirm, or tell me what to fix. 😊`
          );
          return;
        }

        // ── AI-powered intent understanding ───────────────────────────────────
        // Use GPT to understand ANY natural language response from the user
        try {
          const intentRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 600,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `You are a WhatsApp assistant for TMG Install, a furniture installation company in Singapore.

The bot has just shown the customer a detected furniture list and asked them to confirm it.

Current detected list:
${detectedItems || "(empty)"}

${previousItems ? `Previous list (before customer said No/redo):\n${previousItems}` : ""}

The customer replied: "${text}"

Your job: understand what the customer wants and return a JSON response.

Return ONLY valid JSON with these fields:
{
  "action": "confirm" | "add" | "update" | "redo" | "unclear",
  "updatedList": "the complete updated bullet list as a string (• item per line), or empty string if action is redo/unclear",
  "reply": "your natural human reply in English (1-2 sentences max, friendly tone)"
}

Rules:
- "confirm": customer is happy, wants to proceed (yes, ok, correct, looks right, good, etc.)
- "add": customer wants to ADD items to the current list. Merge current + new items into updatedList
- "update": customer wants to CORRECT or REPLACE specific items. Provide the corrected updatedList
- "redo": customer wants to completely start fresh without specifying what (just "no", "redo", "wrong", etc.)
- "unclear": you genuinely cannot understand what they want

Smart parsing:
- "short of X" or "missing X" or "also need X" → add X to current list (action: add)
- "the first list is correct" or "the original was right" → use previousItems as base + any new items mentioned
- "wrong" / "not X" / "should be Y instead" → correct that item (action: update)
- "just X" or "only X" → replace the whole list with just X (action: update)
- If they reference "the first list" and previousItems exists, use previousItems as the starting point

For updatedList: always format as bullet points starting with "•", one item per line.
For reply: be natural and friendly, confirm what you did.`,
              },
            ],
          });

          const intent = JSON.parse(intentRes.choices[0]?.message?.content || "{}");
          const action = intent.action as string;
          const updatedList = (intent.updatedList as string || "").trim();
          const aiReply = (intent.reply as string || "").trim();

          if (action === "confirm") {
            await storage.upsertWhatsAppSession(from, { state: "awaiting_date", collectedItems: detectedItems });
            await sendWhatsAppMessage(from,
              `${aiReply ? aiReply + " " : ""}📅 *When would you like this done?*\n\n` +
              `_e.g. This Saturday, next week, 20 April 2026_\n\n` +
              `Reply *anytime* if you're flexible and our team will contact you to schedule.`
            );
            return;
          }

          if ((action === "add" || action === "update") && updatedList) {
            await storage.upsertWhatsAppSession(from, { collectedItems: updatedList });
            await sendWhatsAppMessage(from,
              `${aiReply} Here's the updated list:\n\n${updatedList}\n\n` +
              `• Reply *YES* to confirm\n` +
              `• Tell me if anything else needs changing\n` +
              `• Send a *photo* to add more items\n` +
              `• Reply *NO* to start fresh`
            );
            return;
          }

          if (action === "redo") {
            // Save current items as previousItems before clearing
            await storage.upsertWhatsAppSession(from, {
              state: "awaiting_items",
              collectedItems: null,
              previousItems: detectedItems || previousItems || null,
            });
            await sendWhatsAppMessage(from,
              `${aiReply || "No problem!"} Let's redo the list. *Type it out* or *send a new photo* 📸\n\n_e.g._\n• 1 king bed frame (install)\n• 3-door wardrobe (dismantle)`
            );
            return;
          }

          // unclear or parse error — give helpful nudge
          await sendWhatsAppMessage(from,
            `${aiReply || "Hmm, I'm not quite sure what you'd like to change!"} 😊\n\n` +
            `Here's the current list:\n\n${detectedItems}\n\n` +
            `• Reply *YES* to confirm this\n` +
            `• Tell me what to add or fix\n` +
            `• Reply *NO* to start fresh`
          );
          return;

        } catch (err) {
          console.error("[WhatsApp] Intent parse error:", err);
          // Fallback: treat as addition
          const fallback = detectedItems ? `${detectedItems}\n• ${text.replace(/^[•\-\*]\s*/, "")}` : text;
          await storage.upsertWhatsAppSession(from, { collectedItems: fallback });
          await sendWhatsAppMessage(from,
            `Got it! Here's the updated list:\n\n${fallback}\n\n• Reply *YES* to confirm\n• Tell me what else to change\n• Reply *NO* to start fresh`
          );
          return;
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // State: awaiting_date — collect preferred service date after items verified
      // ─────────────────────────────────────────────────────────────────────────
      if (state === "awaiting_date") {
        const name = session.collectedName!;
        const address = session.collectedAddress!;
        const items = session.collectedItems!;

        // Use GPT to understand the date preference (any format, flexible, ASAP, etc.)
        let preferredDate = text.trim();
        try {
          const dateRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 80,
            response_format: { type: "json_object" },
            messages: [{
              role: "system",
              content: `Today is ${new Date().toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.
The customer was asked when they'd like their furniture job done.
Parse their reply and return JSON: { "date": string, "flexible": boolean }
- date: a clean human-readable date string (e.g. "Saturday 28 March 2026", "Week of 20 April 2026", "Flexible — anytime")
- flexible: true if they said anytime/flexible/whenever/not sure
Customer said: "${text}"`
            }]
          });
          const dp = JSON.parse(dateRes.choices[0]?.message?.content || "{}");
          if (dp.date) preferredDate = dp.date;
        } catch {}

        await storage.upsertWhatsAppSession(from, { state: "awaiting_confirmation", preferredDate });

        // Build the confirmation summary
        await sendWhatsAppMessage(from,
          `Perfect! Here's a summary of your request:\n\n` +
          `👤 *Name:* ${name}\n` +
          `📍 *Address:* ${address}\n` +
          `🛋️ *Items:*\n${items}\n` +
          `📅 *Preferred date:* ${preferredDate}\n\n` +
          `Shall I send this to our team? Reply *YES* to submit.\n\n` +
          `_Need to fix anything? Type *change name*, *change address*, *change items*, or *change date*._`
        );
        return;
      }

      if (state === "awaiting_confirmation") {
        if (textLower === "cancel" || textLower === "nevermind" || textLower === "never mind" || textLower === "stop") {
          await storage.deleteWhatsAppSession(from);
          await sendWhatsAppMessage(from,
            `No worries at all! 😊 If you'd like to get a quote in the future, just send *hi* and I'll help you right away.`
          );
          return;
        }

        if (textLower === "no") {
          // Don't cancel — show correction options
          await sendWhatsAppMessage(from,
            `No problem! What would you like to change? 😊\n\n` +
            `• Type *change name* — update your name\n` +
            `• Type *change address* — fix the job address\n` +
            `• Type *change items* — update the furniture list\n` +
            `• Type *cancel* — to cancel this request`
          );
          return;
        }

        if (textLower !== "yes") {
          // Use GPT to understand what the customer wants at confirmation stage
          try {
            const confirmIntent = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 300,
              response_format: { type: "json_object" },
              messages: [{
                role: "system",
                content: `You are a WhatsApp assistant for TMG Install. The customer is at the final confirmation step.
Their current request:
- Name: ${session.collectedName}
- Address: ${session.collectedAddress}
- Items: ${session.collectedItems}

Customer said: "${text}"

Determine their intent and return JSON:
{
  "action": "submit" | "edit_items" | "change_name" | "change_address" | "change_date" | "redo_items" | "question" | "cancel" | "unclear",
  "reply": "your friendly 1-sentence confirmation of what you did/understood",
  "updatedItems": "complete updated bullet list ONLY for edit_items action"
}

- submit: they want to confirm/submit (yes, ok, send it, go ahead, confirm, all good, etc.)
- edit_items: they want to add, remove, or change a specific item (e.g. "remove dining table", "add 1 wardrobe", "change bed to queen size"). Also return updatedItems = the FULL updated bullet list after applying their change.
- change_name: they want to change their name
- change_address: they want to change the address
- change_date: they want to change the preferred date or schedule
- redo_items: they want to completely redo/replace the entire items list from scratch
- question: they have a question about the service/price/timing
- cancel: they want to cancel
- unclear: genuinely unclear

For edit_items: compute the full updated list (apply their change) and return in updatedItems.
For questions: answer briefly in reply (team confirms pricing after submission, typical response within 1 business day).`
              }]
            });
            const ci = JSON.parse(confirmIntent.choices[0]?.message?.content || "{}");

            if (ci.action === "submit") {
              // Fall through to YES processing below
            } else if (ci.action === "edit_items") {
              // Apply the targeted add/remove/change directly — no list wipe
              const updatedItems = ci.updatedItems || session.collectedItems || "";
              await storage.upsertWhatsAppSession(from, { state: "awaiting_items_verify", collectedItems: updatedItems });
              await sendWhatsAppMessage(from,
                `${ci.reply || "Done!"} Here's your updated list:\n\n${updatedItems}\n\n` +
                `Does this look right?\n• Reply *YES* to proceed\n• Tell me any other corrections needed\n• Send a photo to add more items`
              );
              return;
            } else if (ci.action === "change_name") {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_name" });
              await sendWhatsAppMessage(from, `${ci.reply || "Sure!"} What's the correct name?`);
              return;
            } else if (ci.action === "change_address") {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_address" });
              await sendWhatsAppMessage(from, `${ci.reply || "No problem!"} What's the correct address? 📍`);
              return;
            } else if (ci.action === "change_date") {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_date" });
              await sendWhatsAppMessage(from, `${ci.reply || "Sure!"} 📅 When would you prefer to have this done?\n\n_e.g. This Saturday, next week, 20 April 2026, or reply *anytime* if flexible._`);
              return;
            } else if (ci.action === "redo_items") {
              // Complete redo — keep existing list in previousItems so user can reference it
              await storage.upsertWhatsAppSession(from, {
                state: "awaiting_items",
                collectedItems: null,
                previousItems: session.collectedItems,
              });
              await sendWhatsAppMessage(from,
                `${ci.reply || "Sure!"} What items do you need help with?\n\n` +
                `📸 Send a photo or type the list below.`
              );
              return;
            } else if (ci.action === "cancel") {
              await storage.deleteWhatsAppSession(from);
              await sendWhatsAppMessage(from, `${ci.reply || "No worries!"} If you need a quote in future, just send *hi* anytime. 😊`);
              return;
            } else {
              // question or unclear
              await sendWhatsAppMessage(from,
                `${ci.reply || "Our team will be in touch to confirm all the details!"} 😊\n\n` +
                `Ready to go? Reply *YES* to submit, or tell me what you'd like to change.`
              );
              return;
            }
            // If action === "submit", fall through to YES processing below
          } catch {
            await sendWhatsAppMessage(from,
              `Almost there! 😊 Just reply *YES* to submit to our team, or tell me what you'd like to change.\n\n` +
              `• *change name / address / items* — to fix details\n• *cancel* — to stop`
            );
            return;
          }
        }

        const name = session.collectedName!;
        const address = session.collectedAddress!;
        const itemsText = session.collectedItems!;

        // ── Step 1: Load catalog so we can match and use real prices ──────
        const catalog = await storage.getCatalogItems();

        // ── Step 2: Parse items with OpenAI (same logic as web flow) ──────
        let aiParsedItems: { detectedName: string; serviceType: string; quantity: number; estimatedUnitPrice: number; confidence: number }[] = [];
        try {
          const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are an AI assistant for TMG Install, a furniture installation company in Singapore.
Extract furniture items and required services from the customer's description.
Valid service types are: 'install', 'dismantle', 'relocate'.

Our catalog includes these items (name — serviceType — price SGD):
${catalog.map(c => `- ${c.name} (${c.serviceType}) $${c.basePrice}`).join("\n")}

Try to match detected items to the catalog above. Use the catalog item name as detectedName when matched.
For items not in the catalog, estimate a reasonable SGD unit price.

Return a JSON object with an 'items' array. Each item should have:
- 'detectedName': string (match catalog name exactly when possible, e.g. 'IKEA Pax Wardrobe')
- 'serviceType': string ('install', 'dismantle', or 'relocate')
- 'quantity': number
- 'estimatedUnitPrice': number
- 'confidence': number (0-100)
Return ONLY valid JSON.`,
              },
              { role: "user", content: itemsText },
            ],
            response_format: { type: "json_object" },
          });
          const raw = aiResponse.choices[0].message.content || '{"items":[]}';
          console.log("[WhatsApp] OpenAI item parse:", raw);
          const parsed = JSON.parse(raw);
          aiParsedItems = parsed.items || [];
        } catch (aiErr) {
          console.error("[WhatsApp] OpenAI parse error:", aiErr);
        }

        // Fallback: create one raw item if parsing returned nothing
        if (!aiParsedItems.length) {
          aiParsedItems = [{ detectedName: itemsText.substring(0, 200), serviceType: "install", quantity: 1, estimatedUnitPrice: 0, confidence: 50 }];
        }

        // ── Step 3: Match each item against the catalog (same as web flow) ─
        let totalEstimate = 0;
        const quoteItems = aiParsedItems.map((item) => {
          const matchedCatalogItem = catalog.find(c =>
            c.serviceType === item.serviceType &&
            item.detectedName.toLowerCase().includes(c.name.toLowerCase())
          );
          const unitPrice = matchedCatalogItem ? Number(matchedCatalogItem.basePrice) : (item.estimatedUnitPrice || 0);
          const qty = item.quantity || 1;
          const subtotal = unitPrice * qty;
          totalEstimate += subtotal;
          return {
            originalDescription: itemsText,
            detectedName: item.detectedName,
            serviceType: item.serviceType || "install",
            quantity: qty,
            unitPrice: unitPrice.toFixed(2),
            subtotal: subtotal.toFixed(2),
            catalogItemId: matchedCatalogItem?.id,
          };
        });

        const refNo = `TMG-${randomBytes(2).toString("hex").toUpperCase()}`;

        // ── Minimum charge: SGD 180 (same rule as web flow) ──────────────────
        const MIN_CHARGE = 180;
        const minAdjustment = totalEstimate < MIN_CHARGE ? MIN_CHARGE - totalEstimate : 0;
        const grandTotal = totalEstimate + minAdjustment;

        if (minAdjustment > 0) {
          quoteItems.push({
            originalDescription: "Minimum Charge Adjustment",
            detectedName: "Minimum Charge Adjustment",
            serviceType: "adjustment",
            quantity: 1,
            unitPrice: minAdjustment.toFixed(2),
            subtotal: minAdjustment.toFixed(2),
            catalogItemId: undefined,
          });
        }
        // ─────────────────────────────────────────────────────────────────────

        const depositAmount = (grandTotal * 0.50).toFixed(2);
        const finalAmount = (grandTotal * 0.50).toFixed(2);

        const quote = await storage.createQuote(
          { name, email: `wa_${from}@tmginstall.com`, phone: from },
          {
            referenceNo: refNo,
            serviceAddress: address,
            status: "submitted",
            sourceChannel: "whatsapp",
            customerWhatsappPhone: from,
            subtotal: totalEstimate.toFixed(2),
            total: grandTotal.toFixed(2),
            depositAmount,
            finalAmount,
            requiresManualReview: true,
            preferredDate: session.preferredDate || null,
          } as any,
          quoteItems as any
        );

        await storage.deleteWhatsAppSession(from);

        await sendWhatsAppMessage(from,
          `✅ All done, *${name}*! Your request has been submitted.\n\n` +
          `🔖 *Reference:* ${quote.referenceNo}\n` +
          `📍 *Address:* ${address}\n` +
          (session.preferredDate ? `📅 *Preferred date:* ${session.preferredDate}\n` : "") +
          `\nOur team will review and send you a quote shortly — typically within 1 business day.\n\n` +
          `Track your request: ${APP_URL}/quotes/${quote.id}\n\n` +
          `Thanks for choosing TMG Install! 🙏 Reply *hi* anytime for a new quote.`
        );

        // Notify admin
        try {
          await sendEmail({
            to: ADMIN_EMAIL,
            subject: `📱 WhatsApp Quote — ${quote.referenceNo} from ${name}`,
            html: `<p>New quote submitted via <strong>WhatsApp</strong> from ${name} (+${from}).</p><p>Reference: <strong>${quote.referenceNo}</strong></p><p>Address: ${address}</p>${session.preferredDate ? `<p>Preferred date: <strong>${session.preferredDate}</strong></p>` : ""}<p>Items:<br>${itemsText.replace(/\n/g, "<br>")}</p><p><a href="${APP_URL}/admin/quotes/${quote.id}">View in Admin Panel</a></p>`,
          });
        } catch (alertErr) {
          console.error("[WhatsApp] Admin alert email error:", alertErr);
        }
        return;
      }

      // Fallback for submitted state
      await sendWhatsAppMessage(from,
        `Your request has already been submitted — our team will be in touch soon! 😊\n\nReply *hi* to start a new request.`
      );
    } catch (err) {
      console.error("[WhatsApp] Webhook handler error:", err);
    }
  });

  // ── Admin: Send Payment Link via WhatsApp ─────────────────────────────────
  app.post("/api/admin/quotes/:id/send-whatsapp-payment", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    try {
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      const phone = (quote as any).customerWhatsappPhone;
      if (!phone) return res.status(400).json({ message: "No WhatsApp number on this quote" });

      const depositAmount = String(quote.depositAmount || "0");

      // Generate Stripe payment link if available
      let paymentLink = `${APP_URL}/quotes/${id}`;
      if (stripe && parseFloat(depositAmount) > 0) {
        const link = await createStripePaymentLink(
          `Deposit for ${quote.referenceNo}`,
          parseFloat(depositAmount),
          { quoteId: String(id), type: "deposit" },
          `${APP_URL}/quotes/${id}`
        );
        if (link) paymentLink = link;
      }

      await sendWhatsAppPaymentLink(phone, quote.referenceNo, depositAmount, paymentLink);

      res.json({ message: "Payment link sent via WhatsApp" });
    } catch (err) {
      console.error("[WhatsApp] Send payment link error:", err);
      res.status(500).json({ message: "Failed to send WhatsApp message" });
    }
  });

  // ── Admin: WhatsApp Token Settings ────────────────────────────────────────
  app.post("/api/admin/settings/whatsapp-token", async (req, res) => {
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== "string" || token.trim().length < 20) {
      return res.status(400).json({ message: "Invalid token" });
    }
    try {
      await updateAccessToken(token.trim());
      res.json({ message: "WhatsApp token updated successfully" });
    } catch (err) {
      console.error("[Admin] Failed to update WhatsApp token:", err);
      res.status(500).json({ message: "Failed to update token" });
    }
  });

  return httpServer;
}
