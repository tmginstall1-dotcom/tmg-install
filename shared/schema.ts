import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users (Admin/Staff)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('staff'), // 'admin' | 'staff'
  name: text("name").notNull(),
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
export const quotesRelations = relations(quotes, ({ one, many }) => ({
  customer: one(customers, { fields: [quotes.customerId], references: [customers.id] }),
  assignedStaff: one(users, { fields: [quotes.assignedStaffId], references: [users.id] }),
  items: many(quoteItems),
  updates: many(jobUpdates),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteItems.quoteId], references: [quotes.id] }),
  catalogItem: one(catalogItems, { fields: [quoteItems.catalogItemId], references: [catalogItems.id] }),
}));

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
};
