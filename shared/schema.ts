import { pgTable, text, serial, integer, boolean, timestamp, numeric, index, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Teams (groups of staff members)
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Attendance Logs (daily clock in/out)
export const attendanceLogs = pgTable("attendance_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  clockInAt: timestamp("clock_in_at").notNull(),
  clockOutAt: timestamp("clock_out_at"),
  clockInLat: numeric("clock_in_lat"),
  clockInLng: numeric("clock_in_lng"),
  clockOutLat: numeric("clock_out_lat"),
  clockOutLng: numeric("clock_out_lng"),
  notes: text("notes"),
  deductionMinutes: integer("deduction_minutes").default(0).notNull(), // admin-applied bulk/per-row deduction in minutes
  deductionReason: text("deduction_reason"),                            // why this deduction was applied
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  attendanceUserIdx: index("attendance_logs_user_id_idx").on(t.userId),
  attendanceClockInIdx: index("attendance_logs_clock_in_idx").on(t.clockInAt),
}));

// Users (Admin/Staff)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('staff'), // 'admin' | 'staff'
  name: text("name").notNull(),
  teamId: integer("team_id").references(() => teams.id),
  // HR / Contact fields
  phone: text("phone"),
  email: text("email"),
  nricFin: text("nric_fin"),                          // NRIC or FIN (Singapore)
  startDate: text("start_date"),                      // Employment start date YYYY-MM-DD
  emergencyName: text("emergency_name"),
  emergencyPhone: text("emergency_phone"),
  // Payroll fields
  payType: text("pay_type").default("hourly"),        // 'hourly' | 'monthly'
  monthlyRate: numeric("monthly_rate").default("0"),  // SGD per month base salary
  hourlyRate: numeric("hourly_rate").default("0"),    // SGD per hour, first 8 hrs/day
  overtimeRate: numeric("overtime_rate").default("0"),// SGD per hour, after 8 hrs/day
  annualLeaveEntitlement: integer("annual_leave_entitlement").default(14), // days per year
  // Push notification token (Firebase Cloud Messaging — registered from Android app)
  fcmToken: text("fcm_token"),
  // Optional clock-in time restriction — "HH:MM" in SGT (e.g. "07:25"). If set, staff may only clock in within ±10 min of this time.
  clockInTime: text("clock_in_time"),
});

// Attendance Amendment Requests
export const attendanceAmendments = pgTable("attendance_amendments", {
  id: serial("id").primaryKey(),
  attendanceLogId: integer("attendance_log_id").references(() => attendanceLogs.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  originalClockIn: timestamp("original_clock_in"),
  originalClockOut: timestamp("original_clock_out"),
  requestedClockIn: timestamp("requested_clock_in"),
  requestedClockOut: timestamp("requested_clock_out"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  adminNote: text("admin_note"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  amendmentUserIdx: index("attendance_amendments_user_id_idx").on(t.userId),
  amendmentStatusIdx: index("attendance_amendments_status_idx").on(t.status),
}));

// GPS Track Points — continuous location history for staff
export const gpsTrackPoints = pgTable("gps_track_points", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  accuracy: numeric("accuracy"),   // metres (browser accuracy estimate)
  speed: numeric("speed"),         // m/s — null if unavailable
  heading: numeric("heading"),     // degrees 0-360 — null if unavailable
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
}, (t) => ({
  gpsUserIdx: index("gps_track_points_user_id_idx").on(t.userId),
  gpsRecordedAtIdx: index("gps_track_points_recorded_at_idx").on(t.recordedAt),
}));

export type GpsTrackPoint = typeof gpsTrackPoints.$inferSelect;

// Leave Requests
export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  leaveType: text("leave_type").notNull(), // 'annual' | 'medical' | 'unpaid' | 'other'
  startDate: text("start_date").notNull(),  // yyyy-MM-dd
  endDate: text("end_date").notNull(),      // yyyy-MM-dd
  totalDays: numeric("total_days").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  adminNote: text("admin_note"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  leaveUserIdx: index("leave_requests_user_id_idx").on(t.userId),
  leaveStatusIdx: index("leave_requests_status_idx").on(t.status),
}));

// Payslips
export const payslips = pgTable("payslips", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  periodStart: text("period_start").notNull(),  // yyyy-MM-dd
  periodEnd: text("period_end").notNull(),        // yyyy-MM-dd
  regularHours: numeric("regular_hours").default("0"),
  overtimeHours: numeric("overtime_hours").default("0"),
  basicPay: numeric("basic_pay").default("0"),
  regularPay: numeric("regular_pay").default("0"),
  overtimePay: numeric("overtime_pay").default("0"),
  mealAllowance: numeric("meal_allowance").default("0"),
  // Sum of $8 per-job transport reimbursements for jobs in the pay period
  // where admin enabled `staffTransportAllowance` on the job.
  transportAllowance: numeric("transport_allowance").default("0"),
  leaveDeduction: numeric("leave_deduction").default("0"),
  loanDeduction: numeric("loan_deduction").default("0"),
  grossPay: numeric("gross_pay").default("0"),
  notes: text("notes"),
  generatedBy: integer("generated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Staff Loans
export const staffLoans = pgTable("staff_loans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  description: text("description").notNull(),
  totalAmount: numeric("total_amount").notNull(),
  monthlyRepayment: numeric("monthly_repayment").notNull(),
  remainingBalance: numeric("remaining_balance").notNull(),
  startDate: text("start_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customers
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  // Default billing-side details. Each quote may override these so a customer
  // can be billed under a different company / address per job if needed.
  companyName: text("company_name"),
  companyUen: text("company_uen"),
  billingAddress: text("billing_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Catalog Items
export const catalogItems = pgTable("catalog_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku"),
  category: text("category"),
  serviceType: text("service_type").notNull(), // 'install', 'dismantle', 'relocate', 'dispose', 'dismantle_dispose'
  basePrice: numeric("base_price").notNull(),
  volumeM3: numeric("volume_m3"),              // cubic metres footprint in Toyota Hiace
  active: boolean("active").default(true),
});

// App Settings (key-value store for runtime config)
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type AppSetting = typeof appSettings.$inferSelect;

// Promo Codes — marketing discount codes (e.g. TMG50 = $50 off for first 100 customers)
export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountAmount: numeric("discount_amount").notNull().default("50"),
  maxUses: integer("max_uses").notNull().default(100),
  usesCount: integer("uses_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  minOrderAmount: numeric("min_order_amount").default("0"), // minimum job total required to use this code
  createdAt: timestamp("created_at").defaultNow(),
});
export type PromoCode = typeof promoCodes.$inferSelect;

// WhatsApp Message Log (persists all inbound/outbound messages for admin view)
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),                           // customer phone (e.g. 6591234567)
  direction: text("direction").notNull(),                   // 'inbound' | 'outbound'
  body: text("body").notNull(),
  mediaType: text("media_type"),                            // 'image' | null
  mediaUrl: text("media_url"),
  wamid: text("wamid"),                                     // WhatsApp message ID for dedup
  sentBy: text("sent_by").default("bot"),                   // 'bot' | 'admin:<username>'
  readAt: timestamp("read_at"),                             // null = unread (only meaningful for inbound)
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  waPhoneIdx: index("whatsapp_messages_phone_idx").on(t.phone),
  waCreatedAtIdx: index("whatsapp_messages_created_at_idx").on(t.createdAt),
}));
export type WhatsAppMessage = typeof whatsappMessages.$inferSelect;

