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
import { sendWhatsAppMessage, sendWhatsAppPaymentLink, updateAccessToken, WHATSAPP_VERIFY_TOKEN } from "./whatsapp";

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

  // Schedule management: get pending + confirmed bookings
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
      const depositAmount = (totalEstimate * 0.30).toFixed(2);
      const finalAmount = (totalEstimate * 0.70).toFixed(2);

      const quote = await storage.createQuote(
        input.customer,
        {
          referenceNo,
          serviceAddress: input.serviceAddress,
          status: 'submitted',
          subtotal: totalEstimate.toFixed(2),
          total: totalEstimate.toFixed(2),
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
      const text: string = (msg.text?.body || "").trim();
      const textLower = text.toLowerCase();

      const session = await storage.getWhatsAppSession(from);
      const state = session?.state ?? "start";

      if (textLower === "restart" || textLower === "start" || textLower === "hi" || textLower === "hello" || !session) {
        await storage.upsertWhatsAppSession(from, { state: "awaiting_name", collectedName: null, collectedAddress: null, collectedItems: null });
        await sendWhatsAppMessage(from,
          `👋 Welcome to *TMG Install*!\n\nI can help you get a furniture installation quote in minutes.\n\nWhat is your *full name*?`
        );
        return;
      }

      if (state === "awaiting_name") {
        if (text.length < 2) {
          await sendWhatsAppMessage(from, "Please enter your full name to continue.");
          return;
        }
        await storage.upsertWhatsAppSession(from, { state: "awaiting_address", collectedName: text });
        await sendWhatsAppMessage(from,
          `Nice to meet you, *${text}*! 😊\n\n📍 What is your *installation address* in Singapore?\n\n_e.g. 123 Orchard Road, #05-01, Singapore 238867_`
        );
        return;
      }

      if (state === "awaiting_address") {
        if (text.length < 5) {
          await sendWhatsAppMessage(from, "Please enter a valid Singapore address.");
          return;
        }
        await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedAddress: text });
        await sendWhatsAppMessage(from,
          `Got it! 🛋️ Now please tell me *what furniture items* you need installed.\n\nList each item on a new line, for example:\n• 1 king bed frame\n• 2-door wardrobe\n• Dining table with 4 chairs\n• TV console\n\nJust type them out and I'll process your quote!`
        );
        return;
      }

      if (state === "awaiting_items") {
        if (text.length < 3) {
          await sendWhatsAppMessage(from, "Please describe the furniture items you need installed.");
          return;
        }
        const name = session.collectedName!;
        const address = session.collectedAddress!;
        await storage.upsertWhatsAppSession(from, { state: "awaiting_confirmation", collectedItems: text });
        await sendWhatsAppMessage(from,
          `Here's your quote request summary:\n\n` +
          `👤 *Name:* ${name}\n` +
          `📍 *Address:* ${address}\n` +
          `🛋️ *Items:*\n${text}\n\n` +
          `Reply *YES* to submit your quote request, or *NO* to start over.`
        );
        return;
      }

      if (state === "awaiting_confirmation") {
        if (textLower === "no") {
          await storage.deleteWhatsAppSession(from);
          await sendWhatsAppMessage(from,
            `No problem! Send *hi* anytime to start a new quote request. 😊`
          );
          return;
        }

        if (textLower !== "yes") {
          await sendWhatsAppMessage(from, `Please reply *YES* to submit or *NO* to start over.`);
          return;
        }

        const name = session.collectedName!;
        const address = session.collectedAddress!;
        const itemsText = session.collectedItems!;

        // Use OpenAI to parse items (same as web flow)
        let parsedItems: { detectedName: string; serviceType: string; quantity: number; unitPrice: number }[] = [];
        try {
          const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are a furniture installation quote assistant for TMG Install in Singapore. Parse the customer's furniture list into structured items. For each item return: detectedName, serviceType (install/dismantle/relocate), quantity (integer), unitPrice (SGD estimate based on Singapore market rates). Return JSON array only.`,
              },
              { role: "user", content: itemsText },
            ],
            response_format: { type: "json_object" },
          });
          const parsed = JSON.parse(aiResponse.choices[0].message.content || "{}");
          parsedItems = parsed.items || [];
        } catch (aiErr) {
          console.error("[WhatsApp] OpenAI parse error:", aiErr);
          parsedItems = [{ detectedName: itemsText, serviceType: "install", quantity: 1, unitPrice: 0 }];
        }

        const refNo = `TMG-${randomBytes(2).toString("hex").toUpperCase()}`;
        const quoteItems = parsedItems.map((item) => ({
          originalDescription: itemsText,
          detectedName: item.detectedName,
          serviceType: item.serviceType || "install",
          quantity: item.quantity || 1,
          unitPrice: String(item.unitPrice || 0),
          subtotal: String((item.quantity || 1) * (item.unitPrice || 0)),
        }));

        const subtotal = quoteItems.reduce((s, i) => s + parseFloat(i.subtotal), 0);
        const depositAmount = (subtotal * 0.3).toFixed(2);
        const finalAmount = (subtotal * 0.7).toFixed(2);

        const quote = await storage.createQuote(
          { name, email: `wa_${from}@tmginstall.com`, phone: from },
          {
            serviceAddress: address,
            status: "submitted",
            sourceChannel: "whatsapp",
            customerWhatsappPhone: from,
            subtotal: String(subtotal),
            total: String(subtotal),
            depositAmount,
            finalAmount,
            requiresManualReview: true,
          } as any,
          quoteItems as any
        );

        await storage.deleteWhatsAppSession(from);

        await sendWhatsAppMessage(from,
          `✅ *Quote request submitted!*\n\n` +
          `Reference: *${quote.referenceNo}*\n\n` +
          `Our team will review your request and send you a deposit payment link shortly.\n\n` +
          `Track your quote at:\n${APP_URL}/status/${quote.referenceNo}\n\n` +
          `_Reply *hi* anytime to start a new request._`
        );

        // Notify admin
        try {
          await sendEmail({
            to: ADMIN_EMAIL,
            subject: `📱 WhatsApp Quote — ${quote.referenceNo} from ${name}`,
            html: `<p>New quote submitted via <strong>WhatsApp</strong> from ${name} (+${from}).</p><p>Reference: <strong>${quote.referenceNo}</strong></p><p>Address: ${address}</p><p>Items: ${itemsText}</p><p><a href="${APP_URL}/admin/quotes/${quote.id}">View in Admin Panel</a></p>`,
          });
        } catch (alertErr) {
          console.error("[WhatsApp] Admin alert email error:", alertErr);
        }
        return;
      }

      // Fallback for submitted state
      await sendWhatsAppMessage(from,
        `Your quote has already been submitted. Our team will be in touch soon! 😊\n\nReply *hi* to start a new request.`
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
      let paymentLink = `${APP_URL}/status/${quote.referenceNo}`;
      if (stripe && parseFloat(depositAmount) > 0) {
        const link = await createStripePaymentLink(
          `Deposit for ${quote.referenceNo}`,
          parseFloat(depositAmount),
          { quoteId: String(id), type: "deposit" },
          `${APP_URL}/status/${quote.referenceNo}`
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
