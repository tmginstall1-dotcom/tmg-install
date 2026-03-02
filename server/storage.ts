import { db } from "./db";
import { 
  users, customers, catalogItems, quotes, quoteItems, jobUpdates,
  type InsertUser, type InsertCustomer, type InsertCatalogItem, type InsertQuote, type InsertQuoteItem, type InsertJobUpdate,
  type QuoteResponse
} from "@shared/schema";
import { eq } from "drizzle-orm";

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
  getQuote(id: number): Promise<QuoteResponse | undefined>;
  createQuote(customer: InsertCustomer, quote: Omit<InsertQuote, 'customerId'>, items: InsertQuoteItem[]): Promise<QuoteResponse>;
  updateQuoteStatus(id: number, status: string, updateRecord?: InsertJobUpdate, assignedStaffId?: number): Promise<QuoteResponse | undefined>;
  updateQuotePayment(id: number, paymentType: 'deposit' | 'final', amount: string): Promise<QuoteResponse | undefined>;
  updateQuoteBooking(id: number, scheduledAt: Date, timeWindow: string): Promise<QuoteResponse | undefined>;
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
    let query = db.select().from(catalogItems);
    // Simple search implementation
    const items = await query;
    if (search) {
      const lowerSearch = search.toLowerCase();
      return items.filter(i => i.name.toLowerCase().includes(lowerSearch) || i.sku?.toLowerCase().includes(lowerSearch));
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

    const updatesList = await db.select().from(jobUpdates).where(eq(jobUpdates.quoteId, quoteId));

    return {
      ...quote,
      customer,
      assignedStaff: staff,
      items: itemsWithCatalog,
      updates: updatesList,
    };
  }

  async getQuotes(status?: string): Promise<QuoteResponse[]> {
    let query = db.select().from(quotes);
    const quotesList = status ? await db.select().from(quotes).where(eq(quotes.status, status)) : await query;
    
    const detailedQuotes = await Promise.all(quotesList.map(q => this.fetchQuoteDetails(q.id)));
    return detailedQuotes.filter((q): q is QuoteResponse => q !== undefined);
  }

  async getQuote(id: number): Promise<QuoteResponse | undefined> {
    return await this.fetchQuoteDetails(id);
  }

  async createQuote(customerData: InsertCustomer, quoteData: Omit<InsertQuote, 'customerId'>, itemsData: Omit<InsertQuoteItem, 'quoteId'>[]) {
    // 1. Create customer
    const [customer] = await db.insert(customers).values(customerData).returning();

    // 2. Create quote
    const [quote] = await db.insert(quotes).values({
      ...quoteData,
      customerId: customer.id
    }).returning();

    // 3. Create items
    if (itemsData.length > 0) {
      await db.insert(quoteItems).values(
        itemsData.map(item => ({ ...item, quoteId: quote.id }))
      );
    }

    // 4. Create initial timeline update
    await db.insert(jobUpdates).values({
      quoteId: quote.id,
      statusChange: quoteData.status || 'submitted',
      actorType: 'customer',
      note: 'Quote requested online'
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
      updateData.depositAmount = amount;
      updateData.depositPaidAt = now;
      updateData.paymentStatus = 'deposit_paid';
    } else {
      updateData.finalAmount = amount;
      updateData.finalPaidAt = now;
      updateData.paymentStatus = 'paid_in_full';
    }

    await db.update(quotes).set(updateData).where(eq(quotes.id, id));

    await db.insert(jobUpdates).values({
      quoteId: id,
      statusChange: `payment_${paymentType}_received`,
      actorType: 'customer',
      note: `${paymentType === 'deposit' ? 'Deposit' : 'Final'} payment of $${amount} received`
    });

    return await this.fetchQuoteDetails(id);
  }

  async updateQuoteBooking(id: number, scheduledAt: Date, timeWindow: string) {
    await db.update(quotes).set({
      scheduledAt,
      timeWindow,
      status: 'booked'
    }).where(eq(quotes.id, id));

    await db.insert(jobUpdates).values({
      quoteId: id,
      statusChange: 'booked',
      actorType: 'customer',
      note: `Booking confirmed for ${scheduledAt.toDateString()} ${timeWindow}`
    });

    return await this.fetchQuoteDetails(id);
  }
}

export const storage = new DatabaseStorage();