// WhatsApp Conversation Sessions
export const whatsappSessions = pgTable("whatsapp_sessions", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  state: text("state").notNull().default("awaiting_name"), // awaiting_name | awaiting_address | awaiting_items | awaiting_items_verify | awaiting_service_type | awaiting_floor | awaiting_access | awaiting_to_address | awaiting_date | awaiting_remarks | awaiting_confirmation | submitted
  collectedName: text("collected_name"),
  collectedEmail: text("collected_email"),   // optional — soft ask after name
  collectedAddress: text("collected_address"),
  collectedItems: text("collected_items"),
  previousItems: text("previous_items"),
  preferredDate: text("preferred_date"),        // display text shown in WhatsApp (e.g. "Saturday, 28 March 2026")
  preferredDateIso: text("preferred_date_iso"), // yyyy-MM-dd for quotes table — null if flexible
  preferredTimeWindow: text("preferred_time_window"), // e.g. "09:00-12:00" or "13:00-17:00" — null if flexible

  // Relocation fields
  isRelocation: boolean("is_relocation").default(false),
  collectedToAddress: text("collected_to_address"),   // destination address (dropoff)
  distanceKm: numeric("distance_km"),                  // computed route distance (OSRM)

  // Floor / access fields (affect pricing surcharges — same as web flow)
  floorLevel: integer("floor_level").default(1),       // floor number of the job address (1 = ground)
  hasLift: boolean("has_lift").default(true),          // whether a lift is available
  accessDifficulty: text("access_difficulty").default("easy"), // 'easy' | 'medium' | 'hard'

  // Conversation memory — JSON array of {role:"user"|"assistant", content:string}
  // Stores the last 8 exchanges so GPT can reference earlier context.
  conversationHistory: text("conversation_history"),

  // Special notes from customer (condo rules, parking, fragile items, etc.)
  specialRemarks: text("special_remarks"),

  // Rich structured state JSON — used by the unified orchestration engine
  // Tracks items (grouped), from/to addresses, floor/lift per address, schedule,
  // customer info, and corrections — persists across every turn of the conversation.
  structuredState: text("structured_state"),

  // Admin takeover — when true, bot will not respond; admin handles the chat manually
  botPaused: boolean("bot_paused").default(false),
  botPausedAt: timestamp("bot_paused_at"),

  // ── AI Sales Agent fields (Phase 9) ──────────────────────────────────────
  // AI conversation state machine (separate from legacy bot state)
  aiState: text("ai_state").default("new_lead"),
  // 'ai' | 'human' — who currently owns this conversation
  aiOwnership: text("ai_ownership").default("ai"),
  // Timestamp of last inbound message — used to check 24-hr window
  lastInboundAt: timestamp("last_inbound_at"),
  // Whether the Meta 24-hour customer service window is currently open
  windowOpen: boolean("window_open").default(true),
  // Whether this conversation is restricted to template-only outbound messages
  templateModeOnly: boolean("template_mode_only").default(false),
  // AI confidence score (0.0 – 1.0) for current intent classification
  confidenceScore: numeric("confidence_score", { precision: 4, scale: 2 }),
  // JSON: structured extracted facts (service type, address, items, etc.)
  caseFacts: text("case_facts"),
  // JSON: list of fact keys still missing before quote is ready
  missingFacts: text("missing_facts"),
  // Why this conversation was handed off to human
  handoffReason: text("handoff_reason"),
  // Whether a follow-up is already scheduled (prevents double-scheduling)
  followupScheduled: boolean("followup_scheduled").default(false),

  // ── Lead scoring (Phase 11) ──────────────────────────────────────────────
  // 0–100 hotness score from server/ai-lead-scoring.ts. Recomputed per inbound.
  leadScore: integer("lead_score").default(0),
  // JSON array of {label, points} explaining the score
  leadScoreReasons: text("lead_score_reasons"),
  // When we last fired a "hot lead" real-time alert for this conversation —
  // used to avoid re-alerting on every subsequent message in the same chat.
  hotLeadAlertedAt: timestamp("hot_lead_alerted_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type WhatsAppSession = typeof whatsappSessions.$inferSelect;

// Quotes / Jobs
// Status machine:
// submitted → deposit_requested → deposit_paid → booking_requested → booked → assigned → in_progress → completed → final_payment_requested → final_paid → closed
// Also: cancelled (any time)
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  referenceNo: text("reference_no").notNull().unique(),
  // Old reference numbers that previously identified this quote. When the
  // weak-ref rotation migration replaced the customer-facing referenceNo,
  // the original value(s) are kept here so that links/emails/WhatsApp
  // messages already in customers' hands still resolve to the same quote.
  legacyReferenceNos: text("legacy_reference_nos").array(),
  customerId: integer("customer_id").references(() => customers.id),
  serviceAddress: text("service_address").notNull(),
  status: text("status").notNull().default("submitted"),
  sourceChannel: text("source_channel").default("web"), // 'web' | 'whatsapp'
  customerWhatsappPhone: text("customer_whatsapp_phone"),

  subtotal: numeric("subtotal").default("0"),
  discount: numeric("discount").default("0"),
  transportFee: numeric("transport_fee").default("0"),
  total: numeric("total").default("0"),

  aiConfidenceScore: integer("ai_confidence_score"),
  requiresManualReview: boolean("requires_manual_review").default(true),

  // Relocation-specific fields
  pickupAddress: text("pickup_address"),
  dropoffAddress: text("dropoff_address"),
  accessDifficulty: text("access_difficulty"), // 'easy' | 'medium' | 'hard'
  floorsInfo: text("floors_info"), // JSON stringified array
  selectedServices: text("selected_services"), // JSON stringified array

  assignedStaffId: integer("assigned_staff_id").references(() => users.id),
  assignedTeamId: integer("assigned_team_id").references(() => teams.id),
  scheduledAt: timestamp("scheduled_at"),
  timeWindow: text("time_window"), // e.g. "09:00-12:00"

  // Booking tracking
  bookingRequestedAt: timestamp("booking_requested_at"), // when customer submitted request
  rescheduledCount: integer("rescheduled_count").default(0), // # of times rescheduled (max 1 free)

  // Slot chosen in the wizard (before submission)
  preferredDate: text("preferred_date"),           // yyyy-MM-dd chosen by customer in wizard
  preferredTimeWindow: text("preferred_time_window"), // e.g. '09:00-12:00'
  slotHeldUntil: timestamp("slot_held_until"),      // hold expires 48h after submission

  depositAmount: numeric("deposit_amount").default("0"),
  depositPaidAt: timestamp("deposit_paid_at"),
  finalAmount: numeric("final_amount").default("0"),
  finalPaidAt: timestamp("final_paid_at"),
  paymentStatus: text("payment_status").default("unpaid"), // unpaid, deposit_pending, deposit_paid, final_pending, paid_in_full

  distanceKm: numeric("distance_km"), // auto-computed route distance for relocation

  promoCode: text("promo_code"),            // applied promo code (e.g. "TMG50")
  promoDiscount: numeric("promo_discount").default("0"), // SGD discount from promo

  // Post-job additional charges (overtime, access issues, extra items discovered on-site)
  additionalCharge: numeric("additional_charge").default("0"),
  additionalChargeNote: text("additional_charge_note"), // e.g. "Overtime: 2 × 30-min blocks"

  notes: text("notes"), // admin internal notes
  detectionPhotoUrl: text("detection_photo_url"), // thumbnail from AI photo scan at submission

  // Loyalty / repeat-customer discount
  loyaltyDiscount: numeric("loyalty_discount").default("0"), // SGD flat discount for returning customers

  // Relocation mode: "carry" = Carry Only (no dismantle, transport+labor only, 120-min cap with overtime)
  //                   "full"  = Full D&R (dismantle + transport + reinstall, no time cap)
  // Used by email overtime notice gating and admin display. Null for non-relocation jobs.
  relocationMode: text("relocation_mode"),

  // Automated reminders
  dayBeforeReminderAt: timestamp("day_before_reminder_at"), // null = not yet sent

  // Per-job staff transport allowance: when true, assigned staff receive a $8
  // transport reimbursement that's summed onto their monthly payslip.
  staffTransportAllowance: boolean("staff_transport_allowance").default(false),

  // Invoice / quotation billing presentation. The work-site address (above)
  // is where staff actually go; these fields determine how the customer is
  // billed on the printed Quotation / Invoice / Receipt.
  invoiceType: text("invoice_type").default("residential"), // 'residential' | 'commercial'
  billingAddress: text("billing_address"),                  // overrides customer.billingAddress
  billingCompanyName: text("billing_company_name"),         // overrides customer.companyName
  billingCompanyUen: text("billing_company_uen"),           // overrides customer.companyUen
  poNumber: text("po_number"),                              // commercial PO reference

  // Commercial Net-30 invoice lifecycle — used by the dashboard
  // "Outstanding Invoices" widget to compute days-outstanding.
  commercialInvoiceSentAt: timestamp("commercial_invoice_sent_at"),

  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  quotesStatusIdx: index("quotes_status_idx").on(t.status),
  quotesCustomerIdx: index("quotes_customer_id_idx").on(t.customerId),
  quotesCreatedAtIdx: index("quotes_created_at_idx").on(t.createdAt),
  quotesScheduledAtIdx: index("quotes_scheduled_at_idx").on(t.scheduledAt),
  quotesTeamIdx: index("quotes_assigned_team_id_idx").on(t.assignedTeamId),
  quotesStaffIdx: index("quotes_assigned_staff_id_idx").on(t.assignedStaffId),
}));

