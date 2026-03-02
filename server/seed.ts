import { db } from "./db";
import { users, catalogItems } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashSync } from "crypto";

export async function seedDatabase() {
  // Check if admin user exists
  const existingAdmin = await db.select().from(users).where(eq(users.username, "admin"));
  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      username: "admin",
      password: "password123", // Using simple password for prototype
      role: "admin",
      name: "System Admin"
    });
  }

  // Check if staff user exists
  const existingStaff = await db.select().from(users).where(eq(users.username, "staff1"));
  if (existingStaff.length === 0) {
    await db.insert(users).values({
      username: "staff1",
      password: "password123",
      role: "staff",
      name: "John Doe (Staff)"
    });
  }

  // Check if catalog items exist
  const existingItems = await db.select().from(catalogItems);
  if (existingItems.length === 0) {
    await db.insert(catalogItems).values([
      { name: "IKEA Pax Wardrobe", sku: "PAX-01", serviceType: "install", basePrice: "150.00" },
      { name: "IKEA Pax Wardrobe", sku: "PAX-02", serviceType: "dismantle", basePrice: "100.00" },
      { name: "Office Desk", sku: "OD-01", serviceType: "install", basePrice: "50.00" },
      { name: "Conference Table", sku: "CT-01", serviceType: "relocate", basePrice: "200.00" },
      { name: "Ergonomic Chair", sku: "EC-01", serviceType: "install", basePrice: "25.00" },
    ]);
  }
}
