import { db } from "./db";
import { users, catalogItems } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  const existingAdmin = await db.select().from(users).where(eq(users.username, "admin"));
  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      username: "admin",
      password: "password123",
      role: "admin",
      name: "System Admin"
    });
  }

  const existingStaff = await db.select().from(users).where(eq(users.username, "staff1"));
  if (existingStaff.length === 0) {
    await db.insert(users).values({
      username: "staff1",
      password: "password123",
      role: "staff",
      name: "John Doe (Staff)"
    });
  }

  // Check if expanded catalog is already seeded (look for a new SKU)
  const existingNewItem = await db.select().from(catalogItems).where(eq(catalogItems.sku, "QB-INSTALL"));
  if (existingNewItem.length === 0) {
    await db.insert(catalogItems).values([
      // ─── Bedroom ───
      { name: "IKEA Pax Wardrobe", sku: "PAX-01", category: "Bedroom", serviceType: "install", basePrice: "150.00" },
      { name: "IKEA Pax Wardrobe", sku: "PAX-02", category: "Bedroom", serviceType: "dismantle", basePrice: "100.00" },
      { name: "IKEA Pax Wardrobe", sku: "PAX-RELOCATE", category: "Bedroom", serviceType: "relocate", basePrice: "200.00" },

      { name: "Queen Bed Frame", sku: "QB-INSTALL", category: "Bedroom", serviceType: "install", basePrice: "80.00" },
      { name: "Queen Bed Frame", sku: "QB-DISMANTLE", category: "Bedroom", serviceType: "dismantle", basePrice: "60.00" },
      { name: "Queen Bed Frame", sku: "QB-RELOCATE", category: "Bedroom", serviceType: "relocate", basePrice: "120.00" },

      { name: "King Bed Frame", sku: "KB-INSTALL", category: "Bedroom", serviceType: "install", basePrice: "100.00" },
      { name: "King Bed Frame", sku: "KB-DISMANTLE", category: "Bedroom", serviceType: "dismantle", basePrice: "80.00" },
      { name: "King Bed Frame", sku: "KB-RELOCATE", category: "Bedroom", serviceType: "relocate", basePrice: "150.00" },

      { name: "Single Bed Frame", sku: "SB-INSTALL", category: "Bedroom", serviceType: "install", basePrice: "60.00" },
      { name: "Single Bed Frame", sku: "SB-DISMANTLE", category: "Bedroom", serviceType: "dismantle", basePrice: "45.00" },
      { name: "Single Bed Frame", sku: "SB-RELOCATE", category: "Bedroom", serviceType: "relocate", basePrice: "90.00" },

      { name: "Dressing Table", sku: "DT-INSTALL", category: "Bedroom", serviceType: "install", basePrice: "60.00" },
      { name: "Dressing Table", sku: "DT-DISMANTLE", category: "Bedroom", serviceType: "dismantle", basePrice: "45.00" },
      { name: "Dressing Table", sku: "DT-RELOCATE", category: "Bedroom", serviceType: "relocate", basePrice: "80.00" },

      { name: "Bedside Table", sku: "BT-INSTALL", category: "Bedroom", serviceType: "install", basePrice: "30.00" },
      { name: "Bedside Table", sku: "BT-DISMANTLE", category: "Bedroom", serviceType: "dismantle", basePrice: "25.00" },
      { name: "Bedside Table", sku: "BT-RELOCATE", category: "Bedroom", serviceType: "relocate", basePrice: "50.00" },

      // ─── Living Room ───
      { name: "3-Seater Sofa", sku: "SF3-INSTALL", category: "Living Room", serviceType: "install", basePrice: "80.00" },
      { name: "3-Seater Sofa", sku: "SF3-DISMANTLE", category: "Living Room", serviceType: "dismantle", basePrice: "60.00" },
      { name: "3-Seater Sofa", sku: "SF3-RELOCATE", category: "Living Room", serviceType: "relocate", basePrice: "150.00" },

      { name: "2-Seater Sofa", sku: "SF2-INSTALL", category: "Living Room", serviceType: "install", basePrice: "60.00" },
      { name: "2-Seater Sofa", sku: "SF2-DISMANTLE", category: "Living Room", serviceType: "dismantle", basePrice: "45.00" },
      { name: "2-Seater Sofa", sku: "SF2-RELOCATE", category: "Living Room", serviceType: "relocate", basePrice: "110.00" },

      { name: "TV Console", sku: "TVC-INSTALL", category: "Living Room", serviceType: "install", basePrice: "60.00" },
      { name: "TV Console", sku: "TVC-DISMANTLE", category: "Living Room", serviceType: "dismantle", basePrice: "50.00" },
      { name: "TV Console", sku: "TVC-RELOCATE", category: "Living Room", serviceType: "relocate", basePrice: "100.00" },

      { name: "Coffee Table", sku: "CFT-INSTALL", category: "Living Room", serviceType: "install", basePrice: "40.00" },
      { name: "Coffee Table", sku: "CFT-DISMANTLE", category: "Living Room", serviceType: "dismantle", basePrice: "30.00" },
      { name: "Coffee Table", sku: "CFT-RELOCATE", category: "Living Room", serviceType: "relocate", basePrice: "70.00" },

      { name: "TV Wall Mounting", sku: "TVWM-INSTALL", category: "Living Room", serviceType: "install", basePrice: "80.00" },

      // ─── Dining ───
      { name: "Dining Table", sku: "DNT-INSTALL", category: "Dining", serviceType: "install", basePrice: "80.00" },
      { name: "Dining Table", sku: "DNT-DISMANTLE", category: "Dining", serviceType: "dismantle", basePrice: "60.00" },
      { name: "Dining Table", sku: "DNT-RELOCATE", category: "Dining", serviceType: "relocate", basePrice: "120.00" },

      { name: "Dining Chair", sku: "DNC-INSTALL", category: "Dining", serviceType: "install", basePrice: "20.00" },
      { name: "Dining Chair", sku: "DNC-DISMANTLE", category: "Dining", serviceType: "dismantle", basePrice: "15.00" },
      { name: "Dining Chair", sku: "DNC-RELOCATE", category: "Dining", serviceType: "relocate", basePrice: "30.00" },

      // ─── Office ───
      { name: "Office Desk", sku: "OD-01", category: "Office", serviceType: "install", basePrice: "50.00" },
      { name: "Office Desk", sku: "OD-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "50.00" },
      { name: "Office Desk", sku: "OD-RELOCATE", category: "Office", serviceType: "relocate", basePrice: "100.00" },

      { name: "Ergonomic Chair", sku: "EC-01", category: "Office", serviceType: "install", basePrice: "25.00" },
      { name: "Ergonomic Chair", sku: "EC-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "20.00" },
      { name: "Ergonomic Chair", sku: "EC-RELOCATE", category: "Office", serviceType: "relocate", basePrice: "40.00" },

      { name: "Filing Cabinet", sku: "FC-INSTALL", category: "Office", serviceType: "install", basePrice: "50.00" },
      { name: "Filing Cabinet", sku: "FC-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "40.00" },
      { name: "Filing Cabinet", sku: "FC-RELOCATE", category: "Office", serviceType: "relocate", basePrice: "80.00" },

      { name: "Conference Table", sku: "CT-01", category: "Office", serviceType: "relocate", basePrice: "200.00" },
      { name: "Conference Table", sku: "CT-INSTALL", category: "Office", serviceType: "install", basePrice: "150.00" },
      { name: "Conference Table", sku: "CT-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "120.00" },

      { name: "Bookshelf", sku: "BS-INSTALL", category: "Office", serviceType: "install", basePrice: "60.00" },
      { name: "Bookshelf", sku: "BS-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "50.00" },
      { name: "Bookshelf", sku: "BS-RELOCATE", category: "Office", serviceType: "relocate", basePrice: "100.00" },

      // ─── Others ───
      { name: "Display Cabinet", sku: "DC-INSTALL", category: "Others", serviceType: "install", basePrice: "80.00" },
      { name: "Display Cabinet", sku: "DC-DISMANTLE", category: "Others", serviceType: "dismantle", basePrice: "65.00" },
      { name: "Display Cabinet", sku: "DC-RELOCATE", category: "Others", serviceType: "relocate", basePrice: "130.00" },

      { name: "Shoe Rack", sku: "SR-INSTALL", category: "Others", serviceType: "install", basePrice: "30.00" },
      { name: "Shoe Rack", sku: "SR-DISMANTLE", category: "Others", serviceType: "dismantle", basePrice: "25.00" },
      { name: "Shoe Rack", sku: "SR-RELOCATE", category: "Others", serviceType: "relocate", basePrice: "50.00" },

      { name: "Mirror Installation", sku: "MI-INSTALL", category: "Others", serviceType: "install", basePrice: "50.00" },
    ]);
  }
}