// Quote Items
export const quoteItems = pgTable("quote_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").references(() => quotes.id).notNull(),
  catalogItemId: integer("catalog_item_id").references(() => catalogItems.id),
  originalDescription: text("original_description").notNull(),
  detectedName: text("detected_name"),
  remark: text("remark"),
  serviceType: text("service_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price").notNull().default("0"),
  subtotal: numeric("subtotal").notNull().default("0"),
}, (t) => ({
  quoteItemsQuoteIdx: index("quote_items_quote_id_idx").on(t.quoteId),
}));

// Job Updates (Timeline / Proof of work)
export const jobUpdates = pgTable("job_updates", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").references(() => quotes.id).notNull(),
  statusChange: text("status_change").notNull(),
  actorType: text("actor_type").notNull(), // 'system', 'admin', 'staff', 'customer'
  actorId: integer("actor_id"),
  note: text("note"),
  photoUrl: text("photo_url"), // JSON array of URLs for multiple photos
  gpsLat: numeric("gps_lat"),
  gpsLng: numeric("gps_lng"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  jobUpdatesQuoteIdx: index("job_updates_quote_id_idx").on(t.quoteId),
}));

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, { fields: [users.teamId], references: [teams.id] }),
  attendanceLogs: many(attendanceLogs),
  leaveRequests: many(leaveRequests),
  payslips: many(payslips),
  staffLoans: many(staffLoans),
}));

