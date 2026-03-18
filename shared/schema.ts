import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow(),
});

// Users (Admin/Staff)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('staff'), // 'admin' | 'staff'
  name: text("name").notNull(),
  teamId: integer("team_id").references(() => teams.id),
  // Payroll fields
  payType: text("pay_type").default("hourly"),        // 'hourly' | 'monthly'
  monthlyRate: numeric("monthly_rate").default("0"),  // SGD per month base salary
  hourlyRate: numeric("hourly_rate").default("0"),    // SGD per hour, first 8 hrs/day
  overtimeRate: numeric("overtime_rate").default("0"),// SGD per hour, after 8 hrs/day
  annualLeaveEntitlement: integer("annual_leave_entitlement").default(14), // days per year
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
});

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
});

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
});

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
  leaveDeduction: numeric("leave_deduction").default("0"),
  grossPay: numeric("gross_pay").default("0"),
  notes: text("notes"),
  generatedBy: integer("generated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customers
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  companyName: text("company_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Catalog Items
export const catalogItems = pgTable("catalog_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku"),
  category: text("category"),
  serviceType: text("service_type").notNull(), // 'install', 'dismantle', 'relocate'
  basePrice: numeric("base_price").notNull(),
  active: boolean("active").default(true),
});

// Quotes / Jobs
// Status machine:
// submitted → deposit_requested → deposit_paid → booking_requested → booked → assigned → in_progress → completed → final_payment_requested → final_paid → closed
// Also: cancelled (any time)
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  referenceNo: text("reference_no").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id),
  serviceAddress: text("service_address").notNull(),
  status: text("status").notNull().default("submitted"),

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

  notes: text("notes"), // admin internal notes
  detectionPhotoUrl: text("detection_photo_url"), // thumbnail from AI photo scan at submission

  createdAt: timestamp("created_at").defaultNow(),
});

// Quote Items
export const quoteItems = pgTable("quote_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").references(() => quotes.id).notNull(),
  catalogItemId: integer("catalog_item_id").references(() => catalogItems.id),
  originalDescription: text("original_description").notNull(),
  detectedName: text("detected_name"),
  serviceType: text("service_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price").notNull().default("0"),
  subtotal: numeric("subtotal").notNull().default("0"),
});

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
});

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, { fields: [users.teamId], references: [teams.id] }),
  attendanceLogs: many(attendanceLogs),
  leaveRequests: many(leaveRequests),
  payslips: many(payslips),
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
