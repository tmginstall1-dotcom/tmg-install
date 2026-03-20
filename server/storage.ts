import { db } from "./db";
import { 
  users, customers, catalogItems, quotes, quoteItems, jobUpdates, blockedSlots, teams, attendanceLogs,
  attendanceAmendments, leaveRequests, payslips, gpsTrackPoints, siteEvents,
  type InsertUser, type InsertCustomer, type InsertCatalogItem, type InsertQuote, type InsertQuoteItem, type InsertJobUpdate,
  type QuoteResponse, type InsertBlockedSlot, type BlockedSlot,
  type Team, type InsertTeam, type AttendanceLog, type InsertAttendanceLog, type AttendanceLogWithUser,
  type AttendanceAmendment, type AttendanceAmendmentWithUser,
  type LeaveRequest, type LeaveRequestWithUser,
  type Payslip, type PayslipWithUser,
  type GpsTrackPoint, type SiteEvent
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
  addJobUpdate(update: InsertJobUpdate): Promise<void>;

  // Blocked Slots
  getBlockedSlots(): Promise<BlockedSlot[]>;
  createBlockedSlot(slot: InsertBlockedSlot): Promise<BlockedSlot>;
  deleteBlockedSlot(id: number): Promise<void>;

  // Held Slots (active quotes that have a slot reserved)
  getHeldSlots(): Promise<{ date: string; timeSlot: string; quoteId: number }[]>;
  getSlotCapacities(): Promise<{ date: string; timeSlot: string; usedAmount: number }[]>;
  isSlotAvailable(date: string, timeWindow: string, excludeQuoteId?: number): Promise<boolean>;

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
    const results = await Promise.all(quotesList.map(q => this.fetchQuoteDetails(q.id)));
    return results.filter(Boolean) as QuoteResponse[];
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

  async getQuotes(status?: string): Promise<QuoteResponse[]> {
    const quotesList = status ? await db.select().from(quotes).where(eq(quotes.status, status)).orderBy(desc(quotes.createdAt)) : await db.select().from(quotes).orderBy(desc(quotes.createdAt));
    const detailedQuotes = await Promise.all(quotesList.map(q => this.fetchQuoteDetails(q.id)));
    return detailedQuotes.filter((q): q is QuoteResponse => q !== undefined);
  }

  async getQuotesByStatuses(statuses: string[]): Promise<QuoteResponse[]> {
    const quotesList = await db.select().from(quotes).where(inArray(quotes.status, statuses)).orderBy(desc(quotes.createdAt));
    const detailedQuotes = await Promise.all(quotesList.map(q => this.fetchQuoteDetails(q.id)));
    return detailedQuotes.filter((q): q is QuoteResponse => q !== undefined);
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

    if (data.quoteUpdates) {
      await db.update(quotes).set(data.quoteUpdates).where(eq(quotes.id, id));
    }

    if (data.items !== undefined) {
      // Replace all items
      await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));
      if (data.items.length > 0) {
        await db.insert(quoteItems).values(data.items.map(item => ({ ...item, quoteId: id })));
      }
      // Recalculate totals
      const subtotal = data.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      const existingQuote = await db.select().from(quotes).where(eq(quotes.id, id));
      const transportFee = Number(existingQuote[0]?.transportFee || 0);
      const total = subtotal + transportFee;
      const depositAmount = (total * 0.30).toFixed(2);
      const finalAmount = (total * 0.70).toFixed(2);
      await db.update(quotes).set({
        subtotal: subtotal.toFixed(2),
        total: total.toFixed(2),
        depositAmount,
        finalAmount,
      }).where(eq(quotes.id, id));
    }

    await db.insert(jobUpdates).values({
      quoteId: id,
      statusChange: 'edited',
      actorType: 'admin',
      note: 'Quote edited by admin'
    });

    return await this.fetchQuoteDetails(id);
  }

  async addJobUpdate(update: InsertJobUpdate) {
    await db.insert(jobUpdates).values(update);
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
