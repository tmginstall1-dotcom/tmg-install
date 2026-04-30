import { db } from "./db";
import { 
  users, customers, catalogItems, quotes, quoteItems, jobUpdates, blockedSlots, teams, attendanceLogs,
  attendanceAmendments, leaveRequests, payslips, staffLoans, gpsTrackPoints, siteEvents, whatsappSessions, whatsappMessages,
  receipts, faqEntries, cannedReplies, pricingCorrections, ggvJobs,
  type InsertUser, type InsertCustomer, type InsertCatalogItem, type InsertQuote, type InsertQuoteItem, type InsertJobUpdate,
  type QuoteResponse, type InsertBlockedSlot, type BlockedSlot,
  type Team, type InsertTeam, type AttendanceLog, type InsertAttendanceLog, type AttendanceLogWithUser,
  type AttendanceAmendment, type AttendanceAmendmentWithUser,
  type LeaveRequest, type LeaveRequestWithUser,
  type Payslip, type PayslipWithUser,
  type StaffLoan, type InsertStaffLoan,
  type GpsTrackPoint, type SiteEvent, type WhatsAppSession, type WhatsAppMessage,
  type Receipt, type ReceiptWithUser,
  type FaqEntry, type InsertFaqEntry, type CannedReply, type InsertCannedReply,
  type PricingCorrection, type InsertPricingCorrection,
  type GGVJob, type InsertGGVJob,
  subcontractors, jobSubcontracts,
  type Subcontractor, type InsertSubcontractor,
  type JobSubcontract, type InsertJobSubcontract,
  partialLeads, type PartialLead,
} from "@shared/schema";
import { eq, desc, or, inArray, isNotNull, and, not, gte, lte, isNull, sql, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserByUsername(username: string): Promise<typeof users.$inferSelect | undefined>;
  getUserById(id: number): Promise<typeof users.$inferSelect | undefined>;
  getStaffMembers(): Promise<typeof users.$inferSelect[]>;
  createUser(user: InsertUser): Promise<typeof users.$inferSelect>;
  updateUser(id: number, data: Partial<typeof users.$inferInsert>): Promise<typeof users.$inferSelect | undefined>;
  deleteUser(id: number): Promise<void>;

  // Teams
  getTeams(): Promise<(Team & { members: typeof users.$inferSelect[] })[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, data: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<void>;
  assignUserToTeam(userId: number, teamId: number | null): Promise<void>;
  getTeammateIds(userId: number): Promise<number[]>;

  // Attendance
  clockIn(userId: number, lat?: string, lng?: string): Promise<AttendanceLog>;
  clockOut(userId: number, lat?: string, lng?: string): Promise<AttendanceLog | undefined>;
  getTodayAttendance(userId: number): Promise<AttendanceLog | undefined>;
  getAttendanceLogs(from?: Date, to?: Date, userId?: number): Promise<AttendanceLogWithUser[]>;
  getAttendanceLog(id: number): Promise<AttendanceLog | undefined>;
  createAttendanceLog(data: { userId: number; clockInAt: Date; clockOutAt?: Date | null; notes?: string }): Promise<AttendanceLog>;
  updateAttendanceLog(id: number, data: { clockInAt?: Date; clockOutAt?: Date | null; notes?: string }): Promise<AttendanceLog | undefined>;
  deleteAttendanceLog(id: number): Promise<void>;

  // GPS Track Points
  addGpsTrackPoint(data: { userId: number; lat: string; lng: string; accuracy?: string; speed?: string; heading?: string; recordedAt?: Date }): Promise<GpsTrackPoint>;
  getGpsTrackPoints(userId: number, dateFrom: Date, dateTo: Date): Promise<GpsTrackPoint[]>;

  // Amendments
  createAmendment(data: Omit<typeof attendanceAmendments.$inferInsert, 'id' | 'createdAt'>): Promise<AttendanceAmendment>;
  getAmendmentsByUser(userId: number): Promise<AttendanceAmendmentWithUser[]>;
  getPendingAmendments(): Promise<AttendanceAmendmentWithUser[]>;
  reviewAmendment(id: number, status: 'approved' | 'rejected', adminNote: string, reviewedBy: number): Promise<AttendanceAmendment | undefined>;

  // Leave Requests
  createLeaveRequest(data: Omit<typeof leaveRequests.$inferInsert, 'id' | 'createdAt'>): Promise<LeaveRequest>;
  getLeaveRequestsByUser(userId: number): Promise<LeaveRequest[]>;
  getAllLeaveRequests(status?: string): Promise<LeaveRequestWithUser[]>;
  reviewLeaveRequest(id: number, status: 'approved' | 'rejected', adminNote: string, reviewedBy: number): Promise<LeaveRequest | undefined>;
  getLeaveBalance(userId: number, year: number): Promise<{ entitlement: number; used: number; pending: number; remaining: number }>;

  // Pay Settings
  updatePaySettings(userId: number, settings: { payType?: string; monthlyRate?: string; hourlyRate?: string; overtimeRate?: string; annualLeaveEntitlement?: number }): Promise<typeof users.$inferSelect | undefined>;
  updateFcmToken(userId: number, token: string): Promise<void>;
  getFcmTokensByUserIds(userIds: number[]): Promise<string[]>;

  // Payslips
  generatePayslip(data: Omit<typeof payslips.$inferInsert, 'id' | 'createdAt'>): Promise<Payslip>;
  getPayslipsByUser(userId: number): Promise<Payslip[]>;
  getAllPayslips(userId?: number): Promise<PayslipWithUser[]>;
  deletePayslip(id: number): Promise<void>;

  // Staff Loans
  getStaffLoans(userId?: number): Promise<StaffLoan[]>;
  createStaffLoan(data: InsertStaffLoan): Promise<StaffLoan>;
  updateStaffLoan(id: number, data: Partial<InsertStaffLoan>): Promise<StaffLoan | undefined>;
  deleteStaffLoan(id: number): Promise<void>;

  // Catalog
  getCatalogItems(search?: string): Promise<typeof catalogItems.$inferSelect[]>;
  createCatalogItem(item: InsertCatalogItem): Promise<typeof catalogItems.$inferSelect>;

  // Admin Utilities
  clearAllData(): Promise<void>;

  // Quotes
  getQuotes(status?: string): Promise<QuoteResponse[]>;
  getQuotesByStatuses(statuses: string[]): Promise<QuoteResponse[]>;
  getQuotesForStaff(staffId: number): Promise<QuoteResponse[]>;
  getQuote(id: number): Promise<QuoteResponse | undefined>;
  createQuote(customer: InsertCustomer, quote: Omit<InsertQuote, 'customerId'>, items: InsertQuoteItem[]): Promise<QuoteResponse>;
  updateQuoteStatus(id: number, status: string, updateRecord?: Omit<InsertJobUpdate, 'quoteId' | 'statusChange'>, assignedStaffId?: number, assignedTeamId?: number | null): Promise<QuoteResponse | undefined>;
  updateQuotePayment(id: number, paymentType: 'deposit' | 'final', amount: string): Promise<QuoteResponse | undefined>;
  requestBooking(id: number, scheduledAt: Date, timeWindow: string): Promise<QuoteResponse | undefined>;
  confirmBooking(id: number): Promise<QuoteResponse | undefined>;
  rescheduleBooking(id: number, scheduledAt: Date, timeWindow: string): Promise<QuoteResponse | undefined>;
  editQuote(id: number, data: {
    customerUpdates?: Partial<typeof customers.$inferInsert>;
    quoteUpdates?: Partial<typeof quotes.$inferInsert>;
    items?: Omit<InsertQuoteItem, 'quoteId'>[];
  }): Promise<QuoteResponse | undefined>;
  updateAdditionalCharge(id: number, additionalCharge: string, additionalChargeNote: string): Promise<QuoteResponse | undefined>;
  addJobUpdate(update: InsertJobUpdate): Promise<void>;
  deleteQuote(id: number): Promise<void>;

  // Blocked Slots
  getBlockedSlots(): Promise<BlockedSlot[]>;
  createBlockedSlot(slot: InsertBlockedSlot): Promise<BlockedSlot>;
  deleteBlockedSlot(id: number): Promise<void>;

  // Held Slots (active quotes that have a slot reserved)
  getHeldSlots(): Promise<{ date: string; timeSlot: string; quoteId: number }[]>;
  getSlotCapacities(): Promise<{ date: string; timeSlot: string; usedAmount: number }[]>;
  isSlotAvailable(date: string, timeWindow: string, excludeQuoteId?: number): Promise<boolean>;

  // WhatsApp Sessions
  getWhatsAppSession(phone: string): Promise<WhatsAppSession | undefined>;
  upsertWhatsAppSession(phone: string, data: Partial<Omit<WhatsAppSession, 'id' | 'phone' | 'createdAt'>>): Promise<WhatsAppSession>;
  deleteWhatsAppSession(phone: string): Promise<void>;

  // WhatsApp Message Log
  logWhatsAppMessage(data: { phone: string; direction: 'inbound' | 'outbound'; body: string; mediaType?: string; mediaUrl?: string; wamid?: string; sentBy?: string }): Promise<WhatsAppMessage>;
  getWhatsAppMessages(phone: string, limit?: number): Promise<WhatsAppMessage[]>;
  getWhatsAppConversations(): Promise<{ phone: string; name: string | null; lastMessage: string; lastAt: Date; unreadCount: number; state: string | null; botPaused: boolean }[]>;
  markWhatsAppMessagesRead(phone: string): Promise<void>;

  // Receipts
  createReceipt(userId: number, data: { receiptDate: string; amount: string; category: string; description?: string; fileData: string; fileType: string; fileName: string }): Promise<Receipt>;
  getReceiptsByUser(userId: number): Promise<Receipt[]>;
  getAllReceipts(filters?: { year?: number; month?: number; day?: number }): Promise<ReceiptWithUser[]>;
  getReceiptById(id: number): Promise<Receipt | undefined>;
  updateReceiptStatus(id: number, status: 'approved' | 'rejected', adminNote: string | null, reviewedBy: number): Promise<Receipt | undefined>;
  deleteReceipt(id: number): Promise<void>;

  // FAQ Entries
  getFaqEntries(activeOnly?: boolean): Promise<FaqEntry[]>;
  createFaqEntry(data: InsertFaqEntry): Promise<FaqEntry>;
  updateFaqEntry(id: number, data: Partial<InsertFaqEntry>): Promise<FaqEntry | undefined>;
  deleteFaqEntry(id: number): Promise<void>;

  // Canned Replies
  getCannedReplies(activeOnly?: boolean): Promise<CannedReply[]>;
  createCannedReply(data: InsertCannedReply): Promise<CannedReply>;
  updateCannedReply(id: number, data: Partial<InsertCannedReply>): Promise<CannedReply | undefined>;
  deleteCannedReply(id: number): Promise<void>;

  // Pricing Corrections (self-learning)
  getPricingCorrections(activeOnly?: boolean): Promise<PricingCorrection[]>;
  createPricingCorrection(data: InsertPricingCorrection): Promise<PricingCorrection>;
  updatePricingCorrection(id: number, data: Partial<InsertPricingCorrection>): Promise<PricingCorrection | undefined>;
  deletePricingCorrection(id: number): Promise<void>;

  // GGV Jobs
  getGGVJobs(date: string): Promise<GGVJob[]>;
  createGGVJob(data: InsertGGVJob): Promise<GGVJob>;
  updateGGVJob(id: number, data: Partial<InsertGGVJob>): Promise<GGVJob | undefined>;
  deleteGGVJob(id: number): Promise<void>;

  // Site Analytics
  addSiteEvent(data: { event: string; page?: string; label?: string; referrer?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; sessionId?: string; deviceType?: string }): Promise<SiteEvent>;
  updateSiteEventGeo(id: number, geo: { country?: string; countryCode?: string; city?: string; latitude?: string; longitude?: string }): Promise<void>;
  getSiteAnalytics(days?: number): Promise<{
    days: number;
    today: { pageViews: number; sessions: number; wizardStarts: number; wizardSubmits: number; bounceRate: number; avgPagesPerSession: number };
    yesterday: { pageViews: number; sessions: number; wizardStarts: number; wizardSubmits: number; bounceRate: number; avgPagesPerSession: number };
    trend: { date: string; pageViews: number; sessions: number }[];
    sources: { source: string; count: number }[];
    funnel: { step: string; count: number }[];
    countries: { country: string; countryCode: string; count: number; lat: number; lng: number }[];
    cities: { city: string; country: string; countryCode: string; count: number; lat: number; lng: number }[];
    devices: { device: string; count: number }[];
    hourly: { hour: number; count: number }[];
    topPages: { page: string; count: number }[];
    utmCampaigns: { campaign: string; source: string; count: number }[];
    recent: SiteEvent[];
  }>;

  // Subcontractors
  getSubcontractors(): Promise<Subcontractor[]>;
  getSubcontractorById(id: number): Promise<Subcontractor | undefined>;
  createSubcontractor(data: InsertSubcontractor): Promise<Subcontractor>;
  updateSubcontractor(id: number, data: Partial<InsertSubcontractor>): Promise<Subcontractor | undefined>;
  deleteSubcontractor(id: number): Promise<void>;

  // Job Subcontracts
  getJobSubcontracts(quoteId: number): Promise<(JobSubcontract & { subcontractor: Subcontractor })[]>;
  getSubcontractorJobs(subcontractorId: number): Promise<(JobSubcontract & { quoteRef: string; customerName: string | null; scheduledAt: Date | null; quoteTotal: string | null })[]>;
  assignSubcontract(data: InsertJobSubcontract): Promise<JobSubcontract>;
  updateJobSubcontract(id: number, data: Partial<Pick<JobSubcontract, 'agreedCost' | 'paymentStatus' | 'paidAt' | 'notes'>>): Promise<JobSubcontract | undefined>;
  deleteJobSubcontract(id: number): Promise<void>;
  getSubcontractSummary(): Promise<{
    totalRevenue: number;
    totalSubCosts: number;
    netProfit: number;
    totalUnpaid: number;
    payables: { subcontractorId: number; name: string; company: string | null; unpaidCount: number; unpaidTotal: number }[];
  }>;

  // Partial Leads
  createPartialLead(data: { resumeToken: string; email: string; name?: string; phone?: string; services?: any; serviceAddress?: string; pickupAddress?: string; dropoffAddress?: string; items?: any; slotDateStr?: string }): Promise<import("@shared/schema").PartialLead>;
  updatePartialLead(token: string, data: Partial<{ name: string; phone: string; services: any; serviceAddress: string; pickupAddress: string; dropoffAddress: string; items: any; slotDateStr: string; lastActiveAt: Date }>): Promise<void>;
  markPartialLeadCompleted(token: string): Promise<void>;
  getPartialLeadByToken(token: string): Promise<import("@shared/schema").PartialLead | undefined>;
  getDuePartialLeads(olderThanMs: number): Promise<import("@shared/schema").PartialLead[]>;
  markPartialLeadEmailSent(token: string): Promise<void>;
  markPartialLeadWhatsappSent(token: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserById(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getStaffMembers() {
    return await db.select().from(users).where(eq(users.role, 'staff'));
  }

  async createUser(user: InsertUser) {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: number, data: Partial<typeof users.$inferInsert>) {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number) {
    // Nullify FK references before deleting to avoid constraint errors
    await db.update(quotes).set({ assignedStaffId: null }).where(eq(quotes.assignedStaffId, id));
    await db.update(attendanceAmendments).set({ reviewedBy: null } as any).where(eq(attendanceAmendments.reviewedBy, id));
    await db.update(leaveRequests).set({ reviewedBy: null } as any).where(eq(leaveRequests.reviewedBy, id));
    await db.update(payslips).set({ generatedBy: null } as any).where(eq(payslips.generatedBy, id));
    // Delete owned records
    await db.delete(gpsTrackPoints).where(eq(gpsTrackPoints.userId, id));
    // Delete amendment records that reference this user's attendance logs
    const userLogs = await db.select({ id: attendanceLogs.id }).from(attendanceLogs).where(eq(attendanceLogs.userId, id));
    if (userLogs.length > 0) {
      const logIds = userLogs.map(l => l.id);
      await db.delete(attendanceAmendments).where(inArray(attendanceAmendments.attendanceLogId, logIds));
    }
    await db.delete(attendanceAmendments).where(eq(attendanceAmendments.userId, id));
    await db.delete(attendanceLogs).where(eq(attendanceLogs.userId, id));
    await db.delete(leaveRequests).where(eq(leaveRequests.userId, id));
    await db.delete(payslips).where(eq(payslips.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  // Teams
  async getTeams() {
    const allTeams = await db.select().from(teams).orderBy(teams.name);
    const allStaff = await db.select().from(users).where(eq(users.role, 'staff'));
    return allTeams.map(team => ({
      ...team,
      members: allStaff.filter(u => u.teamId === team.id),
    }));
  }

  async createTeam(team: InsertTeam) {
    const [created] = await db.insert(teams).values(team).returning();
    return created;
  }

  async updateTeam(id: number, data: Partial<InsertTeam>) {
    const [updated] = await db.update(teams).set(data).where(eq(teams.id, id)).returning();
    return updated;
  }

  async deleteTeam(id: number) {
    await db.update(users).set({ teamId: null }).where(eq(users.teamId, id));
    await db.delete(teams).where(eq(teams.id, id));
  }

  async assignUserToTeam(userId: number, teamId: number | null) {
    await db.update(users).set({ teamId }).where(eq(users.id, userId));
  }

  async getTeammateIds(userId: number): Promise<number[]> {
    const [me] = await db.select().from(users).where(eq(users.id, userId));
    if (!me?.teamId) return [userId];
    const teammates = await db.select({ id: users.id }).from(users).where(eq(users.teamId, me.teamId));
    return teammates.map(t => t.id);
  }

  // Attendance
  async clockIn(userId: number, lat?: string, lng?: string): Promise<AttendanceLog> {
    const [log] = await db.insert(attendanceLogs).values({
      userId,
      clockInAt: new Date(),
      clockInLat: lat,
      clockInLng: lng,
    }).returning();
    return log;
  }

  async clockOut(userId: number, lat?: string, lng?: string): Promise<AttendanceLog | undefined> {
    // Find the most recent open record (no clockOutAt)
    const [open] = await db.select().from(attendanceLogs)
      .where(and(eq(attendanceLogs.userId, userId), isNull(attendanceLogs.clockOutAt)))
      .orderBy(desc(attendanceLogs.clockInAt))
      .limit(1);
    if (!open) return undefined;
    const [updated] = await db.update(attendanceLogs)
      .set({ clockOutAt: new Date(), clockOutLat: lat, clockOutLng: lng })
      .where(eq(attendanceLogs.id, open.id))
      .returning();
    return updated;
  }

  async getTodayAttendance(userId: number): Promise<AttendanceLog | undefined> {
    // Use Singapore time (UTC+8) for day boundaries
    const SGT = 8 * 3600000;
    const sgtNow = new Date(Date.now() + SGT);
    const y = sgtNow.getUTCFullYear(), mo = sgtNow.getUTCMonth(), d = sgtNow.getUTCDate();
    const todayStart = new Date(Date.UTC(y, mo, d, 0, 0, 0) - SGT);
    const todayEnd   = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999) - SGT);
    const [log] = await db.select().from(attendanceLogs)
      .where(and(
        eq(attendanceLogs.userId, userId),
        gte(attendanceLogs.clockInAt, todayStart),
        lte(attendanceLogs.clockInAt, todayEnd)
      ))
      .orderBy(desc(attendanceLogs.clockInAt))
      .limit(1);
    return log;
  }

  async getAttendanceLogs(from?: Date, to?: Date, userId?: number): Promise<AttendanceLogWithUser[]> {
    const conditions = [];
    if (from) conditions.push(gte(attendanceLogs.clockInAt, from));
    if (to) conditions.push(lte(attendanceLogs.clockInAt, to));
    if (userId) conditions.push(eq(attendanceLogs.userId, userId));

    const logs = await db.select().from(attendanceLogs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(attendanceLogs.clockInAt));

    const staffList = await db.select().from(users);
    return logs.map(log => ({
      ...log,
      user: staffList.find(u => u.id === log.userId),
    }));
  }

  async getAttendanceLog(id: number): Promise<AttendanceLog | undefined> {
    const [log] = await db.select().from(attendanceLogs).where(eq(attendanceLogs.id, id));
    return log;
  }

  async createAttendanceLog(data: { userId: number; clockInAt: Date; clockOutAt?: Date | null; notes?: string }): Promise<AttendanceLog> {
    const [log] = await db.insert(attendanceLogs).values({
      userId: data.userId,
      clockInAt: data.clockInAt,
      clockOutAt: data.clockOutAt ?? null,
      notes: data.notes ?? null,
    }).returning();
    return log;
  }

  async updateAttendanceLog(id: number, data: { clockInAt?: Date; clockOutAt?: Date | null; notes?: string }): Promise<AttendanceLog | undefined> {
    const updates: any = {};
    if (data.clockInAt !== undefined) updates.clockInAt = data.clockInAt;
    if (data.clockOutAt !== undefined) updates.clockOutAt = data.clockOutAt;
    if (data.notes !== undefined) updates.notes = data.notes;
    const [updated] = await db.update(attendanceLogs).set(updates).where(eq(attendanceLogs.id, id)).returning();
    return updated;
  }

  async deleteAttendanceLog(id: number): Promise<void> {
    await db.delete(attendanceAmendments).where(eq(attendanceAmendments.attendanceLogId, id));
    await db.delete(attendanceLogs).where(eq(attendanceLogs.id, id));
  }

  // GPS Track Points
  async addGpsTrackPoint(data: { userId: number; lat: string; lng: string; accuracy?: string; speed?: string; heading?: string; recordedAt?: Date }): Promise<GpsTrackPoint> {
    const [pt] = await db.insert(gpsTrackPoints).values({
      userId: data.userId,
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy ?? null,
      speed: data.speed ?? null,
      heading: data.heading ?? null,
      recordedAt: data.recordedAt ?? new Date(),
    }).returning();
    return pt;
  }

  async getGpsTrackPoints(userId: number, dateFrom: Date, dateTo: Date): Promise<GpsTrackPoint[]> {
    return db.select().from(gpsTrackPoints)
      .where(and(
        eq(gpsTrackPoints.userId, userId),
        gte(gpsTrackPoints.recordedAt, dateFrom),
        lte(gpsTrackPoints.recordedAt, dateTo),
      ))
      .orderBy(gpsTrackPoints.recordedAt);
  }

  // Amendments
  async createAmendment(data: Omit<typeof attendanceAmendments.$inferInsert, 'id' | 'createdAt'>): Promise<AttendanceAmendment> {
    const [created] = await db.insert(attendanceAmendments).values(data).returning();
    return created;
  }

  async getAmendmentsByUser(userId: number): Promise<AttendanceAmendmentWithUser[]> {
    const rows = await db.select().from(attendanceAmendments)
      .where(eq(attendanceAmendments.userId, userId))
      .orderBy(desc(attendanceAmendments.createdAt));
    const allUsers = await db.select().from(users);
    return rows.map(r => ({ ...r, user: allUsers.find(u => u.id === r.userId) }));
  }

  async getPendingAmendments(): Promise<AttendanceAmendmentWithUser[]> {
    const rows = await db.select().from(attendanceAmendments)
      .orderBy(desc(attendanceAmendments.createdAt));
    const allUsers = await db.select().from(users);
    return rows.map(r => ({ ...r, user: allUsers.find(u => u.id === r.userId) }));
  }

  async reviewAmendment(id: number, status: 'approved' | 'rejected', adminNote: string, reviewedBy: number): Promise<AttendanceAmendment | undefined> {
    const [amendment] = await db.select().from(attendanceAmendments).where(eq(attendanceAmendments.id, id));
    if (!amendment) return undefined;
    if (status === 'approved') {
      // Apply the corrected times to the attendance log
      const updates: any = {};
      if (amendment.requestedClockIn) updates.clockInAt = amendment.requestedClockIn;
      if (amendment.requestedClockOut) updates.clockOutAt = amendment.requestedClockOut;
      if (Object.keys(updates).length > 0) {
        await db.update(attendanceLogs).set(updates).where(eq(attendanceLogs.id, amendment.attendanceLogId));
      }
    }
    const [updated] = await db.update(attendanceAmendments)
      .set({ status, adminNote, reviewedBy, reviewedAt: new Date() })
      .where(eq(attendanceAmendments.id, id))
      .returning();
    return updated;
  }

  // Leave Requests
  async createLeaveRequest(data: Omit<typeof leaveRequests.$inferInsert, 'id' | 'createdAt'>): Promise<LeaveRequest> {
    const [created] = await db.insert(leaveRequests).values(data).returning();
    return created;
  }

  async getLeaveRequestsByUser(userId: number): Promise<LeaveRequest[]> {
    return db.select().from(leaveRequests)
      .where(eq(leaveRequests.userId, userId))
      .orderBy(desc(leaveRequests.createdAt));
  }

  async getAllLeaveRequests(status?: string): Promise<LeaveRequestWithUser[]> {
    const rows = status
      ? await db.select().from(leaveRequests).where(eq(leaveRequests.status, status)).orderBy(desc(leaveRequests.createdAt))
      : await db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
    const allUsers = await db.select().from(users);
    return rows.map(r => ({ ...r, user: allUsers.find(u => u.id === r.userId) }));
  }

  async reviewLeaveRequest(id: number, status: 'approved' | 'rejected', adminNote: string, reviewedBy: number): Promise<LeaveRequest | undefined> {
    const [updated] = await db.update(leaveRequests)
      .set({ status, adminNote, reviewedBy, reviewedAt: new Date() })
      .where(eq(leaveRequests.id, id))
      .returning();
    return updated;
  }

  async getLeaveBalance(userId: number, year: number): Promise<{ entitlement: number; used: number; pending: number; remaining: number }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const entitlement = user?.annualLeaveEntitlement ?? 14;
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const requests = await db.select().from(leaveRequests)
      .where(and(
        eq(leaveRequests.userId, userId),
        eq(leaveRequests.leaveType, 'annual'),
        gte(leaveRequests.startDate, yearStart),
        lte(leaveRequests.startDate, yearEnd),
      ));
    const used = requests.filter(r => r.status === 'approved').reduce((s, r) => s + parseFloat(r.totalDays as string), 0);
    const pending = requests.filter(r => r.status === 'pending').reduce((s, r) => s + parseFloat(r.totalDays as string), 0);
    return { entitlement, used, pending, remaining: entitlement - used - pending };
  }

  // Pay Settings
  async updatePaySettings(userId: number, settings: { payType?: string; monthlyRate?: string; hourlyRate?: string; overtimeRate?: string; annualLeaveEntitlement?: number }) {
    const [updated] = await db.update(users).set(settings as any).where(eq(users.id, userId)).returning();
    return updated;
  }

  async updateFcmToken(userId: number, token: string): Promise<void> {
    await db.update(users).set({ fcmToken: token } as any).where(eq(users.id, userId));
  }

  async getFcmTokensByUserIds(userIds: number[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await db.select({ fcmToken: (users as any).fcmToken })
      .from(users)
      .where(inArray(users.id, userIds));
    return rows
      .map((r: any) => r.fcmToken as string | null)
      .filter((t): t is string => typeof t === "string" && t.length > 0);
  }

  // Payslips
  async generatePayslip(data: Omit<typeof payslips.$inferInsert, 'id' | 'createdAt'>): Promise<Payslip> {
    const [created] = await db.insert(payslips).values(data).returning();
    return created;
  }

  async getPayslipsByUser(userId: number): Promise<Payslip[]> {
    return db.select().from(payslips).where(eq(payslips.userId, userId)).orderBy(desc(payslips.createdAt));
  }

  async getAllPayslips(userId?: number): Promise<PayslipWithUser[]> {
    const rows = userId
      ? await db.select().from(payslips).where(eq(payslips.userId, userId)).orderBy(desc(payslips.createdAt))
      : await db.select().from(payslips).orderBy(desc(payslips.createdAt));
    const allUsers = await db.select().from(users);
    return rows.map(r => ({ ...r, user: allUsers.find(u => u.id === r.userId) }));
  }

  async deletePayslip(id: number): Promise<void> {
    await db.delete(payslips).where(eq(payslips.id, id));
  }

  async getStaffLoans(userId?: number): Promise<StaffLoan[]> {
    if (userId) {
      return db.select().from(staffLoans).where(eq(staffLoans.userId, userId)).orderBy(desc(staffLoans.createdAt));
    }
    return db.select().from(staffLoans).orderBy(desc(staffLoans.createdAt));
  }

  async createStaffLoan(data: InsertStaffLoan): Promise<StaffLoan> {
    const [created] = await db.insert(staffLoans).values(data).returning();
    return created;
  }

  async updateStaffLoan(id: number, data: Partial<InsertStaffLoan>): Promise<StaffLoan | undefined> {
    const [updated] = await db.update(staffLoans).set(data).where(eq(staffLoans.id, id)).returning();
    return updated;
  }

  async deleteStaffLoan(id: number): Promise<void> {
    await db.delete(staffLoans).where(eq(staffLoans.id, id));
  }

  async getQuotesForStaff(staffId: number): Promise<QuoteResponse[]> {
    const teammateIds = await this.getTeammateIds(staffId);
    // Also get the staff member's teamId so we can include team-assigned jobs
    const [me] = await db.select().from(users).where(eq(users.id, staffId));
    const myTeamId = me?.teamId;

    const conditions = [inArray(quotes.assignedStaffId, teammateIds)];
    if (myTeamId) {
      conditions.push(eq(quotes.assignedTeamId, myTeamId));
    }

    const quotesList = await db.select().from(quotes)
      .where(or(...conditions))
      .orderBy(desc(quotes.createdAt));
    return this.fetchQuoteDetailsBatch(quotesList);
  }

  async getCatalogItems(search?: string) {
    const items = await db.select().from(catalogItems).where(eq(catalogItems.active, true));
    if (search) {
      const lowerSearch = search.toLowerCase();
      return items.filter(i => i.name.toLowerCase().includes(lowerSearch) || i.sku?.toLowerCase().includes(lowerSearch) || i.category?.toLowerCase().includes(lowerSearch));
    }
    return items;
  }

  async createCatalogItem(item: InsertCatalogItem) {
    const [created] = await db.insert(catalogItems).values(item).returning();
    return created;
  }

  private async fetchQuoteDetails(quoteId: number): Promise<QuoteResponse | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!quote) return undefined;

    const customer = quote.customerId ? (await db.select().from(customers).where(eq(customers.id, quote.customerId)))[0] : undefined;
    const staff = quote.assignedStaffId ? (await db.select().from(users).where(eq(users.id, quote.assignedStaffId)))[0] : undefined;

    // Resolve assigned team + its members
    let assignedTeam: (typeof teams.$inferSelect & { members?: typeof users.$inferSelect[] }) | undefined;
    if (quote.assignedTeamId) {
      const [team] = await db.select().from(teams).where(eq(teams.id, quote.assignedTeamId));
      if (team) {
        const members = await db.select().from(users).where(eq(users.teamId, team.id));
        assignedTeam = { ...team, members };
      }
    }
    
    const itemsList = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));
    const itemsWithCatalog = await Promise.all(itemsList.map(async item => {
      const catalogItem = item.catalogItemId ? (await db.select().from(catalogItems).where(eq(catalogItems.id, item.catalogItemId)))[0] : undefined;
      return { ...item, catalogItem };
    }));

    const updatesList = await db.select().from(jobUpdates).where(eq(jobUpdates.quoteId, quoteId)).orderBy(desc(jobUpdates.createdAt));

    return {
      ...quote,
      customer,
      assignedStaff: staff,
      assignedTeam,
      items: itemsWithCatalog,
      updates: updatesList,
    };
  }

  async clearAllData(): Promise<void> {
    await db.delete(jobUpdates);
    await db.delete(quoteItems);
    await db.delete(quotes);
    await db.delete(customers);
  }

  // Batch-load all related data for a list of quotes in 2 parallel rounds (vs N×5 queries)
  private async fetchQuoteDetailsBatch(quotesList: typeof quotes.$inferSelect[]): Promise<QuoteResponse[]> {
    if (!quotesList.length) return [];

    const quoteIds = quotesList.map(q => q.id);
    const customerIds = [...new Set(quotesList.flatMap(q => q.customerId ? [q.customerId] : []))];
    const staffIds    = [...new Set(quotesList.flatMap(q => q.assignedStaffId ? [q.assignedStaffId] : []))];
    const teamIds     = [...new Set(quotesList.flatMap(q => q.assignedTeamId ? [q.assignedTeamId] : []))];

    // Round 1 — 5 parallel queries instead of N×5
    const [allCustomers, allStaff, allTeams, allItems, allUpdates] = await Promise.all([
      customerIds.length ? db.select().from(customers).where(inArray(customers.id, customerIds)) : Promise.resolve([]),
      staffIds.length    ? db.select().from(users).where(inArray(users.id, staffIds))             : Promise.resolve([]),
      teamIds.length     ? db.select().from(teams).where(inArray(teams.id, teamIds))              : Promise.resolve([]),
      db.select().from(quoteItems).where(inArray(quoteItems.quoteId, quoteIds)),
      db.select().from(jobUpdates).where(inArray(jobUpdates.quoteId, quoteIds)).orderBy(desc(jobUpdates.createdAt)),
    ]);

    // Round 2 — catalog items + team members (depend on Round 1 results)
    const catalogIds   = [...new Set(allItems.flatMap(i => i.catalogItemId ? [i.catalogItemId] : []))];
    const [allCatalog, allTeamMembers] = await Promise.all([
      catalogIds.length ? db.select().from(catalogItems).where(inArray(catalogItems.id, catalogIds)) : Promise.resolve([]),
      teamIds.length    ? db.select().from(users).where(inArray(users.teamId, teamIds))               : Promise.resolve([]),
    ]);

    // Build lookup maps
    const customerMap  = new Map(allCustomers.map(c => [c.id, c]));
    const staffMap     = new Map(allStaff.map(s => [s.id, s]));
    const teamMap      = new Map(allTeams.map(t => [t.id, t]));
    const catalogMap   = new Map(allCatalog.map(c => [c.id, c]));

    const itemsByQuote   = new Map<number, typeof quoteItems.$inferSelect[]>();
    const updatesByQuote = new Map<number, typeof jobUpdates.$inferSelect[]>();
    const membersByTeam  = new Map<number, typeof users.$inferSelect[]>();

    for (const item of allItems) {
      if (!itemsByQuote.has(item.quoteId)) itemsByQuote.set(item.quoteId, []);
      itemsByQuote.get(item.quoteId)!.push(item);
    }
    for (const upd of allUpdates) {
      if (!updatesByQuote.has(upd.quoteId)) updatesByQuote.set(upd.quoteId, []);
      updatesByQuote.get(upd.quoteId)!.push(upd);
    }
    for (const member of allTeamMembers) {
      if (!member.teamId) continue;
      if (!membersByTeam.has(member.teamId)) membersByTeam.set(member.teamId, []);
      membersByTeam.get(member.teamId)!.push(member);
    }

    return quotesList.map(quote => {
      const team = quote.assignedTeamId ? teamMap.get(quote.assignedTeamId) : undefined;
      return {
        ...quote,
        customer:      quote.customerId     ? customerMap.get(quote.customerId)     : undefined,
        assignedStaff: quote.assignedStaffId ? staffMap.get(quote.assignedStaffId) : undefined,
        assignedTeam:  team ? { ...team, members: membersByTeam.get(team.id) ?? [] } : undefined,
        items: (itemsByQuote.get(quote.id) ?? []).map(item => ({
          ...item,
          catalogItem: item.catalogItemId ? catalogMap.get(item.catalogItemId) : undefined,
        })),
        updates: updatesByQuote.get(quote.id) ?? [],
      } as QuoteResponse;
    });
  }

  async getQuotes(status?: string): Promise<QuoteResponse[]> {
    const quotesList = status
      ? await db.select().from(quotes).where(eq(quotes.status, status)).orderBy(desc(quotes.createdAt))
      : await db.select().from(quotes).orderBy(desc(quotes.createdAt));
    return this.fetchQuoteDetailsBatch(quotesList);
  }

  async getQuotesByStatuses(statuses: string[]): Promise<QuoteResponse[]> {
    const quotesList = await db.select().from(quotes).where(inArray(quotes.status, statuses)).orderBy(desc(quotes.createdAt));
    return this.fetchQuoteDetailsBatch(quotesList);
  }

  async getQuote(id: number): Promise<QuoteResponse | undefined> {
    return await this.fetchQuoteDetails(id);
  }

  async createQuote(customerData: InsertCustomer, quoteData: Omit<InsertQuote, 'customerId'>, itemsData: Omit<InsertQuoteItem, 'quoteId'>[]) {
    const [customer] = await db.insert(customers).values(customerData).returning();
    const [quote] = await db.insert(quotes).values({ ...quoteData, customerId: customer.id }).returning();
    if (itemsData.length > 0) {
      await db.insert(quoteItems).values(itemsData.map(item => ({ ...item, quoteId: quote.id })));
    }
    await db.insert(jobUpdates).values({
      quoteId: quote.id,
      statusChange: quoteData.status || 'submitted',
      actorType: 'customer',
      note: 'Quote submitted online'
    });
    const detailedQuote = await this.fetchQuoteDetails(quote.id);
    if (!detailedQuote) throw new Error("Failed to fetch created quote");
    return detailedQuote;
  }

  async updateQuoteStatus(id: number, status: string, updateRecord?: Omit<InsertJobUpdate, 'quoteId' | 'statusChange'>, assignedStaffId?: number, assignedTeamId?: number | null) {
    const updateData: Partial<typeof quotes.$inferInsert> = { status };
    if (assignedStaffId !== undefined) {
      updateData.assignedStaffId = assignedStaffId;
      // Assigning individual staff clears team assignment
      updateData.assignedTeamId = null;
    }
    if (assignedTeamId !== undefined) {
      updateData.assignedTeamId = assignedTeamId;
      // Assigning a team clears individual staff assignment
      updateData.assignedStaffId = null;
    }
    await db.update(quotes).set(updateData).where(eq(quotes.id, id));
    await db.insert(jobUpdates).values({
      quoteId: id,
      statusChange: status,
      actorType: updateRecord?.actorType || 'system',
      note: updateRecord?.note,
      photoUrl: updateRecord?.photoUrl,
      gpsLat: updateRecord?.gpsLat,
      gpsLng: updateRecord?.gpsLng,
      actorId: updateRecord?.actorId,
    });
    return await this.fetchQuoteDetails(id);
  }

  async updateQuotePayment(id: number, paymentType: 'deposit' | 'final', amount: string) {
    const now = new Date();

    if (paymentType === 'deposit') {
      // Fetch the quote first to check for a preferred slot
      const existing = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
      const q = existing[0];

      // Record deposit payment
      await db.insert(jobUpdates).values({
        quoteId: id,
        statusChange: 'deposit_paid',
        actorType: 'customer',
        note: `Deposit payment of $${amount} received`
      });

      if (q?.preferredDate && q?.preferredTimeWindow) {
        // Auto-confirm the booking using the slot chosen during the estimate
        const scheduledAt = new Date(q.preferredDate + 'T12:00:00');
        await db.update(quotes).set({
          depositPaidAt: now,
          paymentStatus: 'deposit_paid',
          status: 'booked',
          scheduledAt,
          timeWindow: q.preferredTimeWindow,
          slotHeldUntil: null,
          bookingRequestedAt: now,
        }).where(eq(quotes.id, id));

        await db.insert(jobUpdates).values({
          quoteId: id,
          statusChange: 'booked',
          actorType: 'system',
          note: `Booking auto-confirmed for ${q.preferredDate} ${q.preferredTimeWindow} (slot from estimate)`
        });
      } else {
        // No preferred slot — fall back to deposit_paid (admin can book manually)
        await db.update(quotes).set({
          depositPaidAt: now,
          paymentStatus: 'deposit_paid',
          status: 'deposit_paid',
        }).where(eq(quotes.id, id));
      }

    } else {
      // Final payment
      await db.update(quotes).set({
        finalPaidAt: now,
        paymentStatus: 'paid_in_full',
        status: 'final_paid',
      }).where(eq(quotes.id, id));

      await db.insert(jobUpdates).values({
        quoteId: id,
        statusChange: 'final_paid',
        actorType: 'customer',
        note: `Final payment of $${amount} received`
      });

      // Auto-close
      await db.update(quotes).set({ status: 'closed' }).where(eq(quotes.id, id));
      await db.insert(jobUpdates).values({
        quoteId: id,
        statusChange: 'closed',
        actorType: 'system',
        note: 'Case automatically closed after final payment received'
      });
    }

    return await this.fetchQuoteDetails(id);
  }

  async requestBooking(id: number, scheduledAt: Date, timeWindow: string) {
    await db.update(quotes).set({
      scheduledAt,
      timeWindow,
      status: 'booking_requested',
      bookingRequestedAt: new Date(),
    }).where(eq(quotes.id, id));

    await db.insert(jobUpdates).values({
      quoteId: id,
      statusChange: 'booking_requested',
      actorType: 'customer',
      note: `Customer requested booking for ${scheduledAt.toDateString()} ${timeWindow}`
    });

    return await this.fetchQuoteDetails(id);
  }

  async confirmBooking(id: number) {
    await db.update(quotes).set({ status: 'booked' }).where(eq(quotes.id, id));
    await db.insert(jobUpdates).values({
      quoteId: id,
      statusChange: 'booked',
      actorType: 'admin',
      note: 'Booking confirmed by admin'
    });
    return await this.fetchQuoteDetails(id);
  }

  async rescheduleBooking(id: number, scheduledAt: Date, timeWindow: string) {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    if (!quote) return undefined;

    const newCount = (quote.rescheduledCount || 0) + 1;
    await db.update(quotes).set({
      scheduledAt,
      timeWindow,
      status: 'booking_requested', // Goes back to pending admin confirm
      bookingRequestedAt: new Date(),
      rescheduledCount: newCount,
    }).where(eq(quotes.id, id));

    await db.insert(jobUpdates).values({
      quoteId: id,
      statusChange: 'booking_requested',
      actorType: 'customer',
      note: `Customer requested reschedule to ${scheduledAt.toDateString()} ${timeWindow} (reschedule #${newCount})`
    });

    return await this.fetchQuoteDetails(id);
  }

  async editQuote(id: number, data: {
    customerUpdates?: Partial<typeof customers.$inferInsert>;
    quoteUpdates?: Partial<typeof quotes.$inferInsert>;
    items?: Omit<InsertQuoteItem, 'quoteId'>[];
  }) {
    const quote = await this.fetchQuoteDetails(id);
    if (!quote) return undefined;

    if (data.customerUpdates && quote.customerId) {
      await db.update(customers).set(data.customerUpdates).where(eq(customers.id, quote.customerId));
    }

    // Track what the admin asked for so we can emit a customer-friendly
    // timeline event below. Drive the audit purely from the requested action
    // (the status the client sent), NOT from a before/after diff — otherwise
    // a re-click of "Mark as Pending" on a quote that's already in
    // booking_pending would silently fall through to the generic 'edited'
    // branch and the customer would never see the event.
    const requestedStatus = data.quoteUpdates?.status;

    if (data.quoteUpdates) {
      await db.update(quotes).set(data.quoteUpdates).where(eq(quotes.id, id));
    }

    if (data.items !== undefined) {
      // Fetch current quote for promo and transport
      const existingQuote = await db.select().from(quotes).where(eq(quotes.id, id));
      const transportFee = Number(
        data.quoteUpdates?.transportFee ?? existingQuote[0]?.transportFee ?? 0
      );
      const promoDiscount = Number(existingQuote[0]?.promoDiscount || 0);

      // Separate regular items from discount line items
      const regularItems = data.items.filter(item => item.serviceType !== 'discount');
      const discountLineItems: typeof data.items = promoDiscount > 0 && existingQuote[0]?.promoCode
        ? [{
            originalDescription: `Promo Code: ${existingQuote[0].promoCode}`,
            detectedName: `Promo Code: ${existingQuote[0].promoCode}`,
            serviceType: 'discount' as const,
            quantity: 1,
            unitPrice: (-promoDiscount).toFixed(2),
            subtotal: (-promoDiscount).toFixed(2),
            catalogItemId: null,
          }]
        : [];

      // Replace all items (regular + preserved discount line)
      await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));
      const allItems = [...regularItems, ...discountLineItems];
      if (allItems.length > 0) {
        await db.insert(quoteItems).values(allItems.map(item => ({ ...item, quoteId: id })));
      }

      // Recalculate totals — subtotal = regular items only; promo applied to total
      const subtotal = regularItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      const total = Math.max(0, subtotal - promoDiscount + transportFee);
      const depositAmount = (total * 0.50).toFixed(2);
      const finalAmount = (total * 0.50).toFixed(2);
      await db.update(quotes).set({
        subtotal: subtotal.toFixed(2),
        total: total.toFixed(2),
        depositAmount,
        finalAmount,
      }).where(eq(quotes.id, id));
    }

    if (requestedStatus === 'booking_pending') {
      // Admin clicked "Mark as Pending" — log a customer-visible event so the
      // tracker page reflects the change. Idempotent against re-clicks.
      await db.insert(jobUpdates).values({
        quoteId: id,
        statusChange: 'booking_pending',
        actorType: 'admin',
        note: 'Booking date pending — to be reconfirmed.',
      });
    } else if (requestedStatus === 'booked') {
      // Admin saved a fresh date for a previously-pending booking — surface
      // the new confirmation publicly so the customer sees their slot is set.
      await db.insert(jobUpdates).values({
        quoteId: id,
        statusChange: 'booked',
        actorType: 'admin',
        note: 'New booking date confirmed.',
      });
    } else {
      await db.insert(jobUpdates).values({
        quoteId: id,
        statusChange: 'edited',
        actorType: 'admin',
        note: 'Quote edited by admin'
      });
    }

    // Recover the staff workflow after a reschedule. If the quote came out of
    // this edit sitting in 'booked' but a crew is still attached (assignment
    // wasn't cleared during the reschedule), promote it to 'assigned' so the
    // staff app's "Arrive on site" / "Start job" flow is unblocked again.
    // Without this, the rescheduled job is stranded in booked and the crew
    // cannot complete it. Also covers historical quotes that got stuck before
    // this fix was deployed — the next save reconciles them automatically.
    const reloaded = await db.select().from(quotes).where(eq(quotes.id, id));
    const post = reloaded[0];
    if (
      post &&
      post.status === 'booked' &&
      (post.assignedStaffId || post.assignedTeamId) &&
      post.scheduledAt
    ) {
      await db.update(quotes).set({ status: 'assigned' }).where(eq(quotes.id, id));
      await db.insert(jobUpdates).values({
        quoteId: id,
        statusChange: 'assigned',
        actorType: 'admin',
        note: 'Crew re-assigned for the new date.',
      });
    }

    return await this.fetchQuoteDetails(id);
  }

  async updateAdditionalCharge(id: number, additionalCharge: string, additionalChargeNote: string) {
    await db.update(quotes).set({ additionalCharge, additionalChargeNote }).where(eq(quotes.id, id));
    await db.insert(jobUpdates).values({
      quoteId: id,
      statusChange: 'edited',
      actorType: 'admin',
      note: `Additional charge updated: $${additionalCharge}${additionalChargeNote ? ` — ${additionalChargeNote}` : ''}`,
    });
    return await this.fetchQuoteDetails(id);
  }

  async addJobUpdate(update: InsertJobUpdate) {
    await db.insert(jobUpdates).values(update);
  }

  async deleteQuote(id: number): Promise<void> {
    await db.delete(jobUpdates).where(eq(jobUpdates.quoteId, id));
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  async getBlockedSlots(): Promise<BlockedSlot[]> {
    return await db.select().from(blockedSlots).orderBy(blockedSlots.date);
  }

  async createBlockedSlot(slot: InsertBlockedSlot): Promise<BlockedSlot> {
    const [created] = await db.insert(blockedSlots).values(slot).returning();
    return created;
  }

  async deleteBlockedSlot(id: number): Promise<void> {
    await db.delete(blockedSlots).where(eq(blockedSlots.id, id));
  }

  // Return all slots currently held/full by active quotes.
  // Slot capacity rules:
  //   Morning  (09:00-12:00): $500 max cumulative
  //   Afternoon (13:00-17:00): $700 max cumulative
  //   Daily big-order cap: a single job ≥ $1000 blocks the entire day (both slots)
  //   Large job overflow: if a single job's value exceeds a slot's cap, it spills into
  //   the next consecutive slot (morning → afternoon → next-day morning → …)
  async getHeldSlots(): Promise<{ date: string; timeSlot: string; quoteId: number }[]> {
    const SLOT_CAPS: Record<string, number> = { "09:00-12:00": 500, "13:00-17:00": 700 };
    const DAILY_BIG_ORDER_CAP = 1000;
    const TIME_SLOTS = ['09:00-12:00', '13:00-17:00'];

    const activeStatuses = [
      'submitted', 'deposit_requested', 'deposit_paid',
      'booking_requested', 'booked', 'assigned', 'in_progress',
    ];
    const activeQuotes = await db.select({
      id: quotes.id,
      preferredDate: quotes.preferredDate,
      preferredTimeWindow: quotes.preferredTimeWindow,
      slotHeldUntil: quotes.slotHeldUntil,
      status: quotes.status,
      total: quotes.total,
    }).from(quotes).where(inArray(quotes.status, activeStatuses));

    const now = new Date();

    const validQuotes = activeQuotes
      .filter(q => q.preferredDate && q.preferredTimeWindow)
      .filter(q => {
        if (['deposit_paid', 'booking_requested', 'booked', 'assigned', 'in_progress'].includes(q.status)) return true;
        return !q.slotHeldUntil || q.slotHeldUntil > now;
      });

    // Cumulative total per slot (for threshold check on primary slot)
    const slotTotals = new Map<string, number>();
    for (const q of validQuotes) {
      const key = `${q.preferredDate}|${q.preferredTimeWindow}`;
      slotTotals.set(key, (slotTotals.get(key) ?? 0) + Number(q.total || 0));
    }

    const heldSet = new Set<string>();
    const result: { date: string; timeSlot: string; quoteId: number }[] = [];

    const addHeld = (date: string, timeSlot: string, quoteId: number) => {
      const k = `${date}|${timeSlot}`;
      if (!heldSet.has(k)) { heldSet.add(k); result.push({ date, timeSlot, quoteId }); }
    };

    // Helper: find any quote booked on a date (for quoteId association)
    const anyQuoteOnDate = (date: string) =>
      validQuotes.find(q => q.preferredDate === date)?.id ?? validQuotes[0]?.id ?? 0;

    // Process each affected date using combined-slot carryover.
    // Morning total + any prior overflow → if ≥ cap → morning full, excess carries to afternoon.
    // Afternoon total + morning carryover → if ≥ cap → afternoon full, excess carries to next-day morning.
    // A single job ≥ $1000 always blocks the entire day first.
    const allDates = [...new Set(validQuotes.map(q => q.preferredDate!))].sort();

    // Track cross-day carryover: key = date string, value = amount carried into that day's morning
    const dayCarryover = new Map<string, number>();

    for (const date of allDates) {
      // Rule 1: any single job ≥ $1000 on this day → block both slots
      const bigOrderQuote = validQuotes.find(
        q => q.preferredDate === date && Number(q.total || 0) >= DAILY_BIG_ORDER_CAP
      );
      if (bigOrderQuote) {
        for (const ts of TIME_SLOTS) addHeld(date, ts, bigOrderQuote.id);
        continue;
      }

      let carry = dayCarryover.get(date) ?? 0;

      for (const ts of TIME_SLOTS) {
        const tsCap = SLOT_CAPS[ts] ?? 500;
        const tsDirect = slotTotals.get(`${date}|${ts}`) ?? 0;
        const tsEffective = tsDirect + carry;

        if (tsEffective >= tsCap) {
          const quoteId = validQuotes.find(q => q.preferredDate === date && q.preferredTimeWindow === ts)?.id
            ?? anyQuoteOnDate(date);
          addHeld(date, ts, quoteId);
          carry = tsEffective - tsCap; // excess rolls into next slot
        } else {
          carry = 0; // slot absorbed all carry, chain stops
        }
      }

      // If carry remains after the day's last slot, it rolls into next calendar day's morning
      if (carry > 0) {
        const nextD = new Date(date + 'T12:00:00');
        nextD.setDate(nextD.getDate() + 1);
        const nextDate = nextD.toISOString().split('T')[0];
        dayCarryover.set(nextDate, (dayCarryover.get(nextDate) ?? 0) + carry);
        // If the carry alone fills the next day's morning, pre-block it now if it's not in allDates
        const nextMorningCap = SLOT_CAPS[TIME_SLOTS[0]] ?? 500;
        const nextMorningDirect = slotTotals.get(`${nextDate}|${TIME_SLOTS[0]}`) ?? 0;
        if (nextMorningDirect + carry >= nextMorningCap) {
          addHeld(nextDate, TIME_SLOTS[0], anyQuoteOnDate(date));
        }
      }
    }

    return result;
  }

  // Returns per-slot cumulative booking value for all active quotes (used by UI capacity bars)
  async getSlotCapacities(): Promise<{ date: string; timeSlot: string; usedAmount: number }[]> {
    const activeStatuses = [
      'submitted', 'deposit_requested', 'deposit_paid',
      'booking_requested', 'booked', 'assigned', 'in_progress',
    ];
    const activeQuotes = await db.select({
      preferredDate: quotes.preferredDate,
      preferredTimeWindow: quotes.preferredTimeWindow,
      slotHeldUntil: quotes.slotHeldUntil,
      status: quotes.status,
      total: quotes.total,
    }).from(quotes).where(inArray(quotes.status, activeStatuses));

    const now = new Date();
    const validQuotes = activeQuotes
      .filter(q => q.preferredDate && q.preferredTimeWindow)
      .filter(q => {
        if (['deposit_paid', 'booking_requested', 'booked', 'assigned', 'in_progress'].includes(q.status)) return true;
        return !q.slotHeldUntil || q.slotHeldUntil > now;
      });

    const slotTotals = new Map<string, number>();
    for (const q of validQuotes) {
      const key = `${q.preferredDate}|${q.preferredTimeWindow}`;
      slotTotals.set(key, (slotTotals.get(key) ?? 0) + Number(q.total || 0));
    }

    return Array.from(slotTotals.entries()).map(([key, usedAmount]) => {
      const [date, timeSlot] = key.split('|');
      return { date, timeSlot, usedAmount };
    });
  }

  // Returns true if the date+timeWindow slot has capacity remaining.
  // Morning cap: $500 | Afternoon cap: $700 | Single job ≥ $1000 → whole day blocked.
  // Also blocks slots that fall within overflow of a large job from an earlier slot.
  async isSlotAvailable(date: string, timeWindow: string, excludeQuoteId?: number): Promise<boolean> {
    const SLOT_CAPS: Record<string, number> = { "09:00-12:00": 500, "13:00-17:00": 700 };
    const DAILY_BIG_ORDER_CAP = 1000;
    const TIME_SLOTS = ['09:00-12:00', '13:00-17:00'];

    // Check admin-blocked slots first
    const blocked = await db.select().from(blockedSlots)
      .where(eq(blockedSlots.date, date));
    const isBlocked = blocked.some(b => b.timeSlot === null || b.timeSlot === timeWindow);
    if (isBlocked) return false;

    const activeStatuses = [
      'submitted', 'deposit_requested', 'deposit_paid',
      'booking_requested', 'booked', 'assigned', 'in_progress',
    ];
    const held = await db.select({
      id: quotes.id,
      preferredDate: quotes.preferredDate,
      preferredTimeWindow: quotes.preferredTimeWindow,
      slotHeldUntil: quotes.slotHeldUntil,
      status: quotes.status,
      total: quotes.total,
    }).from(quotes).where(inArray(quotes.status, activeStatuses));

    const now = new Date();
    const validQuotes = held.filter(q => {
      if (excludeQuoteId && q.id === excludeQuoteId) return false;
      if (!q.preferredDate || !q.preferredTimeWindow) return false;
      if (['deposit_paid', 'booking_requested', 'booked', 'assigned', 'in_progress'].includes(q.status)) return true;
      return !q.slotHeldUntil || q.slotHeldUntil > now;
    });

    // Rule 1: any single active job on this day ≥ $1000 → whole day blocked
    const hasBigOrder = validQuotes.some(
      q => q.preferredDate === date && Number(q.total || 0) >= DAILY_BIG_ORDER_CAP
    );
    if (hasBigOrder) return false;

    // Rule 2 & 3: combined carryover — walk morning → afternoon with accumulated carry.
    // Also account for carryover arriving from the previous day's afternoon overflow.
    const prevD = new Date(date + 'T12:00:00');
    prevD.setDate(prevD.getDate() - 1);
    const prevDate = prevD.toISOString().split('T')[0];

    // Compute previous day's carryover into today's morning
    let prevCarry = 0;
    const prevBig = validQuotes.some(
      q => q.preferredDate === prevDate && Number(q.total || 0) >= DAILY_BIG_ORDER_CAP
    );
    if (!prevBig) {
      let c = 0;
      for (const ts of TIME_SLOTS) {
        const tsCap = SLOT_CAPS[ts] ?? 500;
        const tsDirect = validQuotes
          .filter(q => q.preferredDate === prevDate && q.preferredTimeWindow === ts)
          .reduce((sum, q) => sum + Number(q.total || 0), 0);
        const tsEff = tsDirect + c;
        c = tsEff >= tsCap ? tsEff - tsCap : 0;
      }
      prevCarry = c; // whatever remains after prev day's afternoon is today's morning carry
    }

    // Now walk today's slots up to (and including) the target slot
    let carry = prevCarry;
    for (const ts of TIME_SLOTS) {
      const tsCap = SLOT_CAPS[ts] ?? 500;
      const tsDirect = validQuotes
        .filter(q => q.preferredDate === date && q.preferredTimeWindow === ts)
        .reduce((sum, q) => sum + Number(q.total || 0), 0);
      const tsEffective = tsDirect + carry;

      if (ts === timeWindow) {
        // This is the slot we're checking — is there remaining capacity?
        return tsEffective < tsCap;
      }

      // Carry forward: if this earlier slot is over cap, excess rolls into next
      carry = tsEffective >= tsCap ? tsEffective - tsCap : 0;
    }

    return true; // timeWindow not found in TIME_SLOTS (shouldn't happen)
  }

  /**
   * Returns the next `count` available date+slot pairs starting from tomorrow.
   * Checks up to `daysAhead` calendar days. Skips Sundays (not working).
   * Returns [{date, timeWindow, display}] — at most 2 per day (AM then PM).
   */
  async getNextAvailableSlots(count: number = 6, daysAhead: number = 30): Promise<{ date: string; timeWindow: string; display: string }[]> {
    const TIME_SLOTS = ['09:00-12:00', '13:00-17:00'];
    const slotLabel: Record<string, string> = {
      '09:00-12:00': 'Morning (9am–12pm)',
      '13:00-17:00': 'Afternoon (1pm–5pm)',
    };
    const results: { date: string; timeWindow: string; display: string }[] = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);

    for (let d = 1; d <= daysAhead && results.length < count; d++) {
      const day = new Date(base);
      day.setDate(base.getDate() + d);
      if (day.getDay() === 0) continue; // Skip Sundays

      const dateStr = day.toISOString().split('T')[0];
      const dayName = day.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });

      for (const tw of TIME_SLOTS) {
        if (results.length >= count) break;
        const available = await this.isSlotAvailable(dateStr, tw);
        if (available) {
          results.push({ date: dateStr, timeWindow: tw, display: `${dayName} — ${slotLabel[tw]}` });
        }
      }
    }
    return results;
  }

  async getWhatsAppSession(phone: string): Promise<WhatsAppSession | undefined> {
    const [session] = await db.select().from(whatsappSessions).where(eq(whatsappSessions.phone, phone));
    return session;
  }

  /**
   * Atomically claim the photo-scan slot for this phone number.
   * Transitions state from 'awaiting_items' → 'awaiting_items_verify' and
   * seeds the queue with the first mediaId. The UPDATE only succeeds for
   * exactly ONE concurrent caller (PostgreSQL row-lock), so callers that
   * lose the race (return false) must call appendPhotoToScanQueue instead.
   */
  async claimPhotoScan(phone: string, mediaId: string): Promise<boolean> {
    const claimed = await db
      .update(whatsappSessions)
      .set({
        state: "awaiting_items_verify",
        collectedItems: `__scanning__:${mediaId}`,
        updatedAt: new Date(),
      })
      .where(and(eq(whatsappSessions.phone, phone), eq(whatsappSessions.state, "awaiting_items")))
      .returning({ id: whatsappSessions.id });
    return claimed.length > 0;
  }

  /**
   * Atomically append a photo mediaId to the scan queue using a raw SQL
   * concatenation — no read-then-write, so concurrent appends are safe.
   */
  async appendPhotoToScanQueue(phone: string, mediaId: string): Promise<void> {
    await db.execute(
      sql`UPDATE whatsapp_sessions
          SET collected_items = collected_items || ${`,${mediaId}`},
              updated_at = NOW()
          WHERE phone = ${phone}
            AND state = 'awaiting_items_verify'
            AND collected_items LIKE '__scanning__%'`
    );
  }

  async upsertWhatsAppSession(phone: string, data: Partial<Omit<WhatsAppSession, 'id' | 'phone' | 'createdAt'>>): Promise<WhatsAppSession> {
    const existing = await this.getWhatsAppSession(phone);
    if (existing) {
      const [updated] = await db
        .update(whatsappSessions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(whatsappSessions.phone, phone))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(whatsappSessions)
        .values({ phone, ...data, updatedAt: new Date() })
        .returning();
      return created;
    }
  }

  async deleteWhatsAppSession(phone: string): Promise<void> {
    await db.delete(whatsappSessions).where(eq(whatsappSessions.phone, phone));
  }

  async logWhatsAppMessage(data: { phone: string; direction: 'inbound' | 'outbound'; body: string; mediaType?: string; mediaUrl?: string; wamid?: string; sentBy?: string }): Promise<WhatsAppMessage> {
    const [msg] = await db.insert(whatsappMessages).values({
      phone: data.phone,
      direction: data.direction,
      body: data.body,
      mediaType: data.mediaType ?? null,
      mediaUrl: data.mediaUrl ?? null,
      wamid: data.wamid ?? null,
      sentBy: data.sentBy ?? (data.direction === 'outbound' ? 'bot' : null),
    }).returning();
    return msg;
  }

  async getWhatsAppMessages(phone: string, limit = 300): Promise<WhatsAppMessage[]> {
    // Fetch newest N messages (DESC) then reverse so display is oldest→newest
    const rows = await db.select().from(whatsappMessages)
      .where(eq(whatsappMessages.phone, phone))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  async getWhatsAppConversations(): Promise<{ phone: string; name: string | null; lastMessage: string; lastAt: Date; unreadCount: number; state: string | null; botPaused: boolean; pendingQuoteRef: string | null; pendingQuoteStatus: string | null; customerName: string | null }[]> {
    // Get latest message per phone + unread count + pending quote info
    const rows = await db.execute(sql`
      SELECT
        m.phone,
        COALESCE(ws.collected_name, c.name) AS name,
        ws.state,
        ws.bot_paused,
        (SELECT body FROM whatsapp_messages WHERE phone = m.phone ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM whatsapp_messages WHERE phone = m.phone ORDER BY created_at DESC LIMIT 1) AS last_at,
        COUNT(CASE WHEN m.direction = 'inbound' AND m.read_at IS NULL THEN 1 END)::int AS unread_count,
        (
          SELECT q.reference_no FROM quotes q
          WHERE q.customer_whatsapp_phone = m.phone
            AND q.status IN ('new', 'sent')
          ORDER BY q.created_at DESC LIMIT 1
        ) AS pending_quote_ref,
        (
          SELECT q.status FROM quotes q
          WHERE q.customer_whatsapp_phone = m.phone
            AND q.status IN ('new', 'sent')
          ORDER BY q.created_at DESC LIMIT 1
        ) AS pending_quote_status,
        c.name AS customer_name
      FROM whatsapp_messages m
      LEFT JOIN whatsapp_sessions ws ON ws.phone = m.phone
      LEFT JOIN customers c ON c.phone = m.phone
      GROUP BY m.phone, ws.collected_name, ws.state, ws.bot_paused, c.name
      ORDER BY last_at DESC
    `);
    return (rows.rows as any[]).map(r => ({
      phone: r.phone,
      name: r.name ?? null,
      state: r.state ?? null,
      botPaused: r.bot_paused === true,
      lastMessage: r.last_message ?? "",
      lastAt: new Date(r.last_at),
      unreadCount: Number(r.unread_count ?? 0),
      pendingQuoteRef: r.pending_quote_ref ?? null,
      pendingQuoteStatus: r.pending_quote_status ?? null,
      customerName: r.customer_name ?? null,
    }));
  }

  async markWhatsAppMessagesRead(phone: string): Promise<void> {
    await db.update(whatsappMessages)
      .set({ readAt: new Date() })
      .where(and(eq(whatsappMessages.phone, phone), eq(whatsappMessages.direction, 'inbound'), isNull(whatsappMessages.readAt)));
  }

  async getGGVJobs(date: string): Promise<GGVJob[]> {
    return db.select().from(ggvJobs).where(eq(ggvJobs.date, date)).orderBy(ggvJobs.id);
  }
  async createGGVJob(data: InsertGGVJob): Promise<GGVJob> {
    const [row] = await db.insert(ggvJobs).values(data).returning();
    return row;
  }
  async updateGGVJob(id: number, data: Partial<InsertGGVJob>): Promise<GGVJob | undefined> {
    const [row] = await db.update(ggvJobs).set(data).where(eq(ggvJobs.id, id)).returning();
    return row;
  }
  async deleteGGVJob(id: number): Promise<void> {
    await db.delete(ggvJobs).where(eq(ggvJobs.id, id));
  }

  async addSiteEvent(data: { event: string; page?: string; label?: string; referrer?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; sessionId?: string; deviceType?: string }): Promise<SiteEvent> {
    const [evt] = await db.insert(siteEvents).values({
      event: data.event,
      page: data.page ?? null,
      label: data.label ?? null,
      referrer: data.referrer ?? null,
      utmSource: data.utmSource ?? null,
      utmMedium: data.utmMedium ?? null,
      utmCampaign: data.utmCampaign ?? null,
      sessionId: data.sessionId ?? null,
      deviceType: data.deviceType ?? null,
    }).returning();
    return evt;
  }

  async updateSiteEventGeo(id: number, geo: { country?: string; countryCode?: string; city?: string; latitude?: string; longitude?: string }): Promise<void> {
    await db.update(siteEvents).set({
      country: geo.country ?? null,
      countryCode: geo.countryCode ?? null,
      city: geo.city ?? null,
      latitude: geo.latitude ?? null,
      longitude: geo.longitude ?? null,
    }).where(eq(siteEvents.id, id));
  }

  async getSiteAnalytics(days: number = 7) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    function statsFor(rows: SiteEvent[]) {
      const pvRows = rows.filter(r => r.event === 'page_view');
      const sessions = new Set(pvRows.map(r => r.sessionId).filter(Boolean)) as Set<string>;
      // Bounce rate: sessions where only 1 page_view event exists
      const sessPageCount: Record<string, number> = {};
      for (const r of pvRows) { if (r.sessionId) sessPageCount[r.sessionId] = (sessPageCount[r.sessionId] ?? 0) + 1; }
      const bounceSessions = Object.values(sessPageCount).filter(n => n === 1).length;
      const totalSessions = sessions.size || 1;
      return {
        pageViews: pvRows.length,
        sessions: totalSessions,
        wizardStarts: rows.filter(r => r.event === 'wizard_start').length,
        wizardSubmits: rows.filter(r => r.event === 'wizard_submit').length,
        bounceRate: Math.round((bounceSessions / totalSessions) * 100),
        avgPagesPerSession: Math.round((pvRows.length / totalSessions) * 10) / 10,
      };
    }

    const todayRows = await db.select().from(siteEvents)
      .where(and(gte(siteEvents.createdAt, todayStart), lte(siteEvents.createdAt, todayEnd)));
    const yesterdayRows = await db.select().from(siteEvents)
      .where(and(gte(siteEvents.createdAt, yesterdayStart), lte(siteEvents.createdAt, todayStart)));

    const windowStart = new Date(todayStart.getTime() - (days - 1) * 86400000);
    const allRows = await db.select().from(siteEvents)
      .where(gte(siteEvents.createdAt, windowStart));

    // Build trend (one entry per day in the window)
    const trend: { date: string; pageViews: number; sessions: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 86400000);
      const dEnd = new Date(d.getTime() + 86400000);
      const dayRows = allRows.filter(r => r.createdAt >= d && r.createdAt < dEnd && r.event === 'page_view');
      trend.push({
        date: d.toISOString().split('T')[0],
        pageViews: dayRows.length,
        sessions: new Set(dayRows.map(r => r.sessionId).filter(Boolean)).size,
      });
    }

    function parseSource(row: SiteEvent): string {
      if (row.utmSource) {
        const s = row.utmSource.toLowerCase();
        if (s.includes('google')) return 'Google';
        if (s.includes('facebook') || s.includes('fb')) return 'Facebook';
        if (s.includes('instagram') || s.includes('ig')) return 'Instagram';
        if (s.includes('tiktok')) return 'TikTok';
        if (s.includes('whatsapp')) return 'WhatsApp';
        return row.utmSource;
      }
      if (!row.referrer) return 'Direct';
      try {
        const hostname = new URL(row.referrer).hostname.replace('www.', '');
        if (hostname.includes('google')) return 'Google';
        if (hostname.includes('facebook') || hostname.includes('fb.com')) return 'Facebook';
        if (hostname.includes('instagram')) return 'Instagram';
        if (hostname.includes('tiktok')) return 'TikTok';
        if (hostname.includes('bing')) return 'Bing';
        if (hostname.includes('yahoo')) return 'Yahoo';
        if (hostname.includes('whatsapp')) return 'WhatsApp';
        if (hostname.includes('tmginstall.com')) return 'Internal';
        return hostname;
      } catch { return 'Direct'; }
    }

    const sourceCounts: Record<string, number> = {};
    for (const row of allRows.filter(r => r.event === 'page_view')) {
      const src = parseSource(row);
      sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
    }
    const sources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count }));

    const funnelLanding = allRows.filter(r => r.event === 'page_view' && r.page === '/').length;
    const funnelStart = allRows.filter(r => r.event === 'wizard_start').length;
    const funnelSubmit = allRows.filter(r => r.event === 'wizard_submit').length;
    const funnel = [
      { step: 'Visited Landing', count: funnelLanding },
      { step: 'Started Estimate', count: funnelStart },
      { step: 'Submitted Lead', count: funnelSubmit },
    ];

    // Countries breakdown (page_view only)
    const countryCounts: Record<string, { count: number; lat: number; lng: number; countryCode: string }> = {};
    for (const row of allRows.filter(r => r.event === 'page_view' && r.country)) {
      const key = row.country!;
      if (!countryCounts[key]) {
        countryCounts[key] = { count: 0, lat: parseFloat(row.latitude ?? '0') || 0, lng: parseFloat(row.longitude ?? '0') || 0, countryCode: row.countryCode ?? '' };
      }
      countryCounts[key].count++;
    }
    const countries = Object.entries(countryCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([country, d]) => ({ country, countryCode: d.countryCode, count: d.count, lat: d.lat, lng: d.lng }));

    // City-level breakdown (for map dots — more granular than country)
    const cityCounts: Record<string, { count: number; lat: number; lng: number; country: string; countryCode: string }> = {};
    for (const row of allRows.filter(r => r.event === 'page_view' && r.city && r.latitude && r.longitude)) {
      const key = `${row.city}||${row.countryCode}`;
      if (!cityCounts[key]) {
        cityCounts[key] = { count: 0, lat: parseFloat(row.latitude!), lng: parseFloat(row.longitude!), country: row.country ?? '', countryCode: row.countryCode ?? '' };
      }
      cityCounts[key].count++;
    }
    const cities = Object.entries(cityCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([key, d]) => ({ city: key.split('||')[0], country: d.country, countryCode: d.countryCode, count: d.count, lat: d.lat, lng: d.lng }));

    // Device breakdown
    const deviceCounts: Record<string, number> = {};
    for (const row of allRows.filter(r => r.event === 'page_view')) {
      const d = row.deviceType ?? 'desktop';
      deviceCounts[d] = (deviceCounts[d] ?? 0) + 1;
    }
    const devices = Object.entries(deviceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([device, count]) => ({ device, count }));

    // Hourly traffic (today only, page_view)
    const hourly: { hour: number; count: number }[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    for (const row of todayRows.filter(r => r.event === 'page_view')) {
      hourly[row.createdAt.getHours()].count++;
    }

    // Top pages
    const pageCounts: Record<string, number> = {};
    for (const row of allRows.filter(r => r.event === 'page_view' && r.page)) {
      pageCounts[row.page!] = (pageCounts[row.page!] ?? 0) + 1;
    }
    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page, count]) => ({ page, count }));

    // UTM Campaigns
    const campaignCounts: Record<string, { count: number; source: string }> = {};
    for (const row of allRows.filter(r => r.utmCampaign)) {
      const key = row.utmCampaign!;
      if (!campaignCounts[key]) campaignCounts[key] = { count: 0, source: row.utmSource ?? '' };
      campaignCounts[key].count++;
    }
    const utmCampaigns = Object.entries(campaignCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([campaign, d]) => ({ campaign, source: d.source, count: d.count }));

    const recent = await db.select().from(siteEvents)
      .orderBy(desc(siteEvents.createdAt))
      .limit(100);

    return { days, today: statsFor(todayRows), yesterday: statsFor(yesterdayRows), trend, sources, funnel, countries, cities, devices, hourly, topPages, utmCampaigns, recent };
  }

  // ── Receipts ──────────────────────────────────────────────────────────────
  async createReceipt(userId: number, data: { receiptDate: string; amount: string; category: string; description?: string; fileData: string; fileType: string; fileName: string }): Promise<Receipt> {
    const [row] = await db.insert(receipts).values({
      userId,
      receiptDate: data.receiptDate,
      amount: data.amount,
      category: data.category,
      description: data.description ?? null,
      fileData: data.fileData,
      fileType: data.fileType,
      fileName: data.fileName,
      status: "pending",
    }).returning();
    return row;
  }

  async getReceiptsByUser(userId: number): Promise<Receipt[]> {
    return db.select().from(receipts).where(eq(receipts.userId, userId)).orderBy(desc(receipts.receiptDate));
  }

  async getAllReceipts(filters?: { year?: number; month?: number; day?: number }): Promise<ReceiptWithUser[]> {
    const rows = await db
      .select({
        id: receipts.id,
        userId: receipts.userId,
        receiptDate: receipts.receiptDate,
        amount: receipts.amount,
        category: receipts.category,
        description: receipts.description,
        fileData: receipts.fileData,
        fileType: receipts.fileType,
        fileName: receipts.fileName,
        status: receipts.status,
        adminNote: receipts.adminNote,
        reviewedBy: receipts.reviewedBy,
        reviewedAt: receipts.reviewedAt,
        createdAt: receipts.createdAt,
        userName: users.name,
        userPhone: users.phone,
      })
      .from(receipts)
      .innerJoin(users, eq(receipts.userId, users.id))
      .orderBy(desc(receipts.receiptDate));

    return rows
      .filter(r => {
        if (!filters) return true;
        const [y, m, d] = r.receiptDate.split("-").map(Number);
        if (filters.year && y !== filters.year) return false;
        if (filters.month && m !== filters.month) return false;
        if (filters.day && d !== filters.day) return false;
        return true;
      })
      .map(r => ({
        id: r.id,
        userId: r.userId,
        receiptDate: r.receiptDate,
        amount: r.amount,
        category: r.category,
        description: r.description,
        fileData: r.fileData,
        fileType: r.fileType,
        fileName: r.fileName,
        status: r.status,
        adminNote: r.adminNote,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
        user: { id: r.userId, name: r.userName, phone: r.userPhone },
      }));
  }

  async getReceiptById(id: number): Promise<Receipt | undefined> {
    const [row] = await db.select().from(receipts).where(eq(receipts.id, id));
    return row;
  }

  async updateReceiptStatus(id: number, status: 'approved' | 'rejected', adminNote: string | null, reviewedBy: number): Promise<Receipt | undefined> {
    const [row] = await db
      .update(receipts)
      .set({ status, adminNote, reviewedBy, reviewedAt: new Date() })
      .where(eq(receipts.id, id))
      .returning();
    return row;
  }

  async deleteReceipt(id: number): Promise<void> {
    await db.delete(receipts).where(eq(receipts.id, id));
  }

  // ── FAQ Entries ─────────────────────────────────────────────────────────────
  async getFaqEntries(activeOnly = false): Promise<FaqEntry[]> {
    const q = db.select().from(faqEntries);
    if (activeOnly) {
      return q.where(eq(faqEntries.active, true)).orderBy(faqEntries.sortOrder, faqEntries.id);
    }
    return q.orderBy(faqEntries.sortOrder, faqEntries.id);
  }

  async createFaqEntry(data: InsertFaqEntry): Promise<FaqEntry> {
    const [created] = await db.insert(faqEntries).values(data).returning();
    return created;
  }

  async updateFaqEntry(id: number, data: Partial<InsertFaqEntry>): Promise<FaqEntry | undefined> {
    const [updated] = await db.update(faqEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(faqEntries.id, id))
      .returning();
    return updated;
  }

  async deleteFaqEntry(id: number): Promise<void> {
    await db.delete(faqEntries).where(eq(faqEntries.id, id));
  }

  // ── Canned Replies ───────────────────────────────────────────────────────────
  async getCannedReplies(activeOnly = false): Promise<CannedReply[]> {
    const q = db.select().from(cannedReplies);
    if (activeOnly) {
      return q.where(eq(cannedReplies.active, true)).orderBy(cannedReplies.shortcut);
    }
    return q.orderBy(cannedReplies.shortcut);
  }

  async createCannedReply(data: InsertCannedReply): Promise<CannedReply> {
    const [created] = await db.insert(cannedReplies).values(data).returning();
    return created;
  }

  async updateCannedReply(id: number, data: Partial<InsertCannedReply>): Promise<CannedReply | undefined> {
    const [updated] = await db.update(cannedReplies).set(data).where(eq(cannedReplies.id, id)).returning();
    return updated;
  }

  async deleteCannedReply(id: number): Promise<void> {
    await db.delete(cannedReplies).where(eq(cannedReplies.id, id));
  }

  // ── Pricing Corrections ──────────────────────────────────────────────────────
  async getPricingCorrections(activeOnly = false): Promise<PricingCorrection[]> {
    const q = db.select().from(pricingCorrections);
    if (activeOnly) {
      return q.where(eq(pricingCorrections.active, true)).orderBy(desc(pricingCorrections.createdAt));
    }
    return q.orderBy(desc(pricingCorrections.createdAt));
  }

  async createPricingCorrection(data: InsertPricingCorrection): Promise<PricingCorrection> {
    const [created] = await db.insert(pricingCorrections).values(data).returning();
    return created;
  }

  async updatePricingCorrection(id: number, data: Partial<InsertPricingCorrection>): Promise<PricingCorrection | undefined> {
    const [updated] = await db.update(pricingCorrections).set(data).where(eq(pricingCorrections.id, id)).returning();
    return updated;
  }

  async deletePricingCorrection(id: number): Promise<void> {
    await db.delete(pricingCorrections).where(eq(pricingCorrections.id, id));
  }

  // ── Subcontractors ─────────────────────────────────────────────────────────
  async getSubcontractors(): Promise<Subcontractor[]> {
    return db.select().from(subcontractors).orderBy(subcontractors.name);
  }

  async getSubcontractorById(id: number): Promise<Subcontractor | undefined> {
    const [row] = await db.select().from(subcontractors).where(eq(subcontractors.id, id));
    return row;
  }

  async createSubcontractor(data: InsertSubcontractor): Promise<Subcontractor> {
    const [row] = await db.insert(subcontractors).values(data).returning();
    return row;
  }

  async updateSubcontractor(id: number, data: Partial<InsertSubcontractor>): Promise<Subcontractor | undefined> {
    const [row] = await db.update(subcontractors).set(data).where(eq(subcontractors.id, id)).returning();
    return row;
  }

  async deleteSubcontractor(id: number): Promise<void> {
    await db.delete(subcontractors).where(eq(subcontractors.id, id));
  }

  // ── Job Subcontracts ───────────────────────────────────────────────────────
  async getJobSubcontracts(quoteId: number): Promise<(JobSubcontract & { subcontractor: Subcontractor })[]> {
    const rows = await db.execute(sql`
      SELECT js.*, row_to_json(s) as subcontractor
      FROM job_subcontracts js
      JOIN subcontractors s ON s.id = js.subcontractor_id
      WHERE js.quote_id = ${quoteId}
      ORDER BY js.created_at
    `);
    return (rows.rows as any[]).map(r => ({
      id: r.id,
      quoteId: r.quote_id,
      subcontractorId: r.subcontractor_id,
      agreedCost: r.agreed_cost,
      paymentStatus: r.payment_status,
      paidAt: r.paid_at,
      notes: r.notes,
      createdAt: r.created_at,
      subcontractor: r.subcontractor,
    }));
  }

  async getSubcontractorJobs(subcontractorId: number): Promise<(JobSubcontract & { quoteRef: string; customerName: string | null; scheduledAt: Date | null; quoteTotal: string | null })[]> {
    const rows = await db.execute(sql`
      SELECT js.*, q.reference_no as quote_ref, c.name as customer_name, q.scheduled_at, q.total as quote_total
      FROM job_subcontracts js
      JOIN quotes q ON q.id = js.quote_id
      LEFT JOIN customers c ON c.id = q.customer_id
      WHERE js.subcontractor_id = ${subcontractorId}
      ORDER BY js.created_at DESC
    `);
    return (rows.rows as any[]).map(r => ({
      id: r.id,
      quoteId: r.quote_id,
      subcontractorId: r.subcontractor_id,
      agreedCost: r.agreed_cost,
      paymentStatus: r.payment_status,
      paidAt: r.paid_at,
      notes: r.notes,
      createdAt: r.created_at,
      quoteRef: r.quote_ref,
      customerName: r.customer_name ?? null,
      scheduledAt: r.scheduled_at ? new Date(r.scheduled_at) : null,
      quoteTotal: r.quote_total ?? null,
    }));
  }

  async assignSubcontract(data: InsertJobSubcontract): Promise<JobSubcontract> {
    const [row] = await db.insert(jobSubcontracts).values(data).returning();
    return row;
  }

  async updateJobSubcontract(id: number, data: Partial<Pick<JobSubcontract, 'agreedCost' | 'paymentStatus' | 'paidAt' | 'notes'>>): Promise<JobSubcontract | undefined> {
    const [row] = await db.update(jobSubcontracts).set(data).where(eq(jobSubcontracts.id, id)).returning();
    return row;
  }

  async deleteJobSubcontract(id: number): Promise<void> {
    await db.delete(jobSubcontracts).where(eq(jobSubcontracts.id, id));
  }

  async getSubcontractSummary(): Promise<{
    totalRevenue: number;
    totalSubCosts: number;
    netProfit: number;
    totalUnpaid: number;
    payables: { subcontractorId: number; name: string; company: string | null; unpaidCount: number; unpaidTotal: number }[];
  }> {
    // Total revenue = sum of paid quotes (deposit_paid + paid_in_full)
    const revenueRows = await db.execute(sql`
      SELECT COALESCE(SUM(
        CASE WHEN payment_status = 'paid_in_full' THEN COALESCE(total::numeric, 0)
             WHEN payment_status IN ('deposit_paid', 'final_pending') THEN COALESCE(deposit_amount::numeric, 0)
             ELSE 0 END
      ), 0) as total_revenue
      FROM quotes
      WHERE status NOT IN ('cancelled', 'new', 'sent')
    `);
    const totalRevenue = Number((revenueRows.rows[0] as any)?.total_revenue ?? 0);

    // Total sub costs
    const costsRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(agreed_cost::numeric), 0) as total_costs,
        COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN agreed_cost::numeric ELSE 0 END), 0) as total_unpaid
      FROM job_subcontracts
    `);
    const totalSubCosts = Number((costsRows.rows[0] as any)?.total_costs ?? 0);
    const totalUnpaid = Number((costsRows.rows[0] as any)?.total_unpaid ?? 0);

    // Per-sub payables
    const payableRows = await db.execute(sql`
      SELECT
        s.id as subcontractor_id,
        s.name,
        s.company,
        COUNT(js.id)::int as unpaid_count,
        COALESCE(SUM(js.agreed_cost::numeric), 0) as unpaid_total
      FROM subcontractors s
      JOIN job_subcontracts js ON js.subcontractor_id = s.id AND js.payment_status = 'unpaid'
      GROUP BY s.id, s.name, s.company
      HAVING COALESCE(SUM(js.agreed_cost::numeric), 0) > 0
      ORDER BY unpaid_total DESC
    `);

    return {
      totalRevenue,
      totalSubCosts,
      netProfit: totalRevenue - totalSubCosts,
      totalUnpaid,
      payables: (payableRows.rows as any[]).map(r => ({
        subcontractorId: Number(r.subcontractor_id),
        name: r.name,
        company: r.company ?? null,
        unpaidCount: Number(r.unpaid_count),
        unpaidTotal: Number(r.unpaid_total),
      })),
    };
  }

  // ── Partial Leads ─────────────────────────────────────────────────────────
  async createPartialLead(data: { resumeToken: string; email: string; name?: string; phone?: string; services?: any; serviceAddress?: string; pickupAddress?: string; dropoffAddress?: string; items?: any; slotDateStr?: string }): Promise<PartialLead> {
    const [row] = await db.insert(partialLeads).values({
      resumeToken: data.resumeToken,
      email: data.email,
      name: data.name ?? null,
      phone: data.phone ?? null,
      services: data.services ?? null,
      serviceAddress: data.serviceAddress ?? null,
      pickupAddress: data.pickupAddress ?? null,
      dropoffAddress: data.dropoffAddress ?? null,
      items: data.items ?? null,
      slotDateStr: data.slotDateStr ?? null,
      status: "pending",
    }).returning();
    return row;
  }

  async updatePartialLead(token: string, data: Partial<{ name: string; phone: string; services: any; serviceAddress: string; pickupAddress: string; dropoffAddress: string; items: any; slotDateStr: string; lastActiveAt: Date }>): Promise<void> {
    await db.update(partialLeads).set({ ...data, lastActiveAt: new Date() }).where(eq(partialLeads.resumeToken, token));
  }

  async markPartialLeadCompleted(token: string): Promise<void> {
    await db.update(partialLeads).set({ status: "completed", completedAt: new Date() }).where(eq(partialLeads.resumeToken, token));
  }

  async getPartialLeadByToken(token: string): Promise<PartialLead | undefined> {
    const [row] = await db.select().from(partialLeads).where(eq(partialLeads.resumeToken, token)).limit(1);
    return row;
  }

  async getDuePartialLeads(olderThanMs: number): Promise<PartialLead[]> {
    const cutoff = new Date(Date.now() - olderThanMs);
    return db.select().from(partialLeads).where(
      and(
        eq(partialLeads.status, "pending"),
        lte(partialLeads.createdAt, cutoff),
        isNull(partialLeads.emailSentAt),
      )
    );
  }

  async markPartialLeadEmailSent(token: string): Promise<void> {
    await db.update(partialLeads).set({ emailSentAt: new Date() }).where(eq(partialLeads.resumeToken, token));
  }

  async markPartialLeadWhatsappSent(token: string): Promise<void> {
    await db.update(partialLeads).set({ whatsappSentAt: new Date() }).where(eq(partialLeads.resumeToken, token));
  }
}

export const storage = new DatabaseStorage();

export async function autoBookPendingQuotes() {
  const stuckStatuses = ['deposit_paid', 'booking_requested'];
  const stuck = await db.select().from(quotes)
    .where(inArray(quotes.status, stuckStatuses));

  let migrated = 0;
  for (const q of stuck) {
    // Case 1: has a preferred slot from the estimate
    if (q.preferredDate && q.preferredTimeWindow) {
      const scheduledAt = new Date(q.preferredDate + 'T12:00:00');
      await db.update(quotes).set({
        status: 'booked',
        scheduledAt,
        timeWindow: q.preferredTimeWindow,
        slotHeldUntil: null,
        bookingRequestedAt: q.bookingRequestedAt ?? new Date(),
      }).where(eq(quotes.id, q.id));
      await db.insert(jobUpdates).values({
        quoteId: q.id,
        statusChange: 'booked',
        actorType: 'system',
        note: `Booking auto-confirmed for ${q.preferredDate} ${q.preferredTimeWindow} (migrated)`,
      });
      migrated++;
    // Case 2: already has a scheduledAt (admin-confirmed via old flow) but status didn't flip to booked
    } else if (q.scheduledAt && q.timeWindow) {
      await db.update(quotes).set({
        status: 'booked',
        slotHeldUntil: null,
      }).where(eq(quotes.id, q.id));
      await db.insert(jobUpdates).values({
        quoteId: q.id,
        statusChange: 'booked',
        actorType: 'system',
        note: `Status corrected to booked — slot already set for ${q.scheduledAt.toDateString()} ${q.timeWindow}`,
      });
      migrated++;
    }
  }
  if (migrated > 0) {
    console.log(`[startup] Auto-booked ${migrated} quote(s) from stuck deposit_paid/booking_requested state`);
  }
}