export const attendanceLogsRelations = relations(attendanceLogs, ({ one, many }) => ({
  user: one(users, { fields: [attendanceLogs.userId], references: [users.id] }),
  amendments: many(attendanceAmendments),
}));

export const attendanceAmendmentsRelations = relations(attendanceAmendments, ({ one }) => ({
  log: one(attendanceLogs, { fields: [attendanceAmendments.attendanceLogId], references: [attendanceLogs.id] }),
  user: one(users, { fields: [attendanceAmendments.userId], references: [users.id] }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  user: one(users, { fields: [leaveRequests.userId], references: [users.id] }),
}));

export const payslipsRelations = relations(payslips, ({ one }) => ({
  user: one(users, { fields: [payslips.userId], references: [users.id] }),
}));

export const staffLoansRelations = relations(staffLoans, ({ one }) => ({
  user: one(users, { fields: [staffLoans.userId], references: [users.id] }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  customer: one(customers, { fields: [quotes.customerId], references: [customers.id] }),
  assignedStaff: one(users, { fields: [quotes.assignedStaffId], references: [users.id] }),
  assignedTeam: one(teams, { fields: [quotes.assignedTeamId], references: [teams.id] }),
  items: many(quoteItems),
  updates: many(jobUpdates),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteItems.quoteId], references: [quotes.id] }),
  catalogItem: one(catalogItems, { fields: [quoteItems.catalogItemId], references: [catalogItems.id] }),
}));

