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

  // Round 1: initial catalog (QB-INSTALL marker)
  const r1 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "QB-INSTALL"));
  if (r1.length === 0) {
    await db.insert(catalogItems).values([
      { name: "IKEA Pax Wardrobe", sku: "PAX-01", category: "IKEA Wardrobes", serviceType: "install", basePrice: "150.00" },
      { name: "IKEA Pax Wardrobe", sku: "PAX-02", category: "IKEA Wardrobes", serviceType: "dismantle", basePrice: "100.00" },
      { name: "IKEA Pax Wardrobe", sku: "PAX-RELOCATE", category: "IKEA Wardrobes", serviceType: "relocate", basePrice: "200.00" },
      { name: "Queen Bed Frame", sku: "QB-INSTALL", category: "Beds", serviceType: "install", basePrice: "80.00" },
      { name: "Queen Bed Frame", sku: "QB-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "60.00" },
      { name: "Queen Bed Frame", sku: "QB-RELOCATE", category: "Beds", serviceType: "relocate", basePrice: "120.00" },
      { name: "King Bed Frame", sku: "KB-INSTALL", category: "Beds", serviceType: "install", basePrice: "100.00" },
      { name: "King Bed Frame", sku: "KB-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "80.00" },
      { name: "King Bed Frame", sku: "KB-RELOCATE", category: "Beds", serviceType: "relocate", basePrice: "150.00" },
      { name: "Single Bed Frame", sku: "SB-INSTALL", category: "Beds", serviceType: "install", basePrice: "60.00" },
      { name: "Single Bed Frame", sku: "SB-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "45.00" },
      { name: "Single Bed Frame", sku: "SB-RELOCATE", category: "Beds", serviceType: "relocate", basePrice: "90.00" },
      { name: "Dressing Table", sku: "DT-INSTALL", category: "Bedroom", serviceType: "install", basePrice: "60.00" },
      { name: "Dressing Table", sku: "DT-DISMANTLE", category: "Bedroom", serviceType: "dismantle", basePrice: "45.00" },
      { name: "Dressing Table", sku: "DT-RELOCATE", category: "Bedroom", serviceType: "relocate", basePrice: "80.00" },
      { name: "Bedside Table", sku: "BT-INSTALL", category: "Bedroom", serviceType: "install", basePrice: "30.00" },
      { name: "Bedside Table", sku: "BT-DISMANTLE", category: "Bedroom", serviceType: "dismantle", basePrice: "25.00" },
      { name: "Bedside Table", sku: "BT-RELOCATE", category: "Bedroom", serviceType: "relocate", basePrice: "50.00" },
      { name: "3-Seater Sofa", sku: "SF3-INSTALL", category: "Sofas", serviceType: "install", basePrice: "80.00" },
      { name: "3-Seater Sofa", sku: "SF3-DISMANTLE", category: "Sofas", serviceType: "dismantle", basePrice: "60.00" },
      { name: "3-Seater Sofa", sku: "SF3-RELOCATE", category: "Sofas", serviceType: "relocate", basePrice: "150.00" },
      { name: "2-Seater Sofa", sku: "SF2-INSTALL", category: "Sofas", serviceType: "install", basePrice: "60.00" },
      { name: "2-Seater Sofa", sku: "SF2-DISMANTLE", category: "Sofas", serviceType: "dismantle", basePrice: "45.00" },
      { name: "2-Seater Sofa", sku: "SF2-RELOCATE", category: "Sofas", serviceType: "relocate", basePrice: "110.00" },
      { name: "TV Console", sku: "TVC-INSTALL", category: "Living Room", serviceType: "install", basePrice: "60.00" },
      { name: "TV Console", sku: "TVC-DISMANTLE", category: "Living Room", serviceType: "dismantle", basePrice: "50.00" },
      { name: "TV Console", sku: "TVC-RELOCATE", category: "Living Room", serviceType: "relocate", basePrice: "100.00" },
      { name: "Coffee Table", sku: "CFT-INSTALL", category: "Living Room", serviceType: "install", basePrice: "40.00" },
      { name: "Coffee Table", sku: "CFT-DISMANTLE", category: "Living Room", serviceType: "dismantle", basePrice: "30.00" },
      { name: "Coffee Table", sku: "CFT-RELOCATE", category: "Living Room", serviceType: "relocate", basePrice: "70.00" },
      { name: "TV Wall Mounting", sku: "TVWM-INSTALL", category: "Living Room", serviceType: "install", basePrice: "80.00" },
      { name: "Dining Table", sku: "DNT-INSTALL", category: "Dining", serviceType: "install", basePrice: "80.00" },
      { name: "Dining Table", sku: "DNT-DISMANTLE", category: "Dining", serviceType: "dismantle", basePrice: "60.00" },
      { name: "Dining Table", sku: "DNT-RELOCATE", category: "Dining", serviceType: "relocate", basePrice: "120.00" },
      { name: "Dining Chair", sku: "DNC-INSTALL", category: "Dining", serviceType: "install", basePrice: "20.00" },
      { name: "Dining Chair", sku: "DNC-DISMANTLE", category: "Dining", serviceType: "dismantle", basePrice: "15.00" },
      { name: "Dining Chair", sku: "DNC-RELOCATE", category: "Dining", serviceType: "relocate", basePrice: "30.00" },
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
      { name: "Bookshelf", sku: "BS-INSTALL", category: "Storage", serviceType: "install", basePrice: "60.00" },
      { name: "Bookshelf", sku: "BS-DISMANTLE", category: "Storage", serviceType: "dismantle", basePrice: "50.00" },
      { name: "Bookshelf", sku: "BS-RELOCATE", category: "Storage", serviceType: "relocate", basePrice: "100.00" },
      { name: "Display Cabinet", sku: "DC-INSTALL", category: "Storage", serviceType: "install", basePrice: "80.00" },
      { name: "Display Cabinet", sku: "DC-DISMANTLE", category: "Storage", serviceType: "dismantle", basePrice: "65.00" },
      { name: "Display Cabinet", sku: "DC-RELOCATE", category: "Storage", serviceType: "relocate", basePrice: "130.00" },
      { name: "Shoe Rack", sku: "SR-INSTALL", category: "Storage", serviceType: "install", basePrice: "30.00" },
      { name: "Shoe Rack", sku: "SR-DISMANTLE", category: "Storage", serviceType: "dismantle", basePrice: "25.00" },
      { name: "Shoe Rack", sku: "SR-RELOCATE", category: "Storage", serviceType: "relocate", basePrice: "50.00" },
      { name: "Mirror Installation", sku: "MI-INSTALL", category: "Others", serviceType: "install", basePrice: "50.00" },
    ]);
  }

  // Round 2: expanded market-rate catalog (IKEA-KALLAX-INSTALL marker)
  const r2 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "IKEA-KALLAX-INSTALL"));
  if (r2.length === 0) {
    await db.insert(catalogItems).values([

      // ─── IKEA Series ─────────────────────────────────────────────────────────
      { name: "IKEA Kallax Shelf Unit (2×2)", sku: "IKEA-KALLAX-INSTALL", category: "IKEA Shelving", serviceType: "install", basePrice: "45.00" },
      { name: "IKEA Kallax Shelf Unit (2×2)", sku: "IKEA-KALLAX-DISMANTLE", category: "IKEA Shelving", serviceType: "dismantle", basePrice: "35.00" },
      { name: "IKEA Kallax Shelf Unit (4×4)", sku: "IKEA-KALLAX44-INSTALL", category: "IKEA Shelving", serviceType: "install", basePrice: "65.00" },
      { name: "IKEA Kallax Shelf Unit (4×4)", sku: "IKEA-KALLAX44-DISMANTLE", category: "IKEA Shelving", serviceType: "dismantle", basePrice: "50.00" },

      { name: "IKEA Besta TV Unit", sku: "IKEA-BESTA-INSTALL", category: "IKEA Living Room", serviceType: "install", basePrice: "70.00" },
      { name: "IKEA Besta TV Unit", sku: "IKEA-BESTA-DISMANTLE", category: "IKEA Living Room", serviceType: "dismantle", basePrice: "55.00" },
      { name: "IKEA Besta TV Unit", sku: "IKEA-BESTA-RELOCATE", category: "IKEA Living Room", serviceType: "relocate", basePrice: "110.00" },

      { name: "IKEA Hemnes Bed Frame (Double)", sku: "IKEA-HEMNES-DBL-INSTALL", category: "IKEA Beds", serviceType: "install", basePrice: "90.00" },
      { name: "IKEA Hemnes Bed Frame (Double)", sku: "IKEA-HEMNES-DBL-DISMANTLE", category: "IKEA Beds", serviceType: "dismantle", basePrice: "70.00" },
      { name: "IKEA Hemnes Bed Frame (Queen)", sku: "IKEA-HEMNES-Q-INSTALL", category: "IKEA Beds", serviceType: "install", basePrice: "100.00" },
      { name: "IKEA Hemnes Bed Frame (Queen)", sku: "IKEA-HEMNES-Q-DISMANTLE", category: "IKEA Beds", serviceType: "dismantle", basePrice: "80.00" },

      { name: "IKEA Malm Bed Frame (Double)", sku: "IKEA-MALM-DBL-INSTALL", category: "IKEA Beds", serviceType: "install", basePrice: "90.00" },
      { name: "IKEA Malm Bed Frame (Double)", sku: "IKEA-MALM-DBL-DISMANTLE", category: "IKEA Beds", serviceType: "dismantle", basePrice: "70.00" },
      { name: "IKEA Malm Bed Frame (Queen/King)", sku: "IKEA-MALM-Q-INSTALL", category: "IKEA Beds", serviceType: "install", basePrice: "110.00" },
      { name: "IKEA Malm Bed Frame (Queen/King)", sku: "IKEA-MALM-Q-DISMANTLE", category: "IKEA Beds", serviceType: "dismantle", basePrice: "85.00" },

      { name: "IKEA Malm Chest of Drawers (3-drawer)", sku: "IKEA-MALM3-INSTALL", category: "IKEA Bedroom", serviceType: "install", basePrice: "45.00" },
      { name: "IKEA Malm Chest of Drawers (3-drawer)", sku: "IKEA-MALM3-DISMANTLE", category: "IKEA Bedroom", serviceType: "dismantle", basePrice: "35.00" },
      { name: "IKEA Malm Chest of Drawers (6-drawer)", sku: "IKEA-MALM6-INSTALL", category: "IKEA Bedroom", serviceType: "install", basePrice: "60.00" },
      { name: "IKEA Malm Chest of Drawers (6-drawer)", sku: "IKEA-MALM6-DISMANTLE", category: "IKEA Bedroom", serviceType: "dismantle", basePrice: "45.00" },

      { name: "IKEA Alex Drawer Unit", sku: "IKEA-ALEX-INSTALL", category: "IKEA Storage", serviceType: "install", basePrice: "45.00" },
      { name: "IKEA Alex Drawer Unit", sku: "IKEA-ALEX-DISMANTLE", category: "IKEA Storage", serviceType: "dismantle", basePrice: "35.00" },

      { name: "IKEA Billy Bookcase", sku: "IKEA-BILLY-INSTALL", category: "IKEA Shelving", serviceType: "install", basePrice: "40.00" },
      { name: "IKEA Billy Bookcase", sku: "IKEA-BILLY-DISMANTLE", category: "IKEA Shelving", serviceType: "dismantle", basePrice: "30.00" },
      { name: "IKEA Billy Bookcase with Extension", sku: "IKEA-BILLY-EXT-INSTALL", category: "IKEA Shelving", serviceType: "install", basePrice: "55.00" },
      { name: "IKEA Billy Bookcase with Extension", sku: "IKEA-BILLY-EXT-DISMANTLE", category: "IKEA Shelving", serviceType: "dismantle", basePrice: "40.00" },

      { name: "IKEA Trofast Storage System", sku: "IKEA-TROFAST-INSTALL", category: "IKEA Storage", serviceType: "install", basePrice: "40.00" },
      { name: "IKEA Trofast Storage System", sku: "IKEA-TROFAST-DISMANTLE", category: "IKEA Storage", serviceType: "dismantle", basePrice: "30.00" },

      { name: "IKEA Hemnes Wardrobe (3-door)", sku: "IKEA-HW3-INSTALL", category: "IKEA Wardrobes", serviceType: "install", basePrice: "120.00" },
      { name: "IKEA Hemnes Wardrobe (3-door)", sku: "IKEA-HW3-DISMANTLE", category: "IKEA Wardrobes", serviceType: "dismantle", basePrice: "90.00" },

      { name: "IKEA Kleppstad Wardrobe (2-door)", sku: "IKEA-KLEPP-INSTALL", category: "IKEA Wardrobes", serviceType: "install", basePrice: "80.00" },
      { name: "IKEA Kleppstad Wardrobe (2-door)", sku: "IKEA-KLEPP-DISMANTLE", category: "IKEA Wardrobes", serviceType: "dismantle", basePrice: "60.00" },

      { name: "IKEA Poäng Armchair", sku: "IKEA-POANG-INSTALL", category: "IKEA Living Room", serviceType: "install", basePrice: "30.00" },
      { name: "IKEA Poäng Armchair", sku: "IKEA-POANG-DISMANTLE", category: "IKEA Living Room", serviceType: "dismantle", basePrice: "25.00" },

      { name: "IKEA Kivik Sofa (3-seat)", sku: "IKEA-KIVIK3-INSTALL", category: "IKEA Living Room", serviceType: "install", basePrice: "70.00" },
      { name: "IKEA Kivik Sofa (3-seat)", sku: "IKEA-KIVIK3-DISMANTLE", category: "IKEA Living Room", serviceType: "dismantle", basePrice: "55.00" },

      { name: "IKEA Micke Desk", sku: "IKEA-MICKE-INSTALL", category: "IKEA Study", serviceType: "install", basePrice: "40.00" },
      { name: "IKEA Micke Desk", sku: "IKEA-MICKE-DISMANTLE", category: "IKEA Study", serviceType: "dismantle", basePrice: "30.00" },

      { name: "IKEA Lack TV Bench", sku: "IKEA-LACK-INSTALL", category: "IKEA Living Room", serviceType: "install", basePrice: "35.00" },
      { name: "IKEA Lack TV Bench", sku: "IKEA-LACK-DISMANTLE", category: "IKEA Living Room", serviceType: "dismantle", basePrice: "25.00" },

      { name: "IKEA Stuva Storage Combo (Kids)", sku: "IKEA-STUVA-INSTALL", category: "Kids", serviceType: "install", basePrice: "90.00" },
      { name: "IKEA Stuva Storage Combo (Kids)", sku: "IKEA-STUVA-DISMANTLE", category: "Kids", serviceType: "dismantle", basePrice: "65.00" },

      { name: "IKEA Vittsjo Laptop Stand/Shelf", sku: "IKEA-VITTSJO-INSTALL", category: "IKEA Study", serviceType: "install", basePrice: "35.00" },
      { name: "IKEA Vittsjo Laptop Stand/Shelf", sku: "IKEA-VITTSJO-DISMANTLE", category: "IKEA Study", serviceType: "dismantle", basePrice: "25.00" },

      { name: "IKEA Ivar Shelving Unit", sku: "IKEA-IVAR-INSTALL", category: "IKEA Shelving", serviceType: "install", basePrice: "50.00" },
      { name: "IKEA Ivar Shelving Unit", sku: "IKEA-IVAR-DISMANTLE", category: "IKEA Shelving", serviceType: "dismantle", basePrice: "35.00" },

      // ─── Speciality Beds ─────────────────────────────────────────────────────
      { name: "Hydraulic Storage Bed (Queen)", sku: "HYDR-Q-INSTALL", category: "Beds", serviceType: "install", basePrice: "150.00" },
      { name: "Hydraulic Storage Bed (Queen)", sku: "HYDR-Q-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "100.00" },
      { name: "Hydraulic Storage Bed (King)", sku: "HYDR-K-INSTALL", category: "Beds", serviceType: "install", basePrice: "180.00" },
      { name: "Hydraulic Storage Bed (King)", sku: "HYDR-K-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "120.00" },

      { name: "Bunk Bed (Standard)", sku: "BUNK-INSTALL", category: "Beds", serviceType: "install", basePrice: "150.00" },
      { name: "Bunk Bed (Standard)", sku: "BUNK-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "100.00" },
      { name: "Bunk Bed (with Trundle)", sku: "BUNK-TRD-INSTALL", category: "Beds", serviceType: "install", basePrice: "170.00" },
      { name: "Bunk Bed (with Trundle)", sku: "BUNK-TRD-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "120.00" },

      { name: "Loft Bed with Desk", sku: "LOFT-INSTALL", category: "Beds", serviceType: "install", basePrice: "170.00" },
      { name: "Loft Bed with Desk", sku: "LOFT-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "120.00" },

      { name: "Murphy / Wall Bed", sku: "MURPHY-INSTALL", category: "Beds", serviceType: "install", basePrice: "250.00" },
      { name: "Murphy / Wall Bed", sku: "MURPHY-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "180.00" },

      { name: "Tatami Platform Bed", sku: "TATAMI-INSTALL", category: "Beds", serviceType: "install", basePrice: "130.00" },
      { name: "Tatami Platform Bed", sku: "TATAMI-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "90.00" },

      { name: "Baby Crib / Cot", sku: "CRIB-INSTALL", category: "Kids", serviceType: "install", basePrice: "60.00" },
      { name: "Baby Crib / Cot", sku: "CRIB-DISMANTLE", category: "Kids", serviceType: "dismantle", basePrice: "45.00" },

      { name: "Platform Bed (Super Single)", sku: "PLAT-SS-INSTALL", category: "Beds", serviceType: "install", basePrice: "75.00" },
      { name: "Platform Bed (Super Single)", sku: "PLAT-SS-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "55.00" },

      // ─── Wardrobes & Built-in Storage ────────────────────────────────────────
      { name: "Sliding Door Wardrobe (2-door)", sku: "SLDR2-INSTALL", category: "Wardrobes", serviceType: "install", basePrice: "120.00" },
      { name: "Sliding Door Wardrobe (2-door)", sku: "SLDR2-DISMANTLE", category: "Wardrobes", serviceType: "dismantle", basePrice: "85.00" },
      { name: "Sliding Door Wardrobe (3-door)", sku: "SLDR3-INSTALL", category: "Wardrobes", serviceType: "install", basePrice: "160.00" },
      { name: "Sliding Door Wardrobe (3-door)", sku: "SLDR3-DISMANTLE", category: "Wardrobes", serviceType: "dismantle", basePrice: "110.00" },
      { name: "Hinged Door Wardrobe (2-door)", sku: "HGD2-INSTALL", category: "Wardrobes", serviceType: "install", basePrice: "100.00" },
      { name: "Hinged Door Wardrobe (2-door)", sku: "HGD2-DISMANTLE", category: "Wardrobes", serviceType: "dismantle", basePrice: "75.00" },
      { name: "Hinged Door Wardrobe (4-door)", sku: "HGD4-INSTALL", category: "Wardrobes", serviceType: "install", basePrice: "150.00" },
      { name: "Hinged Door Wardrobe (4-door)", sku: "HGD4-DISMANTLE", category: "Wardrobes", serviceType: "dismantle", basePrice: "110.00" },
      { name: "Custom/Built-in Wardrobe", sku: "CUST-WRD-INSTALL", category: "Wardrobes", serviceType: "install", basePrice: "200.00" },
      { name: "Custom/Built-in Wardrobe", sku: "CUST-WRD-DISMANTLE", category: "Wardrobes", serviceType: "dismantle", basePrice: "150.00" },
      { name: "Walk-in Wardrobe Frame System", sku: "WALKIN-INSTALL", category: "Wardrobes", serviceType: "install", basePrice: "300.00" },
      { name: "Walk-in Wardrobe Frame System", sku: "WALKIN-DISMANTLE", category: "Wardrobes", serviceType: "dismantle", basePrice: "220.00" },

      // ─── Sofas ───────────────────────────────────────────────────────────────
      { name: "L-Shaped / Corner Sofa", sku: "LSOFA-INSTALL", category: "Sofas", serviceType: "install", basePrice: "100.00" },
      { name: "L-Shaped / Corner Sofa", sku: "LSOFA-DISMANTLE", category: "Sofas", serviceType: "dismantle", basePrice: "75.00" },
      { name: "L-Shaped / Corner Sofa", sku: "LSOFA-RELOCATE", category: "Sofas", serviceType: "relocate", basePrice: "180.00" },

      { name: "Recliner Sofa (2-seater)", sku: "RECL2-INSTALL", category: "Sofas", serviceType: "install", basePrice: "70.00" },
      { name: "Recliner Sofa (2-seater)", sku: "RECL2-DISMANTLE", category: "Sofas", serviceType: "dismantle", basePrice: "55.00" },
      { name: "Recliner Sofa (3-seater)", sku: "RECL3-INSTALL", category: "Sofas", serviceType: "install", basePrice: "90.00" },
      { name: "Recliner Sofa (3-seater)", sku: "RECL3-DISMANTLE", category: "Sofas", serviceType: "dismantle", basePrice: "70.00" },

      { name: "Sofa Bed / Day Bed", sku: "SOFABED-INSTALL", category: "Sofas", serviceType: "install", basePrice: "80.00" },
      { name: "Sofa Bed / Day Bed", sku: "SOFABED-DISMANTLE", category: "Sofas", serviceType: "dismantle", basePrice: "60.00" },
      { name: "Sofa Bed / Day Bed", sku: "SOFABED-RELOCATE", category: "Sofas", serviceType: "relocate", basePrice: "130.00" },

      { name: "Single Armchair / Accent Chair", sku: "ARM-INSTALL", category: "Sofas", serviceType: "install", basePrice: "30.00" },
      { name: "Single Armchair / Accent Chair", sku: "ARM-DISMANTLE", category: "Sofas", serviceType: "dismantle", basePrice: "25.00" },
      { name: "Single Armchair / Accent Chair", sku: "ARM-RELOCATE", category: "Sofas", serviceType: "relocate", basePrice: "55.00" },

      { name: "Chaise Lounge", sku: "CHAISE-INSTALL", category: "Sofas", serviceType: "install", basePrice: "70.00" },
      { name: "Chaise Lounge", sku: "CHAISE-DISMANTLE", category: "Sofas", serviceType: "dismantle", basePrice: "55.00" },

      // ─── Living Room ─────────────────────────────────────────────────────────
      { name: "Entertainment Feature Wall Unit", sku: "ENT-INSTALL", category: "Living Room", serviceType: "install", basePrice: "120.00" },
      { name: "Entertainment Feature Wall Unit", sku: "ENT-DISMANTLE", category: "Living Room", serviceType: "dismantle", basePrice: "90.00" },

      { name: "Bar Cabinet / Wine Rack", sku: "BAR-INSTALL", category: "Living Room", serviceType: "install", basePrice: "65.00" },
      { name: "Bar Cabinet / Wine Rack", sku: "BAR-DISMANTLE", category: "Living Room", serviceType: "dismantle", basePrice: "50.00" },

      { name: "Side Table", sku: "SIDE-INSTALL", category: "Living Room", serviceType: "install", basePrice: "25.00" },
      { name: "Side Table", sku: "SIDE-DISMANTLE", category: "Living Room", serviceType: "dismantle", basePrice: "20.00" },
      { name: "Side Table", sku: "SIDE-RELOCATE", category: "Living Room", serviceType: "relocate", basePrice: "40.00" },

      { name: "Console / Hallway Table", sku: "CONS-INSTALL", category: "Living Room", serviceType: "install", basePrice: "45.00" },
      { name: "Console / Hallway Table", sku: "CONS-DISMANTLE", category: "Living Room", serviceType: "dismantle", basePrice: "35.00" },

      // ─── Dining ──────────────────────────────────────────────────────────────
      { name: "Extendable Dining Table", sku: "EXDT-INSTALL", category: "Dining", serviceType: "install", basePrice: "90.00" },
      { name: "Extendable Dining Table", sku: "EXDT-DISMANTLE", category: "Dining", serviceType: "dismantle", basePrice: "70.00" },
      { name: "Extendable Dining Table", sku: "EXDT-RELOCATE", category: "Dining", serviceType: "relocate", basePrice: "140.00" },

      { name: "Bar Stool / Counter Stool", sku: "BARSTL-INSTALL", category: "Dining", serviceType: "install", basePrice: "20.00" },
      { name: "Bar Stool / Counter Stool", sku: "BARSTL-DISMANTLE", category: "Dining", serviceType: "dismantle", basePrice: "15.00" },

      { name: "Sideboard / Buffet Cabinet", sku: "SIDE-BUF-INSTALL", category: "Dining", serviceType: "install", basePrice: "70.00" },
      { name: "Sideboard / Buffet Cabinet", sku: "SIDE-BUF-DISMANTLE", category: "Dining", serviceType: "dismantle", basePrice: "55.00" },
      { name: "Sideboard / Buffet Cabinet", sku: "SIDE-BUF-RELOCATE", category: "Dining", serviceType: "relocate", basePrice: "110.00" },

      { name: "China Cabinet / Display Hutch", sku: "CHINA-INSTALL", category: "Dining", serviceType: "install", basePrice: "80.00" },
      { name: "China Cabinet / Display Hutch", sku: "CHINA-DISMANTLE", category: "Dining", serviceType: "dismantle", basePrice: "65.00" },

      // ─── Office ──────────────────────────────────────────────────────────────
      { name: "L-Shaped Executive Desk", sku: "L-DESK-INSTALL", category: "Office", serviceType: "install", basePrice: "100.00" },
      { name: "L-Shaped Executive Desk", sku: "L-DESK-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "80.00" },
      { name: "L-Shaped Executive Desk", sku: "L-DESK-RELOCATE", category: "Office", serviceType: "relocate", basePrice: "160.00" },

      { name: "Height-Adjustable Sit-Stand Desk", sku: "STND-INSTALL", category: "Office", serviceType: "install", basePrice: "130.00" },
      { name: "Height-Adjustable Sit-Stand Desk", sku: "STND-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "100.00" },

      { name: "Office Panel / Partition", sku: "PANEL-INSTALL", category: "Office", serviceType: "install", basePrice: "60.00" },
      { name: "Office Panel / Partition", sku: "PANEL-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "45.00" },

      { name: "Locker Unit (Staff / School)", sku: "LOCK-INSTALL", category: "Office", serviceType: "install", basePrice: "55.00" },
      { name: "Locker Unit (Staff / School)", sku: "LOCK-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "40.00" },

      { name: "Reception Counter", sku: "RECPT-INSTALL", category: "Office", serviceType: "install", basePrice: "200.00" },
      { name: "Reception Counter", sku: "RECPT-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "150.00" },

      { name: "Monitor Arm / Desk Mount", sku: "MONARM-INSTALL", category: "Office", serviceType: "install", basePrice: "35.00" },
      { name: "Monitor Arm / Desk Mount", sku: "MONARM-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "25.00" },

      { name: "Credenza / Office Storage Cabinet", sku: "CRED-INSTALL", category: "Office", serviceType: "install", basePrice: "80.00" },
      { name: "Credenza / Office Storage Cabinet", sku: "CRED-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "60.00" },

      // ─── Kids ─────────────────────────────────────────────────────────────────
      { name: "Kids Study Desk with Hutch", sku: "KDSK-INSTALL", category: "Kids", serviceType: "install", basePrice: "100.00" },
      { name: "Kids Study Desk with Hutch", sku: "KDSK-DISMANTLE", category: "Kids", serviceType: "dismantle", basePrice: "75.00" },

      { name: "Kids Wardrobe (2-door)", sku: "KWRD-INSTALL", category: "Kids", serviceType: "install", basePrice: "100.00" },
      { name: "Kids Wardrobe (2-door)", sku: "KWRD-DISMANTLE", category: "Kids", serviceType: "dismantle", basePrice: "75.00" },

      { name: "Toy / Play Storage Unit", sku: "TOY-INSTALL", category: "Kids", serviceType: "install", basePrice: "45.00" },
      { name: "Toy / Play Storage Unit", sku: "TOY-DISMANTLE", category: "Kids", serviceType: "dismantle", basePrice: "35.00" },

      { name: "Changing Table / Baby Dresser", sku: "CHNG-INSTALL", category: "Kids", serviceType: "install", basePrice: "55.00" },
      { name: "Changing Table / Baby Dresser", sku: "CHNG-DISMANTLE", category: "Kids", serviceType: "dismantle", basePrice: "40.00" },

      // ─── Wall-Mounted & Others ───────────────────────────────────────────────
      { name: "Floating Shelf (per unit)", sku: "FLTSHL-INSTALL", category: "Wall-Mounted", serviceType: "install", basePrice: "45.00" },
      { name: "Floating Shelf (per unit)", sku: "FLTSHL-DISMANTLE", category: "Wall-Mounted", serviceType: "dismantle", basePrice: "30.00" },

      { name: "Wall Cabinet (single)", sku: "WLCAB-INSTALL", category: "Wall-Mounted", serviceType: "install", basePrice: "70.00" },
      { name: "Wall Cabinet (single)", sku: "WLCAB-DISMANTLE", category: "Wall-Mounted", serviceType: "dismantle", basePrice: "50.00" },

      { name: "Pegboard / Wall Organiser", sku: "PEG-INSTALL", category: "Wall-Mounted", serviceType: "install", basePrice: "40.00" },
      { name: "Pegboard / Wall Organiser", sku: "PEG-DISMANTLE", category: "Wall-Mounted", serviceType: "dismantle", basePrice: "25.00" },

      { name: "Full-Length Mirror", sku: "FLMIRR-INSTALL", category: "Wall-Mounted", serviceType: "install", basePrice: "55.00" },
      { name: "Full-Length Mirror", sku: "FLMIRR-DISMANTLE", category: "Wall-Mounted", serviceType: "dismantle", basePrice: "35.00" },

      { name: "Curtain Track / Rod Installation", sku: "CURT-INSTALL", category: "Wall-Mounted", serviceType: "install", basePrice: "50.00" },
      { name: "Curtain Track / Rod Installation", sku: "CURT-DISMANTLE", category: "Wall-Mounted", serviceType: "dismantle", basePrice: "30.00" },

      { name: "Swing Door Cabinet", sku: "SDCAB-INSTALL", category: "Storage", serviceType: "install", basePrice: "65.00" },
      { name: "Swing Door Cabinet", sku: "SDCAB-DISMANTLE", category: "Storage", serviceType: "dismantle", basePrice: "50.00" },

      { name: "Tall Shoe Cabinet (5+ tiers)", sku: "SCTALL-INSTALL", category: "Storage", serviceType: "install", basePrice: "50.00" },
      { name: "Tall Shoe Cabinet (5+ tiers)", sku: "SCTALL-DISMANTLE", category: "Storage", serviceType: "dismantle", basePrice: "35.00" },

      { name: "Drawer Chest (5+ drawers)", sku: "DRWCH-INSTALL", category: "Storage", serviceType: "install", basePrice: "65.00" },
      { name: "Drawer Chest (5+ drawers)", sku: "DRWCH-DISMANTLE", category: "Storage", serviceType: "dismantle", basePrice: "50.00" },

      { name: "Garden / Patio Furniture Set", sku: "GARD-INSTALL", category: "Outdoor", serviceType: "install", basePrice: "70.00" },
      { name: "Garden / Patio Furniture Set", sku: "GARD-DISMANTLE", category: "Outdoor", serviceType: "dismantle", basePrice: "55.00" },
      { name: "Garden / Patio Furniture Set", sku: "GARD-RELOCATE", category: "Outdoor", serviceType: "relocate", basePrice: "120.00" },

      { name: "Outdoor Bench", sku: "OUTBENCH-INSTALL", category: "Outdoor", serviceType: "install", basePrice: "40.00" },
      { name: "Outdoor Bench", sku: "OUTBENCH-DISMANTLE", category: "Outdoor", serviceType: "dismantle", basePrice: "30.00" },
    ]);
  }
}
