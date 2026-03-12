import { db } from "./db";
import { 
  users, customers, catalogItems, quotes, quoteItems, jobUpdates, blockedSlots,
  type InsertUser, type InsertCustomer, type InsertCatalogItem, type InsertQuote, type InsertQuoteItem, type InsertJobUpdate,
  type QuoteResponse, type InsertBlockedSlot, type BlockedSlot
} from "@shared/schema";
import { eq, desc, or, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserByUsername(username: string): Promise<typeof users.$inferSelect | undefined>;
  getStaffMembers(): Promise<typeof users.$inferSelect[]>;
  createUser(user: InsertUser): Promise<typeof users.$inferSelect>;

  // Catalog
  getCatalogItems(search?: string): Promise<typeof catalogItems.$inferSelect[]>;
  createCatalogItem(item: InsertCatalogItem): Promise<typeof catalogItems.$inferSelect>;

  // Quotes
  getQuotes(status?: string): Promise<QuoteResponse[]>;
  getQuotesByStatuses(statuses: string[]): Promise<QuoteResponse[]>;
  getQuote(id: number): Promise<QuoteResponse | undefined>;
  createQuote(customer: InsertCustomer, quote: Omit<InsertQuote, 'customerId'>, items: InsertQuoteItem[]): Promise<QuoteResponse>;
  updateQuoteStatus(id: number, status: string, updateRecord?: Omit<InsertJobUpdate, 'quoteId' | 'statusChange'>, assignedStaffId?: number): Promise<QuoteResponse | undefined>;
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
}

export class DatabaseStorage implements IStorage {
  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getStaffMembers() {
    return await db.select().from(users).where(eq(users.role, 'staff'));
  }

  async createUser(user: InsertUser) {
    const [created] = await db.insert(users).values(user).returning();
    return created;
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
      items: itemsWithCatalog,
      updates: updatesList,
    };
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

  async updateQuoteStatus(id: number, status: string, updateRecord?: Omit<InsertJobUpdate, 'quoteId' | 'statusChange'>, assignedStaffId?: number) {
    const updateData: Partial<typeof quotes.$inferInsert> = { status };
    if (assignedStaffId !== undefined) {
      updateData.assignedStaffId = assignedStaffId;
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
    const updateData: Partial<typeof quotes.$inferInsert> = {};
    const now = new Date();

    if (paymentType === 'deposit') {
      updateData.depositPaidAt = now;
      updateData.paymentStatus = 'deposit_paid';
      updateData.status = 'deposit_paid';
    } else {
      updateData.finalPaidAt = now;
      updateData.paymentStatus = 'paid_in_full';
      updateData.status = 'final_paid';
    }

    await db.update(quotes).set(updateData).where(eq(quotes.id, id));
    await db.insert(jobUpdates).values({
      quoteId: id,
      statusChange: paymentType === 'deposit' ? 'deposit_paid' : 'final_paid',
      actorType: 'customer',
      note: `${paymentType === 'deposit' ? 'Deposit' : 'Final'} payment of $${amount} received`
    });

    // Auto-close if final payment received and job was completed
    if (paymentType === 'final') {
      const quote = await this.fetchQuoteDetails(id);
      if (quote) {
        // Auto-close
        await db.update(quotes).set({ status: 'closed' }).where(eq(quotes.id, id));
        await db.insert(jobUpdates).values({
          quoteId: id,
          statusChange: 'closed',
          actorType: 'system',
          note: 'Case automatically closed after final payment received'
        });
      }
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
}

export const storage = new DatabaseStorage();