// Staff Receipts — expense claims uploaded by staff, reviewed by admin
export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  receiptDate: text("receipt_date").notNull(),      // yyyy-MM-dd
  amount: numeric("amount").notNull(),              // SGD
  category: text("category").notNull(),             // 'fuel' | 'tools' | 'transport' | 'meals' | 'parking' | 'other'
  description: text("description"),
  fileData: text("file_data").notNull(),            // base64-encoded file content
  fileType: text("file_type").notNull(),            // 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'
  fileName: text("file_name").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  adminNote: text("admin_note"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = typeof receipts.$inferInsert;
export type ReceiptWithUser = Receipt & { user?: Pick<typeof users.$inferSelect, 'id' | 'name' | 'phone'> };

export const insertReceiptSchema = createInsertSchema(receipts).omit({ id: true, createdAt: true, status: true, adminNote: true, reviewedBy: true, reviewedAt: true });

// FAQ Entries — admin-editable knowledge base read by WhatsApp bot
export const faqEntries = pgTable("faq_entries", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category").notNull().default("general"), // general | pricing | booking | services | policies | hours
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type FaqEntry = typeof faqEntries.$inferSelect;
export type InsertFaqEntry = typeof faqEntries.$inferInsert;
export const insertFaqEntrySchema = createInsertSchema(faqEntries).omit({ id: true, createdAt: true, updatedAt: true });

// Pricing Corrections — admin-teachable mapping: detected item → correct catalog item
// The bot reads these during smartPricingLookup to self-improve over time.
export const pricingCorrections = pgTable("pricing_corrections", {
  id: serial("id").primaryKey(),
  detectedDescription: text("detected_description").notNull(), // phrase bot or customer used (e.g. "privacy pod", "Framery")
  correctedName: text("corrected_name").notNull(),             // human-friendly correct name (e.g. "Solo Phone Booth (1-Person)")
  catalogItemName: text("catalog_item_name"),                  // exact catalog item name to match (must exist in catalog)
  notes: text("notes"),                                        // optional context (e.g. "Framery O = 1-person pod")
  active: boolean("active").notNull().default(true),
  autoLearned: boolean("auto_learned").notNull().default(false), // true = bot discovered this automatically
  createdAt: timestamp("created_at").defaultNow(),
});
export type PricingCorrection = typeof pricingCorrections.$inferSelect;
export type InsertPricingCorrection = typeof pricingCorrections.$inferInsert;
export const insertPricingCorrectionSchema = createInsertSchema(pricingCorrections).omit({ id: true, createdAt: true });

// GGV Jobs — daily delivery/installation job tracker (from Lalamove/GGV sheets)
export const ggvJobs = pgTable("ggv_jobs", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),                          // "YYYY-MM-DD"
  vehicleGroup: text("vehicle_group").notNull().default("TMG1 GGV 029"),
  vehicleType: text("vehicle_type").notNull().default("EV VAN"),
  jobNo: text("job_no"),                                 // e.g. S045260062103
  bookingRef: text("booking_ref"),                       // e.g. V045260161488
  timeStart: text("time_start"),                         // "09:00"
  timeEnd: text("time_end"),                             // "12:00"
  listedPrice: numeric("listed_price"),
  deduction: numeric("deduction").default("0"),
  actualPrice: numeric("actual_price"),                  // THE KEY COLUMN
  serviceType: text("service_type"),                     // D+A, R+A+DISS, etc.
  remarks: text("remarks"),
  address: text("address"),
  postalCode: text("postal_code"),
  distanceKm: numeric("distance_km"),
  ratePerKm: numeric("rate_per_km"),
  flagged: boolean("flagged").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
export type GGVJob = typeof ggvJobs.$inferSelect;
export type InsertGGVJob = typeof ggvJobs.$inferInsert;

// Canned Replies — quick reply templates for admin manual responses
export const cannedReplies = pgTable("canned_replies", {
  id: serial("id").primaryKey(),
  shortcut: text("shortcut").notNull().unique(), // e.g. /quote /hours /thanks
  title: text("title").notNull(),
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export type CannedReply = typeof cannedReplies.$inferSelect;
export type InsertCannedReply = typeof cannedReplies.$inferInsert;
export const insertCannedReplySchema = createInsertSchema(cannedReplies).omit({ id: true, createdAt: true });

// Site Analytics Events — tracks customer page views and clicks
export const siteEvents = pgTable("site_events", {
  id: serial("id").primaryKey(),
  event: text("event").notNull(),      // page_view | cta_click | wizard_start | wizard_submit
  page: text("page"),                  // /  /estimate  /quotes/:id
  label: text("label"),                // button label or step name
  referrer: text("referrer"),          // document.referrer
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  sessionId: text("session_id"),       // random ID stored in sessionStorage
  country: text("country"),            // e.g. Singapore
  countryCode: text("country_code"),   // e.g. SG
  city: text("city"),                  // e.g. Singapore
  latitude: text("latitude"),
  longitude: text("longitude"),
  deviceType: text("device_type"),     // mobile | tablet | desktop
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SiteEvent = typeof siteEvents.$inferSelect;

// Zod Schemas
// Blocked Dates/Slots (admin-managed, prevents customer bookings)
export const blockedSlots = pgTable("blocked_slots", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),                     // yyyy-MM-dd
  timeSlot: text("time_slot"),                      // '09:00-12:00' | '13:00-17:00' | null = whole day
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBlockedSlotSchema = createInsertSchema(blockedSlots).omit({ id: true, createdAt: true });
export type BlockedSlot = typeof blockedSlots.$inferSelect;
export type InsertBlockedSlot = z.infer<typeof insertBlockedSlotSchema>;

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true });
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export const insertAttendanceLogSchema = createInsertSchema(attendanceLogs).omit({ id: true, createdAt: true });
export type AttendanceLog = typeof attendanceLogs.$inferSelect;
export type InsertAttendanceLog = z.infer<typeof insertAttendanceLogSchema>;
export type AttendanceLogWithUser = AttendanceLog & { user?: User };

export const insertAttendanceAmendmentSchema = createInsertSchema(attendanceAmendments).omit({ id: true, createdAt: true });
export type AttendanceAmendment = typeof attendanceAmendments.$inferSelect;
export type InsertAttendanceAmendment = z.infer<typeof insertAttendanceAmendmentSchema>;
export type AttendanceAmendmentWithUser = AttendanceAmendment & { user?: User };

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, createdAt: true });
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type LeaveRequestWithUser = LeaveRequest & { user?: User };

export const insertPayslipSchema = createInsertSchema(payslips).omit({ id: true, createdAt: true });
export type Payslip = typeof payslips.$inferSelect;
export type InsertPayslip = z.infer<typeof insertPayslipSchema>;
export type PayslipWithUser = Payslip & { user?: User };

export const insertStaffLoanSchema = createInsertSchema(staffLoans).omit({ id: true, createdAt: true });
export type StaffLoan = typeof staffLoans.$inferSelect;
export type InsertStaffLoan = z.infer<typeof insertStaffLoanSchema>;
export type StaffLoanWithUser = StaffLoan & { user?: User };

// Job Completion Checklist — per-quote checklist items ticked off by staff on-site
export const jobChecklists = pgTable("job_checklists", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").references(() => quotes.id).notNull(),
  item: text("item").notNull(),           // label, e.g. "Items unpacked & checked"
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("done_at"),
  doneByUserId: integer("done_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  checklistQuoteIdx: index("job_checklists_quote_id_idx").on(t.quoteId),
}));
export type JobChecklist = typeof jobChecklists.$inferSelect;

// Customer Portal Tokens — phone-number based OTP for customer self-service portal
export const customerTokens = pgTable("customer_tokens", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),          // customer email (lookup key)
  token: text("token").notNull(),           // 6-digit OTP code
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  customerTokensEmailIdx: index("customer_tokens_email_idx").on(t.email),
}));
export type CustomerToken = typeof customerTokens.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const insertCatalogItemSchema = createInsertSchema(catalogItems).omit({ id: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true });
export const insertQuoteItemSchema = createInsertSchema(quoteItems).omit({ id: true });
export const insertJobUpdateSchema = createInsertSchema(jobUpdates).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type CatalogItem = typeof catalogItems.$inferSelect;
export type InsertCatalogItem = z.infer<typeof insertCatalogItemSchema>;

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;

export type JobUpdate = typeof jobUpdates.$inferSelect;
export type InsertJobUpdate = z.infer<typeof insertJobUpdateSchema>;

// Custom API Request/Response Types

// For customer submitting a quote
export const quoteRequestSchema = z.object({
  customer: z.object({
    name: z.string(),
    email: z.string().email(),
    phone: z.string(),
    companyName: z.string().optional(),
  }),
  serviceAddress: z.string(),
  itemsDescription: z.string(), // Natural language description for AI to parse
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export type QuoteResponse = Quote & {
  customer?: Customer;
  items?: (QuoteItem & { catalogItem?: CatalogItem })[];
  updates?: JobUpdate[];
  assignedStaff?: User;
  assignedTeam?: Team & { members?: User[] };
};

// ─── AI OPERATIONS LAYER ────────────────────────────────────────────────────
// All tables below are isolated from the live workflow and only used by the
// AI ops sidecar (ads agents + site agents). Disabling AI modules has zero
// effect on the existing booking/payment/admin/staff flows.

// Feature flags — master switches for every AI capability
export const aiFeatureFlags = pgTable("ai_feature_flags", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: boolean("value").notNull().default(false),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: text("updated_by"),
});
export type AiFeatureFlag = typeof aiFeatureFlags.$inferSelect;

// Attribution events — full conversion funnel logging
export const aiAttributionEvents = pgTable("ai_attribution_events", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id"),
  referenceNo: text("reference_no"),
  eventType: text("event_type").notNull(), // lead_submitted | deposit_paid | booking_confirmed | final_paid | quote_sent
  source: text("source"),                  // google_ads | meta_ads | organic | whatsapp | direct | referral
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  landingPage: text("landing_page"),
  quoteValue: numeric("quote_value", { precision: 10, scale: 2 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type AiAttributionEvent = typeof aiAttributionEvents.$inferSelect;

// Ads snapshots — manual or API-sourced performance data (Google / Meta)
export const aiAdsSnapshots = pgTable("ai_ads_snapshots", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),         // google | meta
  source: text("source").notNull().default("manual"), // manual | google_ads_api | meta_ads_api
  snapshotDate: text("snapshot_date").notNull(), // YYYY-MM-DD
  campaignId: text("campaign_id"),
  campaignName: text("campaign_name"),
  adSetId: text("ad_set_id"),
  adSetName: text("ad_set_name"),
  adId: text("ad_id"),
  adName: text("ad_name"),
  keyword: text("keyword"),
  matchType: text("match_type"),
  spend: numeric("spend", { precision: 10, scale: 2 }),
  impressions: integer("impressions"),
  clicks: integer("clicks"),
  conversions: numeric("conversions", { precision: 10, scale: 2 }),
  conversionValue: numeric("conversion_value", { precision: 10, scale: 2 }),
  ctr: numeric("ctr", { precision: 10, scale: 4 }),
  cpc: numeric("cpc", { precision: 10, scale: 4 }),
  cpl: numeric("cpl", { precision: 10, scale: 4 }),
  qualityScore: integer("quality_score"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type AiAdsSnapshot = typeof aiAdsSnapshots.$inferSelect;

// Ads recommendations — AI-generated action recommendations
export const aiAdRecommendations = pgTable("ai_ad_recommendations", {
  id: serial("id").primaryKey(),
  platform: text("platform"),                     // google | meta | both
  action: text("action").notNull(),               // cut | keep | scale | test | fix-tracking | pause | negate
  riskLevel: text("risk_level").notNull(),        // low | medium | high
  targetType: text("target_type"),                // campaign | ad_group | ad | keyword
  targetId: text("target_id"),
  targetName: text("target_name"),
  reason: text("reason"),
  sourceData: jsonb("source_data"),
  confidence: numeric("confidence", { precision: 5, scale: 2 }),
  expectedEffect: text("expected_effect"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | applied | deferred
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  appliedAt: timestamp("applied_at"),
  rollbackInfo: text("rollback_info"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type AiAdRecommendation = typeof aiAdRecommendations.$inferSelect;

// Site audits — CRO / SEO / Speed / QA audit runs
export const aiSiteAudits = pgTable("ai_site_audits", {
  id: serial("id").primaryKey(),
  auditType: text("audit_type").notNull(),  // cro | seo | speed | full
  status: text("status").notNull().default("running"),  // running | complete | failed
  score: integer("score"),                  // 0–100
  summary: text("summary"),
  findings: jsonb("findings"),
  triggeredBy: text("triggered_by"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});
export type AiSiteAudit = typeof aiSiteAudits.$inferSelect;

// Site recommendations — CRO / SEO / copy / layout suggestions
export const aiSiteRecommendations = pgTable("ai_site_recommendations", {
  id: serial("id").primaryKey(),
  auditId: integer("audit_id"),
  category: text("category").notNull(),   // cro | seo | speed | trust | copy | layout
  priority: text("priority").notNull(),   // critical | high | medium | low
  page: text("page"),
  title: text("title").notNull(),
  description: text("description"),
  suggestedChange: text("suggested_change"),
  riskLevel: text("risk_level").notNull().default("low"),
  status: text("status").notNull().default("open"), // open | approved | rejected | applied | deferred
  approvedBy: text("approved_by"),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type AiSiteRecommendation = typeof aiSiteRecommendations.$inferSelect;

// Approval queue — all AI-proposed actions awaiting human review
export const aiApprovalQueue = pgTable("ai_approval_queue", {
  id: serial("id").primaryKey(),
  queueType: text("queue_type").notNull(), // ads_change | site_change | creative | budget | negative_keyword
  title: text("title").notNull(),
  description: text("description"),
  riskLevel: text("risk_level").notNull(), // low | medium | high
  confidence: numeric("confidence", { precision: 5, scale: 2 }),
  expectedImpact: text("expected_impact"),
  proposedAction: jsonb("proposed_action"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | deferred
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  refType: text("ref_type"),   // ad_recommendation | site_recommendation
  refId: integer("ref_id"),
  rollbackPath: text("rollback_path"),  // Human-readable rollback instructions
  // Phase 5: manual execution tracking
  executionStatus: text("execution_status"),  // null | "executed" | "execution_failed"
  executedAt: timestamp("executed_at"),
  executedBy: text("executed_by"),
  executionResult: jsonb("execution_result"), // Structured deliverable output
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});
export type AiApprovalItem = typeof aiApprovalQueue.$inferSelect;

// Audit log — immutable record of every AI action (recommendations, approvals, etc.)
export const aiAuditLog = pgTable("ai_audit_log", {
  id: serial("id").primaryKey(),
  actionType: text("action_type").notNull(), // recommendation_generated | action_approved | action_rejected | action_applied | audit_run | publish_event | rollback | flag_changed
  actor: text("actor"),                       // "ai_agent" | admin username
  module: text("module"),                     // ads | site | attribution | flags
  summary: text("summary"),
  detail: jsonb("detail"),
  outcome: text("outcome"),                   // success | failed | skipped
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Spend Guardrails (Phase 9b) ──────────────────────────────────────────────
// Hard daily/monthly SGD ceiling on AI-driven ad-spend changes.
// Each row records the *delta* (new budget − old budget) of an AI-approved
// budget action, plus whether the spend guard let it through. The sum over
// today/month drives the cap enforcement in server/ai-spend-guard.ts.
export const aiSpendLedger = pgTable("ai_spend_ledger", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(),                 // google_ads | meta_ads | other
  sgdDelta: numeric("sgd_delta", { precision: 12, scale: 2 }).notNull().default("0"),
  executionId: integer("execution_id"),               // ai_platform_executions.id (nullable)
  actionType: text("action_type"),                    // adjust_budget | scale | cut | etc.
  campaignName: text("campaign_name"),
  decision: text("decision").notNull().default("allowed"), // allowed | blocked_daily | blocked_monthly
  createdAt: timestamp("created_at").defaultNow(),
});
export type AiSpendLedger = typeof aiSpendLedger.$inferSelect;

// ── LLM Telemetry (Phase 9d — world-class observability) ────────────────────
// One row per LLM call routed through server/ai-llm-client.ts. Powers the
// LLM Health card on the AI Hub, cost dashboards, and retro analysis of
// schema-repair / circuit-breaker behavior.
export const aiLlmCalls = pgTable("ai_llm_calls", {
  id: serial("id").primaryKey(),
  agent: text("agent").notNull(),                     // e.g. whatsapp_extract_facts
  model: text("model").notNull(),                     // gpt-4o, gpt-4o-mini, ...
  latencyMs: integer("latency_ms").notNull().default(0),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  costSgd: numeric("cost_sgd", { precision: 12, scale: 6 }).notNull().default("0"),
  success: boolean("success").notNull().default(false),
  errorMessage: text("error_message"),                // null on success
  schemaRepaired: boolean("schema_repaired").notNull().default(false),
  attempts: integer("attempts").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});
export type AiLlmCall = typeof aiLlmCalls.$inferSelect;

// ── Customer Ratings (Phase 9c — feedback loop) ─────────────────────────────
// Captures post-job customer ratings (1-5) collected via WhatsApp prompt
// after closeCase. Joins back to whatsapp_sessions.lead_score for tuning the
// AI scorer (does our "hot lead" actually satisfy more than our "cold"?).
export const customerRatings = pgTable("customer_ratings", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id"),
  phone: text("phone").notNull(),
  rating: integer("rating"),                          // 1..5, null while pending
  comment: text("comment"),
  source: text("source").notNull().default("whatsapp"), // whatsapp | review_link | manual
  status: text("status").notNull().default("pending"),  // pending | answered | declined
  promptedAt: timestamp("prompted_at").defaultNow(),
  answeredAt: timestamp("answered_at"),
});
export type CustomerRating = typeof customerRatings.$inferSelect;

// ── Phase 2: Live Data Connectors ────────────────────────────────────────────

// Connector configs — one row per connector, tracks sync state
export const aiConnectorConfigs = pgTable("ai_connector_configs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),           // google_ads | meta_ads | search_console | pagespeed
  enabled: boolean("enabled").notNull().default(false),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status").notNull().default("never"), // never | running | success | error
  syncError: text("sync_error"),
  accountId: text("account_id"),
  extraConfig: jsonb("extra_config"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type AiConnectorConfig = typeof aiConnectorConfigs.$inferSelect;

// Search Console data — keyword/page performance from Google Search Console API
export const aiSearchConsoleData = pgTable("ai_search_console_data", {
  id: serial("id").primaryKey(),
  syncId: text("sync_id"),
  date: text("date").notNull(),
  query: text("query"),
  page: text("page"),
  country: text("country"),
  device: text("device"),
  clicks: integer("clicks").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  ctr: numeric("ctr", { precision: 10, scale: 4 }),
  position: numeric("position", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  gscSyncIdx: index("ai_gsc_sync_id_idx").on(t.syncId),
  gscClicksIdx: index("ai_gsc_clicks_idx").on(t.clicks),
}));
export type AiSearchConsoleRow = typeof aiSearchConsoleData.$inferSelect;

// PageSpeed data — CWV and performance scores from PageSpeed Insights API
export const aiPagespeedData = pgTable("ai_pagespeed_data", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  strategy: text("strategy").notNull().default("mobile"), // mobile | desktop
  performanceScore: integer("performance_score"),
  accessibilityScore: integer("accessibility_score"),
  seoScore: integer("seo_score"),
  bestPracticesScore: integer("best_practices_score"),
  fcpMs: integer("fcp_ms"),
  lcpMs: integer("lcp_ms"),
  clsScore: numeric("cls_score", { precision: 10, scale: 4 }),
  ttfbMs: integer("ttfb_ms"),
  rawAudits: jsonb("raw_audits"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  psStrategyIdx: index("ai_pagespeed_strategy_idx").on(t.strategy, t.createdAt),
}));
export type AiPagespeedRow = typeof aiPagespeedData.$inferSelect;

// ── Phase 7: Platform Execution Records ──────────────────────────────────────
// Stores the result of every attempt to push an approved action to Google Ads
// or Meta Ads. One row per platform execution attempt. Completely isolated from
// the live booking/payment/customer workflow.

export const aiPlatformExecutions = pgTable("ai_platform_executions", {
  id: serial("id").primaryKey(),
  approvalQueueId: integer("approval_queue_id").notNull(),
  recommendationId: integer("recommendation_id"),
  platform: text("platform").notNull(),           // google_ads | meta_ads
  actionType: text("action_type").notNull(),      // negative_keyword_add | pause_ad | enable_ad | pause_adset | enable_adset | adjust_budget | export_only
  targetObjectIds: jsonb("target_object_ids"),    // { campaignId, adGroupId, adId, adSetId, budgetId, … }
  proposedChange: jsonb("proposed_change"),       // What we intended to do
  executedChange: jsonb("executed_change"),       // What was actually sent / confirmed
  actor: text("actor").notNull().default("system"),
  resultStatus: text("result_status").notNull().default("pending"), // success | failed | test_mode | export_only | missing_ids
  platformResponseSummary: text("platform_response_summary"),
  platformResponseRaw: jsonb("platform_response_raw"),
  rollbackPath: text("rollback_path"),            // Human-readable recovery path
  rollbackPayload: jsonb("rollback_payload"),     // Exact API payload to reverse the change
  errorMessage: text("error_message"),
  testMode: boolean("test_mode").notNull().default(false),
  rolledBackAt: timestamp("rolled_back_at"),
  rolledBackBy: text("rolled_back_by"),
  rollbackStatus: text("rollback_status"),        // success | failed | manual_required
  rollbackError: text("rollback_error"),
  baselineMetric: jsonb("baseline_metric"),       // { ctr, conversions, clicks, spend, windowDays } captured at exec time for self-healing
  selfHealingCheckedAt: timestamp("self_healing_checked_at"), // last time the self-healer evaluated this exec
  createdAt: timestamp("created_at").defaultNow(),
});
export type AiPlatformExecution = typeof aiPlatformExecutions.$inferSelect;

// ── Site settings (live overrides written by AI Site agent on approve) ───────
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),  // e.g. "meta_title:/", "h1:/", "cta_text:/estimate"
  settingValue: text("setting_value").notNull(),
  previousValue: text("previous_value"),               // For one-click rollback
  page: text("page"),                                  // e.g. "/" or "/estimate"
  field: text("field"),                                // e.g. "meta_title", "meta_description", "h1", "cta_text"
  source: text("source").default("ai_agent"),          // ai_agent | manual
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: text("updated_by"),
});
export type SiteSetting = typeof siteSettings.$inferSelect;

// ── Phase 9: WhatsApp AI Sales Agent ─────────────────────────────────────────

export const aiWhatsappFollowups = pgTable("ai_whatsapp_followups", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  followupType: text("followup_type").notNull(), // missing_info | quote_reminder | deposit_reminder | booking_reminder | stale_reactivation
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  status: text("status").notNull().default("pending"), // pending | sent | skipped | cancelled
  messagePreview: text("message_preview"),
  skipReason: text("skip_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  followupPhoneIdx: index("ai_whatsapp_followups_phone_idx").on(t.phone),
  followupStatusIdx: index("ai_whatsapp_followups_status_idx").on(t.status, t.scheduledAt),
}));
export type AiWhatsappFollowup = typeof aiWhatsappFollowups.$inferSelect;

export const aiWhatsappHandoffs = pgTable("ai_whatsapp_handoffs", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  reason: text("reason").notNull(),        // low_confidence | frustrated | custom_pricing | dispute | unsupported_service | unknown
  handedAt: timestamp("handed_at").defaultNow(),
  handedBy: text("handed_by").default("ai"), // 'ai' | 'admin:<user>'
  notes: text("notes"),
  resumedAt: timestamp("resumed_at"),       // null = still with human
  resumedBy: text("resumed_by"),
}, (t) => ({
  handoffPhoneIdx: index("ai_whatsapp_handoffs_phone_idx").on(t.phone),
}));
export type AiWhatsappHandoff = typeof aiWhatsappHandoffs.$inferSelect;

// ── Subcontractors ─────────────────────────────────────────────────────────
export const subcontractors = pgTable("subcontractors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  company: text("company"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSubcontractorSchema = createInsertSchema(subcontractors).omit({ id: true, createdAt: true });
export type InsertSubcontractor = z.infer<typeof insertSubcontractorSchema>;
export type Subcontractor = typeof subcontractors.$inferSelect;

// ── Job Subcontracts (links a quote to a subcontractor with cost) ──────────
export const jobSubcontracts = pgTable("job_subcontracts", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").references(() => quotes.id).notNull(),
  subcontractorId: integer("subcontractor_id").references(() => subcontractors.id).notNull(),
  agreedCost: numeric("agreed_cost").notNull(),         // what TMG pays the sub
  paymentStatus: text("payment_status").notNull().default("unpaid"), // 'unpaid' | 'paid'
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  jobSubcontractQuoteIdx: index("job_subcontracts_quote_idx").on(t.quoteId),
  jobSubcontractSubIdx: index("job_subcontracts_sub_idx").on(t.subcontractorId),
}));
export const insertJobSubcontractSchema = createInsertSchema(jobSubcontracts).omit({ id: true, createdAt: true });
export type InsertJobSubcontract = z.infer<typeof insertJobSubcontractSchema>;
export type JobSubcontract = typeof jobSubcontracts.$inferSelect;

// ── Partial Leads (abandoned web wizard capture) ──────────────────────────
export const partialLeads = pgTable("partial_leads", {
  id: serial("id").primaryKey(),
  resumeToken: text("resume_token").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  phone: text("phone"),
  services: jsonb("services"),
  serviceAddress: text("service_address"),
  pickupAddress: text("pickup_address"),
  dropoffAddress: text("dropoff_address"),
  items: jsonb("items"),
  slotDateStr: text("slot_date_str"),
  status: text("status").notNull().default("pending"),
  emailSentAt: timestamp("email_sent_at"),
  whatsappSentAt: timestamp("whatsapp_sent_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
}, (t) => ({
  partialLeadsTokenIdx: index("partial_leads_token_idx").on(t.resumeToken),
  partialLeadsStatusIdx: index("partial_leads_status_idx").on(t.status, t.createdAt),
}));
export type PartialLead = typeof partialLeads.$inferSelect;
