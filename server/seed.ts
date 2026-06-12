import { db } from "./db";
import { users, catalogItems, faqEntries, cannedReplies } from "@shared/schema";
import { eq, count, sql, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

const ACCOUNTS = [
  { username: "admin", password: "Admin@TMG2026", role: "admin", name: "System Admin" },
] as const;

export async function seedDatabase() {
  for (const acct of ACCOUNTS) {
    const hash = await bcrypt.hash(acct.password, 10);
    await db
      .insert(users)
      .values({ username: acct.username, password: hash, role: acct.role, name: acct.name })
      .onConflictDoUpdate({
        target: users.username,
        set: { password: hash, name: acct.name, role: acct.role },
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

      { name: "Height-Adjustable Sit-Stand Desk", sku: "STND-INSTALL", category: "Office", serviceType: "install", basePrice: "100.00" },
      { name: "Height-Adjustable Sit-Stand Desk", sku: "STND-DISMANTLE", category: "Office", serviceType: "dismantle", basePrice: "60.00" },

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

      { name: "Swing Door Cabinet", sku: "SDCAB-INSTALL", category: "Storage", serviceType: "install", basePrice: "70.00" },
      { name: "Swing Door Cabinet", sku: "SDCAB-DISMANTLE", category: "Storage", serviceType: "dismantle", basePrice: "50.00" },

      { name: "Tall Shoe Cabinet (5+ tiers)", sku: "SCTALL-INSTALL", category: "Storage", serviceType: "install", basePrice: "85.00" },
      { name: "Tall Shoe Cabinet (5+ tiers)", sku: "SCTALL-DISMANTLE", category: "Storage", serviceType: "dismantle", basePrice: "55.00" },

      { name: "Drawer Chest (5+ drawers)", sku: "DRWCH-INSTALL", category: "Storage", serviceType: "install", basePrice: "80.00" },
      { name: "Drawer Chest (5+ drawers)", sku: "DRWCH-DISMANTLE", category: "Storage", serviceType: "dismantle", basePrice: "60.00" },

      { name: "Combo Cabinet (Drawers + Swing Doors)", sku: "CMBCAB-INSTALL", category: "Storage", serviceType: "install", basePrice: "90.00" },
      { name: "Combo Cabinet (Drawers + Swing Doors)", sku: "CMBCAB-DISMANTLE", category: "Storage", serviceType: "dismantle", basePrice: "65.00" },

      { name: "Garden / Patio Furniture Set", sku: "GARD-INSTALL", category: "Outdoor", serviceType: "install", basePrice: "70.00" },
      { name: "Garden / Patio Furniture Set", sku: "GARD-DISMANTLE", category: "Outdoor", serviceType: "dismantle", basePrice: "55.00" },
      { name: "Garden / Patio Furniture Set", sku: "GARD-RELOCATE", category: "Outdoor", serviceType: "relocate", basePrice: "120.00" },

      { name: "Outdoor Bench", sku: "OUTBENCH-INSTALL", category: "Outdoor", serviceType: "install", basePrice: "40.00" },
      { name: "Outdoor Bench", sku: "OUTBENCH-DISMANTLE", category: "Outdoor", serviceType: "dismantle", basePrice: "30.00" },
    ]);
  }

  // Round 2b (back-fill): Combo Cabinet rows added after Round 2 was already
  // sealed in production. The Round 2 marker (IKEA-KALLAX-INSTALL) blocks the
  // whole block from running again on existing deployments, so these two new
  // SKUs would never reach prod. Insert each missing SKU independently so a
  // partial state (one present, one missing) still self-heals.
  const cmbcabRows = [
    { name: "Combo Cabinet (Drawers + Swing Doors)", sku: "CMBCAB-INSTALL", category: "Storage", serviceType: "install", basePrice: "90.00", volumeM3: "0.50" },
    { name: "Combo Cabinet (Drawers + Swing Doors)", sku: "CMBCAB-DISMANTLE", category: "Storage", serviceType: "dismantle", basePrice: "65.00", volumeM3: "0.50" },
  ];
  for (const row of cmbcabRows) {
    const existing = await db.select().from(catalogItems).where(eq(catalogItems.sku, row.sku));
    if (existing.length === 0) {
      await db.insert(catalogItems).values(row).onConflictDoNothing();
      console.log(`[seed] Inserted ${row.sku} (Combo Cabinet back-fill).`);
    }
  }

  // Round 3: Phone Booths / Meeting Pods + Drilling Services (PHONE-BOOTH-INSTALL marker)
  const r3 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "PHONE-BOOTH-INSTALL"));
  if (r3.length === 0) {
    await db.insert(catalogItems).values([

      // ─── Phone Booths & Meeting Pods ─────────────────────────────────────────
      // Solo phone booth (1-person acoustic pod, freestanding, ~1m² footprint)
      { name: "Solo Phone Booth (1-Person)", sku: "PHONE-BOOTH-INSTALL", category: "Meeting Pods & Phone Booths", serviceType: "install", basePrice: "280.00" },
      { name: "Solo Phone Booth (1-Person)", sku: "PHONE-BOOTH-DISMANTLE", category: "Meeting Pods & Phone Booths", serviceType: "dismantle", basePrice: "180.00" },
      { name: "Solo Phone Booth (1-Person)", sku: "PHONE-BOOTH-RELOCATE", category: "Meeting Pods & Phone Booths", serviceType: "relocate", basePrice: "380.00" },

      // Duo / 2-person phone booth
      { name: "Duo Phone Booth (2-Person)", sku: "DUO-BOOTH-INSTALL", category: "Meeting Pods & Phone Booths", serviceType: "install", basePrice: "350.00" },
      { name: "Duo Phone Booth (2-Person)", sku: "DUO-BOOTH-DISMANTLE", category: "Meeting Pods & Phone Booths", serviceType: "dismantle", basePrice: "250.00" },
      { name: "Duo Phone Booth (2-Person)", sku: "DUO-BOOTH-RELOCATE", category: "Meeting Pods & Phone Booths", serviceType: "relocate", basePrice: "500.00" },

      // 4-person meeting pod
      { name: "Meeting Pod (4-Person)", sku: "POD4-INSTALL", category: "Meeting Pods & Phone Booths", serviceType: "install", basePrice: "550.00" },
      { name: "Meeting Pod (4-Person)", sku: "POD4-DISMANTLE", category: "Meeting Pods & Phone Booths", serviceType: "dismantle", basePrice: "380.00" },
      { name: "Meeting Pod (4-Person)", sku: "POD4-RELOCATE", category: "Meeting Pods & Phone Booths", serviceType: "relocate", basePrice: "750.00" },

      // 6-person meeting room pod
      { name: "Meeting Room Pod (6-Person)", sku: "POD6-INSTALL", category: "Meeting Pods & Phone Booths", serviceType: "install", basePrice: "750.00" },
      { name: "Meeting Room Pod (6-Person)", sku: "POD6-DISMANTLE", category: "Meeting Pods & Phone Booths", serviceType: "dismantle", basePrice: "550.00" },
      { name: "Meeting Room Pod (6-Person)", sku: "POD6-RELOCATE", category: "Meeting Pods & Phone Booths", serviceType: "relocate", basePrice: "950.00" },

      // 8-person / large boardroom pod
      { name: "Large Meeting Pod (8-Person)", sku: "POD8-INSTALL", category: "Meeting Pods & Phone Booths", serviceType: "install", basePrice: "950.00" },
      { name: "Large Meeting Pod (8-Person)", sku: "POD8-DISMANTLE", category: "Meeting Pods & Phone Booths", serviceType: "dismantle", basePrice: "700.00" },
      { name: "Large Meeting Pod (8-Person)", sku: "POD8-RELOCATE", category: "Meeting Pods & Phone Booths", serviceType: "relocate", basePrice: "1200.00" },

      // Freestanding acoustic booth (open-top / semi-enclosed)
      { name: "Freestanding Acoustic Booth", sku: "ACBOOTH-INSTALL", category: "Meeting Pods & Phone Booths", serviceType: "install", basePrice: "300.00" },
      { name: "Freestanding Acoustic Booth", sku: "ACBOOTH-DISMANTLE", category: "Meeting Pods & Phone Booths", serviceType: "dismantle", basePrice: "200.00" },
      { name: "Freestanding Acoustic Booth", sku: "ACBOOTH-RELOCATE", category: "Meeting Pods & Phone Booths", serviceType: "relocate", basePrice: "420.00" },

      // Modular pod panel (per panel, for modular pod systems)
      { name: "Modular Pod Panel (per panel)", sku: "PODPANEL-INSTALL", category: "Meeting Pods & Phone Booths", serviceType: "install", basePrice: "80.00" },
      { name: "Modular Pod Panel (per panel)", sku: "PODPANEL-DISMANTLE", category: "Meeting Pods & Phone Booths", serviceType: "dismantle", basePrice: "60.00" },

      // Kiosk / standing mini-pod
      { name: "Standing Kiosk / Mini Pod", sku: "KIOSK-INSTALL", category: "Meeting Pods & Phone Booths", serviceType: "install", basePrice: "200.00" },
      { name: "Standing Kiosk / Mini Pod", sku: "KIOSK-DISMANTLE", category: "Meeting Pods & Phone Booths", serviceType: "dismantle", basePrice: "150.00" },
      { name: "Standing Kiosk / Mini Pod", sku: "KIOSK-RELOCATE", category: "Meeting Pods & Phone Booths", serviceType: "relocate", basePrice: "280.00" },

      // ─── Drilling Services ────────────────────────────────────────────────────
      // Standard wall drilling — brick / plasterboard (per hole)
      { name: "Wall Drilling — Brick / Drywall (per hole)", sku: "DRILL-BRICK", category: "Drilling Services", serviceType: "install", basePrice: "15.00" },

      // Concrete wall drilling (per hole) — reinforced/HDB concrete
      { name: "Wall Drilling — Concrete (per hole)", sku: "DRILL-CONCRETE", category: "Drilling Services", serviceType: "install", basePrice: "25.00" },

      // Marble / tile drilling (per hole) — delicate surface requiring diamond bit
      { name: "Wall Drilling — Marble / Tile (per hole)", sku: "DRILL-MARBLE", category: "Drilling Services", serviceType: "install", basePrice: "40.00" },

      // Glass / tempered glass drilling (per hole)
      { name: "Glass / Partition Drilling (per hole)", sku: "DRILL-GLASS", category: "Drilling Services", serviceType: "install", basePrice: "60.00" },

      // Shelf or bracket mounting (per bracket set, includes rawl plugs and screws)
      { name: "Shelf Bracket Mounting (per bracket set)", sku: "DRILL-BRACKET", category: "Drilling Services", serviceType: "install", basePrice: "30.00" },

      // Heavy-duty wall anchor (per anchor point — for load-bearing fittings)
      { name: "Heavy-Duty Wall Anchor (per point)", sku: "DRILL-ANCHOR", category: "Drilling Services", serviceType: "install", basePrice: "35.00" },

      // Hole-patching / wall restoration after removal (per hole)
      { name: "Wall Hole Patching / Restoration (per hole)", sku: "DRILL-PATCH", category: "Drilling Services", serviceType: "dismantle", basePrice: "20.00" },

      // Cable / conduit channel drilling through wall (per penetration)
      { name: "Cable / Conduit Wall Penetration (per point)", sku: "DRILL-CABLE", category: "Drilling Services", serviceType: "install", basePrice: "45.00" },

      // Overhead cable tray mounting (per metre run — drilling into ceiling/beam)
      { name: "Overhead Cable Tray Mounting (per metre)", sku: "DRILL-TRAY", category: "Drilling Services", serviceType: "install", basePrice: "55.00" },

      // Full set of misc. fixings / misc drilling (job-based for small works)
      { name: "Miscellaneous Drilling & Fixing (per session)", sku: "DRILL-MISC", category: "Drilling Services", serviceType: "install", basePrice: "80.00" },
    ]);
  }

  // Round 4: Gym equipment, appliances, SG-specific items (TREADMILL-INSTALL marker)
  const r4 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "TREADMILL-INSTALL"));
  if (r4.length === 0) {
    await db.insert(catalogItems).values([

      // ─── Gym & Fitness Equipment ──────────────────────────────────────────────
      { name: "Treadmill",                       sku: "TREADMILL-INSTALL",   category: "Gym Equipment", serviceType: "install",   basePrice: "80.00" },
      { name: "Treadmill",                       sku: "TREADMILL-DISMANTLE", category: "Gym Equipment", serviceType: "dismantle", basePrice: "60.00" },
      { name: "Treadmill",                       sku: "TREADMILL-RELOCATE",  category: "Gym Equipment", serviceType: "relocate",  basePrice: "140.00" },

      { name: "Elliptical Machine",              sku: "ELLIP-INSTALL",   category: "Gym Equipment", serviceType: "install",   basePrice: "80.00" },
      { name: "Elliptical Machine",              sku: "ELLIP-DISMANTLE", category: "Gym Equipment", serviceType: "dismantle", basePrice: "60.00" },
      { name: "Elliptical Machine",              sku: "ELLIP-RELOCATE",  category: "Gym Equipment", serviceType: "relocate",  basePrice: "130.00" },

      { name: "Rowing Machine",                  sku: "ROW-INSTALL",   category: "Gym Equipment", serviceType: "install",   basePrice: "60.00" },
      { name: "Rowing Machine",                  sku: "ROW-DISMANTLE", category: "Gym Equipment", serviceType: "dismantle", basePrice: "45.00" },
      { name: "Rowing Machine",                  sku: "ROW-RELOCATE",  category: "Gym Equipment", serviceType: "relocate",  basePrice: "100.00" },

      { name: "Exercise / Spin Bike",            sku: "BIKE-INSTALL",   category: "Gym Equipment", serviceType: "install",   basePrice: "50.00" },
      { name: "Exercise / Spin Bike",            sku: "BIKE-DISMANTLE", category: "Gym Equipment", serviceType: "dismantle", basePrice: "40.00" },
      { name: "Exercise / Spin Bike",            sku: "BIKE-RELOCATE",  category: "Gym Equipment", serviceType: "relocate",  basePrice: "90.00" },

      { name: "Power Rack / Squat Rack",         sku: "RACK-INSTALL",   category: "Gym Equipment", serviceType: "install",   basePrice: "150.00" },
      { name: "Power Rack / Squat Rack",         sku: "RACK-DISMANTLE", category: "Gym Equipment", serviceType: "dismantle", basePrice: "100.00" },
      { name: "Power Rack / Squat Rack",         sku: "RACK-RELOCATE",  category: "Gym Equipment", serviceType: "relocate",  basePrice: "220.00" },

      { name: "Adjustable Weight Bench",         sku: "BENCH-INSTALL",   category: "Gym Equipment", serviceType: "install",   basePrice: "40.00" },
      { name: "Adjustable Weight Bench",         sku: "BENCH-DISMANTLE", category: "Gym Equipment", serviceType: "dismantle", basePrice: "30.00" },
      { name: "Adjustable Weight Bench",         sku: "BENCH-RELOCATE",  category: "Gym Equipment", serviceType: "relocate",  basePrice: "70.00" },

      { name: "Multi-Station Home Gym",          sku: "MULTIGYM-INSTALL",   category: "Gym Equipment", serviceType: "install",   basePrice: "200.00" },
      { name: "Multi-Station Home Gym",          sku: "MULTIGYM-DISMANTLE", category: "Gym Equipment", serviceType: "dismantle", basePrice: "150.00" },
      { name: "Multi-Station Home Gym",          sku: "MULTIGYM-RELOCATE",  category: "Gym Equipment", serviceType: "relocate",  basePrice: "320.00" },

      { name: "Dumbbell Rack / Weight Storage",  sku: "DBRACK-INSTALL",   category: "Gym Equipment", serviceType: "install",   basePrice: "60.00" },
      { name: "Dumbbell Rack / Weight Storage",  sku: "DBRACK-DISMANTLE", category: "Gym Equipment", serviceType: "dismantle", basePrice: "45.00" },
      { name: "Dumbbell Rack / Weight Storage",  sku: "DBRACK-RELOCATE",  category: "Gym Equipment", serviceType: "relocate",  basePrice: "100.00" },

      { name: "Pull-Up / Wall-Mounted Gym Bar",  sku: "PULLUP-INSTALL",   category: "Gym Equipment", serviceType: "install",   basePrice: "70.00" },
      { name: "Pull-Up / Wall-Mounted Gym Bar",  sku: "PULLUP-DISMANTLE", category: "Gym Equipment", serviceType: "dismantle", basePrice: "40.00" },

      // ─── Appliance Relocation ─────────────────────────────────────────────────
      { name: "Refrigerator (2-Door / Standard)",  sku: "FRIDGE2-INSTALL",   category: "Appliances", serviceType: "install",   basePrice: "60.00" },
      { name: "Refrigerator (2-Door / Standard)",  sku: "FRIDGE2-DISMANTLE", category: "Appliances", serviceType: "dismantle", basePrice: "40.00" },
      { name: "Refrigerator (2-Door / Standard)",  sku: "FRIDGE2-RELOCATE",  category: "Appliances", serviceType: "relocate",  basePrice: "100.00" },

      { name: "Refrigerator (French Door / 4-Door)", sku: "FRIDGE4-INSTALL",   category: "Appliances", serviceType: "install",   basePrice: "80.00" },
      { name: "Refrigerator (French Door / 4-Door)", sku: "FRIDGE4-DISMANTLE", category: "Appliances", serviceType: "dismantle", basePrice: "55.00" },
      { name: "Refrigerator (French Door / 4-Door)", sku: "FRIDGE4-RELOCATE",  category: "Appliances", serviceType: "relocate",  basePrice: "130.00" },

      { name: "Washing Machine (Top Load)",      sku: "WM-TOP-INSTALL",   category: "Appliances", serviceType: "install",   basePrice: "60.00" },
      { name: "Washing Machine (Top Load)",      sku: "WM-TOP-DISMANTLE", category: "Appliances", serviceType: "dismantle", basePrice: "40.00" },
      { name: "Washing Machine (Top Load)",      sku: "WM-TOP-RELOCATE",  category: "Appliances", serviceType: "relocate",  basePrice: "100.00" },

      { name: "Washing Machine (Front Load)",    sku: "WM-FRONT-INSTALL",   category: "Appliances", serviceType: "install",   basePrice: "70.00" },
      { name: "Washing Machine (Front Load)",    sku: "WM-FRONT-DISMANTLE", category: "Appliances", serviceType: "dismantle", basePrice: "50.00" },
      { name: "Washing Machine (Front Load)",    sku: "WM-FRONT-RELOCATE",  category: "Appliances", serviceType: "relocate",  basePrice: "110.00" },

      { name: "Dryer / Washer-Dryer Combo",      sku: "DRYER-INSTALL",   category: "Appliances", serviceType: "install",   basePrice: "60.00" },
      { name: "Dryer / Washer-Dryer Combo",      sku: "DRYER-DISMANTLE", category: "Appliances", serviceType: "dismantle", basePrice: "45.00" },
      { name: "Dryer / Washer-Dryer Combo",      sku: "DRYER-RELOCATE",  category: "Appliances", serviceType: "relocate",  basePrice: "100.00" },

      { name: "Dishwasher",                      sku: "DSHW-INSTALL",   category: "Appliances", serviceType: "install",   basePrice: "70.00" },
      { name: "Dishwasher",                      sku: "DSHW-DISMANTLE", category: "Appliances", serviceType: "dismantle", basePrice: "50.00" },
      { name: "Dishwasher",                      sku: "DSHW-RELOCATE",  category: "Appliances", serviceType: "relocate",  basePrice: "110.00" },

      { name: "Wine Cooler / Beverage Fridge",   sku: "WINECOOL-INSTALL",   category: "Appliances", serviceType: "install",   basePrice: "50.00" },
      { name: "Wine Cooler / Beverage Fridge",   sku: "WINECOOL-DISMANTLE", category: "Appliances", serviceType: "dismantle", basePrice: "35.00" },
      { name: "Wine Cooler / Beverage Fridge",   sku: "WINECOOL-RELOCATE",  category: "Appliances", serviceType: "relocate",  basePrice: "80.00" },

      // ─── Singapore-Specific Items ─────────────────────────────────────────────
      { name: "Retractable Ceiling Clothes Rack", sku: "CEILRACK-INSTALL",   category: "Singapore-Specific", serviceType: "install",   basePrice: "80.00" },
      { name: "Retractable Ceiling Clothes Rack", sku: "CEILRACK-DISMANTLE", category: "Singapore-Specific", serviceType: "dismantle", basePrice: "50.00" },

      { name: "HDB Bomb Shelter Shelving",        sku: "BSHELV-INSTALL",   category: "Singapore-Specific", serviceType: "install",   basePrice: "120.00" },
      { name: "HDB Bomb Shelter Shelving",        sku: "BSHELV-DISMANTLE", category: "Singapore-Specific", serviceType: "dismantle", basePrice: "80.00" },

      { name: "Laundry / Utility Area Cabinet",   sku: "UTIL-INSTALL",   category: "Singapore-Specific", serviceType: "install",   basePrice: "80.00" },
      { name: "Laundry / Utility Area Cabinet",   sku: "UTIL-DISMANTLE", category: "Singapore-Specific", serviceType: "dismantle", basePrice: "60.00" },

      { name: "Wardrobe with Built-in Mirror",    sku: "WRDMIR-INSTALL",   category: "Wardrobes", serviceType: "install",   basePrice: "150.00" },
      { name: "Wardrobe with Built-in Mirror",    sku: "WRDMIR-DISMANTLE", category: "Wardrobes", serviceType: "dismantle", basePrice: "110.00" },

      { name: "Study / Computer Table",           sku: "STUDY-INSTALL",   category: "Bedroom", serviceType: "install",   basePrice: "60.00" },
      { name: "Study / Computer Table",           sku: "STUDY-DISMANTLE", category: "Bedroom", serviceType: "dismantle", basePrice: "45.00" },
      { name: "Study / Computer Table",           sku: "STUDY-RELOCATE",  category: "Bedroom", serviceType: "relocate",  basePrice: "90.00" },

      { name: "Massage Chair",                    sku: "MASS-INSTALL",   category: "Living Room", serviceType: "install",   basePrice: "80.00" },
      { name: "Massage Chair",                    sku: "MASS-DISMANTLE", category: "Living Room", serviceType: "dismantle", basePrice: "60.00" },
      { name: "Massage Chair",                    sku: "MASS-RELOCATE",  category: "Living Room", serviceType: "relocate",  basePrice: "130.00" },

      { name: "Piano (Upright)",                  sku: "PIANO-UP-RELOCATE", category: "Specialty", serviceType: "relocate",  basePrice: "350.00" },
      { name: "Piano (Upright)",                  sku: "PIANO-UP-INSTALL",  category: "Specialty", serviceType: "install",   basePrice: "120.00" },

      { name: "Piano (Grand)",                    sku: "PIANO-GR-RELOCATE", category: "Specialty", serviceType: "relocate",  basePrice: "600.00" },
      { name: "Piano (Grand)",                    sku: "PIANO-GR-INSTALL",  category: "Specialty", serviceType: "install",   basePrice: "200.00" },

      { name: "Safe / Gun Safe",                  sku: "SAFE-INSTALL",   category: "Specialty", serviceType: "install",   basePrice: "100.00" },
      { name: "Safe / Gun Safe",                  sku: "SAFE-RELOCATE",  category: "Specialty", serviceType: "relocate",  basePrice: "160.00" },

      { name: "Pool / Billiard Table",            sku: "POOL-INSTALL",   category: "Specialty", serviceType: "install",   basePrice: "350.00" },
      { name: "Pool / Billiard Table",            sku: "POOL-DISMANTLE", category: "Specialty", serviceType: "dismantle", basePrice: "250.00" },
      { name: "Pool / Billiard Table",            sku: "POOL-RELOCATE",  category: "Specialty", serviceType: "relocate",  basePrice: "550.00" },

      { name: "Foosball / Game Table",            sku: "GAME-INSTALL",   category: "Specialty", serviceType: "install",   basePrice: "80.00" },
      { name: "Foosball / Game Table",            sku: "GAME-DISMANTLE", category: "Specialty", serviceType: "dismantle", basePrice: "60.00" },
      { name: "Foosball / Game Table",            sku: "GAME-RELOCATE",  category: "Specialty", serviceType: "relocate",  basePrice: "130.00" },
    ]);
  }

  // Price corrections — Singapore market calibration (PC-R1-MARKER)
  const pcR1 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "PC-R1-MARKER"));
  if (pcR1.length === 0) {
    // Insert a non-visible marker so this block only runs once
    await db.insert(catalogItems).values({
      name: "_Price Correction R1",
      sku: "PC-R1-MARKER",
      category: "_System",
      serviceType: "install",
      basePrice: "0.00",
    });

    // Murphy / Wall Bed — Singapore market is $400–600 install (complex wall mount + frame)
    await db.update(catalogItems).set({ basePrice: "400.00" }).where(eq(catalogItems.sku, "MURPHY-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "280.00" }).where(eq(catalogItems.sku, "MURPHY-DISMANTLE"));

    // Walk-in Wardrobe Frame System — full system is $400–600 in SG
    await db.update(catalogItems).set({ basePrice: "450.00" }).where(eq(catalogItems.sku, "WALKIN-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "320.00" }).where(eq(catalogItems.sku, "WALKIN-DISMANTLE"));

    // Ergonomic Chair — $40–60 install in SG (was $25 which is below market)
    await db.update(catalogItems).set({ basePrice: "40.00" }).where(eq(catalogItems.sku, "EC-01"));
    await db.update(catalogItems).set({ basePrice: "30.00" }).where(eq(catalogItems.sku, "EC-DISMANTLE"));
    await db.update(catalogItems).set({ basePrice: "65.00" }).where(eq(catalogItems.sku, "EC-RELOCATE"));

    // Hydraulic Bed King — complex mechanism, $200–250 in SG
    await db.update(catalogItems).set({ basePrice: "200.00" }).where(eq(catalogItems.sku, "HYDR-K-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "140.00" }).where(eq(catalogItems.sku, "HYDR-K-DISMANTLE"));

    // Hydraulic Bed Queen — $170–200 in SG
    await db.update(catalogItems).set({ basePrice: "170.00" }).where(eq(catalogItems.sku, "HYDR-Q-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "120.00" }).where(eq(catalogItems.sku, "HYDR-Q-DISMANTLE"));

    // Reception Counter — $250–350 install in SG
    await db.update(catalogItems).set({ basePrice: "280.00" }).where(eq(catalogItems.sku, "RECPT-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "200.00" }).where(eq(catalogItems.sku, "RECPT-DISMANTLE"));

    // Conference Table — large format, $200 install is correct; relocate bumped up
    await db.update(catalogItems).set({ basePrice: "280.00" }).where(eq(catalogItems.sku, "CT-01"));

    // Loft Bed with Desk — complex two-tier structure, $200 in SG
    await db.update(catalogItems).set({ basePrice: "200.00" }).where(eq(catalogItems.sku, "LOFT-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "150.00" }).where(eq(catalogItems.sku, "LOFT-DISMANTLE"));

    // Bunk Bed with Trundle — extra mechanism, $190 install
    await db.update(catalogItems).set({ basePrice: "190.00" }).where(eq(catalogItems.sku, "BUNK-TRD-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "140.00" }).where(eq(catalogItems.sku, "BUNK-TRD-DISMANTLE"));

    // Custom/Built-in Wardrobe — $250+ in SG for full unit
    await db.update(catalogItems).set({ basePrice: "250.00" }).where(eq(catalogItems.sku, "CUST-WRD-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "180.00" }).where(eq(catalogItems.sku, "CUST-WRD-DISMANTLE"));

    // Height-Adjustable Sit-Stand Desk — $100 install, $60 dismantle (60% rule)
    await db.update(catalogItems).set({ basePrice: "100.00" }).where(eq(catalogItems.sku, "STND-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "60.00" }).where(eq(catalogItems.sku, "STND-DISMANTLE"));

    // IKEA PAX Wardrobe — standard rate in SG is $160–200 for large unit
    await db.update(catalogItems).set({ basePrice: "160.00" }).where(eq(catalogItems.sku, "PAX-01"));
    await db.update(catalogItems).set({ basePrice: "110.00" }).where(eq(catalogItems.sku, "PAX-02"));
    await db.update(catalogItems).set({ basePrice: "230.00" }).where(eq(catalogItems.sku, "PAX-RELOCATE"));
  }

  // Round 5: Bathroom mirror cabinets (LILLANGEN-INSTALL marker)
  const r5 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "LILLANGEN-INSTALL"));
  if (r5.length === 0) {
    await db.insert(catalogItems).values([
      { name: "IKEA LILLÅNGEN Mirror Cabinet", sku: "LILLANGEN-INSTALL",   category: "Bathroom", serviceType: "install",   basePrice: "60.00" },
      { name: "IKEA LILLÅNGEN Mirror Cabinet", sku: "LILLANGEN-DISMANTLE", category: "Bathroom", serviceType: "dismantle", basePrice: "40.00" },
      { name: "IKEA GODMORGON Mirror Cabinet", sku: "GODMORGON-INSTALL",   category: "Bathroom", serviceType: "install",   basePrice: "70.00" },
      { name: "IKEA GODMORGON Mirror Cabinet", sku: "GODMORGON-DISMANTLE", category: "Bathroom", serviceType: "dismantle", basePrice: "45.00" },
      { name: "IKEA HEMNES Mirror Cabinet",    sku: "HEMNES-MC-INSTALL",   category: "Bathroom", serviceType: "install",   basePrice: "80.00" },
      { name: "IKEA HEMNES Mirror Cabinet",    sku: "HEMNES-MC-DISMANTLE", category: "Bathroom", serviceType: "dismantle", basePrice: "55.00" },
      { name: "Washroom Mirror Cabinet (Small, up to 60cm)", sku: "WMC-SM-INSTALL",   category: "Bathroom", serviceType: "install",   basePrice: "65.00" },
      { name: "Washroom Mirror Cabinet (Small, up to 60cm)", sku: "WMC-SM-DISMANTLE", category: "Bathroom", serviceType: "dismantle", basePrice: "40.00" },
      { name: "Washroom Mirror Cabinet (Large, 60cm+)",      sku: "WMC-LG-INSTALL",   category: "Bathroom", serviceType: "install",   basePrice: "85.00" },
      { name: "Washroom Mirror Cabinet (Large, 60cm+)",      sku: "WMC-LG-DISMANTLE", category: "Bathroom", serviceType: "dismantle", basePrice: "55.00" },
    ]);
  }

  // Round 6: Carton boxes for moving (CBX-SM marker)
  // Volumes (L × W × H): S=40×30×30cm, M=50×40×40cm, L=60×50×45cm, XL=70×60×55cm, Wardrobe=125×55×50cm
  const r6 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "CBX-SM"));
  if (r6.length === 0) {
    await db.insert(catalogItems).values([
      {
        name: "Carton Box — Small (40×30×30 cm)",
        sku: "CBX-SM",
        category: "Moving Boxes",
        serviceType: "relocate",
        basePrice: "3.50",
        volumeM3: "0.036",
      },
      {
        name: "Carton Box — Medium (50×40×40 cm)",
        sku: "CBX-MD",
        category: "Moving Boxes",
        serviceType: "relocate",
        basePrice: "5.50",
        volumeM3: "0.080",
      },
      {
        name: "Carton Box — Large (60×50×45 cm)",
        sku: "CBX-LG",
        category: "Moving Boxes",
        serviceType: "relocate",
        basePrice: "8.00",
        volumeM3: "0.135",
      },
      {
        name: "Carton Box — XL (70×60×55 cm)",
        sku: "CBX-XL",
        category: "Moving Boxes",
        serviceType: "relocate",
        basePrice: "12.00",
        volumeM3: "0.231",
      },
      {
        name: "Carton Box — Wardrobe (125×55×50 cm)",
        sku: "CBX-WRD",
        category: "Moving Boxes",
        serviceType: "relocate",
        basePrice: "18.00",
        volumeM3: "0.344",
      },
    ]);
  }

  // Round 7: Add volumeM3 to key furniture items for Toyota Hiace trip calculation
  const r7 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "VOL-UPDATED"));
  if (r7.length === 0) {
    // Marker — insert a dummy disabled record so this round only runs once
    await db.insert(catalogItems).values([
      { name: "__volume_seed_marker__", sku: "VOL-UPDATED", category: "System", serviceType: "install", basePrice: "0", active: false },
    ]);

    // Volumes based on typical disassembled/packed furniture footprint in a van (m³)
    const volumeUpdates: { sku: string; volumeM3: string }[] = [
      // Wardrobes
      { sku: "PAX-01",          volumeM3: "0.80" },
      { sku: "PAX-02",          volumeM3: "0.80" },
      { sku: "PAX-RELOCATE",    volumeM3: "0.80" },
      // Beds
      { sku: "QB-INSTALL",      volumeM3: "0.50" },
      { sku: "QB-DISMANTLE",    volumeM3: "0.50" },
      { sku: "QB-RELOCATE",     volumeM3: "0.50" },
      { sku: "KB-INSTALL",      volumeM3: "0.70" },
      { sku: "KB-DISMANTLE",    volumeM3: "0.70" },
      { sku: "KB-RELOCATE",     volumeM3: "0.70" },
      { sku: "SB-INSTALL",      volumeM3: "0.35" },
      { sku: "SB-DISMANTLE",    volumeM3: "0.35" },
      { sku: "SB-RELOCATE",     volumeM3: "0.35" },
      // Bedroom
      { sku: "DT-INSTALL",      volumeM3: "0.30" },
      { sku: "DT-DISMANTLE",    volumeM3: "0.30" },
      { sku: "DT-RELOCATE",     volumeM3: "0.30" },
      { sku: "BT-INSTALL",      volumeM3: "0.10" },
      { sku: "BT-DISMANTLE",    volumeM3: "0.10" },
      { sku: "BT-RELOCATE",     volumeM3: "0.10" },
      // Sofas
      { sku: "SF3-INSTALL",     volumeM3: "1.80" },
      { sku: "SF3-DISMANTLE",   volumeM3: "1.80" },
      { sku: "SF3-RELOCATE",    volumeM3: "1.80" },
      { sku: "SF2-INSTALL",     volumeM3: "1.30" },
      { sku: "SF2-DISMANTLE",   volumeM3: "1.30" },
      { sku: "SF2-RELOCATE",    volumeM3: "1.30" },
      // Living room
      { sku: "TVC-INSTALL",     volumeM3: "0.40" },
      { sku: "TVC-DISMANTLE",   volumeM3: "0.40" },
      { sku: "TVC-RELOCATE",    volumeM3: "0.40" },
    ];

    for (const u of volumeUpdates) {
      await db.update(catalogItems).set({ volumeM3: u.volumeM3 }).where(eq(catalogItems.sku, u.sku));
    }
  }

  // Round 7.5: Murphy / Wall Bed size + storage variants (PC-MURPHY-V1-MARKER)
  // The single generic "Murphy / Wall Bed" entry was too broad — customers in
  // Singapore mostly buy 4 distinct configurations and each has very different
  // labour / time-on-site profile. SG market reference (May 2026):
  //   Single (no storage)        ~$300–340 install  (simpler frame, 1 wall plate)
  //   Single with side storage   ~$360–400 install  (extra cabinet column)
  //   Queen (no storage)         ~$430–470 install  (heavy mattress cradle, 2 men)
  //   Queen with side storage    ~$520–580 install  (full wall system, 2 men + setup)
  // Dismantle ≈ ~70% of install; dispose ≈ dismantle × 0.85;
  // dismantle+dispose ≈ install × 0.85; relocate ≈ install + dismantle − bundle.
  const pcMurphyV1 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "PC-MURPHY-V1-MARKER"));
  if (pcMurphyV1.length === 0) {
    // Insert the variant rows FIRST, then the marker last — so a crash in
    // the middle of this block leaves the marker absent and the whole block
    // re-runs cleanly on the next boot (rows are .onConflictDoNothing on
    // unique SKU). If the marker went in first and the row insert failed,
    // the missing rows would be permanently skipped.
    await db.insert(catalogItems).values([
      // ── Murphy / Wall Bed (Single) ────────────────────────────────────────
      { name: "Murphy / Wall Bed (Single)", sku: "MURPHY-SG-INSTALL",        category: "Beds", serviceType: "install",           basePrice: "320.00", volumeM3: "0.60" },
      { name: "Murphy / Wall Bed (Single)", sku: "MURPHY-SG-DISMANTLE",      category: "Beds", serviceType: "dismantle",         basePrice: "220.00", volumeM3: "0.60" },
      { name: "Murphy / Wall Bed (Single)", sku: "MURPHY-SG-DISPOSE",        category: "Beds", serviceType: "dispose",           basePrice: "200.00", volumeM3: "0.60" },
      { name: "Murphy / Wall Bed (Single)", sku: "MURPHY-SG-DIS-DISP",       category: "Beds", serviceType: "dismantle_dispose", basePrice: "340.00", volumeM3: "0.60" },
      { name: "Murphy / Wall Bed (Single)", sku: "MURPHY-SG-RELOCATE",       category: "Beds", serviceType: "relocate",          basePrice: "460.00", volumeM3: "0.60" },

      // ── Murphy / Wall Bed (Single, with Storage) ──────────────────────────
      { name: "Murphy / Wall Bed (Single, with Storage)", sku: "MURPHY-SGS-INSTALL",   category: "Beds", serviceType: "install",           basePrice: "380.00", volumeM3: "0.75" },
      { name: "Murphy / Wall Bed (Single, with Storage)", sku: "MURPHY-SGS-DISMANTLE", category: "Beds", serviceType: "dismantle",         basePrice: "260.00", volumeM3: "0.75" },
      { name: "Murphy / Wall Bed (Single, with Storage)", sku: "MURPHY-SGS-DISPOSE",   category: "Beds", serviceType: "dispose",           basePrice: "230.00", volumeM3: "0.75" },
      { name: "Murphy / Wall Bed (Single, with Storage)", sku: "MURPHY-SGS-DIS-DISP",  category: "Beds", serviceType: "dismantle_dispose", basePrice: "395.00", volumeM3: "0.75" },
      { name: "Murphy / Wall Bed (Single, with Storage)", sku: "MURPHY-SGS-RELOCATE",  category: "Beds", serviceType: "relocate",          basePrice: "530.00", volumeM3: "0.75" },

      // ── Murphy / Wall Bed (Queen) ─────────────────────────────────────────
      { name: "Murphy / Wall Bed (Queen)", sku: "MURPHY-Q-INSTALL",    category: "Beds", serviceType: "install",           basePrice: "450.00", volumeM3: "0.85" },
      { name: "Murphy / Wall Bed (Queen)", sku: "MURPHY-Q-DISMANTLE",  category: "Beds", serviceType: "dismantle",         basePrice: "310.00", volumeM3: "0.85" },
      { name: "Murphy / Wall Bed (Queen)", sku: "MURPHY-Q-DISPOSE",    category: "Beds", serviceType: "dispose",           basePrice: "270.00", volumeM3: "0.85" },
      { name: "Murphy / Wall Bed (Queen)", sku: "MURPHY-Q-DIS-DISP",   category: "Beds", serviceType: "dismantle_dispose", basePrice: "460.00", volumeM3: "0.85" },
      { name: "Murphy / Wall Bed (Queen)", sku: "MURPHY-Q-RELOCATE",   category: "Beds", serviceType: "relocate",          basePrice: "640.00", volumeM3: "0.85" },

      // ── Murphy / Wall Bed (Queen, with Storage) ───────────────────────────
      { name: "Murphy / Wall Bed (Queen, with Storage)", sku: "MURPHY-QS-INSTALL",    category: "Beds", serviceType: "install",           basePrice: "550.00", volumeM3: "1.05" },
      { name: "Murphy / Wall Bed (Queen, with Storage)", sku: "MURPHY-QS-DISMANTLE",  category: "Beds", serviceType: "dismantle",         basePrice: "380.00", volumeM3: "1.05" },
      { name: "Murphy / Wall Bed (Queen, with Storage)", sku: "MURPHY-QS-DISPOSE",    category: "Beds", serviceType: "dispose",           basePrice: "320.00", volumeM3: "1.05" },
      { name: "Murphy / Wall Bed (Queen, with Storage)", sku: "MURPHY-QS-DIS-DISP",   category: "Beds", serviceType: "dismantle_dispose", basePrice: "560.00", volumeM3: "1.05" },
      { name: "Murphy / Wall Bed (Queen, with Storage)", sku: "MURPHY-QS-RELOCATE",   category: "Beds", serviceType: "relocate",          basePrice: "770.00", volumeM3: "1.05" },
    ]).onConflictDoNothing();

    // Deactivate the legacy generic "Murphy / Wall Bed" entries. Without
    // this, the customer estimator's fuzzy matcher (which strips
    // parentheses before scoring) collapses every variant to the same base
    // name and the legacy row sometimes wins by iteration order — defeating
    // the whole point of splitting variants. The rows stay in the DB for
    // any historical quotes that still reference them.
    await db.update(catalogItems).set({ active: false }).where(eq(catalogItems.sku, "MURPHY-INSTALL"));
    await db.update(catalogItems).set({ active: false }).where(eq(catalogItems.sku, "MURPHY-DISMANTLE"));
    await db.update(catalogItems).set({ active: false }).where(eq(catalogItems.sku, "MURPHYWA-DISPOSE"));
    await db.update(catalogItems).set({ active: false }).where(eq(catalogItems.sku, "MURPHYWA-DIS-DISP"));
    // Legacy relocate row has no SKU — match by exact name + serviceType.
    await db.update(catalogItems)
      .set({ active: false })
      .where(and(eq(catalogItems.name, "Murphy / Wall Bed"), eq(catalogItems.serviceType, "relocate")));

    // Marker last — only written if every step above succeeded.
    await db.insert(catalogItems).values({
      name: "_Price Correction Murphy V1",
      sku: "PC-MURPHY-V1-MARKER",
      category: "_System",
      serviceType: "install",
      basePrice: "0.00",
      active: false,
    });
  }

  // Round: Blind / window-covering INSTALL + DISMANTLE prices.
  // Bug fix — the catalog previously had blinds priced ONLY for dispose /
  // dismantle_dispose / relocate. There was NO per-window INSTALL or
  // DISMANTLE price for roller / venetian / roman / vertical / zebra /
  // motorised blinds. As a result, "install 4 blinds" found no catalog
  // match and fell back to the generic $150/unit rate (4 × $150 + fees ≈
  // SGD 640+), badly over-quoting a simple job. These rows give the
  // matcher real per-window install/dismantle labour rates (SG market:
  // ~$40–50 install per window, dismantle ≈ 65% of install). Inserted
  // idempotently by unique SKU so existing databases pick them up on the
  // next boot; the marker is written last so a mid-block crash re-runs.
  const pcBlindV1 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "PC-BLIND-V1-MARKER"));
  if (pcBlindV1.length === 0) {
    await db.insert(catalogItems).values([
      { name: "Roller Blind (per window)",              sku: "ROLLERBL-INSTALL",   category: "Curtains & Blinds", serviceType: "install",   basePrice: "40.00", volumeM3: "0.04" },
      { name: "Roller Blind (per window)",              sku: "ROLLERBL-DISMANTLE", category: "Curtains & Blinds", serviceType: "dismantle", basePrice: "25.00", volumeM3: "0.04" },
      { name: "Venetian Blind (per window)",            sku: "VENETIAN-INSTALL",   category: "Curtains & Blinds", serviceType: "install",   basePrice: "45.00", volumeM3: "0.05" },
      { name: "Venetian Blind (per window)",            sku: "VENETIAN-DISMANTLE", category: "Curtains & Blinds", serviceType: "dismantle", basePrice: "30.00", volumeM3: "0.05" },
      { name: "Roman Blind (per window)",               sku: "ROMANBLI-INSTALL",   category: "Curtains & Blinds", serviceType: "install",   basePrice: "45.00", volumeM3: "0.04" },
      { name: "Roman Blind (per window)",               sku: "ROMANBLI-DISMANTLE", category: "Curtains & Blinds", serviceType: "dismantle", basePrice: "30.00", volumeM3: "0.04" },
      { name: "Vertical Blind (per window)",            sku: "VERTICAL-INSTALL",   category: "Curtains & Blinds", serviceType: "install",   basePrice: "45.00", volumeM3: "0.05" },
      { name: "Vertical Blind (per window)",            sku: "VERTICAL-DISMANTLE", category: "Curtains & Blinds", serviceType: "dismantle", basePrice: "30.00", volumeM3: "0.05" },
      { name: "Day and Night or Zebra Blind (per window)", sku: "DAYANDNI-INSTALL",   category: "Curtains & Blinds", serviceType: "install",   basePrice: "50.00", volumeM3: "0.05" },
      { name: "Day and Night or Zebra Blind (per window)", sku: "DAYANDNI-DISMANTLE", category: "Curtains & Blinds", serviceType: "dismantle", basePrice: "30.00", volumeM3: "0.05" },
      { name: "Motorised Blind or Curtain Track",       sku: "MOTORISE-INSTALL",   category: "Curtains & Blinds", serviceType: "install",   basePrice: "90.00", volumeM3: "0.06" },
      { name: "Motorised Blind or Curtain Track",       sku: "MOTORISE-DISMANTLE", category: "Curtains & Blinds", serviceType: "dismantle", basePrice: "60.00", volumeM3: "0.06" },
    ]).onConflictDoNothing();

    // Marker last — only written if every row insert above succeeded.
    await db.insert(catalogItems).values({
      name: "_Price Correction Blind V1",
      sku: "PC-BLIND-V1-MARKER",
      category: "_System",
      serviceType: "install",
      basePrice: "0.00",
      active: false,
    }).onConflictDoNothing();
  }

  // Round 8: Add missing relocate variants + comprehensive volumeM3 for all relocate items
  const r8 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "VOL2-UPDATED"));
  if (r8.length === 0) {
    await db.insert(catalogItems).values([
      { name: "__volume_seed_r8_marker__", sku: "VOL2-UPDATED", category: "System", serviceType: "install", basePrice: "0", active: false },
    ]);

    // ── Add missing relocate variants ────────────────────────────────────────
    await db.insert(catalogItems).values([
      // Office Panel / Partition — relocate (move configured panels to new office)
      { name: "Office Panel / Partition",             sku: "PANEL-RELOCATE",      category: "Office",      serviceType: "relocate", basePrice: "80.00",  volumeM3: "0.30" },
      // Monitor Arm / Desk Mount — relocate
      { name: "Monitor Arm / Desk Mount",             sku: "MONARM-RELOCATE",     category: "Office",      serviceType: "relocate", basePrice: "50.00",  volumeM3: "0.05" },
      // Modular Pod Panel — relocate
      { name: "Modular Pod Panel (per panel)",        sku: "PODPANEL-RELOCATE",   category: "Office",      serviceType: "relocate", basePrice: "90.00",  volumeM3: "0.30" },
      // Desk Privacy Screen — relocate
      { name: "Desk Privacy Screen or Modesty Panel", sku: "OFF-DESK-SCREEN-RELOCATE", category: "Office", serviceType: "relocate", basePrice: "45.00",  volumeM3: "0.06" },
      // Locker unit — relocate
      { name: "Locker Unit (Staff / School)",         sku: "LOCK-RELOCATE",       category: "Office",      serviceType: "relocate", basePrice: "90.00",  volumeM3: "0.40" },
      // Height-Adjustable Sit-Stand Desk — relocate
      { name: "Height-Adjustable Sit-Stand Desk",     sku: "STND-RELOCATE",       category: "Office",      serviceType: "relocate", basePrice: "220.00", volumeM3: "0.55" },
      // Conference Table — relocate
      { name: "Conference Table",                     sku: "CT-RELOCATE",         category: "Office",      serviceType: "relocate", basePrice: "250.00", volumeM3: "1.20" },
      // Credenza / Office Storage Cabinet — relocate
      { name: "Credenza / Office Storage Cabinet",    sku: "CRED-RELOCATE",       category: "Office",      serviceType: "relocate", basePrice: "130.00", volumeM3: "0.55" },
      // Whiteboard — relocate
      { name: "Whiteboard or Pinboard (wall-mount)",  sku: "OFF-WHITEBOARD-RELOCATE", category: "Office",  serviceType: "relocate", basePrice: "100.00", volumeM3: "0.12" },
    ]).onConflictDoNothing();

    // ── Comprehensive volumeM3 for all relocate items ────────────────────────
    const v2: { sku: string; volumeM3: string }[] = [
      // Office
      { sku: "OD-RELOCATE",            volumeM3: "0.50" },
      { sku: "EC-RELOCATE",            volumeM3: "0.28" },
      { sku: "L-DESK-RELOCATE",        volumeM3: "0.80" },
      { sku: "CT-01",                  volumeM3: "1.20" },
      { sku: "CT-RELOCATE",            volumeM3: "1.20" },
      { sku: "FC-RELOCATE",            volumeM3: "0.35" },
      { sku: "CRED-RELOCATE",          volumeM3: "0.55" },
      { sku: "LOCK-RELOCATE",          volumeM3: "0.40" },
      { sku: "STND-RELOCATE",          volumeM3: "0.55" },
      { sku: "OFF-SOFA-RELOCATE",      volumeM3: "1.20" },
      { sku: "OFF-TRAINING-TBL-RELOCATE", volumeM3: "0.40" },
      { sku: "PANEL-RELOCATE",         volumeM3: "0.30" },
      { sku: "MONARM-RELOCATE",        volumeM3: "0.05" },
      { sku: "PODPANEL-RELOCATE",      volumeM3: "0.30" },
      { sku: "OFF-DESK-SCREEN-RELOCATE", volumeM3: "0.06" },
      // Living room
      { sku: "CFT-RELOCATE",           volumeM3: "0.25" },
      { sku: "LVG-OTTOMAN-RELOCATE",   volumeM3: "0.15" },
      { sku: "LVG-NESTING-RELOCATE",   volumeM3: "0.12" },
      // Bedroom / Study
      { sku: "BS-RELOCATE",            volumeM3: "0.50" },
      { sku: "STD-BOOKCASE-RELOCATE",  volumeM3: "0.60" },
      { sku: "STD-DESK-RELOCATE",      volumeM3: "0.40" },
      { sku: "STD-CORNER-DESK-RELOCATE", volumeM3: "0.80" },
      { sku: "BED-CHEST3-RELOCATE",    volumeM3: "0.40" },
      { sku: "BED-CHEST5-RELOCATE",    volumeM3: "0.55" },
      { sku: "BED-NIGHTSTAND-RELOCATE", volumeM3: "0.20" },
      // Dining
      { sku: "DT-01",                  volumeM3: "0.60" },
      { sku: "DC-RELOCATE",            volumeM3: "0.12" },
      // Appliances
      { sku: "FRIDGE2-RELOCATE",       volumeM3: "0.60" },
      { sku: "FRIDGE4-RELOCATE",       volumeM3: "0.85" },
      { sku: "WM-TOP-RELOCATE",        volumeM3: "0.50" },
      { sku: "WM-FRONT-RELOCATE",      volumeM3: "0.50" },
      { sku: "DRYER-RELOCATE",         volumeM3: "0.50" },
      { sku: "DSHW-RELOCATE",          volumeM3: "0.45" },
      { sku: "WINECOOL-RELOCATE",      volumeM3: "0.35" },
      // Gym
      { sku: "TREADMILL-RELOCATE",     volumeM3: "0.80" },
      { sku: "ELLIP-RELOCATE",         volumeM3: "0.60" },
      { sku: "ROW-RELOCATE",           volumeM3: "0.40" },
      { sku: "BIKE-RELOCATE",          volumeM3: "0.30" },
      { sku: "RACK-RELOCATE",          volumeM3: "0.70" },
      { sku: "BENCH-RELOCATE",         volumeM3: "0.20" },
      { sku: "MULTIGYM-RELOCATE",      volumeM3: "1.50" },
      { sku: "DBRACK-RELOCATE",        volumeM3: "0.35" },
      // Specialty
      { sku: "MASS-RELOCATE",          volumeM3: "0.80" },
      { sku: "PIANO-UP-RELOCATE",      volumeM3: "1.20" },
      { sku: "PIANO-GR-RELOCATE",      volumeM3: "2.50" },
      { sku: "PIANO-GRAND-RELOCATE",   volumeM3: "2.50" },
      { sku: "SAFE-RELOCATE",          volumeM3: "0.20" },
      { sku: "POOL-RELOCATE",          volumeM3: "2.00" },
      { sku: "GAME-RELOCATE",          volumeM3: "0.60" },
      // Wardrobes
      { sku: "WRDMIR-RELOCATE",        volumeM3: "0.90" },
      // Decor
      { sku: "DECOR-RUG-RELOCATE",     volumeM3: "0.20" },
      // Bathroom
      { sku: "BATH-VANITY-RELOCATE",   volumeM3: "0.50" },
      // Singapore-specific
      { sku: "STUDY-RELOCATE",         volumeM3: "0.40" },
      // AV / Media
      { sku: "ENT-AVRAK-RELOCATE",     volumeM3: "0.30" },
      // Misc relocate items that exist
      { sku: "APPL-AIRFRYER-RELOCATE", volumeM3: "0.10" },
      { sku: "SOFA-1-RELOCATE",        volumeM3: "0.80" },
      { sku: "SOFA-3-RELOCATE",        volumeM3: "1.80" },
      { sku: "SOFA-4-RELOCATE",        volumeM3: "2.20" },
      { sku: "SOFA-MOD-RELOCATE",      volumeM3: "2.50" },
      { sku: "RECLINER-RELOCATE",      volumeM3: "0.70" },
      { sku: "BUNK-RELOCATE",          volumeM3: "0.65" },
      { sku: "BUNK-TRD-RELOCATE",      volumeM3: "0.65" },
      { sku: "SB-RELOCATE-01",         volumeM3: "0.35" },
      { sku: "CUST-WRD-RELOCATE",      volumeM3: "0.90" },
    ];

    for (const u of v2) {
      await db.update(catalogItems).set({ volumeM3: u.volumeM3 }).where(eq(catalogItems.sku, u.sku));
    }
  }

  // Round 9: Full catalog volumeM3 coverage — every install/dismantle/relocate SKU
  const r9 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "VOL3-FULL-COVERAGE"));
  if (r9.length === 0) {
    await db.insert(catalogItems).values([
      { name: "__volume_seed_r9_marker__", sku: "VOL3-FULL-COVERAGE", category: "System", serviceType: "install", basePrice: "0", active: false },
    ]);

    const allVols: { sku: string; vol: string }[] = [
      // APPLIANCES
      { sku:"DSHW-INSTALL", vol:"0.45" },    { sku:"DSHW-DISMANTLE", vol:"0.45" },
      { sku:"DRYER-INSTALL", vol:"0.50" },   { sku:"DRYER-DISMANTLE", vol:"0.50" },
      { sku:"FRIDGE2-INSTALL", vol:"0.60" }, { sku:"FRIDGE2-DISMANTLE", vol:"0.60" },
      { sku:"FRIDGE4-INSTALL", vol:"0.85" }, { sku:"FRIDGE4-DISMANTLE", vol:"0.85" },
      { sku:"WM-FRONT-INSTALL", vol:"0.50" },{ sku:"WM-FRONT-DISMANTLE", vol:"0.50" },
      { sku:"WM-TOP-INSTALL", vol:"0.50" },  { sku:"WM-TOP-DISMANTLE", vol:"0.50" },
      { sku:"WINECOOL-INSTALL", vol:"0.35" },{ sku:"WINECOOL-DISMANTLE", vol:"0.35" },
      // BABY & KIDS
      { sku:"KIDS-GATE-INSTALL", vol:"0.02" },     { sku:"KIDS-GATE-DISMANTLE", vol:"0.02" },
      { sku:"KIDS-HIGHCHAIR-INSTALL", vol:"0.08" },{ sku:"KIDS-HIGHCHAIR-DISMANTLE", vol:"0.08" },
      { sku:"KIDS-SLIDE-INSTALL", vol:"0.30" },    { sku:"KIDS-SLIDE-DISMANTLE", vol:"0.30" },
      { sku:"KIDS-TRAMP-INSTALL", vol:"0.40" },    { sku:"KIDS-TRAMP-DISMANTLE", vol:"0.40" },
      { sku:"KIDS-PLAYPEN-INSTALL", vol:"0.25" },  { sku:"KIDS-PLAYPEN-DISMANTLE", vol:"0.25" },
      // BATHROOM
      { sku:"BATH-MIRROR-INSTALL", vol:"0.10" },   { sku:"BATH-MIRROR-DISMANTLE", vol:"0.10" },
      { sku:"BATH-SHELF-INSTALL", vol:"0.05" },    { sku:"BATH-SHELF-DISMANTLE", vol:"0.05" },
      { sku:"BATH-VANITY-INSTALL", vol:"0.50" },   { sku:"BATH-VANITY-DISMANTLE", vol:"0.50" },
      { sku:"BATH-STOR-INSTALL", vol:"0.08" },     { sku:"BATH-STOR-DISMANTLE", vol:"0.08" },
      { sku:"GODMORGON-INSTALL", vol:"0.10" },     { sku:"GODMORGON-DISMANTLE", vol:"0.10" },
      { sku:"HEMNES-MC-INSTALL", vol:"0.12" },     { sku:"HEMNES-MC-DISMANTLE", vol:"0.12" },
      { sku:"LILLANGEN-INSTALL", vol:"0.08" },     { sku:"LILLANGEN-DISMANTLE", vol:"0.08" },
      { sku:"WMC-SM-INSTALL", vol:"0.08" },        { sku:"WMC-SM-DISMANTLE", vol:"0.08" },
      { sku:"WMC-LG-INSTALL", vol:"0.12" },        { sku:"WMC-LG-DISMANTLE", vol:"0.12" },
      // BEDROOM
      { sku:"BED-OTTOMAN-BENCH-INSTALL", vol:"0.15" },   { sku:"BED-OTTOMAN-BENCH-DISMANTLE", vol:"0.15" },
      { sku:"BED-CHEST3-INSTALL", vol:"0.40" },          { sku:"BED-CHEST3-DISMANTLE", vol:"0.40" },
      { sku:"BED-CHEST5-INSTALL", vol:"0.55" },          { sku:"BED-CHEST5-DISMANTLE", vol:"0.55" },
      { sku:"BED-HEADBOARD-INSTALL", vol:"0.20" },       { sku:"BED-HEADBOARD-DISMANTLE", vol:"0.20" },
      { sku:"BED-OTTO-K-INSTALL", vol:"0.65" },          { sku:"BED-OTTO-K-DISMANTLE", vol:"0.65" },
      { sku:"BED-OTTO-Q-INSTALL", vol:"0.55" },          { sku:"BED-OTTO-Q-DISMANTLE", vol:"0.55" },
      { sku:"STUDY-INSTALL", vol:"0.40" },               { sku:"STUDY-DISMANTLE", vol:"0.40" },
      { sku:"BED-HEADBOARD-UPHL-INSTALL", vol:"0.25" },  { sku:"BED-HEADBOARD-UPHL-DISMANTLE", vol:"0.25" },
      { sku:"BED-VANITY-STOOL-INSTALL", vol:"0.08" },    { sku:"BED-VANITY-STOOL-DISMANTLE", vol:"0.08" },
      { sku:"BED-NIGHTSTAND-INSTALL", vol:"0.20" },      { sku:"BED-NIGHTSTAND-DISMANTLE", vol:"0.20" },
      // BEDS
      { sku:"SB-INSTALL-01", vol:"0.35" },    { sku:"SB-DISMANTLE-01", vol:"0.35" },
      { sku:"SB-INSTALL-02", vol:"0.35" },    { sku:"SB-DISMANTLE-02", vol:"0.35" },
      { sku:"DB-INSTALL-01", vol:"0.45" },    { sku:"DB-DISMANTLE-01", vol:"0.45" },
      { sku:"QB-INSTALL-01", vol:"0.55" },    { sku:"QB-DISMANTLE-01", vol:"0.55" },
      { sku:"KB-INSTALL-01", vol:"0.65" },    { sku:"KB-DISMANTLE-01", vol:"0.65" },
      { sku:"BUNK-INSTALL", vol:"0.65" },     { sku:"BUNK-DISMANTLE", vol:"0.65" },
      { sku:"BUNK-TRD-INSTALL", vol:"0.65" }, { sku:"BUNK-TRD-DISMANTLE", vol:"0.65" },
      { sku:"MURPHY-INSTALL", vol:"0.80" },   { sku:"MURPHY-DISMANTLE", vol:"0.80" },
      { sku:"DIVN-INSTALL", vol:"0.50" },     { sku:"DIVN-DISMANTLE", vol:"0.50" },
      { sku:"HYDR-K-INSTALL", vol:"0.65" },   { sku:"HYDR-K-DISMANTLE", vol:"0.65" },
      { sku:"HYDR-Q-INSTALL", vol:"0.55" },   { sku:"HYDR-Q-DISMANTLE", vol:"0.55" },
      { sku:"LOFT-INSTALL", vol:"0.65" },     { sku:"LOFT-DISMANTLE", vol:"0.65" },
      { sku:"PLAT-SS-INSTALL", vol:"0.40" },  { sku:"PLAT-SS-DISMANTLE", vol:"0.40" },
      { sku:"TATAMI-INSTALL", vol:"0.45" },   { sku:"TATAMI-DISMANTLE", vol:"0.45" },
      // CURTAINS & BLINDS
      { sku:"BLIND-ROLLER-INSTALL", vol:"0.04" },       { sku:"BLIND-ROLLER-DISMANTLE", vol:"0.04" },
      { sku:"BLIND-VENETIAN-INSTALL", vol:"0.05" },     { sku:"BLIND-VENETIAN-DISMANTLE", vol:"0.05" },
      { sku:"CURTAIN-EYELET-INSTALL", vol:"0.06" },     { sku:"CURTAIN-EYELET-DISMANTLE", vol:"0.06" },
      { sku:"CURTAIN-PENCIL-INSTALL", vol:"0.06" },     { sku:"CURTAIN-PENCIL-DISMANTLE", vol:"0.06" },
      { sku:"BLIND-ROMAN-INSTALL", vol:"0.04" },        { sku:"BLIND-ROMAN-DISMANTLE", vol:"0.04" },
      { sku:"CURTAIN-SHEER-INSTALL", vol:"0.05" },      { sku:"CURTAIN-SHEER-DISMANTLE", vol:"0.05" },
      { sku:"BLD-ROLLER-INSTALL", vol:"0.04" },         { sku:"BLD-ROLLER-DISMANTLE", vol:"0.04" },
      { sku:"BLD-ROMAN-INSTALL", vol:"0.04" },          { sku:"BLD-ROMAN-DISMANTLE", vol:"0.04" },
      { sku:"BLD-VENETIAN-INSTALL", vol:"0.05" },       { sku:"BLD-VENETIAN-DISMANTLE", vol:"0.05" },
      { sku:"BLD-VERTICAL-INSTALL", vol:"0.05" },       { sku:"BLD-VERTICAL-DISMANTLE", vol:"0.05" },
      { sku:"BLD-DAY-NIGHT-INSTALL", vol:"0.04" },      { sku:"BLD-DAY-NIGHT-DISMANTLE", vol:"0.04" },
      { sku:"BLD-MOTORIZED-INSTALL", vol:"0.06" },      { sku:"BLD-MOTORIZED-DISMANTLE", vol:"0.06" },
      // DINING
      { sku:"DNT-INSTALL", vol:"0.65" },      { sku:"DNT-DISMANTLE", vol:"0.65" },     { sku:"DNT-RELOCATE", vol:"0.65" },
      { sku:"DNC-INSTALL", vol:"0.08" },      { sku:"DNC-DISMANTLE", vol:"0.08" },     { sku:"DNC-RELOCATE", vol:"0.08" },
      { sku:"EXDT-INSTALL", vol:"0.80" },     { sku:"EXDT-DISMANTLE", vol:"0.80" },    { sku:"EXDT-RELOCATE", vol:"0.80" },
      { sku:"BARSTL-INSTALL", vol:"0.05" },   { sku:"BARSTL-DISMANTLE", vol:"0.05" },
      { sku:"CHINA-INSTALL", vol:"0.55" },    { sku:"CHINA-DISMANTLE", vol:"0.55" },
      { sku:"SIDE-BUF-INSTALL", vol:"0.55" }, { sku:"SIDE-BUF-DISMANTLE", vol:"0.55" },{ sku:"SIDE-BUF-RELOCATE", vol:"0.55" },
      { sku:"DT-01", vol:"0.60" },
      { sku:"DC-INSTALL", vol:"0.08" },       { sku:"DC-DISMANTLE", vol:"0.08" },
      // DRILLING
      { sku:"DRILL-BASIC-INSTALL", vol:"0.01" },    { sku:"DRILL-BASIC-DISMANTLE", vol:"0.01" },
      { sku:"DRILL-ANCHOR-INSTALL", vol:"0.01" },   { sku:"DRILL-PLASTER-INSTALL", vol:"0.01" },
      { sku:"DRILL-CONCRETE-INSTALL", vol:"0.01" }, { sku:"DRILL-GLASS-INSTALL", vol:"0.01" },
      { sku:"DRILL-HOLE-INSTALL", vol:"0.01" },     { sku:"DRILL-PARTITION-INSTALL", vol:"0.01" },
      { sku:"DRILL-STUD-INSTALL", vol:"0.01" },     { sku:"DRILL-DISMANTLE", vol:"0.01" },
      { sku:"DRILL-CONCRETE", vol:"0.01" },  { sku:"DRILL-MISC", vol:"0.01" },
      { sku:"DRILL-PATCH", vol:"0.01" },     { sku:"DRILL-TRAY", vol:"0.01" },
      { sku:"DRILL-ANCHOR", vol:"0.01" },    { sku:"DRILL-BRACKET", vol:"0.01" },
      { sku:"DRILL-BRICK", vol:"0.01" },     { sku:"DRILL-CABLE", vol:"0.01" },
      { sku:"DRILL-GLASS", vol:"0.01" },     { sku:"DRILL-PARTITION", vol:"0.01" },
      { sku:"DRILL-MARBLE", vol:"0.01" },    { sku:"DRILL-TILE", vol:"0.01" },
      // ENTERTAINMENT
      { sku:"ENT-TVCAB-INSTALL", vol:"0.50" },      { sku:"ENT-TVCAB-DISMANTLE", vol:"0.50" },
      { sku:"ENT-ENTUNIT-INSTALL", vol:"0.60" },    { sku:"ENT-ENTUNIT-DISMANTLE", vol:"0.60" },
      { sku:"ENT-AVRAK-INSTALL", vol:"0.30" },      { sku:"ENT-AVRAK-DISMANTLE", vol:"0.30" },
      { sku:"ENT-GAMECAB-INSTALL", vol:"0.40" },    { sku:"ENT-GAMECAB-DISMANTLE", vol:"0.40" },
      { sku:"ENT-MEDIACON-INSTALL", vol:"0.35" },   { sku:"ENT-MEDIACON-DISMANTLE", vol:"0.35" },
      { sku:"ENT-PROJSCR-INSTALL", vol:"0.15" },    { sku:"ENT-PROJSCR-DISMANTLE", vol:"0.15" },
      { sku:"ENT-PROJ-INSTALL", vol:"0.20" },       { sku:"ENT-PROJ-DISMANTLE", vol:"0.20" },
      { sku:"ENT-PROJWALL-INSTALL", vol:"0.15" },   { sku:"ENT-PROJWALL-DISMANTLE", vol:"0.15" },
      { sku:"ENT-SOUNDBAR-INSTALL", vol:"0.05" },   { sku:"ENT-SOUNDBAR-DISMANTLE", vol:"0.05" },
      { sku:"ENT-SPEAKER-INSTALL", vol:"0.08" },    { sku:"ENT-SPEAKER-DISMANTLE", vol:"0.08" },
      { sku:"ENT-INSTALL", vol:"0.60" },            { sku:"ENT-DISMANTLE", vol:"0.60" },
      // FOYER & HALLWAY
      { sku:"FOYER-BENCH-INSTALL", vol:"0.15" },         { sku:"FOYER-BENCH-DISMANTLE", vol:"0.15" },    { sku:"FOYER-BENCH-RELOCATE", vol:"0.15" },
      { sku:"FOYER-HALL-CONSOLE-INSTALL", vol:"0.25" },   { sku:"FOYER-HALL-CONSOLE-DISMANTLE", vol:"0.25" },
      { sku:"FOYER-SHOEBENCH-INSTALL", vol:"0.20" },      { sku:"FOYER-SHOEBENCH-DISMANTLE", vol:"0.20" }, { sku:"FOYER-SHOEBENCH-RELOCATE", vol:"0.20" },
      { sku:"FOYER-UMBSTAND-INSTALL", vol:"0.03" },
      // GYM & FITNESS
      { sku:"GYM-TMILL-INSTALL", vol:"0.80" },  { sku:"GYM-TMILL-DISMANTLE", vol:"0.80" },  { sku:"GYM-TMILL-RELOCATE", vol:"0.80" },
      { sku:"GYM-ELLIP-INSTALL", vol:"0.60" },  { sku:"GYM-ELLIP-DISMANTLE", vol:"0.60" },  { sku:"GYM-ELLIP-RELOCATE", vol:"0.60" },
      { sku:"GYM-ROWER-INSTALL", vol:"0.40" },  { sku:"GYM-ROWER-DISMANTLE", vol:"0.40" },  { sku:"GYM-ROWER-RELOCATE", vol:"0.40" },
      { sku:"GYM-BIKE-INSTALL", vol:"0.30" },   { sku:"GYM-BIKE-DISMANTLE", vol:"0.30" },   { sku:"GYM-BIKE-RELOCATE", vol:"0.30" },
      { sku:"GYM-RACK-INSTALL", vol:"0.70" },   { sku:"GYM-RACK-DISMANTLE", vol:"0.70" },   { sku:"GYM-RACK-RELOCATE", vol:"0.70" },
      { sku:"GYM-BENCH-INSTALL", vol:"0.20" },  { sku:"GYM-BENCH-DISMANTLE", vol:"0.20" },
      { sku:"GYM-MULTI-INSTALL", vol:"1.50" },  { sku:"GYM-MULTI-DISMANTLE", vol:"1.50" },
      { sku:"GYM-MAT-INSTALL", vol:"0.05" },    { sku:"GYM-MAT-DISMANTLE", vol:"0.05" },
      // GYM EQUIPMENT
      { sku:"TREADMILL-INSTALL", vol:"0.80" },  { sku:"TREADMILL-DISMANTLE", vol:"0.80" },
      { sku:"ELLIP-INSTALL", vol:"0.60" },      { sku:"ELLIP-DISMANTLE", vol:"0.60" },
      { sku:"ROW-INSTALL", vol:"0.40" },        { sku:"ROW-DISMANTLE", vol:"0.40" },
      { sku:"BIKE-INSTALL", vol:"0.30" },       { sku:"BIKE-DISMANTLE", vol:"0.30" },
      { sku:"RACK-INSTALL", vol:"0.70" },       { sku:"RACK-DISMANTLE", vol:"0.70" },
      { sku:"BENCH-INSTALL", vol:"0.20" },      { sku:"BENCH-DISMANTLE", vol:"0.20" },
      { sku:"MULTIGYM-INSTALL", vol:"1.50" },   { sku:"MULTIGYM-DISMANTLE", vol:"1.50" },
      { sku:"DBRACK-INSTALL", vol:"0.35" },     { sku:"DBRACK-DISMANTLE", vol:"0.35" },
      { sku:"PULLUP-INSTALL", vol:"0.05" },     { sku:"PULLUP-DISMANTLE", vol:"0.05" },
      // HOME APPLIANCES
      { sku:"APPL-FRIDGE-S-RELOCATE", vol:"0.60" }, { sku:"APPL-FRIDGE-M-RELOCATE", vol:"0.75" },
      { sku:"APPL-FRIDGE-L-RELOCATE", vol:"0.90" }, { sku:"APPL-WASH-RELOCATE", vol:"0.50" },
      { sku:"APPL-DRYER-RELOCATE", vol:"0.50" },    { sku:"APPL-COMBO-RELOCATE", vol:"0.55" },
      { sku:"APPL-DW-RELOCATE", vol:"0.45" },       { sku:"APPL-MICRO-RELOCATE", vol:"0.10" },
      { sku:"APPL-WATERPURIFIER-INSTALL", vol:"0.08" }, { sku:"APPL-WATERPURIFIER-DISMANTLE", vol:"0.08" },
      // IKEA
      { sku:"IKEA-MALM-DBL-INSTALL", vol:"0.45" },  { sku:"IKEA-MALM-DBL-DISMANTLE", vol:"0.45" },
      { sku:"IKEA-MALM-Q-INSTALL", vol:"0.55" },    { sku:"IKEA-MALM-Q-DISMANTLE", vol:"0.55" },
      { sku:"IKEA-HEMNES-DBL-INSTALL", vol:"0.45" },{ sku:"IKEA-HEMNES-DBL-DISMANTLE", vol:"0.45" },
      { sku:"IKEA-HEMNES-Q-INSTALL", vol:"0.55" },  { sku:"IKEA-HEMNES-Q-DISMANTLE", vol:"0.55" },
      { sku:"IKEA-MALM3-INSTALL", vol:"0.40" },     { sku:"IKEA-MALM3-DISMANTLE", vol:"0.40" },
      { sku:"IKEA-MALM6-INSTALL", vol:"0.55" },     { sku:"IKEA-MALM6-DISMANTLE", vol:"0.55" },
      { sku:"IKEA-KIVIK3-INSTALL", vol:"1.80" },    { sku:"IKEA-KIVIK3-DISMANTLE", vol:"1.80" },
      { sku:"IKEA-BESTA-INSTALL", vol:"0.50" },     { sku:"IKEA-BESTA-DISMANTLE", vol:"0.50" },    { sku:"IKEA-BESTA-RELOCATE", vol:"0.50" },
      { sku:"IKEA-LACK-INSTALL", vol:"0.12" },      { sku:"IKEA-LACK-DISMANTLE", vol:"0.12" },
      { sku:"IKEA-POANG-INSTALL", vol:"0.35" },     { sku:"IKEA-POANG-DISMANTLE", vol:"0.35" },
      { sku:"IKEA-BILLY-INSTALL", vol:"0.30" },     { sku:"IKEA-BILLY-DISMANTLE", vol:"0.30" },
      { sku:"IKEA-BILLY-EXT-INSTALL", vol:"0.20" }, { sku:"IKEA-BILLY-EXT-DISMANTLE", vol:"0.20" },
      { sku:"IKEA-KALLAX-INSTALL", vol:"0.35" },    { sku:"IKEA-KALLAX-DISMANTLE", vol:"0.35" },
      { sku:"IKEA-KALLAX44-INSTALL", vol:"0.55" },  { sku:"IKEA-KALLAX44-DISMANTLE", vol:"0.55" },
      { sku:"IKEA-IVAR-INSTALL", vol:"0.40" },      { sku:"IKEA-IVAR-DISMANTLE", vol:"0.40" },
      { sku:"IKEA-ALEX-INSTALL", vol:"0.25" },      { sku:"IKEA-ALEX-DISMANTLE", vol:"0.25" },
      { sku:"IKEA-TROFAST-INSTALL", vol:"0.30" },   { sku:"IKEA-TROFAST-DISMANTLE", vol:"0.30" },
      { sku:"IKEA-MICKE-INSTALL", vol:"0.30" },     { sku:"IKEA-MICKE-DISMANTLE", vol:"0.30" },
      { sku:"IKEA-VITTSJO-INSTALL", vol:"0.25" },   { sku:"IKEA-VITTSJO-DISMANTLE", vol:"0.25" },
      { sku:"IKEA-HW3-INSTALL", vol:"0.80" },       { sku:"IKEA-HW3-DISMANTLE", vol:"0.80" },
      { sku:"IKEA-KLEPP-INSTALL", vol:"0.60" },     { sku:"IKEA-KLEPP-DISMANTLE", vol:"0.60" },
      // KIDS
      { sku:"CRIB-INSTALL", vol:"0.30" },     { sku:"CRIB-DISMANTLE", vol:"0.30" },
      { sku:"CHNG-INSTALL", vol:"0.25" },     { sku:"CHNG-DISMANTLE", vol:"0.25" },
      { sku:"KDSK-INSTALL", vol:"0.25" },     { sku:"KDSK-DISMANTLE", vol:"0.25" },
      { sku:"KWRD-INSTALL", vol:"0.50" },     { sku:"KWRD-DISMANTLE", vol:"0.50" },
      { sku:"TOY-INSTALL", vol:"0.20" },      { sku:"TOY-DISMANTLE", vol:"0.20" },
      { sku:"IKEA-STUVA-INSTALL", vol:"0.60" },{ sku:"IKEA-STUVA-DISMANTLE", vol:"0.60" },
      // KITCHEN
      { sku:"KIT-ISL-INSTALL", vol:"0.60" },   { sku:"KIT-ISL-DISMANTLE", vol:"0.60" },   { sku:"KIT-ISL-RELOCATE", vol:"0.60" },
      { sku:"KIT-TROLL-INSTALL", vol:"0.25" }, { sku:"KIT-TROLL-DISMANTLE", vol:"0.25" }, { sku:"KIT-TROLL-RELOCATE", vol:"0.25" },
      { sku:"KIT-HUTCH-INSTALL", vol:"0.55" }, { sku:"KIT-HUTCH-DISMANTLE", vol:"0.55" }, { sku:"KIT-HUTCH-RELOCATE", vol:"0.55" },
      { sku:"KIT-BARCNT-INSTALL", vol:"0.40" },{ sku:"KIT-BARCNT-DISMANTLE", vol:"0.40" },
      { sku:"KIT-WINE-INSTALL", vol:"0.35" },  { sku:"KIT-WINE-DISMANTLE", vol:"0.35" },  { sku:"KIT-WINE-RELOCATE", vol:"0.35" },
      // LIVING ROOM
      { sku:"LVG-ARMCHAIR-INSTALL", vol:"0.40" },   { sku:"LVG-ARMCHAIR-DISMANTLE", vol:"0.40" },
      { sku:"LVG-COFFEETBL-INSTALL", vol:"0.25" },  { sku:"LVG-COFFEETBL-DISMANTLE", vol:"0.25" },
      { sku:"LVG-OTTOMAN-INSTALL", vol:"0.15" },    { sku:"LVG-OTTOMAN-DISMANTLE", vol:"0.15" },
      { sku:"LVG-NESTING-INSTALL", vol:"0.12" },    { sku:"LVG-NESTING-DISMANTLE", vol:"0.12" },
      { sku:"LVG-FIREPLACE-INSTALL", vol:"0.30" },  { sku:"LVG-FIREPLACE-DISMANTLE", vol:"0.30" },
      { sku:"LVG-PLANT-STAND-INSTALL", vol:"0.05" },{ sku:"LVG-PLANT-STAND-DISMANTLE", vol:"0.05" },
      { sku:"LVG-HAMMOCK-INSTALL", vol:"0.10" },    { sku:"LVG-HAMMOCK-DISMANTLE", vol:"0.10" },
      { sku:"TVC-INSTALL", vol:"0.40" },            { sku:"TVC-DISMANTLE", vol:"0.40" },
      { sku:"CFT-INSTALL", vol:"0.25" },            { sku:"CFT-DISMANTLE", vol:"0.25" },
      { sku:"MASS-INSTALL", vol:"0.80" },           { sku:"MASS-DISMANTLE", vol:"0.80" },
      { sku:"BAR-INSTALL", vol:"0.40" },            { sku:"BAR-DISMANTLE", vol:"0.40" },
      { sku:"CONS-INSTALL", vol:"0.25" },           { sku:"CONS-DISMANTLE", vol:"0.25" },
      { sku:"SIDE-INSTALL", vol:"0.10" },           { sku:"SIDE-DISMANTLE", vol:"0.10" },  { sku:"SIDE-RELOCATE", vol:"0.10" },
      { sku:"TVWM-INSTALL", vol:"0.05" },
      // MATTRESSES
      { sku:"MATT-SS-RELOCATE", vol:"0.18" }, { sku:"MATT-SS-DISPOSAL", vol:"0.18" },
      { sku:"MATT-Q-RELOCATE", vol:"0.22" },  { sku:"MATT-Q-DISPOSAL", vol:"0.22" },
      { sku:"MATT-K-RELOCATE", vol:"0.28" },  { sku:"MATT-K-DISPOSAL", vol:"0.28" },
      { sku:"MATT-TOPPER-RELOCATE", vol:"0.08" },
      { sku:"MATT-SGL-RELOCATE", vol:"0.15" },{ sku:"MATT-DBL-RELOCATE", vol:"0.20" },
      { sku:"MATT-QN-RELOCATE", vol:"0.22" }, { sku:"MATT-KG-RELOCATE", vol:"0.28" },
      // MEETING PODS & PHONE BOOTHS
      { sku:"PHONE-BOOTH-INSTALL", vol:"0.80" }, { sku:"PHONE-BOOTH-DISMANTLE", vol:"0.80" }, { sku:"PHONE-BOOTH-RELOCATE", vol:"0.80" },
      { sku:"DUO-BOOTH-INSTALL", vol:"1.20" },   { sku:"DUO-BOOTH-DISMANTLE", vol:"1.20" },   { sku:"DUO-BOOTH-RELOCATE", vol:"1.20" },
      { sku:"KIOSK-INSTALL", vol:"0.50" },       { sku:"KIOSK-DISMANTLE", vol:"0.50" },       { sku:"KIOSK-RELOCATE", vol:"0.50" },
      { sku:"ACBOOTH-INSTALL", vol:"1.00" },     { sku:"ACBOOTH-DISMANTLE", vol:"1.00" },     { sku:"ACBOOTH-RELOCATE", vol:"1.00" },
      { sku:"POD4-INSTALL", vol:"3.00" },        { sku:"POD4-DISMANTLE", vol:"3.00" },        { sku:"POD4-RELOCATE", vol:"3.00" },
      { sku:"POD6-INSTALL", vol:"4.50" },        { sku:"POD6-DISMANTLE", vol:"4.50" },        { sku:"POD6-RELOCATE", vol:"4.50" },
      { sku:"POD8-INSTALL", vol:"6.00" },        { sku:"POD8-DISMANTLE", vol:"6.00" },        { sku:"POD8-RELOCATE", vol:"6.00" },
      { sku:"POD-PHONE-INSTALL", vol:"0.80" },   { sku:"POD-PHONE-DISMANTLE", vol:"0.80" },   { sku:"POD-PHONE-RELOCATE", vol:"0.80" },
      { sku:"POD-2-INSTALL", vol:"1.80" },       { sku:"POD-2-DISMANTLE", vol:"1.80" },       { sku:"POD-2-RELOCATE", vol:"1.80" },
      { sku:"POD-4-INSTALL", vol:"3.00" },       { sku:"POD-4-DISMANTLE", vol:"3.00" },       { sku:"POD-4-RELOCATE", vol:"3.00" },
      { sku:"POD-6-INSTALL", vol:"4.50" },       { sku:"POD-6-DISMANTLE", vol:"4.50" },       { sku:"POD-6-RELOCATE", vol:"4.50" },
      { sku:"POD-ACOUSTIC-INSTALL", vol:"0.25" },{ sku:"POD-ACOUSTIC-DISMANTLE", vol:"0.25" },{ sku:"POD-ACOUSTIC-RELOCATE", vol:"0.25" },
      { sku:"POD-DIVIDER-INSTALL", vol:"0.15" }, { sku:"POD-DIVIDER-DISMANTLE", vol:"0.15" }, { sku:"POD-DIVIDER-RELOCATE", vol:"0.15" },
      { sku:"POD-LOUNGE-INSTALL", vol:"2.00" },  { sku:"POD-LOUNGE-DISMANTLE", vol:"2.00" },  { sku:"POD-LOUNGE-RELOCATE", vol:"2.00" },
      { sku:"POD-SEMI-INSTALL", vol:"1.20" },    { sku:"POD-SEMI-DISMANTLE", vol:"1.20" },    { sku:"POD-SEMI-RELOCATE", vol:"1.20" },
      // MUSICAL INSTRUMENTS
      { sku:"PIANO-UP-INSTALL", vol:"1.20" },     { sku:"PIANO-UP-DISMANTLE", vol:"1.20" },
      { sku:"PIANO-GR-INSTALL", vol:"2.50" },     { sku:"PIANO-GR-DISMANTLE", vol:"2.50" },
      { sku:"PIANO-GRAND-INSTALL", vol:"2.50" },  { sku:"PIANO-GRAND-DISMANTLE", vol:"2.50" },
      { sku:"INSTR-DRUM-INSTALL", vol:"0.40" },   { sku:"INSTR-DRUM-DISMANTLE", vol:"0.40" }, { sku:"INSTR-DRUM-RELOCATE", vol:"0.40" },
      { sku:"INSTR-ELEC-RELOCATE", vol:"0.15" },
      { sku:"PIANO-DIGITAL-INSTALL", vol:"0.30" },  { sku:"PIANO-DIGITAL-DISMANTLE", vol:"0.30" },  { sku:"PIANO-DIGITAL-RELOCATE", vol:"0.30" },
      { sku:"PIANO-KEYBOARD-INSTALL", vol:"0.15" }, { sku:"PIANO-KEYBOARD-DISMANTLE", vol:"0.15" }, { sku:"PIANO-KEYBOARD-RELOCATE", vol:"0.15" },
      // OFFICE (install/dismantle)
      { sku:"OD-INSTALL", vol:"0.50" },    { sku:"OD-DISMANTLE", vol:"0.50" },    { sku:"OD-01", vol:"0.50" },
      { sku:"EC-INSTALL", vol:"0.28" },    { sku:"EC-DISMANTLE", vol:"0.28" },    { sku:"EC-01", vol:"0.28" },
      { sku:"L-DESK-INSTALL", vol:"0.80" },{ sku:"L-DESK-DISMANTLE", vol:"0.80" },
      { sku:"FC-INSTALL", vol:"0.35" },    { sku:"FC-DISMANTLE", vol:"0.35" },
      { sku:"CRED-INSTALL", vol:"0.55" },  { sku:"CRED-DISMANTLE", vol:"0.55" },
      { sku:"LOCK-INSTALL", vol:"0.40" },  { sku:"LOCK-DISMANTLE", vol:"0.40" },
      { sku:"STND-INSTALL", vol:"0.55" },  { sku:"STND-DISMANTLE", vol:"0.55" },
      { sku:"OFF-SOFA-INSTALL", vol:"1.20" },{ sku:"OFF-SOFA-DISMANTLE", vol:"1.20" },
      { sku:"CT-INSTALL", vol:"1.20" },    { sku:"CT-DISMANTLE", vol:"1.20" },
      { sku:"PANEL-INSTALL", vol:"0.30" }, { sku:"PANEL-DISMANTLE", vol:"0.30" },
      { sku:"MONARM-INSTALL", vol:"0.05" },{ sku:"MONARM-DISMANTLE", vol:"0.05" },
      { sku:"PODPANEL-INSTALL", vol:"0.30" },{ sku:"PODPANEL-DISMANTLE", vol:"0.30" },
      { sku:"OFF-DESK-SCREEN-INSTALL", vol:"0.06" },{ sku:"OFF-DESK-SCREEN-DISMANTLE", vol:"0.06" },
      { sku:"OFF-TRAINING-TBL-INSTALL", vol:"0.40" },{ sku:"OFF-TRAINING-TBL-DISMANTLE", vol:"0.40" },
      { sku:"OFF-WHITEBOARD-INSTALL", vol:"0.12" },{ sku:"OFF-WHITEBOARD-DISMANTLE", vol:"0.12" },
      { sku:"OFF-WORKBENCH-INSTALL", vol:"0.55" },{ sku:"OFF-WORKBENCH-DISMANTLE", vol:"0.55" },
      { sku:"RECPT-INSTALL", vol:"0.80" }, { sku:"RECPT-DISMANTLE", vol:"0.80" },
      // OTHERS
      { sku:"MI-INSTALL", vol:"0.10" },    { sku:"MISC-INSTALL", vol:"0.20" },
      // OUTDOOR
      { sku:"OUT-SWINGSET-INSTALL", vol:"0.40" },  { sku:"OUT-SWINGSET-DISMANTLE", vol:"0.40" },
      { sku:"OUT-UMBR-INSTALL", vol:"0.20" },      { sku:"OUT-UMBR-DISMANTLE", vol:"0.20" },
      { sku:"OUT-SUN-LOUNGE-INSTALL", vol:"0.25" },{ sku:"OUT-SUN-LOUNGE-DISMANTLE", vol:"0.25" },
      { sku:"OUT-BBQ-INSTALL", vol:"0.30" },       { sku:"OUT-BBQ-DISMANTLE", vol:"0.30" },
      { sku:"OUT-STOR-INSTALL", vol:"0.50" },      { sku:"OUT-STOR-DISMANTLE", vol:"0.50" },
      { sku:"OUT-PLANTR-INSTALL", vol:"0.20" },    { sku:"OUT-PLANTR-DISMANTLE", vol:"0.20" },
      { sku:"GARD-INSTALL", vol:"0.60" },          { sku:"GARD-DISMANTLE", vol:"0.60" },  { sku:"GARD-RELOCATE", vol:"0.60" },
      { sku:"OUTBENCH-INSTALL", vol:"0.20" },      { sku:"OUTBENCH-DISMANTLE", vol:"0.20" },
      // RATTAN & CANE
      { sku:"RATTAN-SOFA-INSTALL", vol:"1.00" },   { sku:"RATTAN-SOFA-DISMANTLE", vol:"1.00" },   { sku:"RATTAN-SOFA-RELOCATE", vol:"1.00" },
      { sku:"RATTAN-CHAIR-INSTALL", vol:"0.30" },  { sku:"RATTAN-CHAIR-DISMANTLE", vol:"0.30" },  { sku:"RATTAN-CHAIR-RELOCATE", vol:"0.30" },
      { sku:"RATTAN-DINING-INSTALL", vol:"1.00" }, { sku:"RATTAN-DINING-DISMANTLE", vol:"1.00" },
      { sku:"RATTAN-TABLE-INSTALL", vol:"0.40" },  { sku:"RATTAN-TABLE-DISMANTLE", vol:"0.40" },
      { sku:"RAT-SOFA-INSTALL", vol:"1.00" },      { sku:"RAT-SOFA-DISMANTLE", vol:"1.00" },      { sku:"RAT-SOFA-RELOCATE", vol:"1.00" },
      { sku:"RAT-CHAIR-INSTALL", vol:"0.30" },     { sku:"RAT-CHAIR-DISMANTLE", vol:"0.30" },     { sku:"RAT-CHAIR-RELOCATE", vol:"0.30" },
      { sku:"RAT-TABLE-INSTALL", vol:"1.00" },     { sku:"RAT-TABLE-DISMANTLE", vol:"1.00" },     { sku:"RAT-TABLE-RELOCATE", vol:"1.00" },
      { sku:"RAT-SWING-INSTALL", vol:"0.15" },     { sku:"RAT-SWING-DISMANTLE", vol:"0.15" },
      // SAFE & SECURITY
      { sku:"SAFE-SM-INSTALL", vol:"0.08" },  { sku:"SAFE-MD-INSTALL", vol:"0.15" },
      { sku:"SAFE-SM-RELOCATE", vol:"0.08" }, { sku:"SAFE-MD-RELOCATE", vol:"0.15" }, { sku:"SAFE-LG-RELOCATE", vol:"0.25" },
      // SINGAPORE-SPECIFIC
      { sku:"CEILRACK-INSTALL", vol:"0.05" }, { sku:"CEILRACK-DISMANTLE", vol:"0.05" },
      { sku:"BSHELV-INSTALL", vol:"0.20" },   { sku:"BSHELV-DISMANTLE", vol:"0.20" },
      { sku:"UTIL-INSTALL", vol:"0.40" },     { sku:"UTIL-DISMANTLE", vol:"0.40" },
      // SOFAS
      { sku:"SOFA-1-INSTALL", vol:"0.80" },   { sku:"SOFA-1-DISMANTLE", vol:"0.80" },
      { sku:"SF2-INSTALL", vol:"1.30" },      { sku:"SF2-DISMANTLE", vol:"1.30" },
      { sku:"SF3-INSTALL", vol:"1.80" },      { sku:"SF3-DISMANTLE", vol:"1.80" },
      { sku:"SOFA-4-INSTALL", vol:"2.20" },   { sku:"SOFA-4-DISMANTLE", vol:"2.20" },
      { sku:"SOFA-MOD-INSTALL", vol:"2.50" }, { sku:"SOFA-MOD-DISMANTLE", vol:"2.50" },
      { sku:"RECLINER-INSTALL", vol:"0.70" }, { sku:"RECLINER-DISMANTLE", vol:"0.70" },
      { sku:"ARM-INSTALL", vol:"0.40" },      { sku:"ARM-DISMANTLE", vol:"0.40" },      { sku:"ARM-RELOCATE", vol:"0.40" },
      { sku:"CHAISE-INSTALL", vol:"0.70" },   { sku:"CHAISE-DISMANTLE", vol:"0.70" },
      { sku:"LSOFA-INSTALL", vol:"2.20" },    { sku:"LSOFA-DISMANTLE", vol:"2.20" },    { sku:"LSOFA-RELOCATE", vol:"2.20" },
      { sku:"RECL2-INSTALL", vol:"1.00" },    { sku:"RECL2-DISMANTLE", vol:"1.00" },
      { sku:"RECL3-INSTALL", vol:"1.40" },    { sku:"RECL3-DISMANTLE", vol:"1.40" },
      { sku:"SOFABED-INSTALL", vol:"1.30" },  { sku:"SOFABED-DISMANTLE", vol:"1.30" },  { sku:"SOFABED-RELOCATE", vol:"1.30" },
      // SPECIALTY
      { sku:"POOL-INSTALL", vol:"2.00" },    { sku:"POOL-DISMANTLE", vol:"2.00" },
      { sku:"GAME-INSTALL", vol:"0.60" },    { sku:"GAME-DISMANTLE", vol:"0.60" },
      { sku:"SAFE-INSTALL", vol:"0.20" },    { sku:"SAFE-DISMANTLE", vol:"0.20" },
      // STORAGE
      { sku:"BS-INSTALL", vol:"0.35" },      { sku:"BS-DISMANTLE", vol:"0.35" },
      { sku:"DRWCH-INSTALL", vol:"0.50" },   { sku:"DRWCH-DISMANTLE", vol:"0.50" },
      { sku:"SHCAB-INSTALL", vol:"0.30" },   { sku:"SHCAB-DISMANTLE", vol:"0.30" },    { sku:"SHCAB-RELOCATE", vol:"0.30" },
      { sku:"SR-INSTALL", vol:"0.30" },      { sku:"SR-DISMANTLE", vol:"0.30" },        { sku:"SR-RELOCATE", vol:"0.30" },
      { sku:"SDCAB-INSTALL", vol:"0.40" },   { sku:"SDCAB-DISMANTLE", vol:"0.40" },
      { sku:"SCTALL-INSTALL", vol:"0.40" },  { sku:"SCTALL-DISMANTLE", vol:"0.40" },
      { sku:"CMBCAB-INSTALL", vol:"0.50" },  { sku:"CMBCAB-DISMANTLE", vol:"0.50" },
      // STUDY
      { sku:"STD-DESK-INSTALL", vol:"0.40" },         { sku:"STD-DESK-DISMANTLE", vol:"0.40" },
      { sku:"STD-CORNER-DESK-INSTALL", vol:"0.80" },  { sku:"STD-CORNER-DESK-DISMANTLE", vol:"0.80" },
      { sku:"STD-BOOKCASE-INSTALL", vol:"0.60" },     { sku:"STD-BOOKCASE-DISMANTLE", vol:"0.60" },
      { sku:"STD-FILE-LATERAL-INSTALL", vol:"0.35" }, { sku:"STD-FILE-LATERAL-DISMANTLE", vol:"0.35" },
      { sku:"STD-PRINTER-STAND-INSTALL", vol:"0.10" },{ sku:"STD-PRINTER-STAND-DISMANTLE", vol:"0.10" },
      // WALL DECOR
      { sku:"DECOR-ARTFRAME-SM-INSTALL", vol:"0.03" },  { sku:"DECOR-ARTFRAME-MD-INSTALL", vol:"0.08" },
      { sku:"DECOR-ARTFRAME-LG-INSTALL", vol:"0.12" },  { sku:"DECOR-GALLERY-INSTALL", vol:"0.15" },
      { sku:"DECOR-CLOCK-INSTALL", vol:"0.02" },        { sku:"DECOR-CLOCK-DISMANTLE", vol:"0.02" },
      { sku:"DECOR-CURTAIN-RAIL-INSTALL", vol:"0.05" }, { sku:"DECOR-CURTAIN-RAIL-DISMANTLE", vol:"0.05" },
      { sku:"DECOR-LIGHT-PENDANT-INSTALL", vol:"0.10" },{ sku:"DECOR-LIGHT-PENDANT-DISMANTLE", vol:"0.10" },
      // WALL-MOUNTED
      { sku:"CURT-INSTALL", vol:"0.05" },   { sku:"CURT-DISMANTLE", vol:"0.05" },
      { sku:"FLTSHL-INSTALL", vol:"0.05" }, { sku:"FLTSHL-DISMANTLE", vol:"0.05" },
      { sku:"FLMIRR-INSTALL", vol:"0.10" }, { sku:"FLMIRR-DISMANTLE", vol:"0.10" },
      { sku:"PEG-INSTALL", vol:"0.05" },    { sku:"PEG-DISMANTLE", vol:"0.05" },
      { sku:"WLCAB-INSTALL", vol:"0.20" },  { sku:"WLCAB-DISMANTLE", vol:"0.20" },
      // WARDROBES
      { sku:"HGD2-INSTALL", vol:"0.60" },     { sku:"HGD2-DISMANTLE", vol:"0.60" },
      { sku:"HGD4-INSTALL", vol:"1.00" },     { sku:"HGD4-DISMANTLE", vol:"1.00" },
      { sku:"SLDR2-INSTALL", vol:"0.70" },    { sku:"SLDR2-DISMANTLE", vol:"0.70" },
      { sku:"SLDR3-INSTALL", vol:"1.00" },    { sku:"SLDR3-DISMANTLE", vol:"1.00" },
      { sku:"WALKIN-INSTALL", vol:"1.50" },   { sku:"WALKIN-DISMANTLE", vol:"1.50" },
      { sku:"WRDMIR-INSTALL", vol:"0.90" },   { sku:"WRDMIR-DISMANTLE", vol:"0.90" },
      { sku:"CUST-WRD-INSTALL", vol:"0.90" }, { sku:"CUST-WRD-DISMANTLE", vol:"0.90" },
    ];

    for (const u of allVols) {
      await db.update(catalogItems).set({ volumeM3: u.vol }).where(eq(catalogItems.sku, u.sku));
    }
  }

  // ── FAQ Entries seed (skip if already seeded) ────────────────────────────
  const [{ value: faqCount }] = await db.select({ value: count() }).from(faqEntries);
  if (Number(faqCount) === 0) {
    await db.insert(faqEntries).values([
      // General
      { question: "What does TMG Install do?", answer: "TMG Install (The Moving Guy Pte Ltd) is a Singapore-based furniture services company. We assemble, dismantle, and relocate furniture for homes and offices across Singapore. Whether it's IKEA furniture, wardrobes, beds, sofas, desks, or full office relocations, our experienced team handles it all professionally.", category: "general", sortOrder: 1 },
      { question: "Do you install IKEA furniture?", answer: "Yes! IKEA furniture is one of our specialties. We install all IKEA ranges including PAX wardrobes, KALLAX shelves, MALM beds, HEMNES furniture, BILLY bookcases, BESTA TV units, MICKE desks, and more. We assemble directly from the flat-pack boxes.", category: "services", sortOrder: 2 },
      { question: "What areas in Singapore do you cover?", answer: "We cover the entire Singapore island — HDB estates, condominiums, landed properties, and commercial offices. This includes all regions: North, South, East, West, and Central. There is no additional travel surcharge within Singapore.", category: "general", sortOrder: 3 },
      { question: "Do you work on weekends and public holidays?", answer: "Yes, we operate 7 days a week including Saturdays and Sundays. For public holidays, availability may be limited and the bot will ask you to contact us directly for confirmation. Business hours are typically 9am–6pm daily.", category: "hours", sortOrder: 4 },
      { question: "What are your operating hours?", answer: "We operate Monday to Sunday, 9:00am to 6:00pm. If you need after-hours or emergency services, contact us directly and we will do our best to accommodate.", category: "hours", sortOrder: 5 },
      // Services
      { question: "What services do you offer?", answer: "We offer: (1) *Installation/Assembly* – assembling new furniture from flat-pack; (2) *Dismantling* – taking apart furniture carefully; (3) *Relocation* – moving furniture from one unit to another (within or between buildings); (4) *Disposal* – disposing of old furniture responsibly. Most furniture types are covered.", category: "services", sortOrder: 10 },
      { question: "Do you do full house or office moves?", answer: "We specialize in furniture assembly and relocation, not full house moves (boxes, personal belongings, etc.). However, we can relocate specific furniture items between locations within Singapore. For full office furniture relocations, we handle the dismantle, transport, and reinstallation.", category: "services", sortOrder: 11 },
      { question: "Can you dispose of my old furniture?", answer: "Yes! We offer old furniture disposal as an add-on. Let us know during the booking and we'll arrange disposal at the same time as your installation or pick-up. Pricing depends on the item size.", category: "services", sortOrder: 12 },
      { question: "Do you do TV wall mounting?", answer: "Yes, we offer TV wall mounting services. We'll mount your TV securely and cable-manage for a clean finish. Pricing starts from $80 depending on TV size and wall type.", category: "services", sortOrder: 13 },
      { question: "Do you handle custom or built-in furniture?", answer: "We can dismantle and relocate custom-built furniture. For installation of custom/carpenter-made furniture, it depends on the complexity — please describe the furniture when you chat with us and we'll advise.", category: "services", sortOrder: 14 },
      // Pricing
      { question: "How much does furniture installation cost?", answer: "Pricing depends on the type and quantity of furniture. Example prices: IKEA PAX Wardrobe from $150, Queen Bed Frame from $80, Dining Table from $80, Office Desk from $50, Dining Chair from $20 each. Volume discounts apply for 3+ items. A minimum charge of $80 applies per job.", category: "pricing", sortOrder: 20 },
      { question: "Is there a minimum charge?", answer: "Yes, there is a minimum job charge of $80. This covers our team's time and transport to your location.", category: "pricing", sortOrder: 21 },
      { question: "Are there surcharges for high floors without a lift?", answer: "Yes. For floors above ground floor without lift access, a surcharge applies: floors 2–5 without lift add $10, floors 6–10 add $20, above floor 10 add $30. If a lift is available, no floor surcharge is applied.", category: "pricing", sortOrder: 22 },
      { question: "Do you charge for transport?", answer: "A transport fee applies depending on the job size. For small jobs (1–2 items), transport starts from $20. For larger jobs, we calculate based on volume. The estimate will show the transport fee clearly.", category: "pricing", sortOrder: 23 },
      { question: "Do you have any promotions or discounts?", answer: "Yes! We offer a bulk discount of 10% when you have 3 or more furniture items in one job. We also have promo codes periodically — use code *TMG50* for $50 off (subject to availability). Check our website for current promotions.", category: "pricing", sortOrder: 24 },
      { question: "How do I get a price estimate?", answer: "You can get an instant estimate right here on WhatsApp — just tell me what furniture items you need help with, your address, floor, and whether there's a lift. I'll calculate a price breakdown for you. Alternatively, visit tmginstall.com to use our online estimator.", category: "pricing", sortOrder: 25 },
      // Booking
      { question: "How do I book?", answer: "Just tell me your name, address, what furniture you need help with, and your preferred date and time slot. I'll give you a price estimate and submit your request to our team. You'll receive confirmation within 2 business hours.", category: "booking", sortOrder: 30 },
      { question: "How far in advance do I need to book?", answer: "We recommend booking at least 2–3 days in advance to secure your preferred time slot. For urgent or same-day requests, contact us directly and we'll check availability — a same-day surcharge may apply.", category: "booking", sortOrder: 31 },
      { question: "What time slots are available?", answer: "We offer two daily time slots: *Morning* (9am–12pm) and *Afternoon* (1pm–5pm). You can request a preferred slot when booking and we'll confirm availability.", category: "booking", sortOrder: 32 },
      { question: "Can I change or cancel my booking?", answer: "Yes. You can reschedule once for free. A second reschedule or cancellation within 24 hours of the appointment may incur a cancellation fee. Contact us as early as possible if plans change.", category: "booking", sortOrder: 33 },
      { question: "How do I track the status of my job?", answer: "After booking, you'll receive a link to your job status page where you can track progress in real time. Our team will also message you before they arrive.", category: "booking", sortOrder: 34 },
      // Policies
      { question: "What payment methods do you accept?", answer: "We accept PayNow (UEN: 201800001K), bank transfer, and most major credit/debit cards. Cash is also accepted at the time of service. Smaller jobs (under S$150) are paid in full to confirm the booking; for larger jobs (S$150 and above) a 50% deposit confirms the booking, with the balance payable on completion.", category: "policies", sortOrder: 40 },
      { question: "What is your deposit policy?", answer: "For smaller jobs (under S$150), full payment is required upon booking confirmation to secure your slot. For larger jobs (S$150 and above), a 50% deposit secures your slot, with the remaining 50% payable after the job is completed to your satisfaction. We accept PayNow, bank transfer, and card payments.", category: "policies", sortOrder: 41 },
      { question: "What if something is damaged during the job?", answer: "Our team handles all furniture with care and uses protective materials. In the unlikely event of damage caused by our team, please document it with photos and notify us immediately. We will assess and address it fairly.", category: "policies", sortOrder: 42 },
      { question: "Do I need to prepare anything before the team arrives?", answer: "Please clear the area around the furniture to give our team room to work safely. If parking is restricted, let us know so we can plan accordingly. For condominiums, please arrange loading bay / lift access in advance.", category: "policies", sortOrder: 43 },
      { question: "Do you bring your own tools?", answer: "Yes! Our team arrives fully equipped with all necessary tools — electric drills, hand tools, protective blankets, and hardware. You don't need to provide anything.", category: "policies", sortOrder: 44 },
    ]);
    console.log("[startup] FAQ entries seeded (25 entries).");
  }

  // ── Canned Replies seed (skip if already seeded) ─────────────────────────
  const [{ value: cannedCount }] = await db.select({ value: count() }).from(cannedReplies);
  if (Number(cannedCount) === 0) {
    await db.insert(cannedReplies).values([
      { shortcut: "/received", title: "Request Received", body: "Hi! We have received your request and our team will get back to you within 2 business hours to confirm your booking. 😊" },
      { shortcut: "/photos", title: "Request Photos", body: "Could you please send us some photos of the furniture? This helps us give you a more accurate quote and prepare our team." },
      { shortcut: "/confirm", title: "Booking Confirmed", body: "Great news! Your booking has been confirmed. 🎉 Our team will arrive at the agreed time. Please ensure the area is accessible." },
      { shortcut: "/deposit", title: "Deposit Payment", body: "To confirm your booking, please transfer the payment shown on your quote via PayNow to UEN 201800001K (smaller jobs are paid in full; larger jobs require a 50% deposit). Once received, we'll lock in your slot. Thank you!" },
      { shortcut: "/arrival", title: "Team on the Way", body: "Our team is on the way and will arrive at your location shortly. Please ensure access is ready. Thank you for your patience! 🚐" },
      { shortcut: "/completed", title: "Job Completed", body: "Thank you for choosing TMG Install! 🙏 We hope everything looks great. If any balance remains on your job, please settle it at your convenience. Do let us know if there's anything else you need." },
      { shortcut: "/reschedule", title: "Reschedule Notice", body: "We'd like to reschedule your appointment. Apologies for any inconvenience — could you suggest another date and time that works for you?" },
      { shortcut: "/parking", title: "Parking Info", body: "Could you let us know the parking arrangement at your location? Is there a loading bay, visitor parking, or should our team use public parking nearby?" },
      { shortcut: "/followup", title: "Follow-up Check", body: "Hi! Just checking in to see if everything went smoothly with your TMG Install service. We'd love to hear your feedback! 😊" },
      { shortcut: "/thanks", title: "Thank You", body: "Thank you for choosing TMG Install — The Moving Guy Pte Ltd! 🙏 We appreciate your support. Don't hesitate to reach out whenever you need us again." },
      { shortcut: "/human", title: "Connect to Human", body: "I'm connecting you to our customer service team now. Someone will reply to you shortly. Our business hours are Mon–Sun, 9am–6pm. Thank you for your patience! 😊" },
    ]);
    console.log("[startup] Canned replies seeded (11 entries).");
  }
  // Round 10: Dispose & dismantle_dispose service types + extra items for all categories
  // This ensures production DB has complete service type coverage (R10-DISPOSAL-FULL marker)
  const r10 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "R10-DISPOSAL-FULL"));
  if (r10.length === 0) {
    // Insert marker first
    await db.insert(catalogItems).values([
      { name: "__r10_marker__", sku: "R10-DISPOSAL-FULL", category: "System", serviceType: "install", basePrice: "0", active: false },
    ]);
    // Insert in batches of 100 to avoid query size limits
    await db.insert(catalogItems).values([
      { name: "2-Seater Sofa", sku: "2SEATERS-DISPOSE", category: "Sofas", serviceType: "dispose", basePrice: "40" },
      { name: "2-Seater Sofa", sku: "2SEATERS-DIS-DISP", category: "Sofas", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "3-Seater Sofa", sku: "3SEATERS-DISPOSE", category: "Sofas", serviceType: "dispose", basePrice: "50" },
      { name: "3-Seater Sofa", sku: "3SEATERS-DIS-DISP", category: "Sofas", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "AV Rack or Media Rack", sku: "AVRACKOR-DISPOSE", category: "Entertainment", serviceType: "dispose", basePrice: "50" },
      { name: "AV Rack or Media Rack", sku: "AVRACKOR-DIS-DISP", category: "Entertainment", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Adjustable Weight Bench", sku: "ADJUSTAB-DISPOSE", category: "Gym Equipment", serviceType: "dispose", basePrice: "30" },
      { name: "Adjustable Weight Bench", sku: "ADJUSTAB-DIS-DISP", category: "Gym Equipment", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "BBQ Grill or Outdoor Cooker", sku: "BBQGRILL-DISPOSE", category: "Outdoor", serviceType: "dispose", basePrice: "40" },
      { name: "BBQ Grill or Outdoor Cooker", sku: "BBQGRILL-DIS-DISP", category: "Outdoor", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Baby Crib / Cot", sku: "BABYCRIB-DISPOSE", category: "Kids", serviceType: "dispose", basePrice: "40" },
      { name: "Baby Crib / Cot", sku: "BABYCRIB-DIS-DISP", category: "Kids", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Baby Safety Gate", sku: "BABYSAFE-DISPOSE", category: "Baby & Kids", serviceType: "dispose", basePrice: "30" },
      { name: "Baby Safety Gate", sku: "BABYSAFE-DIS-DISP", category: "Baby & Kids", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "Bar Cabinet / Wine Rack", sku: "BARCABIN-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "40" },
      { name: "Bar Cabinet / Wine Rack", sku: "BARCABIN-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "70" },
      { name: "Bar Counter / Dry Bar Unit", sku: "BARCOUNT-DISPOSE", category: "Kitchen", serviceType: "dispose", basePrice: "65" },
      { name: "Bar Counter / Dry Bar Unit", sku: "BARCOUNT-DIS-DISP", category: "Kitchen", serviceType: "dismantle_dispose", basePrice: "110" },
      { name: "Bar Stool / Counter Stool", sku: "BARSTOOL-DISPOSE", category: "Dining", serviceType: "dispose", basePrice: "30" },
      { name: "Bar Stool / Counter Stool", sku: "BARSTOOL-DIS-DISP", category: "Dining", serviceType: "dismantle_dispose", basePrice: "30" },
      { name: "Bathroom Mirror Cabinet", sku: "BATHROOM-DISPOSE", category: "Bathroom", serviceType: "dispose", basePrice: "35" },
      { name: "Bathroom Mirror Cabinet", sku: "BATHROOM-DIS-DISP", category: "Bathroom", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Bathroom Shelving or Towel Rack", sku: "BATHROOM-DISPOSE", category: "Bathroom", serviceType: "dispose", basePrice: "30" },
      { name: "Bathroom Shelving or Towel Rack", sku: "BATHROOM-DIS-DISP", category: "Bathroom", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Bathroom Vanity Unit (freestanding)", sku: "BATHROOM-DISPOSE", category: "Bathroom", serviceType: "dispose", basePrice: "50" },
      { name: "Bathroom Vanity Unit (freestanding)", sku: "BATHROOM-DIS-DISP", category: "Bathroom", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Bedroom Ottoman or End-of-Bed Bench", sku: "BEDROOMO-DISPOSE", category: "Bedroom", serviceType: "dispose", basePrice: "30" },
      { name: "Bedroom Ottoman or End-of-Bed Bench", sku: "BEDROOMO-DIS-DISP", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Bedside Table", sku: "BEDSIDET-DISPOSE", category: "Bedroom", serviceType: "dispose", basePrice: "30" },
      { name: "Bedside Table", sku: "BEDSIDET-DIS-DISP", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Bookcase (floor-to-ceiling)", sku: "BOOKCASE-DISPOSE", category: "Study", serviceType: "dispose", basePrice: "50" },
      { name: "Bookcase (floor-to-ceiling)", sku: "BOOKCASE-DIS-DISP", category: "Study", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Bookshelf", sku: "BOOKSHEL-DISPOSE", category: "Storage", serviceType: "dispose", basePrice: "40" },
      { name: "Bookshelf", sku: "BOOKSHEL-DIS-DISP", category: "Storage", serviceType: "dismantle_dispose", basePrice: "70" },
      { name: "Bunk Bed (Standard)", sku: "BUNKBEDS-DISPOSE", category: "Beds", serviceType: "dispose", basePrice: "100" },
      { name: "Bunk Bed (Standard)", sku: "BUNKBEDS-DIS-DISP", category: "Beds", serviceType: "dismantle_dispose", basePrice: "155" },
      { name: "Bunk Bed (with Trundle)", sku: "BUNKBEDW-DISPOSE", category: "Beds", serviceType: "dispose", basePrice: "125" },
      { name: "Bunk Bed (with Trundle)", sku: "BUNKBEDW-DIS-DISP", category: "Beds", serviceType: "dismantle_dispose", basePrice: "210" },
      { name: "Chaise Lounge", sku: "CHAISELO-DISPOSE", category: "Sofas", serviceType: "dispose", basePrice: "45" },
      { name: "Chaise Lounge", sku: "CHAISELO-DIS-DISP", category: "Sofas", serviceType: "dismantle_dispose", basePrice: "80" },
      { name: "Changing Table / Baby Dresser", sku: "CHANGING-DISPOSE", category: "Kids", serviceType: "dispose", basePrice: "35" },
      { name: "Changing Table / Baby Dresser", sku: "CHANGING-DIS-DISP", category: "Kids", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Chest of Drawers (3-drawer)", sku: "CHESTOFD-DISPOSE", category: "Bedroom", serviceType: "dispose", basePrice: "35" },
      { name: "Chest of Drawers (3-drawer)", sku: "CHESTOFD-DIS-DISP", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Chest of Drawers (5-drawer)", sku: "CHESTOFD-DISPOSE", category: "Bedroom", serviceType: "dispose", basePrice: "45" },
      { name: "Chest of Drawers (5-drawer)", sku: "CHESTOFD-DIS-DISP", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "75" },
      { name: "China Cabinet / Display Hutch", sku: "CHINACAB-DISPOSE", category: "Dining", serviceType: "dispose", basePrice: "50" },
      { name: "China Cabinet / Display Hutch", sku: "CHINACAB-DIS-DISP", category: "Dining", serviceType: "dismantle_dispose", basePrice: "95" },
      { name: "Coffee Table", sku: "COFFEETA-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "30" },
      { name: "Coffee Table", sku: "COFFEETA-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "Conference Table", sku: "CONFEREN-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "100" },
      { name: "Conference Table", sku: "CONFEREN-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "175" },
      { name: "Console / Hallway Table", sku: "CONSOLEH-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "30" },
      { name: "Console / Hallway Table", sku: "CONSOLEH-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "50" },
      { name: "Corner Study Desk or L-Shaped", sku: "CORNERST-DISPOSE", category: "Study", serviceType: "dispose", basePrice: "40" },
      { name: "Corner Study Desk or L-Shaped", sku: "CORNERST-DIS-DISP", category: "Study", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Credenza / Office Storage Cabinet", sku: "CREDENZA-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "50" },
      { name: "Credenza / Office Storage Cabinet", sku: "CREDENZA-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Curtain Track / Rod Installation", sku: "CURTAINT-DISPOSE", category: "Wall-Mounted", serviceType: "dispose", basePrice: "35" },
      { name: "Curtain Track / Rod Installation", sku: "CURTAINT-DIS-DISP", category: "Wall-Mounted", serviceType: "dismantle_dispose", basePrice: "50" },
      { name: "Custom/Built-in Wardrobe", sku: "CUSTOMBU-DISPOSE", category: "Wardrobes", serviceType: "dispose", basePrice: "165" },
      { name: "Custom/Built-in Wardrobe", sku: "CUSTOMBU-DIS-DISP", category: "Wardrobes", serviceType: "dismantle_dispose", basePrice: "270" },
      { name: "Day and Night or Zebra Blind (per window)", sku: "DAYANDNI-DISPOSE", category: "Curtains & Blinds", serviceType: "dispose", basePrice: "40" },
      { name: "Day and Night or Zebra Blind (per window)", sku: "DAYANDNI-DIS-DISP", category: "Curtains & Blinds", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Desk Privacy Screen or Modesty Panel", sku: "DESKPRIV-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "30" },
      { name: "Desk Privacy Screen or Modesty Panel", sku: "DESKPRIV-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Digital Piano or Stage Piano", sku: "DIGITALP-DISPOSE", category: "Musical Instruments", serviceType: "dispose", basePrice: "35" },
      { name: "Digital Piano or Stage Piano", sku: "DIGITALP-DIS-DISP", category: "Musical Instruments", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Dining Chair", sku: "DININGCH-DISPOSE", category: "Dining", serviceType: "dispose", basePrice: "30" },
      { name: "Dining Chair", sku: "DININGCH-DIS-DISP", category: "Dining", serviceType: "dismantle_dispose", basePrice: "30" },
      { name: "Dining Table", sku: "DININGTA-DISPOSE", category: "Dining", serviceType: "dispose", basePrice: "50" },
      { name: "Dining Table", sku: "DININGTA-DIS-DISP", category: "Dining", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Dishwasher", sku: "DISHWASH-DISPOSE", category: "Appliances", serviceType: "dispose", basePrice: "45" },
      { name: "Dishwasher", sku: "DISHWASH-DIS-DISP", category: "Appliances", serviceType: "dismantle_dispose", basePrice: "75" },
      { name: "Display Cabinet", sku: "DISPLAYC-DISPOSE", category: "Storage", serviceType: "dispose", basePrice: "50" },
      { name: "Display Cabinet", sku: "DISPLAYC-DIS-DISP", category: "Storage", serviceType: "dismantle_dispose", basePrice: "95" },
      { name: "Drawer Chest (5+ drawers)", sku: "DRAWERCH-DISPOSE", category: "Storage", serviceType: "dispose", basePrice: "40" },
      { name: "Drawer Chest (5+ drawers)", sku: "DRAWERCH-DIS-DISP", category: "Storage", serviceType: "dismantle_dispose", basePrice: "70" },
      { name: "Dressing Table", sku: "DRESSING-DISPOSE", category: "Bedroom", serviceType: "dispose", basePrice: "40" },
      { name: "Dressing Table", sku: "DRESSING-DIS-DISP", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Dryer / Washer-Dryer Combo", sku: "DRYERWAS-DISPOSE", category: "Appliances", serviceType: "dispose", basePrice: "40" },
      { name: "Dryer / Washer-Dryer Combo", sku: "DRYERWAS-DIS-DISP", category: "Appliances", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Dumbbell Rack / Weight Storage", sku: "DUMBBELL-DISPOSE", category: "Gym Equipment", serviceType: "dispose", basePrice: "40" },
      { name: "Dumbbell Rack / Weight Storage", sku: "DUMBBELL-DIS-DISP", category: "Gym Equipment", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Duo Phone Booth (2-Person)", sku: "DUOPHONE-DISPOSE", category: "Meeting Pods & Phone Booths", serviceType: "dispose", basePrice: "230" },
      { name: "Duo Phone Booth (2-Person)", sku: "DUOPHONE-DIS-DISP", category: "Meeting Pods & Phone Booths", serviceType: "dismantle_dispose", basePrice: "375" },
      { name: "Electric or Decorative Fireplace Unit", sku: "ELECTRIC-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "65" },
      { name: "Electric or Decorative Fireplace Unit", sku: "ELECTRIC-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "105" },
      { name: "Electronic Keyboard with Stand", sku: "ELECTRON-DISPOSE", category: "Musical Instruments", serviceType: "dispose", basePrice: "30" },
      { name: "Electronic Keyboard with Stand", sku: "ELECTRON-DIS-DISP", category: "Musical Instruments", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Elliptical Machine", sku: "ELLIPTIC-DISPOSE", category: "Gym Equipment", serviceType: "dispose", basePrice: "50" },
      { name: "Elliptical Machine", sku: "ELLIPTIC-DIS-DISP", category: "Gym Equipment", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Entertainment Feature Wall Unit", sku: "ENTERTAI-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "80" },
      { name: "Entertainment Feature Wall Unit", sku: "ENTERTAI-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "135" },
      { name: "Exercise / Spin Bike", sku: "EXERCISE-DISPOSE", category: "Gym Equipment", serviceType: "dispose", basePrice: "35" },
      { name: "Exercise / Spin Bike", sku: "EXERCISE-DIS-DISP", category: "Gym Equipment", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Extendable Dining Table", sku: "EXTENDAB-DISPOSE", category: "Dining", serviceType: "dispose", basePrice: "60" },
      { name: "Extendable Dining Table", sku: "EXTENDAB-DIS-DISP", category: "Dining", serviceType: "dismantle_dispose", basePrice: "105" },
      { name: "Filing Cabinet", sku: "FILINGCA-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "35" },
      { name: "Filing Cabinet", sku: "FILINGCA-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "60" },
    ]);
    await db.insert(catalogItems).values([
      { name: "Floating Shelf (per unit)", sku: "FLOATING-DISPOSE", category: "Wall-Mounted", serviceType: "dispose", basePrice: "30" },
      { name: "Floating Shelf (per unit)", sku: "FLOATING-DIS-DISP", category: "Wall-Mounted", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "Foosball / Game Table", sku: "FOOSBALL-DISPOSE", category: "Specialty", serviceType: "dispose", basePrice: "50" },
      { name: "Foosball / Game Table", sku: "FOOSBALL-DIS-DISP", category: "Specialty", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Freestanding Acoustic Booth", sku: "FREESTAN-DISPOSE", category: "Meeting Pods & Phone Booths", serviceType: "dispose", basePrice: "195" },
      { name: "Freestanding Acoustic Booth", sku: "FREESTAN-DIS-DISP", category: "Meeting Pods & Phone Booths", serviceType: "dismantle_dispose", basePrice: "305" },
      { name: "Full-Length Mirror", sku: "FULLLENG-DISPOSE", category: "Wall-Mounted", serviceType: "dispose", basePrice: "35" },
      { name: "Full-Length Mirror", sku: "FULLLENG-DIS-DISP", category: "Wall-Mounted", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "Gallery Wall (5 to 10 frames)", sku: "GALLERYW-DISPOSE", category: "Wall Decor", serviceType: "dispose", basePrice: "80" },
      { name: "Gaming Cabinet or PC Desk Setup", sku: "GAMINGCA-DISPOSE", category: "Entertainment", serviceType: "dispose", basePrice: "50" },
      { name: "Gaming Cabinet or PC Desk Setup", sku: "GAMINGCA-DIS-DISP", category: "Entertainment", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Garden / Patio Furniture Set", sku: "GARDENPA-DISPOSE", category: "Outdoor", serviceType: "dispose", basePrice: "45" },
      { name: "Garden / Patio Furniture Set", sku: "GARDENPA-DIS-DISP", category: "Outdoor", serviceType: "dismantle_dispose", basePrice: "80" },
      { name: "HDB Bomb Shelter Shelving", sku: "HDBBOMBS-DISPOSE", category: "Singapore-Specific", serviceType: "dispose", basePrice: "80" },
      { name: "HDB Bomb Shelter Shelving", sku: "HDBBOMBS-DIS-DISP", category: "Singapore-Specific", serviceType: "dismantle_dispose", basePrice: "125" },
      { name: "Hallway Bench or Entryway Bench", sku: "HALLWAYB-DISPOSE", category: "Foyer & Hallway", serviceType: "dispose", basePrice: "30" },
      { name: "Hallway Bench or Entryway Bench", sku: "HALLWAYB-DIS-DISP", category: "Foyer & Hallway", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "Hallway Mirror and Console Set", sku: "HALLWAYM-DISPOSE", category: "Foyer & Hallway", serviceType: "dispose", basePrice: "50" },
      { name: "Hallway Mirror and Console Set", sku: "HALLWAYM-DIS-DISP", category: "Foyer & Hallway", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Hanging Swing Chair or Hammock Chair", sku: "HANGINGS-DISPOSE", category: "Rattan & Cane", serviceType: "dispose", basePrice: "50" },
      { name: "Hanging Swing Chair or Hammock Chair", sku: "HANGINGS-DIS-DISP", category: "Rattan & Cane", serviceType: "dismantle_dispose", basePrice: "80" },
      { name: "Headboard (wall-mounted)", sku: "HEADBOAR-DISPOSE", category: "Bedroom", serviceType: "dispose", basePrice: "40" },
      { name: "Headboard (wall-mounted)", sku: "HEADBOAR-DIS-DISP", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Heavy-Duty Workbench or Workshop Table", sku: "HEAVYDUT-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "65" },
      { name: "Heavy-Duty Workbench or Workshop Table", sku: "HEAVYDUT-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "100" },
      { name: "Height-Adjustable Sit-Stand Desk", sku: "HEIGHTAD-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "40" },
      { name: "Height-Adjustable Sit-Stand Desk", sku: "HEIGHTAD-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "High Chair", sku: "HIGHCHAI-DISPOSE", category: "Baby & Kids", serviceType: "dispose", basePrice: "30" },
      { name: "High Chair", sku: "HIGHCHAI-DIS-DISP", category: "Baby & Kids", serviceType: "dismantle_dispose", basePrice: "35" },
      { name: "Hinged Door Wardrobe (2-door)", sku: "HINGEDDO-DISPOSE", category: "Wardrobes", serviceType: "dispose", basePrice: "65" },
      { name: "Hinged Door Wardrobe (2-door)", sku: "HINGEDDO-DIS-DISP", category: "Wardrobes", serviceType: "dismantle_dispose", basePrice: "110" },
      { name: "Hinged Door Wardrobe (4-door)", sku: "HINGEDDO-DISPOSE", category: "Wardrobes", serviceType: "dispose", basePrice: "100" },
      { name: "Hinged Door Wardrobe (4-door)", sku: "HINGEDDO-DIS-DISP", category: "Wardrobes", serviceType: "dismantle_dispose", basePrice: "165" },
      { name: "Hydraulic Storage Bed (King)", sku: "HYDRAULI-DISPOSE", category: "Beds", serviceType: "dispose", basePrice: "130" },
      { name: "Hydraulic Storage Bed (King)", sku: "HYDRAULI-DIS-DISP", category: "Beds", serviceType: "dismantle_dispose", basePrice: "210" },
      { name: "Hydraulic Storage Bed (Queen)", sku: "HYDRAULI-DISPOSE", category: "Beds", serviceType: "dispose", basePrice: "110" },
      { name: "Hydraulic Storage Bed (Queen)", sku: "HYDRAULI-DIS-DISP", category: "Beds", serviceType: "dismantle_dispose", basePrice: "180" },
      { name: "IKEA Alex Drawer Unit", sku: "IKEAALEX-DISPOSE", category: "IKEA Storage", serviceType: "dispose", basePrice: "30" },
      { name: "IKEA Alex Drawer Unit", sku: "IKEAALEX-DIS-DISP", category: "IKEA Storage", serviceType: "dismantle_dispose", basePrice: "50" },
      { name: "IKEA Besta TV Unit", sku: "IKEABEST-DISPOSE", category: "IKEA Living Room", serviceType: "dispose", basePrice: "45" },
      { name: "IKEA Besta TV Unit", sku: "IKEABEST-DIS-DISP", category: "IKEA Living Room", serviceType: "dismantle_dispose", basePrice: "80" },
      { name: "IKEA Billy Bookcase", sku: "IKEABILL-DISPOSE", category: "IKEA Shelving", serviceType: "dispose", basePrice: "30" },
      { name: "IKEA Billy Bookcase", sku: "IKEABILL-DIS-DISP", category: "IKEA Shelving", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "IKEA Billy Bookcase with Extension", sku: "IKEABILL-DISPOSE", category: "IKEA Shelving", serviceType: "dispose", basePrice: "35" },
      { name: "IKEA Billy Bookcase with Extension", sku: "IKEABILL-DIS-DISP", category: "IKEA Shelving", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "IKEA GODMORGON Mirror Cabinet", sku: "IKEAGODM-DISPOSE", category: "Bathroom", serviceType: "dispose", basePrice: "45" },
      { name: "IKEA GODMORGON Mirror Cabinet", sku: "IKEAGODM-DIS-DISP", category: "Bathroom", serviceType: "dismantle_dispose", basePrice: "70" },
      { name: "IKEA HEMNES Mirror Cabinet", sku: "IKEAHEMN-DISPOSE", category: "Bathroom", serviceType: "dispose", basePrice: "50" },
      { name: "IKEA HEMNES Mirror Cabinet", sku: "IKEAHEMN-DIS-DISP", category: "Bathroom", serviceType: "dismantle_dispose", basePrice: "85" },
      { name: "IKEA Hemnes Bed Frame (Double)", sku: "IKEAHEMN-DISPOSE", category: "IKEA Beds", serviceType: "dispose", basePrice: "60" },
      { name: "IKEA Hemnes Bed Frame (Double)", sku: "IKEAHEMN-DIS-DISP", category: "IKEA Beds", serviceType: "dismantle_dispose", basePrice: "105" },
      { name: "IKEA Hemnes Bed Frame (Queen)", sku: "IKEAHEMN-DISPOSE", category: "IKEA Beds", serviceType: "dispose", basePrice: "65" },
      { name: "IKEA Hemnes Bed Frame (Queen)", sku: "IKEAHEMN-DIS-DISP", category: "IKEA Beds", serviceType: "dismantle_dispose", basePrice: "115" },
      { name: "IKEA Hemnes Wardrobe (3-door)", sku: "IKEAHEMN-DISPOSE", category: "IKEA Wardrobes", serviceType: "dispose", basePrice: "80" },
      { name: "IKEA Hemnes Wardrobe (3-door)", sku: "IKEAHEMN-DIS-DISP", category: "IKEA Wardrobes", serviceType: "dismantle_dispose", basePrice: "135" },
      { name: "IKEA Ivar Shelving Unit", sku: "IKEAIVAR-DISPOSE", category: "IKEA Shelving", serviceType: "dispose", basePrice: "35" },
      { name: "IKEA Ivar Shelving Unit", sku: "IKEAIVAR-DIS-DISP", category: "IKEA Shelving", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "IKEA Kallax Shelf Unit (2×2)", sku: "IKEAKALL-DISPOSE", category: "IKEA Shelving", serviceType: "dispose", basePrice: "30" },
      { name: "IKEA Kallax Shelf Unit (2×2)", sku: "IKEAKALL-DIS-DISP", category: "IKEA Shelving", serviceType: "dismantle_dispose", basePrice: "50" },
      { name: "IKEA Kallax Shelf Unit (4×4)", sku: "IKEAKALL-DISPOSE", category: "IKEA Shelving", serviceType: "dispose", basePrice: "40" },
      { name: "IKEA Kallax Shelf Unit (4×4)", sku: "IKEAKALL-DIS-DISP", category: "IKEA Shelving", serviceType: "dismantle_dispose", basePrice: "70" },
      { name: "IKEA Kivik Sofa (3-seat)", sku: "IKEAKIVI-DISPOSE", category: "IKEA Living Room", serviceType: "dispose", basePrice: "45" },
      { name: "IKEA Kivik Sofa (3-seat)", sku: "IKEAKIVI-DIS-DISP", category: "IKEA Living Room", serviceType: "dismantle_dispose", basePrice: "80" },
      { name: "IKEA Kleppstad Wardrobe (2-door)", sku: "IKEAKLEP-DISPOSE", category: "IKEA Wardrobes", serviceType: "dispose", basePrice: "50" },
      { name: "IKEA Kleppstad Wardrobe (2-door)", sku: "IKEAKLEP-DIS-DISP", category: "IKEA Wardrobes", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "IKEA LILLÅNGEN Mirror Cabinet", sku: "IKEALILL-DISPOSE", category: "Bathroom", serviceType: "dispose", basePrice: "40" },
      { name: "IKEA LILLÅNGEN Mirror Cabinet", sku: "IKEALILL-DIS-DISP", category: "Bathroom", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "IKEA Lack TV Bench", sku: "IKEALACK-DISPOSE", category: "IKEA Living Room", serviceType: "dispose", basePrice: "30" },
      { name: "IKEA Lack TV Bench", sku: "IKEALACK-DIS-DISP", category: "IKEA Living Room", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "IKEA Malm Bed Frame (Double)", sku: "IKEAMALM-DISPOSE", category: "IKEA Beds", serviceType: "dispose", basePrice: "60" },
      { name: "IKEA Malm Bed Frame (Double)", sku: "IKEAMALM-DIS-DISP", category: "IKEA Beds", serviceType: "dismantle_dispose", basePrice: "105" },
      { name: "IKEA Malm Bed Frame (Queen/King)", sku: "IKEAMALM-DISPOSE", category: "IKEA Beds", serviceType: "dispose", basePrice: "70" },
      { name: "IKEA Malm Bed Frame (Queen/King)", sku: "IKEAMALM-DIS-DISP", category: "IKEA Beds", serviceType: "dismantle_dispose", basePrice: "125" },
      { name: "IKEA Malm Chest of Drawers (3-drawer)", sku: "IKEAMALM-DISPOSE", category: "IKEA Bedroom", serviceType: "dispose", basePrice: "30" },
      { name: "IKEA Malm Chest of Drawers (3-drawer)", sku: "IKEAMALM-DIS-DISP", category: "IKEA Bedroom", serviceType: "dismantle_dispose", basePrice: "50" },
      { name: "IKEA Malm Chest of Drawers (6-drawer)", sku: "IKEAMALM-DISPOSE", category: "IKEA Bedroom", serviceType: "dispose", basePrice: "40" },
      { name: "IKEA Malm Chest of Drawers (6-drawer)", sku: "IKEAMALM-DIS-DISP", category: "IKEA Bedroom", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "IKEA Micke Desk", sku: "IKEAMICK-DISPOSE", category: "IKEA Study", serviceType: "dispose", basePrice: "30" },
      { name: "IKEA Micke Desk", sku: "IKEAMICK-DIS-DISP", category: "IKEA Study", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "IKEA Poäng Armchair", sku: "IKEAPONG-DISPOSE", category: "IKEA Living Room", serviceType: "dispose", basePrice: "30" },
      { name: "IKEA Poäng Armchair", sku: "IKEAPONG-DIS-DISP", category: "IKEA Living Room", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "IKEA Stuva Storage Combo (Kids)", sku: "IKEASTUV-DISPOSE", category: "Kids", serviceType: "dispose", basePrice: "60" },
      { name: "IKEA Stuva Storage Combo (Kids)", sku: "IKEASTUV-DIS-DISP", category: "Kids", serviceType: "dismantle_dispose", basePrice: "100" },
      { name: "IKEA Trofast Storage System", sku: "IKEATROF-DISPOSE", category: "IKEA Storage", serviceType: "dispose", basePrice: "30" },
      { name: "IKEA Trofast Storage System", sku: "IKEATROF-DIS-DISP", category: "IKEA Storage", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "IKEA Vittsjo Laptop Stand/Shelf", sku: "IKEAVITT-DISPOSE", category: "IKEA Study", serviceType: "dispose", basePrice: "30" },
      { name: "IKEA Vittsjo Laptop Stand/Shelf", sku: "IKEAVITT-DIS-DISP", category: "IKEA Study", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Indoor Hammock or Hammock Chair", sku: "INDOORHA-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "45" },
      { name: "Indoor Hammock or Hammock Chair", sku: "INDOORHA-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "75" },
      { name: "Indoor Plant Stand or Pot Stand", sku: "INDOORPL-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "30" },
      { name: "Indoor Plant Stand or Pot Stand", sku: "INDOORPL-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "30" },
      { name: "Kids Slide or Climber (indoor)", sku: "KIDSSLID-DISPOSE", category: "Baby & Kids", serviceType: "dispose", basePrice: "45" },
      { name: "Kids Slide or Climber (indoor)", sku: "KIDSSLID-DIS-DISP", category: "Baby & Kids", serviceType: "dismantle_dispose", basePrice: "75" },
      { name: "Kids Study Desk with Hutch", sku: "KIDSSTUD-DISPOSE", category: "Kids", serviceType: "dispose", basePrice: "45" },
      { name: "Kids Study Desk with Hutch", sku: "KIDSSTUD-DIS-DISP", category: "Kids", serviceType: "dismantle_dispose", basePrice: "75" },
      { name: "Kids Trampoline (indoor)", sku: "KIDSTRAM-DISPOSE", category: "Baby & Kids", serviceType: "dispose", basePrice: "40" },
      { name: "Kids Trampoline (indoor)", sku: "KIDSTRAM-DIS-DISP", category: "Baby & Kids", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Kids Wardrobe (2-door)", sku: "KIDSWARD-DISPOSE", category: "Kids", serviceType: "dispose", basePrice: "65" },
      { name: "Kids Wardrobe (2-door)", sku: "KIDSWARD-DIS-DISP", category: "Kids", serviceType: "dismantle_dispose", basePrice: "110" },
      { name: "King Bed Frame", sku: "KINGBEDF-DISPOSE", category: "Beds", serviceType: "dispose", basePrice: "65" },
    ]);
    await db.insert(catalogItems).values([
      { name: "King Bed Frame", sku: "KINGBEDF-DIS-DISP", category: "Beds", serviceType: "dismantle_dispose", basePrice: "115" },
      { name: "Kitchen Hutch / Pantry Cabinet", sku: "KITCHENH-DISPOSE", category: "Kitchen", serviceType: "dispose", basePrice: "50" },
      { name: "Kitchen Hutch / Pantry Cabinet", sku: "KITCHENH-DIS-DISP", category: "Kitchen", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Kitchen Island / Breakfast Bar", sku: "KITCHENI-DISPOSE", category: "Kitchen", serviceType: "dispose", basePrice: "50" },
      { name: "Kitchen Island / Breakfast Bar", sku: "KITCHENI-DIS-DISP", category: "Kitchen", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Kitchen Trolley / Cart", sku: "KITCHENT-DISPOSE", category: "Kitchen", serviceType: "dispose", basePrice: "30" },
      { name: "Kitchen Trolley / Cart", sku: "KITCHENT-DIS-DISP", category: "Kitchen", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "L-Shaped / Corner Sofa", sku: "LSHAPEDC-DISPOSE", category: "Sofas", serviceType: "dispose", basePrice: "65" },
      { name: "L-Shaped / Corner Sofa", sku: "LSHAPEDC-DIS-DISP", category: "Sofas", serviceType: "dismantle_dispose", basePrice: "110" },
      { name: "L-Shaped Executive Desk", sku: "LSHAPEDE-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "50" },
      { name: "L-Shaped Executive Desk", sku: "LSHAPEDE-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "80" },
      { name: "Large Meeting Pod (8-Person)", sku: "LARGEMEE-DISPOSE", category: "Meeting Pods & Phone Booths", serviceType: "dispose", basePrice: "620" },
      { name: "Large Meeting Pod (8-Person)", sku: "LARGEMEE-DIS-DISP", category: "Meeting Pods & Phone Booths", serviceType: "dismantle_dispose", basePrice: "1040" },
      { name: "Large Planter Box or Garden Bed", sku: "LARGEPLA-DISPOSE", category: "Outdoor", serviceType: "dispose", basePrice: "35" },
      { name: "Large Planter Box or Garden Bed", sku: "LARGEPLA-DIS-DISP", category: "Outdoor", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "Lateral File Cabinet (2-drawer)", sku: "LATERALF-DISPOSE", category: "Study", serviceType: "dispose", basePrice: "35" },
      { name: "Lateral File Cabinet (2-drawer)", sku: "LATERALF-DIS-DISP", category: "Study", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Laundry / Utility Area Cabinet", sku: "LAUNDRYU-DISPOSE", category: "Singapore-Specific", serviceType: "dispose", basePrice: "50" },
      { name: "Laundry / Utility Area Cabinet", sku: "LAUNDRYU-DIS-DISP", category: "Singapore-Specific", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Locker Unit (Staff / School)", sku: "LOCKERUN-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "35" },
      { name: "Locker Unit (Staff / School)", sku: "LOCKERUN-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Loft Bed with Desk", sku: "LOFTBEDW-DISPOSE", category: "Beds", serviceType: "dispose", basePrice: "130" },
      { name: "Loft Bed with Desk", sku: "LOFTBEDW-DIS-DISP", category: "Beds", serviceType: "dismantle_dispose", basePrice: "220" },
      { name: "Massage Chair", sku: "MASSAGEC-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "50" },
      { name: "Massage Chair", sku: "MASSAGEC-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Meeting Pod (4-Person)", sku: "MEETINGP-DISPOSE", category: "Meeting Pods & Phone Booths", serviceType: "dispose", basePrice: "360" },
      { name: "Meeting Pod (4-Person)", sku: "MEETINGP-DIS-DISP", category: "Meeting Pods & Phone Booths", serviceType: "dismantle_dispose", basePrice: "580" },
      { name: "Meeting Room Pod (6-Person)", sku: "MEETINGR-DISPOSE", category: "Meeting Pods & Phone Booths", serviceType: "dispose", basePrice: "490" },
      { name: "Meeting Room Pod (6-Person)", sku: "MEETINGR-DIS-DISP", category: "Meeting Pods & Phone Booths", serviceType: "dismantle_dispose", basePrice: "820" },
      { name: "Mirror Installation", sku: "MIRRORIN-DISPOSE", category: "Others", serviceType: "dispose", basePrice: "35" },
      { name: "Modular Pod Panel (per panel)", sku: "MODULARP-DISPOSE", category: "Meeting Pods & Phone Booths", serviceType: "dispose", basePrice: "50" },
      { name: "Modular Pod Panel (per panel)", sku: "MODULARP-DIS-DISP", category: "Meeting Pods & Phone Booths", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Monitor Arm / Desk Mount", sku: "MONITORA-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "30" },
      { name: "Monitor Arm / Desk Mount", sku: "MONITORA-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Motorised Blind or Curtain Track", sku: "MOTORISE-DISPOSE", category: "Curtains & Blinds", serviceType: "dispose", basePrice: "80" },
      { name: "Motorised Blind or Curtain Track", sku: "MOTORISE-DIS-DISP", category: "Curtains & Blinds", serviceType: "dismantle_dispose", basePrice: "125" },
      { name: "Multi-Station Home Gym", sku: "MULTISTA-DISPOSE", category: "Gym Equipment", serviceType: "dispose", basePrice: "130" },
      { name: "Multi-Station Home Gym", sku: "MULTISTA-DIS-DISP", category: "Gym Equipment", serviceType: "dismantle_dispose", basePrice: "220" },
      { name: "Murphy / Wall Bed", sku: "MURPHYWA-DISPOSE", category: "Beds", serviceType: "dispose", basePrice: "260" },
      { name: "Murphy / Wall Bed", sku: "MURPHYWA-DIS-DISP", category: "Beds", serviceType: "dismantle_dispose", basePrice: "425" },
      { name: "Nesting Tables (set of 2 or 3)", sku: "NESTINGT-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "30" },
      { name: "Nesting Tables (set of 2 or 3)", sku: "NESTINGT-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Office Panel / Partition", sku: "OFFICEPA-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "40" },
      { name: "Office Panel / Partition", sku: "OFFICEPA-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Office or Reception Sofa (2-seater)", sku: "OFFICEOR-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "45" },
      { name: "Office or Reception Sofa (2-seater)", sku: "OFFICEOR-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "80" },
      { name: "Ottoman Storage Bed (King)", sku: "OTTOMANS-DISPOSE", category: "Bedroom", serviceType: "dispose", basePrice: "105" },
      { name: "Ottoman Storage Bed (King)", sku: "OTTOMANS-DIS-DISP", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "170" },
      { name: "Ottoman Storage Bed (Queen)", sku: "OTTOMANS-DISPOSE", category: "Bedroom", serviceType: "dispose", basePrice: "85" },
      { name: "Ottoman Storage Bed (Queen)", sku: "OTTOMANS-DIS-DISP", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "135" },
      { name: "Outdoor Bench", sku: "OUTDOORB-DISPOSE", category: "Outdoor", serviceType: "dispose", basePrice: "30" },
      { name: "Outdoor Bench", sku: "OUTDOORB-DIS-DISP", category: "Outdoor", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "Outdoor Storage Deck Box or Garden Shed", sku: "OUTDOORS-DISPOSE", category: "Outdoor", serviceType: "dispose", basePrice: "50" },
      { name: "Outdoor Storage Deck Box or Garden Shed", sku: "OUTDOORS-DIS-DISP", category: "Outdoor", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Outdoor Swing or Playset", sku: "OUTDOORS-DISPOSE", category: "Outdoor", serviceType: "dispose", basePrice: "80" },
      { name: "Outdoor Swing or Playset", sku: "OUTDOORS-DIS-DISP", category: "Outdoor", serviceType: "dismantle_dispose", basePrice: "135" },
      { name: "Over-Toilet Storage Cabinet", sku: "OVERTOIL-DISPOSE", category: "Bathroom", serviceType: "dispose", basePrice: "30" },
      { name: "Over-Toilet Storage Cabinet", sku: "OVERTOIL-DIS-DISP", category: "Bathroom", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "Patio Umbrella with Base", sku: "PATIOUMB-DISPOSE", category: "Outdoor", serviceType: "dispose", basePrice: "30" },
      { name: "Patio Umbrella with Base", sku: "PATIOUMB-DIS-DISP", category: "Outdoor", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "Pegboard / Wall Organiser", sku: "PEGBOARD-DISPOSE", category: "Wall-Mounted", serviceType: "dispose", basePrice: "30" },
      { name: "Pegboard / Wall Organiser", sku: "PEGBOARD-DIS-DISP", category: "Wall-Mounted", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Pendant Light or Chandelier Bracket", sku: "PENDANTL-DISPOSE", category: "Wall Decor", serviceType: "dispose", basePrice: "50" },
      { name: "Pendant Light or Chandelier Bracket", sku: "PENDANTL-DIS-DISP", category: "Wall Decor", serviceType: "dismantle_dispose", basePrice: "85" },
      { name: "Piano (Grand)", sku: "PIANOGRA-DISPOSE", category: "Specialty", serviceType: "dispose", basePrice: "130" },
      { name: "Piano (Upright)", sku: "PIANOUPR-DISPOSE", category: "Specialty", serviceType: "dispose", basePrice: "80" },
      { name: "Picture Frame or Artwork (large, above 120cm)", sku: "PICTUREF-DISPOSE", category: "Wall Decor", serviceType: "dispose", basePrice: "40" },
      { name: "Picture Frame or Artwork (medium, 60 to 120cm)", sku: "PICTUREF-DISPOSE", category: "Wall Decor", serviceType: "dispose", basePrice: "30" },
      { name: "Picture Frame or Artwork (small, up to 60cm)", sku: "PICTUREF-DISPOSE", category: "Wall Decor", serviceType: "dispose", basePrice: "30" },
      { name: "Platform Bed (Super Single)", sku: "PLATFORM-DISPOSE", category: "Beds", serviceType: "dispose", basePrice: "50" },
      { name: "Platform Bed (Super Single)", sku: "PLATFORM-DIS-DISP", category: "Beds", serviceType: "dismantle_dispose", basePrice: "85" },
      { name: "Playpen or Baby Playard", sku: "PLAYPENO-DISPOSE", category: "Baby & Kids", serviceType: "dispose", basePrice: "35" },
      { name: "Playpen or Baby Playard", sku: "PLAYPENO-DIS-DISP", category: "Baby & Kids", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "Pool / Billiard Table", sku: "POOLBILL-DISPOSE", category: "Specialty", serviceType: "dispose", basePrice: "230" },
      { name: "Pool / Billiard Table", sku: "POOLBILL-DIS-DISP", category: "Specialty", serviceType: "dismantle_dispose", basePrice: "375" },
      { name: "Power Rack / Squat Rack", sku: "POWERRAC-DISPOSE", category: "Gym Equipment", serviceType: "dispose", basePrice: "100" },
      { name: "Power Rack / Squat Rack", sku: "POWERRAC-DIS-DISP", category: "Gym Equipment", serviceType: "dismantle_dispose", basePrice: "155" },
      { name: "Printer Stand or Side Table", sku: "PRINTERS-DISPOSE", category: "Study", serviceType: "dispose", basePrice: "30" },
      { name: "Printer Stand or Side Table", sku: "PRINTERS-DIS-DISP", category: "Study", serviceType: "dismantle_dispose", basePrice: "35" },
      { name: "Projector Screen (ceiling or wall-mount)", sku: "PROJECTO-DISPOSE", category: "Entertainment", serviceType: "dispose", basePrice: "65" },
      { name: "Projector Screen (ceiling or wall-mount)", sku: "PROJECTO-DIS-DISP", category: "Entertainment", serviceType: "dismantle_dispose", basePrice: "105" },
      { name: "Projector Screen (freestanding)", sku: "PROJECTO-DISPOSE", category: "Entertainment", serviceType: "dispose", basePrice: "40" },
      { name: "Projector Screen (freestanding)", sku: "PROJECTO-DIS-DISP", category: "Entertainment", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Pull-Up / Wall-Mounted Gym Bar", sku: "PULLUPWA-DISPOSE", category: "Gym Equipment", serviceType: "dispose", basePrice: "45" },
      { name: "Pull-Up / Wall-Mounted Gym Bar", sku: "PULLUPWA-DIS-DISP", category: "Gym Equipment", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Queen Bed Frame", sku: "QUEENBED-DISPOSE", category: "Beds", serviceType: "dispose", basePrice: "50" },
      { name: "Queen Bed Frame", sku: "QUEENBED-DIS-DISP", category: "Beds", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Rattan Sofa or Lounge Set", sku: "RATTANSO-DISPOSE", category: "Rattan & Cane", serviceType: "dispose", basePrice: "50" },
      { name: "Rattan Sofa or Lounge Set", sku: "RATTANSO-DIS-DISP", category: "Rattan & Cane", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Rattan or Cane Chair", sku: "RATTANOR-DISPOSE", category: "Rattan & Cane", serviceType: "dispose", basePrice: "30" },
      { name: "Rattan or Cane Chair", sku: "RATTANOR-DIS-DISP", category: "Rattan & Cane", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Rattan or Wicker Dining Set", sku: "RATTANOR-DISPOSE", category: "Rattan & Cane", serviceType: "dispose", basePrice: "65" },
      { name: "Rattan or Wicker Dining Set", sku: "RATTANOR-DIS-DISP", category: "Rattan & Cane", serviceType: "dismantle_dispose", basePrice: "110" },
      { name: "Reception Counter", sku: "RECEPTIO-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "180" },
      { name: "Reception Counter", sku: "RECEPTIO-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "300" },
      { name: "Recliner Sofa (2-seater)", sku: "RECLINER-DISPOSE", category: "Sofas", serviceType: "dispose", basePrice: "45" },
      { name: "Recliner Sofa (2-seater)", sku: "RECLINER-DIS-DISP", category: "Sofas", serviceType: "dismantle_dispose", basePrice: "80" },
      { name: "Recliner Sofa (3-seater)", sku: "RECLINER-DISPOSE", category: "Sofas", serviceType: "dispose", basePrice: "60" },
      { name: "Recliner Sofa (3-seater)", sku: "RECLINER-DIS-DISP", category: "Sofas", serviceType: "dismantle_dispose", basePrice: "105" },
      { name: "Refrigerator (2-Door / Standard)", sku: "REFRIGER-DISPOSE", category: "Appliances", serviceType: "dispose", basePrice: "40" },
    ]);
    await db.insert(catalogItems).values([
      { name: "Refrigerator (2-Door / Standard)", sku: "REFRIGER-DIS-DISP", category: "Appliances", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Refrigerator (French Door / 4-Door)", sku: "REFRIGER-DISPOSE", category: "Appliances", serviceType: "dispose", basePrice: "50" },
      { name: "Refrigerator (French Door / 4-Door)", sku: "REFRIGER-DIS-DISP", category: "Appliances", serviceType: "dismantle_dispose", basePrice: "85" },
      { name: "Retractable Ceiling Clothes Rack", sku: "RETRACTA-DISPOSE", category: "Singapore-Specific", serviceType: "dispose", basePrice: "50" },
      { name: "Retractable Ceiling Clothes Rack", sku: "RETRACTA-DIS-DISP", category: "Singapore-Specific", serviceType: "dismantle_dispose", basePrice: "80" },
      { name: "Roller Blind (per window)", sku: "ROLLERBL-DISPOSE", category: "Curtains & Blinds", serviceType: "dispose", basePrice: "35" },
      { name: "Roller Blind (per window)", sku: "ROLLERBL-DIS-DISP", category: "Curtains & Blinds", serviceType: "dismantle_dispose", basePrice: "50" },
      { name: "Roman Blind (per window)", sku: "ROMANBLI-DISPOSE", category: "Curtains & Blinds", serviceType: "dispose", basePrice: "40" },
      { name: "Roman Blind (per window)", sku: "ROMANBLI-DIS-DISP", category: "Curtains & Blinds", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Rowing Machine", sku: "ROWINGMA-DISPOSE", category: "Gym Equipment", serviceType: "dispose", basePrice: "45" },
      { name: "Rowing Machine", sku: "ROWINGMA-DIS-DISP", category: "Gym Equipment", serviceType: "dismantle_dispose", basePrice: "75" },
      { name: "Safe / Gun Safe", sku: "SAFEGUNS-DISPOSE", category: "Specialty", serviceType: "dispose", basePrice: "65" },
      { name: "Safe Wall or Floor Anchoring (medium)", sku: "SAFEWALL-DISPOSE", category: "Safe & Security", serviceType: "dispose", basePrice: "65" },
      { name: "Safe Wall or Floor Anchoring (small)", sku: "SAFEWALL-DISPOSE", category: "Safe & Security", serviceType: "dispose", basePrice: "40" },
      { name: "Shoe Bench with Storage", sku: "SHOEBENC-DISPOSE", category: "Foyer & Hallway", serviceType: "dispose", basePrice: "35" },
      { name: "Shoe Bench with Storage", sku: "SHOEBENC-DIS-DISP", category: "Foyer & Hallway", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "Shoe Rack", sku: "SHOERACK-DISPOSE", category: "Storage", serviceType: "dispose", basePrice: "30" },
      { name: "Shoe Rack", sku: "SHOERACK-DIS-DISP", category: "Storage", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Side Table", sku: "SIDETABL-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "30" },
      { name: "Side Table", sku: "SIDETABL-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "35" },
      { name: "Sideboard / Buffet Cabinet", sku: "SIDEBOAR-DISPOSE", category: "Dining", serviceType: "dispose", basePrice: "45" },
      { name: "Sideboard / Buffet Cabinet", sku: "SIDEBOAR-DIS-DISP", category: "Dining", serviceType: "dismantle_dispose", basePrice: "80" },
      { name: "Single Armchair / Accent Chair", sku: "SINGLEAR-DISPOSE", category: "Sofas", serviceType: "dispose", basePrice: "30" },
      { name: "Single Armchair / Accent Chair", sku: "SINGLEAR-DIS-DISP", category: "Sofas", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Single Bed Frame", sku: "SINGLEBE-DISPOSE", category: "Beds", serviceType: "dispose", basePrice: "40" },
      { name: "Single Bed Frame", sku: "SINGLEBE-DIS-DISP", category: "Beds", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Sliding Door Wardrobe (2-door)", sku: "SLIDINGD-DISPOSE", category: "Wardrobes", serviceType: "dispose", basePrice: "80" },
      { name: "Sliding Door Wardrobe (2-door)", sku: "SLIDINGD-DIS-DISP", category: "Wardrobes", serviceType: "dismantle_dispose", basePrice: "130" },
      { name: "Sliding Door Wardrobe (3-door)", sku: "SLIDINGD-DISPOSE", category: "Wardrobes", serviceType: "dispose", basePrice: "105" },
      { name: "Sliding Door Wardrobe (3-door)", sku: "SLIDINGD-DIS-DISP", category: "Wardrobes", serviceType: "dismantle_dispose", basePrice: "170" },
      { name: "Sofa Bed / Day Bed", sku: "SOFABEDD-DISPOSE", category: "Sofas", serviceType: "dispose", basePrice: "50" },
      { name: "Sofa Bed / Day Bed", sku: "SOFABEDD-DIS-DISP", category: "Sofas", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Solo Phone Booth (1-Person)", sku: "SOLOPHON-DISPOSE", category: "Meeting Pods & Phone Booths", serviceType: "dispose", basePrice: "180" },
      { name: "Solo Phone Booth (1-Person)", sku: "SOLOPHON-DIS-DISP", category: "Meeting Pods & Phone Booths", serviceType: "dismantle_dispose", basePrice: "280" },
      { name: "Soundbar or Home Audio Setup", sku: "SOUNDBAR-DISPOSE", category: "Entertainment", serviceType: "dispose", basePrice: "35" },
      { name: "Soundbar or Home Audio Setup", sku: "SOUNDBAR-DIS-DISP", category: "Entertainment", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "Speaker Stand or Surround Sound (per unit)", sku: "SPEAKERS-DISPOSE", category: "Entertainment", serviceType: "dispose", basePrice: "30" },
      { name: "Speaker Stand or Surround Sound (per unit)", sku: "SPEAKERS-DIS-DISP", category: "Entertainment", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "Standing Kiosk / Mini Pod", sku: "STANDING-DISPOSE", category: "Meeting Pods & Phone Booths", serviceType: "dispose", basePrice: "130" },
      { name: "Standing Kiosk / Mini Pod", sku: "STANDING-DIS-DISP", category: "Meeting Pods & Phone Booths", serviceType: "dismantle_dispose", basePrice: "220" },
      { name: "Storage Ottoman or Footstool", sku: "STORAGEO-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "30" },
      { name: "Storage Ottoman or Footstool", sku: "STORAGEO-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "35" },
      { name: "Study / Computer Table", sku: "STUDYCOM-DISPOSE", category: "Bedroom", serviceType: "dispose", basePrice: "40" },
      { name: "Study / Computer Table", sku: "STUDYCOM-DIS-DISP", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Study Desk (standard)", sku: "STUDYDES-DISPOSE", category: "Study", serviceType: "dispose", basePrice: "35" },
      { name: "Study Desk (standard)", sku: "STUDYDES-DIS-DISP", category: "Study", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Sun Lounger or Deck Chair", sku: "SUNLOUNG-DISPOSE", category: "Outdoor", serviceType: "dispose", basePrice: "30" },
      { name: "Sun Lounger or Deck Chair", sku: "SUNLOUNG-DIS-DISP", category: "Outdoor", serviceType: "dismantle_dispose", basePrice: "35" },
      { name: "Swing Door Cabinet", sku: "SWINGDOO-DISPOSE", category: "Storage", serviceType: "dispose", basePrice: "40" },
      { name: "Swing Door Cabinet", sku: "SWINGDOO-DIS-DISP", category: "Storage", serviceType: "dismantle_dispose", basePrice: "70" },
      { name: "TV Console", sku: "TVCONSOL-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "40" },
      { name: "TV Console", sku: "TVCONSOL-DIS-DISP", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "70" },
      { name: "TV Wall Mounting", sku: "TVWALLMO-DISPOSE", category: "Living Room", serviceType: "dispose", basePrice: "50" },
      { name: "Tall Shoe Cabinet (5+ tiers)", sku: "TALLSHOE-DISPOSE", category: "Storage", serviceType: "dispose", basePrice: "35" },
      { name: "Tall Shoe Cabinet (5+ tiers)", sku: "TALLSHOE-DIS-DISP", category: "Storage", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "Tatami Platform Bed", sku: "TATAMIPL-DISPOSE", category: "Beds", serviceType: "dispose", basePrice: "85" },
      { name: "Tatami Platform Bed", sku: "TATAMIPL-DIS-DISP", category: "Beds", serviceType: "dismantle_dispose", basePrice: "135" },
      { name: "Toy / Play Storage Unit", sku: "TOYPLAYS-DISPOSE", category: "Kids", serviceType: "dispose", basePrice: "30" },
      { name: "Toy / Play Storage Unit", sku: "TOYPLAYS-DIS-DISP", category: "Kids", serviceType: "dismantle_dispose", basePrice: "50" },
      { name: "Training or Folding Table (per table)", sku: "TRAINING-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "30" },
      { name: "Training or Folding Table (per table)", sku: "TRAINING-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "Umbrella Stand or Coat Rack", sku: "UMBRELLA-DISPOSE", category: "Foyer & Hallway", serviceType: "dispose", basePrice: "30" },
      { name: "Upholstered Headboard Panel", sku: "UPHOLSTE-DISPOSE", category: "Bedroom", serviceType: "dispose", basePrice: "50" },
      { name: "Upholstered Headboard Panel", sku: "UPHOLSTE-DIS-DISP", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "85" },
      { name: "Vanity Stool or Dressing Stool", sku: "VANITYST-DISPOSE", category: "Bedroom", serviceType: "dispose", basePrice: "30" },
      { name: "Vanity Stool or Dressing Stool", sku: "VANITYST-DIS-DISP", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "35" },
      { name: "Venetian Blind (per window)", sku: "VENETIAN-DISPOSE", category: "Curtains & Blinds", serviceType: "dispose", basePrice: "35" },
      { name: "Venetian Blind (per window)", sku: "VENETIAN-DIS-DISP", category: "Curtains & Blinds", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "Vertical Blind (per window)", sku: "VERTICAL-DISPOSE", category: "Curtains & Blinds", serviceType: "dispose", basePrice: "35" },
      { name: "Vertical Blind (per window)", sku: "VERTICAL-DIS-DISP", category: "Curtains & Blinds", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "Walk-in Wardrobe Frame System", sku: "WALKINWA-DISPOSE", category: "Wardrobes", serviceType: "dispose", basePrice: "295" },
      { name: "Walk-in Wardrobe Frame System", sku: "WALKINWA-DIS-DISP", category: "Wardrobes", serviceType: "dismantle_dispose", basePrice: "480" },
      { name: "Wall Cabinet (single)", sku: "WALLCABI-DISPOSE", category: "Wall-Mounted", serviceType: "dispose", basePrice: "45" },
      { name: "Wall Cabinet (single)", sku: "WALLCABI-DIS-DISP", category: "Wall-Mounted", serviceType: "dismantle_dispose", basePrice: "75" },
      { name: "Wall Clock or Decorative Wall Item", sku: "WALLCLOC-DISPOSE", category: "Wall Decor", serviceType: "dispose", basePrice: "30" },
      { name: "Wall Clock or Decorative Wall Item", sku: "WALLCLOC-DIS-DISP", category: "Wall Decor", serviceType: "dismantle_dispose", basePrice: "30" },
      { name: "Wardrobe with Built-in Mirror", sku: "WARDROBE-DISPOSE", category: "Wardrobes", serviceType: "dispose", basePrice: "100" },
      { name: "Wardrobe with Built-in Mirror", sku: "WARDROBE-DIS-DISP", category: "Wardrobes", serviceType: "dismantle_dispose", basePrice: "165" },
      { name: "Washing Machine (Front Load)", sku: "WASHINGM-DISPOSE", category: "Appliances", serviceType: "dispose", basePrice: "45" },
      { name: "Washing Machine (Front Load)", sku: "WASHINGM-DIS-DISP", category: "Appliances", serviceType: "dismantle_dispose", basePrice: "75" },
      { name: "Washing Machine (Top Load)", sku: "WASHINGM-DISPOSE", category: "Appliances", serviceType: "dispose", basePrice: "40" },
      { name: "Washing Machine (Top Load)", sku: "WASHINGM-DIS-DISP", category: "Appliances", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Washroom Mirror Cabinet (Large, 60cm+)", sku: "WASHROOM-DISPOSE", category: "Bathroom", serviceType: "dispose", basePrice: "55" },
      { name: "Washroom Mirror Cabinet (Large, 60cm+)", sku: "WASHROOM-DIS-DISP", category: "Bathroom", serviceType: "dismantle_dispose", basePrice: "85" },
      { name: "Washroom Mirror Cabinet (Small, up to 60cm)", sku: "WASHROOM-DISPOSE", category: "Bathroom", serviceType: "dispose", basePrice: "40" },
      { name: "Washroom Mirror Cabinet (Small, up to 60cm)", sku: "WASHROOM-DIS-DISP", category: "Bathroom", serviceType: "dismantle_dispose", basePrice: "60" },
      { name: "Water Purifier or Dispenser", sku: "WATERPUR-DISPOSE", category: "Home Appliances", serviceType: "dispose", basePrice: "35" },
      { name: "Water Purifier or Dispenser", sku: "WATERPUR-DIS-DISP", category: "Home Appliances", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "Whiteboard or Pinboard (wall-mount)", sku: "WHITEBOA-DISPOSE", category: "Office", serviceType: "dispose", basePrice: "45" },
      { name: "Whiteboard or Pinboard (wall-mount)", sku: "WHITEBOA-DIS-DISP", category: "Office", serviceType: "dismantle_dispose", basePrice: "75" },
      { name: "Wine Cooler / Beverage Fridge", sku: "WINECOOL-DISPOSE", category: "Appliances", serviceType: "dispose", basePrice: "35" },
      { name: "Wine Cooler / Beverage Fridge", sku: "WINECOOL-DIS-DISP", category: "Appliances", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "Wine Rack / Wine Cabinet", sku: "WINERACK-DISPOSE", category: "Kitchen", serviceType: "dispose", basePrice: "30" },
      { name: "Wine Rack / Wine Cabinet", sku: "WINERACK-DIS-DISP", category: "Kitchen", serviceType: "dismantle_dispose", basePrice: "50" },
      { name: "IKEA Kitchen Trolley", sku: "IKEA-KT-DISPOSE", category: "Kitchen", serviceType: "dispose", basePrice: "40" },
      { name: "IKEA Kitchen Trolley", sku: "IKEA-KT-DIS-DISP", category: "Kitchen", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "IKEA Kitchen Island (Small)", sku: "IKEA-KI-S-DISPOSE", category: "Kitchen", serviceType: "dispose", basePrice: "100" },
      { name: "IKEA Kitchen Island (Small)", sku: "IKEA-KI-S-DIS-DISP", category: "Kitchen", serviceType: "dismantle_dispose", basePrice: "145" },
      { name: "IKEA Kitchen Island (Medium)", sku: "IKEA-KI-M-DISPOSE", category: "Kitchen", serviceType: "dispose", basePrice: "130" },
      { name: "IKEA Kitchen Island (Medium)", sku: "IKEA-KI-M-DIS-DISP", category: "Kitchen", serviceType: "dismantle_dispose", basePrice: "190" },
    ]);
    await db.insert(catalogItems).values([
      { name: "IKEA Kitchen Island (Large)", sku: "IKEA-KI-L-DISPOSE", category: "Kitchen", serviceType: "dispose", basePrice: "185" },
      { name: "IKEA Kitchen Island (Large)", sku: "IKEA-KI-L-DIS-DISP", category: "Kitchen", serviceType: "dismantle_dispose", basePrice: "265" },
      { name: "Nightstand or Bedside Table (pair)", sku: "", category: "Bedroom", serviceType: "dispose", basePrice: "40" },
      { name: "Nightstand or Bedside Table (pair)", sku: "", category: "Bedroom", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "IKEA Pax Wardrobe", sku: "", category: "IKEA Wardrobes", serviceType: "dispose", basePrice: "80" },
      { name: "IKEA Pax Wardrobe", sku: "", category: "IKEA Wardrobes", serviceType: "dismantle_dispose", basePrice: "140" },
      { name: "Ergonomic Chair", sku: "", category: "Office", serviceType: "dispose", basePrice: "30" },
      { name: "Ergonomic Chair", sku: "", category: "Office", serviceType: "dismantle_dispose", basePrice: "45" },
      { name: "Office Desk", sku: "", category: "Office", serviceType: "dispose", basePrice: "35" },
      { name: "Office Desk", sku: "", category: "Office", serviceType: "dismantle_dispose", basePrice: "65" },
      { name: "Modular Pod Panel (per panel)", sku: "", category: "Office", serviceType: "dispose", basePrice: "50" },
      { name: "Modular Pod Panel (per panel)", sku: "", category: "Office", serviceType: "dismantle_dispose", basePrice: "85" },
      { name: "Treadmill", sku: "", category: "Gym Equipment", serviceType: "dispose", basePrice: "50" },
      { name: "Treadmill", sku: "", category: "Gym Equipment", serviceType: "dismantle_dispose", basePrice: "90" },
      { name: "Umbrella Stand or Coat Rack", sku: "", category: "Foyer & Hallway", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "TV Wall Mounting", sku: "", category: "Living Room", serviceType: "dismantle_dispose", basePrice: "70" },
      { name: "Mirror Installation", sku: "", category: "Others", serviceType: "dismantle_dispose", basePrice: "50" },
      { name: "Curtain Rail or Track (per room)", sku: "", category: "Wall Decor", serviceType: "dispose", basePrice: "35" },
      { name: "Curtain Rail or Track (per room)", sku: "", category: "Wall Decor", serviceType: "dismantle_dispose", basePrice: "55" },
      { name: "Gallery Wall (5 to 10 frames)", sku: "", category: "Wall Decor", serviceType: "dismantle_dispose", basePrice: "105" },
      { name: "Gym Mat or Foam Flooring (per set)", sku: "", category: "Gym Equipment", serviceType: "dispose", basePrice: "30" },
      { name: "Gym Mat or Foam Flooring (per set)", sku: "", category: "Gym Equipment", serviceType: "dismantle_dispose", basePrice: "40" },
      { name: "IKEA Kitchen Trolley", sku: "IKEA-KT-INSTALL", category: "Kitchen", serviceType: "install", basePrice: "60" },
      { name: "IKEA Kitchen Trolley", sku: "IKEA-KT-DISMANTLE", category: "Kitchen", serviceType: "dismantle", basePrice: "35" },
      { name: "IKEA Kitchen Trolley", sku: "IKEA-KT-RELOCATE", category: "Kitchen", serviceType: "relocate", basePrice: "90" },
      { name: "IKEA Kitchen Island (Small)", sku: "IKEA-KI-S-INSTALL", category: "Kitchen", serviceType: "install", basePrice: "150" },
      { name: "IKEA Kitchen Island (Small)", sku: "IKEA-KI-S-DISMANTLE", category: "Kitchen", serviceType: "dismantle", basePrice: "90" },
      { name: "IKEA Kitchen Island (Small)", sku: "IKEA-KI-S-RELOCATE", category: "Kitchen", serviceType: "relocate", basePrice: "220" },
      { name: "IKEA Kitchen Island (Medium)", sku: "IKEA-KI-M-INSTALL", category: "Kitchen", serviceType: "install", basePrice: "200" },
      { name: "IKEA Kitchen Island (Medium)", sku: "IKEA-KI-M-DISMANTLE", category: "Kitchen", serviceType: "dismantle", basePrice: "120" },
      { name: "IKEA Kitchen Island (Medium)", sku: "IKEA-KI-M-RELOCATE", category: "Kitchen", serviceType: "relocate", basePrice: "300" },
      { name: "IKEA Kitchen Island (Large)", sku: "IKEA-KI-L-INSTALL", category: "Kitchen", serviceType: "install", basePrice: "280" },
      { name: "IKEA Kitchen Island (Large)", sku: "IKEA-KI-L-DISMANTLE", category: "Kitchen", serviceType: "dismantle", basePrice: "170" },
      { name: "IKEA Kitchen Island (Large)", sku: "IKEA-KI-L-RELOCATE", category: "Kitchen", serviceType: "relocate", basePrice: "420" },
      { name: "Sliding Door Wardrobe (2-door)", sku: "", category: "Wardrobes", serviceType: "relocate", basePrice: "175" },
      { name: "Sliding Door Wardrobe (3-door)", sku: "", category: "Wardrobes", serviceType: "relocate", basePrice: "230" },
      { name: "Hinged Door Wardrobe (2-door)", sku: "", category: "Wardrobes", serviceType: "relocate", basePrice: "150" },
      { name: "Hinged Door Wardrobe (4-door)", sku: "", category: "Wardrobes", serviceType: "relocate", basePrice: "220" },
      { name: "Custom/Built-in Wardrobe", sku: "", category: "Wardrobes", serviceType: "relocate", basePrice: "365" },
      { name: "Walk-in Wardrobe Frame System", sku: "", category: "Wardrobes", serviceType: "relocate", basePrice: "655" },
      { name: "Wardrobe with Built-in Mirror", sku: "", category: "Wardrobes", serviceType: "relocate", basePrice: "220" },
      { name: "Kids Wardrobe (2-door)", sku: "", category: "Kids", serviceType: "relocate", basePrice: "150" },
      { name: "IKEA Hemnes Wardrobe (3-door)", sku: "", category: "IKEA Wardrobes", serviceType: "relocate", basePrice: "180" },
      { name: "IKEA Kleppstad Wardrobe (2-door)", sku: "", category: "IKEA Wardrobes", serviceType: "relocate", basePrice: "120" },
      { name: "Bunk Bed (Standard)", sku: "", category: "Beds", serviceType: "relocate", basePrice: "210" },
      { name: "Bunk Bed (with Trundle)", sku: "", category: "Beds", serviceType: "relocate", basePrice: "280" },
      { name: "Hydraulic Storage Bed (Queen)", sku: "", category: "Beds", serviceType: "relocate", basePrice: "245" },
      { name: "Hydraulic Storage Bed (King)", sku: "", category: "Beds", serviceType: "relocate", basePrice: "290" },
      { name: "Murphy / Wall Bed", sku: "", category: "Beds", serviceType: "relocate", basePrice: "580" },
      { name: "Loft Bed with Desk", sku: "", category: "Beds", serviceType: "relocate", basePrice: "300" },
      { name: "Platform Bed (Super Single)", sku: "", category: "Beds", serviceType: "relocate", basePrice: "110" },
      { name: "Tatami Platform Bed", sku: "", category: "Beds", serviceType: "relocate", basePrice: "190" },
      { name: "Baby Safety Gate", sku: "", category: "Baby & Kids", serviceType: "relocate", basePrice: "65" },
      { name: "High Chair", sku: "", category: "Baby & Kids", serviceType: "relocate", basePrice: "40" },
      { name: "Kids Slide or Climber (indoor)", sku: "", category: "Baby & Kids", serviceType: "relocate", basePrice: "100" },
      { name: "Kids Trampoline (indoor)", sku: "", category: "Baby & Kids", serviceType: "relocate", basePrice: "95" },
      { name: "Playpen or Baby Playard", sku: "", category: "Baby & Kids", serviceType: "relocate", basePrice: "70" },
      { name: "Bathroom Mirror Cabinet", sku: "", category: "Bathroom", serviceType: "relocate", basePrice: "80" },
      { name: "Bathroom Shelving or Towel Rack", sku: "", category: "Bathroom", serviceType: "relocate", basePrice: "50" },
      { name: "IKEA GODMORGON Mirror Cabinet", sku: "", category: "Bathroom", serviceType: "relocate", basePrice: "100" },
      { name: "IKEA HEMNES Mirror Cabinet", sku: "", category: "Bathroom", serviceType: "relocate", basePrice: "115" },
      { name: "IKEA LILLÅNGEN Mirror Cabinet", sku: "", category: "Bathroom", serviceType: "relocate", basePrice: "85" },
      { name: "Over-Toilet Storage Cabinet", sku: "", category: "Bathroom", serviceType: "relocate", basePrice: "65" },
      { name: "Bedroom Ottoman or End-of-Bed Bench", sku: "", category: "Bedroom", serviceType: "relocate", basePrice: "50" },
      { name: "Headboard (wall-mounted)", sku: "", category: "Bedroom", serviceType: "relocate", basePrice: "85" },
      { name: "Ottoman Storage Bed (King)", sku: "", category: "Bedroom", serviceType: "relocate", basePrice: "230" },
      { name: "Ottoman Storage Bed (Queen)", sku: "", category: "Bedroom", serviceType: "relocate", basePrice: "185" },
      { name: "Upholstered Headboard Panel", sku: "", category: "Bedroom", serviceType: "relocate", basePrice: "115" },
      { name: "Vanity Stool or Dressing Stool", sku: "", category: "Bedroom", serviceType: "relocate", basePrice: "40" },
      { name: "Day and Night or Zebra Blind (per window)", sku: "", category: "Curtains & Blinds", serviceType: "relocate", basePrice: "85" },
      { name: "Motorised Blind or Curtain Track", sku: "", category: "Curtains & Blinds", serviceType: "relocate", basePrice: "170" },
      { name: "Roller Blind (per window)", sku: "", category: "Curtains & Blinds", serviceType: "relocate", basePrice: "70" },
      { name: "Roman Blind (per window)", sku: "", category: "Curtains & Blinds", serviceType: "relocate", basePrice: "85" },
      { name: "Venetian Blind (per window)", sku: "", category: "Curtains & Blinds", serviceType: "relocate", basePrice: "75" },
      { name: "Vertical Blind (per window)", sku: "", category: "Curtains & Blinds", serviceType: "relocate", basePrice: "75" },
      { name: "Bar Stool / Counter Stool", sku: "", category: "Dining", serviceType: "relocate", basePrice: "40" },
      { name: "China Cabinet / Display Hutch", sku: "", category: "Dining", serviceType: "relocate", basePrice: "125" },
      { name: "Gaming Cabinet or PC Desk Setup", sku: "", category: "Entertainment", serviceType: "relocate", basePrice: "120" },
      { name: "Projector Screen (ceiling or wall-mount)", sku: "", category: "Entertainment", serviceType: "relocate", basePrice: "145" },
      { name: "Projector Screen (freestanding)", sku: "", category: "Entertainment", serviceType: "relocate", basePrice: "85" },
      { name: "Soundbar or Home Audio Setup", sku: "", category: "Entertainment", serviceType: "relocate", basePrice: "70" },
      { name: "Speaker Stand or Surround Sound (per unit)", sku: "", category: "Entertainment", serviceType: "relocate", basePrice: "55" },
      { name: "Hallway Mirror and Console Set", sku: "", category: "Foyer & Hallway", serviceType: "relocate", basePrice: "120" },
      { name: "Pull-Up / Wall-Mounted Gym Bar", sku: "", category: "Gym Equipment", serviceType: "relocate", basePrice: "95" },
      { name: "Water Purifier or Dispenser", sku: "", category: "Home Appliances", serviceType: "relocate", basePrice: "70" },
      { name: "IKEA Malm Chest of Drawers (3-drawer)", sku: "", category: "IKEA Bedroom", serviceType: "relocate", basePrice: "70" },
      { name: "IKEA Malm Chest of Drawers (6-drawer)", sku: "", category: "IKEA Bedroom", serviceType: "relocate", basePrice: "90" },
      { name: "IKEA Hemnes Bed Frame (Double)", sku: "", category: "IKEA Beds", serviceType: "relocate", basePrice: "135" },
      { name: "IKEA Hemnes Bed Frame (Queen)", sku: "", category: "IKEA Beds", serviceType: "relocate", basePrice: "155" },
      { name: "IKEA Malm Bed Frame (Double)", sku: "", category: "IKEA Beds", serviceType: "relocate", basePrice: "135" },
      { name: "IKEA Malm Bed Frame (Queen/King)", sku: "", category: "IKEA Beds", serviceType: "relocate", basePrice: "165" },
      { name: "IKEA Kivik Sofa (3-seat)", sku: "", category: "IKEA Living Room", serviceType: "relocate", basePrice: "105" },
      { name: "IKEA Lack TV Bench", sku: "", category: "IKEA Living Room", serviceType: "relocate", basePrice: "50" },
      { name: "IKEA Poäng Armchair", sku: "", category: "IKEA Living Room", serviceType: "relocate", basePrice: "45" },
      { name: "IKEA Billy Bookcase", sku: "", category: "IKEA Shelving", serviceType: "relocate", basePrice: "60" },
      { name: "IKEA Billy Bookcase with Extension", sku: "", category: "IKEA Shelving", serviceType: "relocate", basePrice: "80" },
      { name: "IKEA Ivar Shelving Unit", sku: "", category: "IKEA Shelving", serviceType: "relocate", basePrice: "70" },
      { name: "IKEA Kallax Shelf Unit (2×2)", sku: "", category: "IKEA Shelving", serviceType: "relocate", basePrice: "70" },
      { name: "IKEA Kallax Shelf Unit (4×4)", sku: "", category: "IKEA Shelving", serviceType: "relocate", basePrice: "100" },
      { name: "IKEA Alex Drawer Unit", sku: "", category: "IKEA Storage", serviceType: "relocate", basePrice: "70" },
    ]);
    await db.insert(catalogItems).values([
      { name: "IKEA Trofast Storage System", sku: "", category: "IKEA Storage", serviceType: "relocate", basePrice: "60" },
      { name: "IKEA Micke Desk", sku: "", category: "IKEA Study", serviceType: "relocate", basePrice: "60" },
      { name: "IKEA Vittsjo Laptop Stand/Shelf", sku: "", category: "IKEA Study", serviceType: "relocate", basePrice: "50" },
      { name: "Baby Crib / Cot", sku: "", category: "Kids", serviceType: "relocate", basePrice: "90" },
      { name: "Changing Table / Baby Dresser", sku: "", category: "Kids", serviceType: "relocate", basePrice: "80" },
      { name: "IKEA Stuva Storage Combo (Kids)", sku: "", category: "Kids", serviceType: "relocate", basePrice: "130" },
      { name: "Kids Study Desk with Hutch", sku: "", category: "Kids", serviceType: "relocate", basePrice: "150" },
      { name: "Toy / Play Storage Unit", sku: "", category: "Kids", serviceType: "relocate", basePrice: "70" },
      { name: "Bar Counter / Dry Bar Unit", sku: "", category: "Kitchen", serviceType: "relocate", basePrice: "150" },
      { name: "Bar Cabinet / Wine Rack", sku: "", category: "Living Room", serviceType: "relocate", basePrice: "100" },
      { name: "Console / Hallway Table", sku: "", category: "Living Room", serviceType: "relocate", basePrice: "70" },
      { name: "Electric or Decorative Fireplace Unit", sku: "", category: "Living Room", serviceType: "relocate", basePrice: "145" },
      { name: "Entertainment Feature Wall Unit", sku: "", category: "Living Room", serviceType: "relocate", basePrice: "180" },
      { name: "Indoor Hammock or Hammock Chair", sku: "", category: "Living Room", serviceType: "relocate", basePrice: "100" },
      { name: "Indoor Plant Stand or Pot Stand", sku: "", category: "Living Room", serviceType: "relocate", basePrice: "40" },
      { name: "Modular Pod Panel (per panel)", sku: "", category: "Meeting Pods & Phone Booths", serviceType: "relocate", basePrice: "120" },
      { name: "Heavy-Duty Workbench or Workshop Table", sku: "", category: "Office", serviceType: "relocate", basePrice: "180" },
      { name: "Reception Counter", sku: "", category: "Office", serviceType: "relocate", basePrice: "410" },
      { name: "BBQ Grill or Outdoor Cooker", sku: "", category: "Outdoor", serviceType: "relocate", basePrice: "90" },
      { name: "Large Planter Box or Garden Bed", sku: "", category: "Outdoor", serviceType: "relocate", basePrice: "70" },
      { name: "Outdoor Bench", sku: "", category: "Outdoor", serviceType: "relocate", basePrice: "60" },
      { name: "Outdoor Storage Deck Box or Garden Shed", sku: "", category: "Outdoor", serviceType: "relocate", basePrice: "120" },
      { name: "Outdoor Swing or Playset", sku: "", category: "Outdoor", serviceType: "relocate", basePrice: "180" },
      { name: "Patio Umbrella with Base", sku: "", category: "Outdoor", serviceType: "relocate", basePrice: "65" },
      { name: "Sun Lounger or Deck Chair", sku: "", category: "Outdoor", serviceType: "relocate", basePrice: "45" },
      { name: "Hanging Swing Chair or Hammock Chair", sku: "", category: "Rattan & Cane", serviceType: "relocate", basePrice: "110" },
      { name: "HDB Bomb Shelter Shelving", sku: "", category: "Singapore-Specific", serviceType: "relocate", basePrice: "170" },
      { name: "Laundry / Utility Area Cabinet", sku: "", category: "Singapore-Specific", serviceType: "relocate", basePrice: "120" },
      { name: "Retractable Ceiling Clothes Rack", sku: "", category: "Singapore-Specific", serviceType: "relocate", basePrice: "110" },
      { name: "Chaise Lounge", sku: "", category: "Sofas", serviceType: "relocate", basePrice: "105" },
      { name: "Recliner Sofa (2-seater)", sku: "", category: "Sofas", serviceType: "relocate", basePrice: "105" },
      { name: "Recliner Sofa (3-seater)", sku: "", category: "Sofas", serviceType: "relocate", basePrice: "135" },
      { name: "Drawer Chest (5+ drawers)", sku: "", category: "Storage", serviceType: "relocate", basePrice: "100" },
      { name: "Swing Door Cabinet", sku: "", category: "Storage", serviceType: "relocate", basePrice: "100" },
      { name: "Tall Shoe Cabinet (5+ tiers)", sku: "", category: "Storage", serviceType: "relocate", basePrice: "70" },
      { name: "Lateral File Cabinet (2-drawer)", sku: "", category: "Study", serviceType: "relocate", basePrice: "80" },
      { name: "Printer Stand or Side Table", sku: "", category: "Study", serviceType: "relocate", basePrice: "45" },
      { name: "Curtain Rail or Track (per room)", sku: "", category: "Wall Decor", serviceType: "relocate", basePrice: "80" },
      { name: "Pendant Light or Chandelier Bracket", sku: "", category: "Wall Decor", serviceType: "relocate", basePrice: "115" },
      { name: "Wall Clock or Decorative Wall Item", sku: "", category: "Wall Decor", serviceType: "relocate", basePrice: "40" },
      { name: "Curtain Track / Rod Installation", sku: "", category: "Wall-Mounted", serviceType: "relocate", basePrice: "70" },
      { name: "Floating Shelf (per unit)", sku: "", category: "Wall-Mounted", serviceType: "relocate", basePrice: "65" },
      { name: "Full-Length Mirror", sku: "", category: "Wall-Mounted", serviceType: "relocate", basePrice: "75" },
      { name: "Pegboard / Wall Organiser", sku: "", category: "Wall-Mounted", serviceType: "relocate", basePrice: "55" },
      { name: "Wall Cabinet (single)", sku: "", category: "Wall-Mounted", serviceType: "relocate", basePrice: "100" },
      { name: "Nightstand or Bedside Table (pair)", sku: "", category: "Bedroom", serviceType: "install", basePrice: "55" },
      { name: "Nightstand or Bedside Table (pair)", sku: "", category: "Bedroom", serviceType: "dismantle", basePrice: "45" },
      { name: "IKEA Pax Wardrobe", sku: "", category: "IKEA Wardrobes", serviceType: "install", basePrice: "160" },
      { name: "IKEA Pax Wardrobe", sku: "", category: "IKEA Wardrobes", serviceType: "dismantle", basePrice: "110" },
      { name: "Ergonomic Chair", sku: "", category: "Office", serviceType: "install", basePrice: "40" },
      { name: "Office Desk", sku: "", category: "Office", serviceType: "install", basePrice: "60" },
      { name: "Modular Pod Panel (per panel)", sku: "", category: "Office", serviceType: "install", basePrice: "80" },
      { name: "Modular Pod Panel (per panel)", sku: "", category: "Office", serviceType: "dismantle", basePrice: "60" },
      { name: "Umbrella Stand or Coat Rack", sku: "", category: "Foyer & Hallway", serviceType: "install", basePrice: "30" },
      { name: "Umbrella Stand or Coat Rack", sku: "", category: "Foyer & Hallway", serviceType: "relocate", basePrice: "45" },
      { name: "TV Wall Mounting", sku: "", category: "Living Room", serviceType: "dismantle", basePrice: "40" },
      { name: "Mirror Installation", sku: "", category: "Others", serviceType: "dismantle", basePrice: "30" },
      { name: "Mirror Installation", sku: "", category: "Others", serviceType: "relocate", basePrice: "70" },
      { name: "Gallery Wall (5 to 10 frames)", sku: "", category: "Wall Decor", serviceType: "dismantle", basePrice: "70" },
      { name: "Gym Mat or Foam Flooring (per set)", sku: "", category: "Gym Equipment", serviceType: "install", basePrice: "40" },
      { name: "Gym Mat or Foam Flooring (per set)", sku: "", category: "Gym Equipment", serviceType: "dismantle", basePrice: "25" },
      { name: "Gym Mat or Foam Flooring (per set)", sku: "", category: "Gym Equipment", serviceType: "relocate", basePrice: "55" },
      { name: "Washroom Mirror Cabinet (Large, 60cm+)", sku: "", category: "Bathroom", serviceType: "relocate", basePrice: "120" },
      { name: "Washroom Mirror Cabinet (Small, up to 60cm)", sku: "", category: "Bathroom", serviceType: "relocate", basePrice: "90" },
      { name: "TV Wall Mounting", sku: "", category: "Living Room", serviceType: "relocate", basePrice: "100" },
      { name: "IKEA Pax Wardrobe", sku: "", category: "IKEA Wardrobes", serviceType: "relocate", basePrice: "230" },
    ]);
    console.log("[startup] Round 10: 566 dispose/dd/extra entries seeded.");
  }

  // Round 11: SG Market Calibration (SG-MARKET-R1 marker)
  // Price corrections based on 2025 Singapore market research across Airtasker, ITB,
  // LocalHandymanSG, Kaodim, Carousell Services, and verified competitor pricing.
  const r11 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "SG-MARKET-R1"));
  if (r11.length === 0) {
    await db.insert(catalogItems).values({
      name: "__sg_market_r1_marker__",
      sku: "SG-MARKET-R1",
      category: "System",
      serviceType: "install",
      basePrice: "0",
      active: false,
    });

    // ── Price corrections ────────────────────────────────────────────────────
    // Coffee Table: market $50–$70 (was $40 — below cheapest market rate)
    await db.update(catalogItems).set({ basePrice: "55.00" }).where(eq(catalogItems.sku, "CFT-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "40.00" }).where(eq(catalogItems.sku, "CFT-DISMANTLE"));
    await db.update(catalogItems).set({ basePrice: "80.00" }).where(eq(catalogItems.sku, "CFT-RELOCATE"));

    // TV Console: market $60–$120 (was $60 — at absolute floor; raised to mid-market)
    await db.update(catalogItems).set({ basePrice: "80.00" }).where(eq(catalogItems.sku, "TVC-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "60.00" }).where(eq(catalogItems.sku, "TVC-DISMANTLE"));
    await db.update(catalogItems).set({ basePrice: "130.00" }).where(eq(catalogItems.sku, "TVC-RELOCATE"));

    // Sliding Door Wardrobe 2-door: market $150–$200+ (was $120 — underpriced)
    await db.update(catalogItems).set({ basePrice: "150.00" }).where(eq(catalogItems.sku, "SLDR2-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "100.00" }).where(eq(catalogItems.sku, "SLDR2-DISMANTLE"));

    // Office Desk (generic single): market $50–$100 (was $50 — at floor; mid-market)
    await db.update(catalogItems).set({ basePrice: "70.00" }).where(eq(catalogItems.sku, "OD-01"));

    // Queen Bed Frame: market $80–$150 (was $80 — at floor; nudged to lower-mid)
    await db.update(catalogItems).set({ basePrice: "90.00" }).where(eq(catalogItems.sku, "QB-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "65.00" }).where(eq(catalogItems.sku, "QB-DISMANTLE"));
    await db.update(catalogItems).set({ basePrice: "140.00" }).where(eq(catalogItems.sku, "QB-RELOCATE"));

    // King Bed Frame: market $100–$180 (was $100 — at floor; nudged to lower-mid)
    await db.update(catalogItems).set({ basePrice: "110.00" }).where(eq(catalogItems.sku, "KB-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "85.00" }).where(eq(catalogItems.sku, "KB-DISMANTLE"));
    await db.update(catalogItems).set({ basePrice: "160.00" }).where(eq(catalogItems.sku, "KB-RELOCATE"));

    // Dining Chair: market $20–$50 per piece (raise slightly from $20 for per-piece jobs)
    await db.update(catalogItems).set({ basePrice: "25.00" }).where(eq(catalogItems.sku, "DNC-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "20.00" }).where(eq(catalogItems.sku, "DNC-DISMANTLE"));

    // ── New items: missing bed sizes ─────────────────────────────────────────
    // Double Bed Frame (between Single $60 and Queen $90) — very common in SG
    await db.insert(catalogItems).values([
      { name: "Double Bed Frame", sku: "DB-INSTALL-01",   category: "Beds", serviceType: "install",   basePrice: "75.00",  volumeM3: "0.45" },
      { name: "Double Bed Frame", sku: "DB-DISMANTLE-01", category: "Beds", serviceType: "dismantle", basePrice: "55.00",  volumeM3: "0.45" },
      { name: "Double Bed Frame", sku: "DB-RELOCATE-01",  category: "Beds", serviceType: "relocate",  basePrice: "115.00", volumeM3: "0.45" },
    ]).onConflictDoNothing();

    // Super Single Bed Frame (between Single $60 and Double $75) — standard SG HDB size
    await db.insert(catalogItems).values([
      { name: "Super Single Bed Frame", sku: "SSB-INSTALL",   category: "Beds", serviceType: "install",   basePrice: "65.00",  volumeM3: "0.38" },
      { name: "Super Single Bed Frame", sku: "SSB-DISMANTLE", category: "Beds", serviceType: "dismantle", basePrice: "50.00",  volumeM3: "0.38" },
      { name: "Super Single Bed Frame", sku: "SSB-RELOCATE",  category: "Beds", serviceType: "relocate",  basePrice: "105.00", volumeM3: "0.38" },
    ]).onConflictDoNothing();

    console.log("[startup] Round 11: SG market calibration applied.");
  }

  // Round 12: Roll back Round 11 price increases — restore original prices (ROLLBACK-R11 marker)
  const r12 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "ROLLBACK-R11"));
  if (r12.length === 0) {
    await db.insert(catalogItems).values({
      name: "__rollback_r11_marker__",
      sku: "ROLLBACK-R11",
      category: "System",
      serviceType: "install",
      basePrice: "0",
      active: false,
    });

    // Coffee Table — restore to $40 install, $30 dismantle, $70 relocate
    await db.update(catalogItems).set({ basePrice: "40.00" }).where(eq(catalogItems.sku, "CFT-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "30.00" }).where(eq(catalogItems.sku, "CFT-DISMANTLE"));
    await db.update(catalogItems).set({ basePrice: "70.00" }).where(eq(catalogItems.sku, "CFT-RELOCATE"));

    // TV Console — restore to $60 install, $50 dismantle, $100 relocate
    await db.update(catalogItems).set({ basePrice: "60.00" }).where(eq(catalogItems.sku, "TVC-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "50.00" }).where(eq(catalogItems.sku, "TVC-DISMANTLE"));
    await db.update(catalogItems).set({ basePrice: "100.00" }).where(eq(catalogItems.sku, "TVC-RELOCATE"));

    // Sliding Door Wardrobe 2-door — restore to $120 install, $85 dismantle
    await db.update(catalogItems).set({ basePrice: "120.00" }).where(eq(catalogItems.sku, "SLDR2-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "85.00" }).where(eq(catalogItems.sku, "SLDR2-DISMANTLE"));

    // Office Desk — restore to $50 install
    await db.update(catalogItems).set({ basePrice: "50.00" }).where(eq(catalogItems.sku, "OD-01"));

    // Queen Bed Frame — restore to $80 install, $60 dismantle, $120 relocate
    await db.update(catalogItems).set({ basePrice: "80.00" }).where(eq(catalogItems.sku, "QB-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "60.00" }).where(eq(catalogItems.sku, "QB-DISMANTLE"));
    await db.update(catalogItems).set({ basePrice: "120.00" }).where(eq(catalogItems.sku, "QB-RELOCATE"));

    // King Bed Frame — restore to $100 install, $80 dismantle, $150 relocate
    await db.update(catalogItems).set({ basePrice: "100.00" }).where(eq(catalogItems.sku, "KB-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "80.00" }).where(eq(catalogItems.sku, "KB-DISMANTLE"));
    await db.update(catalogItems).set({ basePrice: "150.00" }).where(eq(catalogItems.sku, "KB-RELOCATE"));

    // Dining Chair — restore to $20 install, $15 dismantle
    await db.update(catalogItems).set({ basePrice: "20.00" }).where(eq(catalogItems.sku, "DNC-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "15.00" }).where(eq(catalogItems.sku, "DNC-DISMANTLE"));

    console.log("[startup] Round 12: Round 11 price rollback applied.");
  }

  // Round 13: Align ALL catalog relocate prices with D&R bundle formula (RELOCATE-FORMULA-R1 marker)
  // Sets every active relocate-service catalog item to (install + dismantle) × 0.60
  // where both install and dismantle entries exist for that item name.
  // Items with only a relocate entry (mattresses, boxes, appliances) are left unchanged.
  const r13 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "RELOCATE-FORMULA-R1"));
  if (r13.length === 0) {
    await db.insert(catalogItems).values({
      name: "__relocate_formula_r1_marker__",
      sku: "RELOCATE-FORMULA-R1",
      category: "System",
      serviceType: "install",
      basePrice: "0",
      active: false,
    });

    await db.execute(sql`
      UPDATE catalog_items AS r
      SET base_price = ROUND(
          (i.base_price + d.base_price) * 0.60,
          2
        )
      FROM catalog_items AS i
      JOIN catalog_items AS d
        ON  d.name         = i.name
        AND d.service_type = 'dismantle'
        AND d.active       = true
        AND d.category    != 'System'
      WHERE r.name         = i.name
        AND r.service_type = 'relocate'
        AND i.service_type = 'install'
        AND r.active       = true
        AND i.active       = true
        AND i.category    != 'System'
    `);

    console.log("[startup] Round 13: All catalog relocate prices aligned with D&R bundle formula (install + dismantle) × 0.60.");
  }

  // Round 14: Heavy-item Carry Only repricing (HEAVY-CARRY-R1 marker)
  // Round 13's D&R formula under-priced bulky 2-man items vs. Singapore market rates.
  // Market research (Movings.sg, MoveHub, Homejourney, XM Movers, Miuvo, 2025):
  //   - King size mattress + bed frame, same-building, manpower only: $80–$200 typical
  //   - Massage chair (80–130kg, 2-man): $120–$200 (specialised manpower needed)
  // These prices now flow through to Carry Only mode too (see shared/pricing.ts change).
  const r14 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "HEAVY-CARRY-R1"));
  if (r14.length === 0) {
    await db.insert(catalogItems).values({
      name: "__heavy_carry_r1_marker__",
      sku: "HEAVY-CARRY-R1",
      category: "System",
      serviceType: "install",
      basePrice: "0",
      active: false,
    });

    // King Bed Frame relocate: market mid $160 (2-man, bulky, awkward)
    await db.update(catalogItems).set({ basePrice: "160.00" }).where(eq(catalogItems.sku, "KB-RELOCATE"));
    // Massage Chair relocate: upper-mid market $180 (heavy 80–130kg, 2-man minimum)
    await db.update(catalogItems).set({ basePrice: "180.00" }).where(eq(catalogItems.sku, "MASS-RELOCATE"));

    console.log("[startup] Round 14: Heavy-item Carry Only repricing — KB-RELOCATE=$160, MASS-RELOCATE=$180.");
  }

  // Round 15: Mattress relocation catalog completion + competitive repricing (MATT-RELOC-R1 marker)
  // - Adds the missing Single mattress entry (MATT-SGL-RELOCATE) — volume already mapped at 0.15.
  // - Competitive SG market rates (Helpling, Movings.sg, Soulful Concepts, 2025) for mattress-only
  //   relocation (no frame, manpower-only same-building or short carry):
  //     • Single (3'):        ~7–12kg, 1-man liftable but awkward → $50
  //     • Super Single (3.5'): ~10–15kg, 1–2 man → $60
  //     • Queen (5'):         ~25–35kg, 2-man required → $80
  //     • King (6'):          ~30–45kg, 2-man, very floppy/awkward → $100
  const r15 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "MATT-RELOC-R1"));
  if (r15.length === 0) {
    await db.insert(catalogItems).values({
      name: "__matt_reloc_r1_marker__",
      sku: "MATT-RELOC-R1",
      category: "System",
      serviceType: "install",
      basePrice: "0",
      active: false,
    });

    // Insert Single mattress if missing (other three already exist).
    const existingSingle = await db.select().from(catalogItems).where(eq(catalogItems.sku, "MATT-SGL-RELOCATE"));
    if (existingSingle.length === 0) {
      await db.insert(catalogItems).values({
        name: "Mattress — Single",
        sku: "MATT-SGL-RELOCATE",
        category: "Mattresses",
        serviceType: "relocate",
        basePrice: "50.00",
      });
    } else {
      await db.update(catalogItems).set({ basePrice: "50.00" }).where(eq(catalogItems.sku, "MATT-SGL-RELOCATE"));
    }

    await db.update(catalogItems).set({ basePrice: "60.00" }).where(eq(catalogItems.sku, "MATT-SS-RELOCATE"));
    await db.update(catalogItems).set({ basePrice: "80.00" }).where(eq(catalogItems.sku, "MATT-Q-RELOCATE"));
    await db.update(catalogItems).set({ basePrice: "100.00" }).where(eq(catalogItems.sku, "MATT-K-RELOCATE"));

    console.log("[startup] Round 15: Mattress relocation pricing — Single=$50, Super Single=$60, Queen=$80, King=$100.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Round 16: Weight-based Carry Only pricing — light items FREE, heavy items repriced (WEIGHT-TIER-R1 marker)
  // Tier 0 (≤10 kg, 1-hand carry-and-go) → $0  (free, no per-item charge — customer still pays transport + crew base)
  // Tier 1 (10–25 kg, 1-man manageable)  → $30–$60
  // Tier 2 (25–50 kg, 2-man light)       → $70–$110
  // Tier 3 (50–80 kg, 2-man heavy)       → $120–$180
  // Tier 4 (80–130 kg, 2–3-man + care)   → $200–$280
  // Tier 5 (>130 kg / specialty)         → $300+
  // ──────────────────────────────────────────────────────────────────────────
  const weightTierMarkerR16 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "WEIGHT-TIER-R16-MARKER")).limit(1);
  if (weightTierMarkerR16.length === 0) {
    const updates: { sku: string; price: string }[] = [
      // ── Tier 0: FREE (≤10 kg, single-hand carry, walk-and-go) ───────────────
      { sku: "BT-RELOCATE",                price: "0.00" },   // Bedside table ~5–8 kg
      { sku: "SIDE-RELOCATE",              price: "0.00" },   // Side table ~3–5 kg
      { sku: "DNC-RELOCATE",               price: "0.00" },   // Dining chair ~3–5 kg
      { sku: "MONARM-RELOCATE",            price: "0.00" },   // Monitor arm ~2 kg
      { sku: "OFF-DESK-SCREEN-RELOCATE",   price: "0.00" },   // Desk privacy screen ~5 kg
      { sku: "ARM-RELOCATE",               price: "0.00" },   // Single armchair / accent chair (light) ~8–12 kg
      { sku: "EC-RELOCATE",                price: "0.00" },   // Ergonomic chair (rolls on wheels)
      { sku: "OFF-WHITEBOARD-RELOCATE",    price: "0.00" },   // Wall-mount whiteboard ~6 kg
      { sku: "CFT-RELOCATE",               price: "0.00" },   // Coffee table (most are light wood/glass) ~10–15 kg

      // ── Tier 1: $30–$60 (10–25 kg, 1-man) ──────────────────────────────────
      { sku: "SR-RELOCATE",                price: "30.00" },  // Shoe rack — small to medium
      { sku: "OD-RELOCATE",                price: "60.00" },  // Office desk (basic) ~20–25 kg

      // ── Tier 2: $70–$110 (25–50 kg, 2-man light) ──────────────────────────
      { sku: "DT-RELOCATE",                price: "70.00" },  // Dressing table (mirror needs care)
      { sku: "TVC-RELOCATE",               price: "80.00" },  // TV console
      { sku: "STUDY-RELOCATE",             price: "70.00" },  // Study/computer table
      { sku: "BS-RELOCATE",                price: "80.00" },  // Bookshelf
      { sku: "SF2-RELOCATE",               price: "100.00" }, // 2-seater sofa ~35 kg
      { sku: "SB-RELOCATE",                price: "80.00" },  // Single bed frame
      { sku: "FC-RELOCATE",                price: "70.00" },  // Filing cabinet
      { sku: "DNT-RELOCATE",               price: "100.00" }, // Dining table (4-seat)
      { sku: "EXDT-RELOCATE",              price: "120.00" }, // Extendable dining table

      // ── Tier 3: $120–$180 (50–80 kg, 2-man heavy) ─────────────────────────
      { sku: "QB-RELOCATE",                price: "130.00" }, // Queen bed frame
      { sku: "DB-RELOCATE-01",             price: "120.00" }, // Double bed frame
      { sku: "SSB-RELOCATE",               price: "100.00" }, // Super single bed frame
      { sku: "SF3-RELOCATE",               price: "150.00" }, // 3-seater sofa
      { sku: "SOFABED-RELOCATE",           price: "150.00" }, // Sofa bed / day bed
      { sku: "DC-RELOCATE",                price: "150.00" }, // Display cabinet
      { sku: "SIDE-BUF-RELOCATE",          price: "130.00" }, // Sideboard / buffet cabinet

      // ── Tier 4: $200–$280 (80–130 kg, 2–3-man + careful handling) ─────────
      { sku: "KB-RELOCATE",                price: "220.00" }, // King bed frame intact — 60–80 kg, often won't fit lift
      { sku: "MASS-RELOCATE",              price: "220.00" }, // Massage chair — premium models 80–130 kg
      { sku: "PAX-RELOCATE",               price: "240.00" }, // IKEA Pax wardrobe (intact)
      { sku: "LSOFA-RELOCATE",             price: "220.00" }, // L-shaped / corner sofa
      { sku: "L-DESK-RELOCATE",            price: "200.00" }, // L-shaped executive desk

      // ── King mattress slight bump for 2-man weight ─────────────────────────
      { sku: "MATTRESS-K-RELOCATE",        price: "110.00" }, // King mattress ~40 kg (was $100)
    ];

    for (const u of updates) {
      await db.update(catalogItems).set({ basePrice: u.price }).where(eq(catalogItems.sku, u.sku));
    }

    // Idempotency marker
    await db.insert(catalogItems).values({
      name: "Weight Tier R16 Marker",
      sku: "WEIGHT-TIER-R16-MARKER",
      category: "_internal",
      serviceType: "relocate",
      basePrice: "0",
      isActive: false,
    } as any).onConflictDoNothing?.();

    console.log("[startup] Round 16: Weight-tier Carry Only pricing applied — 9 light items FREE, KB=$220, MASS=$220, PAX=$240, LSOFA=$220.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Round 17: Defensive mattress catalog completion (MATT-FULL-R17 marker)
  // Round 15 only inserted Single mattress and assumed the other 3 sizes pre-existed.
  // On a fresh production DB they didn't, so customers searching "mattress" only see one size.
  // This round upserts ALL 4 mattress sizes idempotently.
  // ──────────────────────────────────────────────────────────────────────────
  const r17 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "MATT-FULL-R17")).limit(1);
  if (r17.length === 0) {
    const mattresses = [
      { sku: "MATT-SGL-RELOCATE", name: "Mattress — Single",         price: "50.00", volume: "0.15" },
      { sku: "MATT-SS-RELOCATE",  name: "Mattress — Super Single",   price: "60.00", volume: "0.18" },
      { sku: "MATT-Q-RELOCATE",   name: "Mattress — Queen",          price: "80.00", volume: "0.30" },
      { sku: "MATT-K-RELOCATE",   name: "Mattress — King",           price: "100.00", volume: "0.36" },
    ];

    for (const m of mattresses) {
      const existing = await db.select().from(catalogItems).where(eq(catalogItems.sku, m.sku)).limit(1);
      if (existing.length === 0) {
        await db.insert(catalogItems).values({
          name: m.name,
          sku: m.sku,
          category: "Mattresses",
          serviceType: "relocate",
          basePrice: m.price,
          volumeM3: m.volume,
          active: true,
        } as any);
      } else {
        await db.update(catalogItems).set({ basePrice: m.price, active: true, name: m.name, category: "Mattresses" }).where(eq(catalogItems.sku, m.sku));
      }
    }

    await db.insert(catalogItems).values({
      name: "__matt_full_r17_marker__",
      sku: "MATT-FULL-R17",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log("[startup] Round 17: All 4 mattress sizes guaranteed in catalog (Single $50, Super Single $60, Queen $80, King $100).");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Round 18: Mattress disposal pricing & service-type cleanup (MATT-DISP-R18)
  // Existing MATT-*-DISPOSAL rows had service_type = "dismantle" — a leftover
  // that broke the customer wizard: when the default "Dismantle + Dispose"
  // mode was selected, mattresses fell through to the AI-estimated custom
  // price (~$140) instead of using the flat catalog disposal rate, AND the
  // estimate page tagged them as "Dismantle + Dispose" which is wrong since
  // mattresses can't be dismantled. This round forces service_type = "dispose"
  // on the existing 3 sizes (SS / Queen / King), adds the missing Single
  // mattress disposal SKU, and locks in clean pricing.
  // ──────────────────────────────────────────────────────────────────────────
  // Marker bumped from R18 → R18B because the original R18 inserted rows with
  // names like "Mattress Disposal — Queen" which prevented the wizard's
  // name-based group merge from working. R18B re-runs the upsert with names
  // that match the relocate rows exactly.
  const r18 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "MATT-DISP-R18B")).limit(1);
  if (r18.length === 0) {
    // IMPORTANT: name must match the corresponding RELOCATE row exactly so the
    // customer wizard's groupCatalog (which groups by name) merges them into
    // a single catalog item with two service variants — same pattern as Bunk
    // Bed (BUNKBEDS-DISPOSE + BUNKBEDS-DIS-DISP both share the name "Bunk Bed
    // (Standard)"). Without this the wizard sees a "Mattress — Queen" group
    // with only the relocate entry, fails to find any 'dispose' variant, and
    // falls through to a custom AI-estimated dismantle+dispose item.
    const disposals = [
      { sku: "MATT-SGL-DISPOSAL", name: "Mattress — Single",       price: "50.00", volume: "0.15" },
      { sku: "MATT-SS-DISPOSAL",  name: "Mattress — Super Single", price: "60.00", volume: "0.18" },
      { sku: "MATT-Q-DISPOSAL",   name: "Mattress — Queen",        price: "70.00", volume: "0.30" },
      { sku: "MATT-K-DISPOSAL",   name: "Mattress — King",         price: "80.00", volume: "0.36" },
    ];

    for (const d of disposals) {
      const existing = await db.select().from(catalogItems).where(eq(catalogItems.sku, d.sku)).limit(1);
      if (existing.length === 0) {
        await db.insert(catalogItems).values({
          name: d.name,
          sku: d.sku,
          category: "Mattresses",
          serviceType: "dispose",
          basePrice: d.price,
          volumeM3: d.volume,
          active: true,
        } as any);
      } else {
        await db.update(catalogItems).set({
          name: d.name,
          category: "Mattresses",
          serviceType: "dispose",
          basePrice: d.price,
          volumeM3: d.volume,
          active: true,
        }).where(eq(catalogItems.sku, d.sku));
      }
    }

    // Clean up the broken R18 markers (the original Round 18 had a marker
    // mismatch between read SKU and write SKU, so the block re-ran every
    // restart and accumulated duplicate marker rows). They're inactive
    // _internal rows so they don't affect the catalog, but tidy them up.
    await db.delete(catalogItems).where(eq(catalogItems.sku, "MATT-DISP-R18"));

    await db.insert(catalogItems).values({
      name: "__matt_disp_r18b_marker__",
      sku: "MATT-DISP-R18B",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log("[startup] Round 18B: Mattress disposal SKUs cleaned up — service_type=dispose, names match relocate rows, prices Single $50 / Super Single $60 / Queen $70 / King $80.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Round 19: Television (TV) catalog entries
  // Customers regularly ask for help moving a bare TV (separate from the TV
  // console it sits on). Most requests are "carry and go" relocation — we
  // unplug, wrap, walk it to the truck, and set it up at the new place. We
  // expose three size tiers so a 32" bedroom TV doesn't get priced like an
  // 85" living-room set, and surface install (table mount or simple stand
  // placement) + dismantle (unmounting from a wall bracket) variants too so
  // the wizard's group-by-name UI shows one "Television" tile per size with
  // selectable services. Wall-mounted installs continue to use the existing
  // TVWM-INSTALL ($80) row — that one bundles bracket fitting and cable
  // tidy, which is more involved than a plug-and-play table TV.
  // ──────────────────────────────────────────────────────────────────────────
  const r19 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "TV-R19-MARKER")).limit(1);
  if (r19.length === 0) {
    const tvItems = [
      // Television up to 55" — typical bedroom / second-room TV, light enough for one person.
      { sku: "TV-55-INSTALL",   name: 'Television (up to 55")', svc: "install",  price: "50.00", vol: "0.10" },
      { sku: "TV-55-DISMANTLE", name: 'Television (up to 55")', svc: "dismantle", price: "40.00", vol: "0.10" },
      { sku: "TV-55-RELOCATE",  name: 'Television (up to 55")', svc: "relocate", price: "50.00", vol: "0.10" },
      // Television 65"–75" — standard living-room TV, two people for safe carry.
      { sku: "TV-75-INSTALL",   name: 'Television (65"–75")', svc: "install",  price: "80.00", vol: "0.20" },
      { sku: "TV-75-DISMANTLE", name: 'Television (65"–75")', svc: "dismantle", price: "55.00", vol: "0.20" },
      { sku: "TV-75-RELOCATE",  name: 'Television (65"–75")', svc: "relocate", price: "80.00", vol: "0.20" },
      // Television 75"+ — large screen, fragile glass, padded carry recommended.
      { sku: "TV-XL-INSTALL",   name: 'Television (75" and above)', svc: "install",  price: "120.00", vol: "0.30" },
      { sku: "TV-XL-DISMANTLE", name: 'Television (75" and above)', svc: "dismantle", price: "70.00",  vol: "0.30" },
      { sku: "TV-XL-RELOCATE",  name: 'Television (75" and above)', svc: "relocate", price: "120.00", vol: "0.30" },
    ];

    for (const t of tvItems) {
      const existing = await db.select().from(catalogItems).where(eq(catalogItems.sku, t.sku)).limit(1);
      if (existing.length === 0) {
        await db.insert(catalogItems).values({
          name: t.name,
          sku: t.sku,
          category: "Living Room",
          serviceType: t.svc,
          basePrice: t.price,
          volumeM3: t.vol,
          active: true,
        } as any);
      }
    }

    await db.insert(catalogItems).values({
      name: "__tv_r19_marker__",
      sku: "TV-R19-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log("[startup] Round 19: Television entries added — 3 size tiers (≤55\", 65–75\", 75+\") × install/dismantle/relocate.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Round 19B: Television relocate (carry-and-go) is free.
  // Customer feedback: TVs are light, take seconds to lift into the truck
  // alongside the other furniture, and shouldn't carry a separate line-item
  // charge when we're already on-site for a relocation. Drop the three
  // TV-*-RELOCATE prices to $0 across all size tiers.
  // ──────────────────────────────────────────────────────────────────────────
  const r19b = await db.select().from(catalogItems).where(eq(catalogItems.sku, "TV-R19B-MARKER")).limit(1);
  if (r19b.length === 0) {
    for (const sku of ["TV-55-RELOCATE", "TV-75-RELOCATE", "TV-XL-RELOCATE"]) {
      await db.update(catalogItems)
        .set({ basePrice: "0.00" })
        .where(eq(catalogItems.sku, sku));
    }

    await db.insert(catalogItems).values({
      name: "__tv_r19b_marker__",
      sku: "TV-R19B-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log("[startup] Round 19B: Television relocate (carry-and-go) set to free across all size tiers.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Round 20: Wall-Hung Shelving System (per hole) — walk-in wardrobe style
  // wall-mounted shelving, hanging rails, and basket racks. The labour driver
  // for these systems is the number of holes drilled into the wall (every
  // bracket / standard / rail mount counts), so we price by hole instead of
  // by piece. Rates benchmarked against IKEA's $5/hole install:
  //   • Install     $5/hole — match IKEA so we're competitive on new fits.
  //   • Dismantle   $2/hole — lighter work, no drilling, just unscrew + label.
  //   • Relocate    $7/hole — bundled dismantle + drill + reinstall ($2+$5).
  // All three SKUs share the same display name so the customer wizard merges
  // them under one tile with selectable Install / Dismantle / Relocate
  // service variants (same group-by-name pattern as Mattress and Bunk Bed).
  // ──────────────────────────────────────────────────────────────────────────
  const r20 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "WALLHUNG-R20-MARKER")).limit(1);
  if (r20.length === 0) {
    const wallHungItems = [
      { sku: "WALLHUNG-INSTALL",   name: "Wall-Hung Shelving System (per hole)", svc: "install",   price: "5.00",  vol: "0.02" },
      { sku: "WALLHUNG-DISMANTLE", name: "Wall-Hung Shelving System (per hole)", svc: "dismantle", price: "2.00",  vol: "0.02" },
      { sku: "WALLHUNG-RELOCATE",  name: "Wall-Hung Shelving System (per hole)", svc: "relocate",  price: "7.00",  vol: "0.02" },
    ];

    for (const w of wallHungItems) {
      const existing = await db.select().from(catalogItems).where(eq(catalogItems.sku, w.sku)).limit(1);
      if (existing.length === 0) {
        await db.insert(catalogItems).values({
          name: w.name,
          sku: w.sku,
          category: "Wall-Mounted",
          serviceType: w.svc,
          basePrice: w.price,
          volumeM3: w.vol,
          active: true,
        } as any);
      } else {
        // Keep existing rows in lock-step with the rates above (idempotent
        // re-seed in case prices ever drift on a re-deploy).
        await db.update(catalogItems)
          .set({ basePrice: w.price, name: w.name, category: "Wall-Mounted", active: true })
          .where(eq(catalogItems.sku, w.sku));
      }
    }

    await db.insert(catalogItems).values({
      name: "__wallhung_r20_marker__",
      sku: "WALLHUNG-R20-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log("[startup] Round 20: Wall-Hung Shelving System (per hole) — install $5, dismantle $2, relocate $7.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Round 21: Make per-hole pricing the default for "Walk-in Wardrobe"
  // The customer wizard was still quoting walk-in wardrobes at the old flat
  // $462 relocate ($450 install / $320 dismantle) from the legacy
  // "Walk-in Wardrobe Frame System" SKU because it grouped by that name and
  // outranked the new per-hole tile. User wants the per-hole pricing to win
  // for ALL walk-in wardrobe quotes.
  //
  //   1) Deactivate every "Walk-in Wardrobe Frame System" row (catches both
  //      WALKIN-* SKUs and the legacy unnamed-SKU duplicates) so the old tile
  //      disappears from the wizard.
  //   2) Rename WALLHUNG-* rows so the wizard tile reads
  //      "Walk-in Wardrobe (Wall-Hung, per hole)" — customers typing "walk-in
  //      wardrobe" now see the per-hole tile and can enter their hole count
  //      as quantity.
  // ──────────────────────────────────────────────────────────────────────────
  const r21 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "WALLHUNG-R21-MARKER")).limit(1);
  if (r21.length === 0) {
    // Step 1: hide the legacy flat-priced walk-in wardrobe rows.
    await db.update(catalogItems)
      .set({ active: false })
      .where(eq(catalogItems.name, "Walk-in Wardrobe Frame System"));

    // Step 2: rename per-hole rows so the wizard tile mentions "Walk-in".
    // All three service variants must share the exact same display name so
    // the wizard's group-by-name logic keeps them under a single tile with
    // selectable Install / Dismantle / Relocate options.
    const newName = "Walk-in Wardrobe (Wall-Hung, per hole)";
    for (const sku of ["WALLHUNG-INSTALL", "WALLHUNG-DISMANTLE", "WALLHUNG-RELOCATE"]) {
      await db.update(catalogItems)
        .set({ name: newName })
        .where(eq(catalogItems.sku, sku));
    }

    await db.insert(catalogItems).values({
      name: "__wallhung_r21_marker__",
      sku: "WALLHUNG-R21-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log("[startup] Round 21: Walk-in Wardrobe is now per-hole — legacy flat WALKIN-* rows disabled, WALLHUNG-* renamed to 'Walk-in Wardrobe (Wall-Hung, per hole)'.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Round 22: Fold "Custom/Built-in Wardrobe" into the per-hole tile too
  // After Round 21 the wizard started auto-suggesting "Custom/Built-in
  // Wardrobe" (flat $258 relocate / $250 install / $180 dismantle) when the
  // customer was looking for a walk-in wardrobe. Functionally that's the same
  // carpentry job — built-in carcassing, hanging rails, drilled-into-wall
  // shelves — and the user wants ALL of it priced per hole. So:
  //
  //   1) Deactivate every "Custom/Built-in Wardrobe" row (CUST-WRD-*,
  //      CUSTOMBU-*, and the legacy unnamed-SKU duplicates).
  //   2) Rename the per-hole tile to "Walk-in / Built-in Wardrobe (per hole)"
  //      so customers searching either phrase land on the same per-hole tile.
  //
  // We deliberately leave "Wardrobe with Built-in Mirror" alone — that's a
  // pre-fab piece of furniture (mirror is a feature, not the carpentry
  // method), and per-hole pricing doesn't apply.
  // ──────────────────────────────────────────────────────────────────────────
  const r22 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "WALLHUNG-R22-MARKER")).limit(1);
  if (r22.length === 0) {
    // Step 1: hide the legacy flat-priced built-in wardrobe rows.
    await db.update(catalogItems)
      .set({ active: false })
      .where(eq(catalogItems.name, "Custom/Built-in Wardrobe"));

    // Step 2: rename per-hole rows so the wizard tile covers both phrasings.
    const newName = "Walk-in / Built-in Wardrobe (per hole)";
    for (const sku of ["WALLHUNG-INSTALL", "WALLHUNG-DISMANTLE", "WALLHUNG-RELOCATE"]) {
      await db.update(catalogItems)
        .set({ name: newName })
        .where(eq(catalogItems.sku, sku));
    }

    await db.insert(catalogItems).values({
      name: "__wallhung_r22_marker__",
      sku: "WALLHUNG-R22-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log("[startup] Round 22: Custom/Built-in Wardrobe folded into per-hole tile — renamed to 'Walk-in / Built-in Wardrobe (per hole)'.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Round 23: Stainless-Steel Kitchen Storage Rack / Cabinet
  // Common Taobao / Shopee freestanding stainless-steel multi-tier kitchen
  // rack with sliding doors and an open microwave / appliance shelf. Before
  // this round the AI photo-scanner had no good catalog match and was
  // either (a) lumping it into "Walk-in / Built-in Wardrobe (per hole)"
  // (because of the vertical uprights), or (b) picking the most expensive
  // nearby SKU. Either way customers saw $400+ quotes for what is a
  // straightforward 1.5–2 hr flat-pack job.
  //
  // Real market labour for these:
  //   • Install   $80 — 6–10 panels, bolt assembly, sliding-door alignment.
  //   • Dismantle $60 — unbolt, no drilling.
  //   • Relocate  $130 — D&R bundle (40% off install + dismantle).
  // Volume ~0.45 m³ (similar to a sideboard / credenza).
  // ──────────────────────────────────────────────────────────────────────────
  const r23 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "KITCHRACK-R23-MARKER")).limit(1);
  if (r23.length === 0) {
    const kitchRackItems = [
      { sku: "KITCHRACK-INSTALL",   svc: "install",   price: "80.00",  vol: "0.45" },
      { sku: "KITCHRACK-DISMANTLE", svc: "dismantle", price: "60.00",  vol: "0.45" },
      { sku: "KITCHRACK-RELOCATE",  svc: "relocate",  price: "130.00", vol: "0.45" },
    ];
    const krName = "Stainless Steel Kitchen Storage Rack / Cabinet";
    for (const k of kitchRackItems) {
      const existing = await db.select().from(catalogItems).where(eq(catalogItems.sku, k.sku)).limit(1);
      if (existing.length === 0) {
        await db.insert(catalogItems).values({
          name: krName,
          sku: k.sku,
          category: "Kitchen",
          serviceType: k.svc,
          basePrice: k.price,
          volumeM3: k.vol,
          active: true,
        } as any);
      } else {
        await db.update(catalogItems)
          .set({ basePrice: k.price, name: krName, category: "Kitchen", active: true })
          .where(eq(catalogItems.sku, k.sku));
      }
    }

    await db.insert(catalogItems).values({
      name: "__kitchrack_r23_marker__",
      sku: "KITCHRACK-R23-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log("[startup] Round 23: Stainless Steel Kitchen Storage Rack / Cabinet — install $80, dismantle $60, relocate $130.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Round 24: Auditorium Chair (Fixed Seat) — market-rate catalog entry
  // Before this round there was no auditorium / theatre / lecture-hall chair
  // SKU at all, so the AI photo-scanner and wizard fell back to the generic
  // $150/unit placeholder (shared/pricing.ts → genericFallback). For a 50-
  // seat install that produced a $7,500 line — roughly 3× the real Singapore
  // market labour rate.
  //
  // Market rate basis (SG 2025-26):
  //   • All-in (supply + install) low tier  S$200–S$475/seat
  //   • Install-only labour ≈ 15–25% of all-in = S$45–S$65/seat in batches of 50+
  //   • Comparable existing rows: Ergonomic Chair install $40,
  //     Conference Table install $150, Dining Chair install $25
  //   • Floor-bolt + row alignment + levelling = moderate labour, batch-friendly
  //
  // Naming uses "Auditorium" + "Chair" + "Seat" tokens so the wizard's
  // fuzzy matcher (Estimate.tsx → matchByDescription, ≥40 token score) and
  // the AI photo detector both hit this entry for any of:
  //   "auditorium seat", "auditorium chair", "auditorium seating (per seat)",
  //   "lecture hall chair", "theatre seat", "cinema seat".
  // ──────────────────────────────────────────────────────────────────────────
  const r24 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "AUDCHAIR-R24-MARKER")).limit(1);
  if (r24.length === 0) {
    const audChairItems = [
      { sku: "AUDCHAIR-INSTALL",          svc: "install",           price: "50.00", vol: "0.20" },
      { sku: "AUDCHAIR-DISMANTLE",        svc: "dismantle",         price: "35.00", vol: "0.20" },
      { sku: "AUDCHAIR-RELOCATE",         svc: "relocate",          price: "50.00", vol: "0.20" },
      { sku: "AUDCHAIR-DISPOSE",          svc: "dispose",           price: "40.00", vol: "0.20" },
      { sku: "AUDCHAIR-DIS-DISP",         svc: "dismantle_dispose", price: "65.00", vol: "0.20" },
    ];
    const acName = "Auditorium Chair (Fixed Seat)";
    for (const a of audChairItems) {
      const existing = await db.select().from(catalogItems).where(eq(catalogItems.sku, a.sku)).limit(1);
      if (existing.length === 0) {
        await db.insert(catalogItems).values({
          name: acName,
          sku: a.sku,
          category: "Office",
          serviceType: a.svc,
          basePrice: a.price,
          volumeM3: a.vol,
          active: true,
        } as any);
      } else {
        await db.update(catalogItems)
          .set({ basePrice: a.price, name: acName, category: "Office", active: true })
          .where(eq(catalogItems.sku, a.sku));
      }
    }

    await db.insert(catalogItems).values({
      name: "__audchair_r24_marker__",
      sku: "AUDCHAIR-R24-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log("[startup] Round 24: Auditorium Chair (Fixed Seat) — install $50, dismantle $35, relocate $50, dispose $40, D+D $65.");
  }

  /* ── Round 25: Re-price Height-Adjustable Sit-Stand Desk dispose tiers ──
     Previous prices ($105 dispose / $180 D+D) were the highest of any
     office desk in the catalogue, despite the desk being similar in size
     to an L-Shaped Executive Desk ($65 / $115). Re-aligned so that
     dismantle+dispose lands at ~$100 — the same ballpark as Kids Study
     Desk with Hutch ($110) and L-Shaped Executive Desk ($115). The
     motor + steel frame still carries a small premium over a plain
     Office Desk ($35 / $65). */
  const r25 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "HEIGHTAD-R25-MARKER")).limit(1);
  if (r25.length === 0) {
    await db.update(catalogItems).set({ basePrice: "60.00" }).where(eq(catalogItems.sku, "HEIGHTAD-DISPOSE"));
    await db.update(catalogItems).set({ basePrice: "100.00" }).where(eq(catalogItems.sku, "HEIGHTAD-DIS-DISP"));

    await db.insert(catalogItems).values({
      name: "__heightad_r25_marker__",
      sku: "HEIGHTAD-R25-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log("[startup] Round 25: Height-Adjustable Sit-Stand Desk — dispose $105→$60, dismantle+dispose $180→$100.");
  }

  /* ── Round 26: Re-price desks/tables so customer-visible TOTAL (labor +
     mobilisation $39.90 + stairs $5) lands in a reasonable range, not
     just the labor line.

     Target customer total for a single mid-size office desk D+D = ~$110.
     With $44.90 of fees baked in, that means labor must be ~$65.

     Items adjusted (all are dispose / dismantle+dispose pairs):
       Height-Adjustable Sit-Stand Desk    $60/$100  → $40/$65   (~$85/$110 total)
       L-Shaped Executive Desk             $65/$115  → $50/$80   (~$95/$125 total — bigger, +$15)
       Kids Study Desk with Hutch          $65/$110  → $45/$75   (~$90/$120 total)
       Corner Study Desk or L-Shaped       $50/$90   → $40/$65   (~$85/$110 total)
       Heavy-Duty Workbench / Workshop     $80/$135  → $65/$100  (~$110/$145 total — kept higher, genuinely larger)

     Untouched on purpose:
       Office Desk standard ($35/$65 → ~$80/$110 total) — already at target
       IKEA Micke Desk ($30/$45 → ~$75/$90 total)       — small, correctly cheap
       Study Desk standard ($35/$60 → ~$80/$105 total)  — already at target
       Loft Bed with Desk — bed-class, not a desk
  */
  const r26 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "DESKREP-R26-MARKER")).limit(1);
  if (r26.length === 0) {
    const deskRepricing: Array<{ sku: string; price: string }> = [
      { sku: "HEIGHTAD-DISPOSE",  price: "40.00" },
      { sku: "HEIGHTAD-DIS-DISP", price: "65.00" },
      { sku: "LSHAPEDE-DISPOSE",  price: "50.00" },
      { sku: "LSHAPEDE-DIS-DISP", price: "80.00" },
      { sku: "KIDSSTUD-DISPOSE",  price: "45.00" },
      { sku: "KIDSSTUD-DIS-DISP", price: "75.00" },
      { sku: "CORNERST-DISPOSE",  price: "40.00" },
      { sku: "CORNERST-DIS-DISP", price: "65.00" },
      { sku: "HEAVYDUT-DISPOSE",  price: "65.00" },
      { sku: "HEAVYDUT-DIS-DISP", price: "100.00" },
    ];
    for (const d of deskRepricing) {
      await db.update(catalogItems).set({ basePrice: d.price }).where(eq(catalogItems.sku, d.sku));
    }

    await db.insert(catalogItems).values({
      name: "__desk_reprice_r26_marker__",
      sku: "DESKREP-R26-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log("[startup] Round 26: Desk dispose tiers re-priced so totals (incl. mobilisation) land $85–$145.");
  }

  /* ── Round 27: Backfill volumetric data across the whole catalog ─────────
     Carry-only relocation pricing adds a $20/m³ "Carry Handling" fee on top
     of the transport fee, and trip count is also volume-driven. Many older
     dispose / dismantle+dispose / install / dismantle rows were seeded
     without volume_m3, so customers booking those services don't see the
     per-cubic-metre charge and we under-bill large carry loads.

     Two-step backfill:
       1. For every active item missing volume_m3, copy from a sibling
          (same name, different service_type) that already has a sensible
          value. This recovers ~215 of 218 missing rows automatically and
          keeps volumes consistent across an item's service variants.
       2. Set a manual value for the one remaining real catalog item with
          no sibling reference ("Combo Cabinet (Drawers + Swing Doors)").
          Internal markers (_internal / _System categories) are left alone.
  */
  const r27 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "VOL-BACKFILL-R27-MARKER")).limit(1);
  if (r27.length === 0) {
    // Step 1: sibling backfill — copy volume_m3 from another row with the
    // same name that does have a positive value. MAX() handles the case
    // where multiple siblings exist with slightly different volumes (we
    // err on the side of the larger one, which keeps the fee fair).
    const backfillRes = await db.execute(sql`
      UPDATE catalog_items AS target
      SET volume_m3 = sibling.vol
      FROM (
        SELECT name, MAX(volume_m3::numeric) AS vol
        FROM catalog_items
        WHERE active = true
          AND volume_m3 IS NOT NULL
          AND volume_m3::numeric > 0
        GROUP BY name
      ) AS sibling
      WHERE target.name = sibling.name
        AND target.active = true
        AND (target.volume_m3 IS NULL OR target.volume_m3::numeric <= 0)
    `);

    // Step 2: manual fill for any active customer-facing rows still without
    // a volume (i.e. no sibling reference anywhere in the catalog).
    const manualVolumes: Array<{ name: string; volume: string }> = [
      // Storage cabinet, drawers + swing doors — similar to a 4-door
      // sideboard, roughly 1.0–1.4 m³.
      { name: "Combo Cabinet (Drawers + Swing Doors)", volume: "1.20" },
    ];
    for (const m of manualVolumes) {
      await db.execute(sql`
        UPDATE catalog_items
        SET volume_m3 = ${m.volume}
        WHERE name = ${m.name}
          AND active = true
          AND (volume_m3 IS NULL OR volume_m3::numeric <= 0)
      `);
    }

    await db.insert(catalogItems).values({
      name: "__vol_backfill_r27_marker__",
      sku: "VOL-BACKFILL-R27-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    const rowCount = (backfillRes as any).rowCount ?? "?";
    console.log(`[startup] Round 27: Catalog volume backfill — copied volume_m3 from sibling rows for ${rowCount} items + 1 manual fill (Combo Cabinet).`);
  }

  /* ── Round 28: Catalog volume accuracy pass ─────────────────────────────
     Round 27 just guaranteed every row HAS a volume. This round fixes two
     remaining accuracy issues:

       (a) Same-name duplicates with different volumes — e.g. two rows for
           "Hydraulic Storage Bed (King)" carrying 1.20 and 0.65 m³. We
           normalise every name to the MAX value across its rows. This is
           the right direction for Carry Only (the item is moved intact,
           not dismantled), and never reduces a fee that's already in use.
       (b) A curated list of heavy / oversized items whose intact-carry
           volume was clearly underestimated against real Singapore moves
           (e.g. king-bed frame intact, French-door fridge, massage chair,
           75-inch TV in box). These were mostly back-of-envelope D&R
           volumes that don't match an item moved as one piece.

     Marker: VOL-ACCURACY-R28-MARKER.
  */
  const r28 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "VOL-ACCURACY-R28-MARKER")).limit(1);
  if (r28.length === 0) {
    // (a) Normalise same-name duplicates to the MAX volume per name.
    const dedupeRes = await db.execute(sql`
      UPDATE catalog_items AS target
      SET volume_m3 = sibling.vol
      FROM (
        SELECT name, MAX(volume_m3::numeric) AS vol
        FROM catalog_items
        WHERE active = true
          AND volume_m3 IS NOT NULL
          AND volume_m3::numeric > 0
        GROUP BY name
        HAVING COUNT(DISTINCT volume_m3::numeric) > 1
      ) AS sibling
      WHERE target.name = sibling.name
        AND target.active = true
        AND (target.volume_m3 IS NULL OR target.volume_m3::numeric < sibling.vol)
    `);

    // (b) Curated heavy-item corrections. Volumes here represent the item
    // as it actually travels (intact, in carton, or in transport position).
    // These apply to ALL service types for a given name — install and
    // dismantle volumes track the same physical object.
    const curated: Array<{ name: string; volume: string; note: string }> = [
      // Beds — intact carry-only volumes (mattress sold separately)
      { name: "King Bed Frame",                     volume: "1.20", note: "intact, ~1.9m × 2.0m × 0.3m" },
      { name: "Queen Bed Frame",                    volume: "0.90", note: "intact, ~1.6m × 2.0m × 0.3m" },
      { name: "Double Bed Frame",                   volume: "0.75", note: "intact double" },
      { name: "Super Single Bed Frame",             volume: "0.55", note: "intact super single" },
      { name: "Single Bed Frame",                   volume: "0.45", note: "intact single" },
      // Heavy living-room items
      { name: "Massage Chair",                      volume: "1.50", note: "premium massage chair, intact" },
      { name: "Television (75\" and above)",        volume: "0.50", note: "boxed 75\"+ TV" },
      // Appliances
      { name: "Refrigerator (French Door / 4-Door)",                 volume: "1.20", note: "intact French-door fridge" },
      { name: "Refrigerator — French Door or Side-by-Side",          volume: "1.20", note: "intact French-door / side-by-side" },
      { name: "Refrigerator (2-Door / Standard)",                    volume: "0.80", note: "intact 2-door" },
      { name: "Refrigerator — Double Door (180 to 400L)",            volume: "0.80", note: "intact 2-door" },
      // Specialty
      { name: "Pool / Billiard Table",              volume: "3.00", note: "regulation pool table, dismantled bulk" },
      { name: "Piano (Upright)",                    volume: "1.50", note: "upright piano intact" },
      { name: "Upright Piano (within unit or same floor)", volume: "1.50", note: "upright piano intact" },
      { name: "Piano (Grand)",                      volume: "3.00", note: "grand piano intact" },
      { name: "Baby Grand Piano (within unit or same floor)", volume: "3.00", note: "baby grand intact" },
    ];
    let curatedCount = 0;
    for (const c of curated) {
      const res = await db.execute(sql`
        UPDATE catalog_items
        SET volume_m3 = ${c.volume}
        WHERE name = ${c.name} AND active = true
      `);
      curatedCount += (res as any).rowCount ?? 0;
    }

    await db.insert(catalogItems).values({
      name: "__vol_accuracy_r28_marker__",
      sku: "VOL-ACCURACY-R28-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    const dedupeCount = (dedupeRes as any).rowCount ?? "?";
    console.log(`[startup] Round 28: Volume accuracy — deduped ${dedupeCount} same-name conflicts to MAX value + ${curatedCount} curated heavy-item corrections.`);
  }

  /* ─── Round 29: Sliding Door Wardrobe (4-door / Mirror) SKU ────────────────
     Real-world: customers regularly send photos of large 4-panel sliding
     wardrobes — often with full-length mirrored doors. Pre-R29, the catalog
     only had 2-door and 3-door sliding wardrobe variants, so the AI photo
     detector either under-priced (mapping to 3-door at $230 relocate) or
     mis-split the unit into "3-door wardrobe + swing door cabinet".

     This round introduces a dedicated heavy-tier SKU:
        "Sliding Door Wardrobe (4-door / Mirror)"
     with install/dismantle/relocate/dispose/dismantle_dispose variants and
     a curated transport volume.

     Heavier than the 3-door because:
        – ~40–60% wider (4 panels vs 3)
        – mirrored panels = fragile, requires padding, extra man-power
        – heavier carcass, needs 2-man lift, slower stair-handling

     Marker: WARDROBE-4DOOR-MIRROR-R29-MARKER.
  */
  const r29 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "WARDROBE-4DOOR-MIRROR-R29-MARKER")).limit(1);
  if (r29.length === 0) {
    const newRows: Array<{ sku: string; serviceType: string; basePrice: string; volumeM3: string }> = [
      { sku: "SLDR4M-INSTALL",       serviceType: "install",            basePrice: "240.00", volumeM3: "1.40" },
      { sku: "SLDR4M-DISMANTLE",     serviceType: "dismantle",          basePrice: "170.00", volumeM3: "1.40" },
      { sku: "SLDR4M-RELOCATE",      serviceType: "relocate",           basePrice: "310.00", volumeM3: "1.40" },
      { sku: "SLDR4M-DISPOSE",       serviceType: "dispose",            basePrice: "130.00", volumeM3: "1.40" },
      { sku: "SLDR4M-DIS-DISP",      serviceType: "dismantle_dispose",  basePrice: "210.00", volumeM3: "1.40" },
    ];
    let inserted = 0;
    for (const row of newRows) {
      const exists = await db.select().from(catalogItems).where(eq(catalogItems.sku, row.sku)).limit(1);
      if (exists.length === 0) {
        await db.insert(catalogItems).values({
          name: "Sliding Door Wardrobe (4-door / Mirror)",
          sku: row.sku,
          category: "Wardrobes",
          serviceType: row.serviceType,
          basePrice: row.basePrice,
          volumeM3: row.volumeM3,
          active: true,
        } as any);
        inserted++;
      }
    }

    await db.insert(catalogItems).values({
      name: "__wardrobe_4door_mirror_r29_marker__",
      sku: "WARDROBE-4DOOR-MIRROR-R29-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log(`[startup] Round 29: Sliding Door Wardrobe (4-door / Mirror) — inserted ${inserted} new SKU rows.`);
  }

  /* ── Round 30: Backfill missing RELOCATE variants ────────────────────────
     Survey of the catalog found two real furniture items that have install
     and dismantle prices but no relocate (Carry Only / D&R) variant, so
     they could never appear on a relocation quote. Add them idempotently
     so every catalog furniture item can be quoted as a Relocate. Volume
     mirrors the sibling install rows already in the catalog.

     (Drilling / per-hole / per-bracket service line items are intentionally
     excluded — they describe on-site work, not movable furniture.) */
  {
    const round30Items = [
      {
        name: "Combo Cabinet (Drawers + Swing Doors)",
        sku: "CMBCAB-RELOCATE",
        category: "Storage",
        serviceType: "relocate",
        basePrice: "180.00",
        volumeM3: "1.20",
      },
      {
        name: "Nightstand or Bedside Table (pair)",
        sku: "NIGHTSTAND-PAIR-RELOCATE",
        category: "Bedroom",
        serviceType: "relocate",
        basePrice: "85.00",
        volumeM3: "0.30",
      },
    ];
    let r30Inserted = 0;
    for (const row of round30Items) {
      const existing = await db
        .select()
        .from(catalogItems)
        .where(and(eq(catalogItems.name, row.name), eq(catalogItems.serviceType, "relocate")));
      if (existing.length === 0) {
        await db.insert(catalogItems).values(row as any).onConflictDoNothing();
        r30Inserted++;
      }
    }
    if (r30Inserted > 0) {
      console.log(`[startup] Round 30: Backfilled ${r30Inserted} missing relocate variant(s) so every catalog item is quotable as a Relocate.`);
    }
  }

  /* ── Round 31: Re-price Bunk Beds to Singapore market ────────────────────
     The previous install/dismantle base prices were too low for a real
     bunk-bed job. Effect on the customer-visible D&R bundle:

       Standard:    (install 150 + dismantle 100) × 0.60 = $150   (TOO CHEAP —
                    came out lower than Carry Only $210 even though dismantle
                    + reinstall is genuinely MORE work; bunk beds rarely fit
                    in a lift intact so D&R is the realistic scenario).
       with Trundle:(install 170 + dismantle 120) × 0.60 = $174   (same issue).

     New rates align with Singapore market (2 movers, ~2 h on site) and put
     D&R sensibly above the Carry Only price:

       Standard:    install 250 + dismantle 170 → D&R $252
       Trundle:     install 290 + dismantle 200 → D&R $294

     Idempotent — uses `WHERE base_price = <old>` so re-runs after the new
     prices land are no-ops; will not stomp future manual edits. */
  {
    // Target-state idempotency: read the current row, only UPDATE when it's
    // off-target. Avoids two failure modes from the previous implementation:
    //   1) a hard-coded `oldPrice` guard misses any row a manual edit has
    //      already nudged (Trundle had drifted to 190/140), so the UPDATE
    //      silently did nothing.
    //   2) drizzle/neon doesn't reliably expose `rowCount` on update(), so
    //      a log line based on rowCount was a coin flip even when the UPDATE
    //      ran. Reading first and skipping when already-correct makes the
    //      block safe to re-run forever and gives an honest log line.
    const bunkRepriceTargets = [
      { sku: "BUNK-INSTALL",       newPrice: "250.00", label: "Bunk Bed (Standard) install" },
      { sku: "BUNK-DISMANTLE",     newPrice: "170.00", label: "Bunk Bed (Standard) dismantle" },
      { sku: "BUNK-TRD-INSTALL",   newPrice: "290.00", label: "Bunk Bed (with Trundle) install" },
      { sku: "BUNK-TRD-DISMANTLE", newPrice: "200.00", label: "Bunk Bed (with Trundle) dismantle" },
    ];
    let r31Updated = 0;
    for (const t of bunkRepriceTargets) {
      const rows = await db.select().from(catalogItems).where(eq(catalogItems.sku, t.sku));
      for (const row of rows) {
        // numeric() comes back as a string like "150.00"; normalise both sides.
        const current = Number(row.basePrice);
        const target  = Number(t.newPrice);
        if (!Number.isFinite(current) || current === target) continue;
        await db
          .update(catalogItems)
          .set({ basePrice: t.newPrice })
          .where(eq(catalogItems.id, row.id));
        r31Updated++;
        console.log(`[startup] Round 31: Re-priced ${t.label} ${t.sku} $${current.toFixed(2)} → $${target.toFixed(2)}.`);
      }
    }
    if (r31Updated > 0) {
      console.log(`[startup] Round 31: Bunk bed catalog re-priced for SG market (${r31Updated} row(s) updated). D&R bundles now $252 / $294.`);
    }
  }

  /* ── Round 32: Partial Parts Installation (assembly-assist) ───────────────
     Real-world: customers sometimes assemble most of an item themselves and
     only need help finishing one part — e.g. a storage bed where the frame is
     built but the hydraulic gas-lift mechanism still needs to be attached, or
     screws/brackets that won't go in. The catalog only had full-item installs
     (e.g. Hydraulic Storage Bed install $170/$200), so these small "finish the
     last part" jobs had no line item and couldn't be quoted accurately.

     This round adds two market-priced SKUs (Singapore, 2026):
        – "Partial Parts Installation (Minimum Callout)" $80
          General assembly-assist: attach missing parts, fix screws/brackets
          on an item the customer has mostly put together. Aligns with the
          local handyman minimum-callout rate (~$60–$80, 2 movers on site).
        – "Hydraulic Mechanism Attachment (Storage Bed)" $100
          Attach gas-lift hydraulic struts + fixing screws to an already-
          assembled storage bed. A 2-person job (lift/hold platform, align
          struts), priced well below the full hydraulic install ($170).

     Marker: PARTIAL-PARTS-R32-MARKER. */
  const r32 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "PARTIAL-PARTS-R32-MARKER")).limit(1);
  if (r32.length === 0) {
    const newRows: Array<{ name: string; sku: string; category: string; basePrice: string }> = [
      { name: "Partial Parts Installation (Minimum Callout)", sku: "PARTIAL-INSTALL-MIN", category: "Specialty", basePrice: "80.00" },
      { name: "Hydraulic Mechanism Attachment (Storage Bed)", sku: "HYDR-MECH-ATTACH",    category: "Beds",      basePrice: "100.00" },
    ];
    let inserted = 0;
    for (const row of newRows) {
      const exists = await db.select().from(catalogItems).where(eq(catalogItems.sku, row.sku)).limit(1);
      if (exists.length === 0) {
        await db.insert(catalogItems).values({
          name: row.name,
          sku: row.sku,
          category: row.category,
          serviceType: "install",
          basePrice: row.basePrice,
          active: true,
        } as any);
        inserted++;
      }
    }

    await db.insert(catalogItems).values({
      name: "__partial_parts_r32_marker__",
      sku: "PARTIAL-PARTS-R32-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log(`[startup] Round 32: Partial Parts Installation — inserted ${inserted} new SKU row(s) (assembly-assist / hydraulic mechanism).`);
  }

  /* ─── Round 33: Hinged Door Wardrobe (3-door) SKU ─────────────────────────
     Real-world: the "normal" swing-door (hinged) wardrobe is one of the most
     common units in Singapore homes, and the 3-door size is the everyday
     bestseller — wider than the compact 2-door but not as bulky as the 4-door.
     Pre-R33 the catalog only had hinged 2-door and 4-door variants, so a
     standard 3-door wardrobe had to be mis-mapped to a 2-door (under-quoted)
     or a 4-door (over-quoted). The sliding line already covers 2/3/4 doors;
     this round closes the gap on the hinged line.

     Pricing is interpolated between the existing hinged 2-door and 4-door
     across every service type, so the door-count ladder stays consistent:
        install            $100  →  $125  →  $150
        dismantle          $75   →  $92   →  $110
        relocate           $105  →  $130  →  $156
        dispose            $65   →  $82   →  $100
        dismantle_dispose  $110  →  $138  →  $165
     Transport volume 0.95 m³ sits between the 2-door (0.70) and 4-door (1.20).

     Marker: HINGED-3DOOR-R33-MARKER.
  */
  const r33 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "HINGED-3DOOR-R33-MARKER")).limit(1);
  if (r33.length === 0) {
    const newRows: Array<{ sku: string; serviceType: string; basePrice: string; volumeM3: string }> = [
      { sku: "HGD3-INSTALL",   serviceType: "install",           basePrice: "125.00", volumeM3: "0.95" },
      { sku: "HGD3-DISMANTLE", serviceType: "dismantle",         basePrice: "92.00",  volumeM3: "0.95" },
      { sku: "HGD3-RELOCATE",  serviceType: "relocate",          basePrice: "130.00", volumeM3: "0.95" },
      { sku: "HGD3-DISPOSE",   serviceType: "dispose",           basePrice: "82.00",  volumeM3: "0.95" },
      { sku: "HGD3-DIS-DISP",  serviceType: "dismantle_dispose", basePrice: "138.00", volumeM3: "0.95" },
    ];
    let inserted = 0;
    for (const row of newRows) {
      const exists = await db.select().from(catalogItems).where(eq(catalogItems.sku, row.sku)).limit(1);
      if (exists.length === 0) {
        await db.insert(catalogItems).values({
          name: "Hinged Door Wardrobe (3-door)",
          sku: row.sku,
          category: "Wardrobes",
          serviceType: row.serviceType,
          basePrice: row.basePrice,
          volumeM3: row.volumeM3,
          active: true,
        } as any);
        inserted++;
      }
    }

    await db.insert(catalogItems).values({
      name: "__hinged_3door_r33_marker__",
      sku: "HINGED-3DOOR-R33-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log(`[startup] Round 33: Hinged Door Wardrobe (3-door) — inserted ${inserted} new SKU row(s).`);
  }

  /* ─── Round 34: Small Appliances & Items (relocation) ─────────────────────
     Real-world: customers frequently list small portable appliances and
     office odds-and-ends in a move (toaster, hair dryer, desktop printer,
     office task chair, water filter/dispenser). Pre-R34 these had no catalog
     entry, so the quoter had nothing to price them against and they fell
     through to a generic estimate.

     This round adds a dedicated "Small Appliances & Items" group so each is
     individually quotable for a Relocate, with a curated transport volume
     (volumeM3 = footprint in the van) that feeds the trip/volume calc. These
     are carry-as-is items — no install/dismantle service applies — so only a
     relocate row is created, matching the existing relocate-only appliance
     pattern. Prices are low per-item add-ons; the $80 job minimum still
     governs tiny single-item jobs.

        Toaster                     $15   0.03 m³
        Hair Dryer                  $12   0.02 m³
        Office Printer              $30   0.08 m³
        Office Desk Chair           $30   0.30 m³
        Water Filter / Dispenser    $25   0.10 m³

     Marker: SMALL-ITEMS-R34-MARKER.
  */
  const r34 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "SMALL-ITEMS-R34-MARKER")).limit(1);
  if (r34.length === 0) {
    const newRows: Array<{ name: string; sku: string; basePrice: string; volumeM3: string }> = [
      { name: "Toaster",                  sku: "SMITM-TOASTER-RELOCATE",     basePrice: "15.00", volumeM3: "0.03" },
      { name: "Hair Dryer",               sku: "SMITM-HAIRDRYER-RELOCATE",   basePrice: "12.00", volumeM3: "0.02" },
      { name: "Office Printer",           sku: "SMITM-PRINTER-RELOCATE",     basePrice: "30.00", volumeM3: "0.08" },
      { name: "Office Desk Chair",        sku: "SMITM-DESKCHAIR-RELOCATE",   basePrice: "30.00", volumeM3: "0.30" },
      { name: "Water Filter / Dispenser", sku: "SMITM-WATERFILTER-RELOCATE", basePrice: "25.00", volumeM3: "0.10" },
    ];
    let inserted = 0;
    for (const row of newRows) {
      const exists = await db.select().from(catalogItems).where(eq(catalogItems.sku, row.sku)).limit(1);
      if (exists.length === 0) {
        await db.insert(catalogItems).values({
          name: row.name,
          sku: row.sku,
          category: "Small Appliances & Items",
          serviceType: "relocate",
          basePrice: row.basePrice,
          volumeM3: row.volumeM3,
          active: true,
        } as any);
        inserted++;
      }
    }

    await db.insert(catalogItems).values({
      name: "__small_items_r34_marker__",
      sku: "SMALL-ITEMS-R34-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log(`[startup] Round 34: Small Appliances & Items — inserted ${inserted} new relocate SKU row(s).`);
  }

  /* ─── Round 35: Display Cabinet door-count variants (SG market) ───────────
     Real-world: glass-front display cabinets are sold and moved in standard
     door-count sizes (2 / 3 / 4 / 6 door). Pre-R35 the catalog had only a
     single generic "Display Cabinet", so a compact 2-door unit and a large
     6-door wall of cabinets were quoted at the same price. This round adds a
     door-count ladder priced for the Singapore market — consistent with the
     existing wardrobe door-count ladder, plus a modest premium for the
     careful handling that fragile glass doors require.

     Per-variant pricing (install / dismantle / relocate-carry / dispose /
     dismantle_dispose, with transport volume in m³). The price the customer
     sees for a Relocate is the bundled D&R rate = (install + dismantle) × 0.60
     (see computeDRPrice), shown in the (D&R $) column below:
        2-door   100 / 75  / 120 / 60  / 110    0.50 m³   (D&R $105)
        3-door   130 / 95  / 150 / 75  / 140    0.70 m³   (D&R $135)
        4-door   160 / 115 / 185 / 95  / 170    0.95 m³   (D&R $165)
        6-door   220 / 160 / 250 / 130 / 230    1.40 m³   (D&R $228)
     The generic "Display Cabinet" row is left in place as the default for an
     unspecified size.

     Marker: DISPLAY-CABINET-DOORS-R35-MARKER.
  */
  const r35 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "DISPLAY-CABINET-DOORS-R35-MARKER")).limit(1);
  if (r35.length === 0) {
    const variants: Array<{ name: string; skuBase: string; install: string; dismantle: string; relocate: string; dispose: string; disDisp: string; volumeM3: string }> = [
      { name: "Display Cabinet (2-door)", skuBase: "DISPCAB-2DR", install: "100.00", dismantle: "75.00",  relocate: "120.00", dispose: "60.00",  disDisp: "110.00", volumeM3: "0.50" },
      { name: "Display Cabinet (3-door)", skuBase: "DISPCAB-3DR", install: "130.00", dismantle: "95.00",  relocate: "150.00", dispose: "75.00",  disDisp: "140.00", volumeM3: "0.70" },
      { name: "Display Cabinet (4-door)", skuBase: "DISPCAB-4DR", install: "160.00", dismantle: "115.00", relocate: "185.00", dispose: "95.00",  disDisp: "170.00", volumeM3: "0.95" },
      { name: "Display Cabinet (6-door)", skuBase: "DISPCAB-6DR", install: "220.00", dismantle: "160.00", relocate: "250.00", dispose: "130.00", disDisp: "230.00", volumeM3: "1.40" },
    ];
    let inserted = 0;
    for (const v of variants) {
      const rows: Array<{ sku: string; serviceType: string; basePrice: string }> = [
        { sku: `${v.skuBase}-INSTALL`,   serviceType: "install",           basePrice: v.install },
        { sku: `${v.skuBase}-DISMANTLE`, serviceType: "dismantle",         basePrice: v.dismantle },
        { sku: `${v.skuBase}-RELOCATE`,  serviceType: "relocate",          basePrice: v.relocate },
        { sku: `${v.skuBase}-DISPOSE`,   serviceType: "dispose",           basePrice: v.dispose },
        { sku: `${v.skuBase}-DIS-DISP`,  serviceType: "dismantle_dispose", basePrice: v.disDisp },
      ];
      for (const row of rows) {
        const exists = await db.select().from(catalogItems).where(eq(catalogItems.sku, row.sku)).limit(1);
        if (exists.length === 0) {
          await db.insert(catalogItems).values({
            name: v.name,
            sku: row.sku,
            category: "Storage",
            serviceType: row.serviceType,
            basePrice: row.basePrice,
            volumeM3: v.volumeM3,
            active: true,
          } as any);
          inserted++;
        }
      }
    }

    await db.insert(catalogItems).values({
      name: "__display_cabinet_doors_r35_marker__",
      sku: "DISPLAY-CABINET-DOORS-R35-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log(`[startup] Round 35: Display Cabinet door-count variants (2/3/4/6-door) — inserted ${inserted} new SKU row(s).`);
  }

  /* ─── Round 36: IKEA PAX Wardrobe — per-frame, door-type pricing ──────────
     Problem: the old catalog had ONE flat "IKEA Pax Wardrobe" price for every
     design. A tiny 50cm single open frame and a 3-bay sliding-mirror wall were
     quoted identically — over-charging small jobs and under-charging the big,
     labour-heavy ones (the real cost drivers are the NUMBER of frames/bays and
     the DOOR TYPE: open < hinged < sliding/mirror).

     Fix: retire the single flat PAX item and replace it with a per-frame ladder
     by door type. The customer sets quantity = the number of frames/bays, and
     picks the door type that matches their wardrobe. Prices are PER FRAME and
     calibrated to the Singapore market (IKEA's own assembly ≈ 20% of retail; a
     modest premium is justified for dismantling/reassembling used furniture).

     Per-frame pricing (install / dismantle / relocate-carry / dispose /
     dismantle_dispose, with transport volume in m³). The Relocate price the
     customer sees is the bundled D&R rate = (install + dismantle) × 0.60
     (see computeDRPrice), shown in the (D&R $) column:
        No doors (open)          75  / 45 / 72  / 40 / 70   0.40 m³  (D&R $72)
        Hinged doors            100  / 60 / 96  / 45 / 85   0.42 m³  (D&R $96)
        Sliding / mirror doors  130  / 78 / 125 / 55 / 105  0.45 m³  (D&R $125)

     Marker: PAX-PERFRAME-R36B-MARKER.
  */
  const r36 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "PAX-PERFRAME-R36B-MARKER")).limit(1);
  if (r36.length === 0) {
    // 1. Retire every legacy WHOLE-UNIT PAX representation (the flat single-price
    //    item plus the older door-count whole-unit variants). These all quote one
    //    price regardless of how many frames the customer has, which is exactly the
    //    over/under-charging problem the per-frame ladder below fixes.
    //    getCatalogItems() filters active=true, so deactivating hides them from the
    //    estimator while leaving history intact. Names are matched exactly so the new
    //    "IKEA PAX Wardrobe (per frame, ...)" rows are never affected.
    const legacyNames = [
      "IKEA Pax Wardrobe",
      "IKEA PAX Wardrobe (2-door)",
      "IKEA PAX Wardrobe (3-door)",
      "IKEA PAX Wardrobe (Sliding Doors)",
    ];
    let retired = 0;
    for (const nm of legacyNames) {
      const existingRows = await db.select({ id: catalogItems.id }).from(catalogItems).where(eq(catalogItems.name, nm));
      if (existingRows.length > 0) {
        await db.update(catalogItems).set({ active: false }).where(eq(catalogItems.name, nm));
        retired += existingRows.length;
      }
    }

    // 2. Per-frame, door-type ladder. Quantity = number of frames/bays.
    const variants: Array<{ name: string; skuBase: string; install: string; dismantle: string; relocate: string; dispose: string; disDisp: string; volumeM3: string }> = [
      { name: "IKEA PAX Wardrobe (per frame, no doors)",                skuBase: "PAX-PF-OPEN",  install: "75.00",  dismantle: "45.00", relocate: "72.00",  dispose: "40.00", disDisp: "70.00",  volumeM3: "0.40" },
      { name: "IKEA PAX Wardrobe (per frame, hinged doors)",           skuBase: "PAX-PF-HINGE", install: "100.00", dismantle: "60.00", relocate: "96.00",  dispose: "45.00", disDisp: "85.00",  volumeM3: "0.42" },
      { name: "IKEA PAX Wardrobe (per frame, sliding / mirror doors)", skuBase: "PAX-PF-SLIDE", install: "130.00", dismantle: "78.00", relocate: "125.00", dispose: "55.00", disDisp: "105.00", volumeM3: "0.45" },
    ];
    let inserted = 0;
    for (const v of variants) {
      const rows: Array<{ sku: string; serviceType: string; basePrice: string }> = [
        { sku: `${v.skuBase}-INSTALL`,   serviceType: "install",           basePrice: v.install },
        { sku: `${v.skuBase}-DISMANTLE`, serviceType: "dismantle",         basePrice: v.dismantle },
        { sku: `${v.skuBase}-RELOCATE`,  serviceType: "relocate",          basePrice: v.relocate },
        { sku: `${v.skuBase}-DISPOSE`,   serviceType: "dispose",           basePrice: v.dispose },
        { sku: `${v.skuBase}-DIS-DISP`,  serviceType: "dismantle_dispose", basePrice: v.disDisp },
      ];
      for (const row of rows) {
        const exists = await db.select().from(catalogItems).where(eq(catalogItems.sku, row.sku)).limit(1);
        if (exists.length === 0) {
          await db.insert(catalogItems).values({
            name: v.name,
            sku: row.sku,
            category: "IKEA Wardrobes",
            serviceType: row.serviceType,
            basePrice: row.basePrice,
            volumeM3: v.volumeM3,
            active: true,
          } as any);
          inserted++;
        }
      }
    }

    await db.insert(catalogItems).values({
      name: "__pax_perframe_r36b_marker__",
      sku: "PAX-PERFRAME-R36B-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log(`[startup] Round 36: PAX per-frame door-type ladder — retired ${retired} legacy whole-unit PAX row(s), inserted ${inserted} per-frame SKU row(s).`);
  }

  /* ─── Round 37: Wardrobe Lighting Installation (per light / strip) ─────────
     The Moving Guy now offers wardrobe interior lighting installation as an
     add-on service. The customer supplies the IKEA light kit (sensor LED strip
     / spotlights); we fit it, hide the wiring, and connect the driver. Charged
     PER LIGHT / STRIP installed at $20 each — the customer sets quantity = the
     number of lights/strips they want fitted. Install-only add-on (no
     dismantle/relocate/dispose variants); negligible transport volume since the
     light kit is customer-supplied.
     Marker: WARDROBE-LIGHTING-R37-MARKER. */
  const r37 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "WARDROBE-LIGHTING-R37-MARKER")).limit(1);
  if (r37.length === 0) {
    let inserted = 0;
    const existing = await db.select().from(catalogItems).where(eq(catalogItems.sku, "WARDROBE-LIGHT-INSTALL")).limit(1);
    if (existing.length === 0) {
      await db.insert(catalogItems).values({
        name: "Wardrobe Lighting Installation (per light / strip)",
        sku: "WARDROBE-LIGHT-INSTALL",
        category: "Wardrobes",
        serviceType: "install",
        basePrice: "20.00",
        volumeM3: "0.02",
        active: true,
      } as any);
      inserted++;
    }
    await db.insert(catalogItems).values({
      name: "__wardrobe_lighting_r37_marker__",
      sku: "WARDROBE-LIGHTING-R37-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);
    console.log(`[startup] Round 37: Wardrobe Lighting Installation — inserted ${inserted} new SKU row(s) ($20 per light/strip).`);
  }

  /* ─── Round 38: Common loose move items (boxes, bags, small appliances) ────
     Customers pasting a real moving list routinely include everyday loose
     items the catalog had no row for — Toyogo / cardboard boxes, Batam carrier
     bags, luggage, small kitchen appliances, kitchenware, a study/arm chair,
     a store rack, a movable trolley, a standing mirror, etc. With no catalog
     match these fell through to the relocate GENERIC fallback ($150 × 1.5 =
     ~$225 EACH), which badly over-quoted a normal move (e.g. 17 loose bags →
     ~$3,825). See attached "33 items / $17,185" example.

     This round adds dedicated RELOCATE rows so each is auto-detected on paste
     and priced at a sensible, Singapore-market carry rate, comparative to the
     existing Carton Box ($3.50–$18), Air Fryer ($30) and chair ($25–33) rows.
     These are carry-as-is items (no install/dismantle service), so only a
     relocate row is created — matching the Round 34 small-appliance pattern.
     Names are kept short and generic so the estimator's paste matcher resolves
     colloquial phrasings (e.g. "Mayer rice cooker" → "Rice Cooker", "Toyogo
     boxes" → "Toyogo Box", "Movable trolley" → "Trolley").

     Marker: LOOSE-MOVE-ITEMS-R38-MARKER.
  */
  const r38 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "LOOSE-MOVE-ITEMS-R38-MARKER")).limit(1);
  if (r38.length === 0) {
    const newRows: Array<{ name: string; sku: string; category: string; basePrice: string; volumeM3: string }> = [
      // Boxes, bags & containers
      { name: "Toyogo Box",        sku: "R38-TOYOGO-BOX-RELOCATE",     category: "Moving Boxes", basePrice: "8.00",  volumeM3: "0.10" },
      { name: "Cardbox",           sku: "R38-CARDBOX-RELOCATE",        category: "Moving Boxes", basePrice: "6.00",  volumeM3: "0.08" },
      { name: "Batam Bag",         sku: "R38-BATAM-BAG-RELOCATE",      category: "Moving Boxes", basePrice: "8.00",  volumeM3: "0.12" },
      { name: "Loose Bag",         sku: "R38-LOOSE-BAG-RELOCATE",      category: "Moving Boxes", basePrice: "6.00",  volumeM3: "0.06" },
      { name: "Luggage",           sku: "R38-LUGGAGE-RELOCATE",        category: "Moving Boxes", basePrice: "10.00", volumeM3: "0.10" },
      { name: "Backpack",          sku: "R38-BACKPACK-RELOCATE",       category: "Moving Boxes", basePrice: "5.00",  volumeM3: "0.04" },
      { name: "Laundry Basket",    sku: "R38-LAUNDRY-BASKET-RELOCATE", category: "Moving Boxes", basePrice: "8.00",  volumeM3: "0.10" },
      // Small appliances & kitchenware
      { name: "Hotpot Cooker",     sku: "R38-HOTPOT-COOKER-RELOCATE",  category: "Small Appliances & Items", basePrice: "20.00", volumeM3: "0.04" },
      { name: "Rice Cooker",       sku: "R38-RICE-COOKER-RELOCATE",    category: "Small Appliances & Items", basePrice: "18.00", volumeM3: "0.03" },
      { name: "Water Boiler",      sku: "R38-WATER-BOILER-RELOCATE",   category: "Small Appliances & Items", basePrice: "18.00", volumeM3: "0.03" },
      { name: "Water Dispenser",   sku: "R38-WATER-DISPENSER-RELOCATE",category: "Small Appliances & Items", basePrice: "25.00", volumeM3: "0.10" },
      { name: "Air Purifier",      sku: "R38-AIR-PURIFIER-RELOCATE",   category: "Small Appliances & Items", basePrice: "30.00", volumeM3: "0.10" },
      { name: "Air Cooler",        sku: "R38-AIR-COOLER-RELOCATE",     category: "Small Appliances & Items", basePrice: "35.00", volumeM3: "0.15" },
      { name: "Monitor",           sku: "R38-MONITOR-RELOCATE",        category: "Small Appliances & Items", basePrice: "18.00", volumeM3: "0.05" },
      { name: "Pots & Pans",       sku: "R38-POTS-PANS-RELOCATE",      category: "Small Appliances & Items", basePrice: "12.00", volumeM3: "0.06" },
      { name: "Plates & Crockery", sku: "R38-PLATES-RELOCATE",         category: "Small Appliances & Items", basePrice: "10.00", volumeM3: "0.05" },
      // Chairs & seating
      { name: "Study Chair",       sku: "R38-STUDY-CHAIR-RELOCATE",    category: "Chairs & Seating", basePrice: "25.00", volumeM3: "0.15" },
      { name: "Arm Chair",         sku: "R38-ARM-CHAIR-RELOCATE",      category: "Chairs & Seating", basePrice: "33.00", volumeM3: "0.40" },
      { name: "Folding Chair",     sku: "R38-FOLDING-CHAIR-RELOCATE",  category: "Chairs & Seating", basePrice: "22.00", volumeM3: "0.20" },
      // Storage & misc
      { name: "Store Rack",        sku: "R38-STORE-RACK-RELOCATE",     category: "Storage & Misc", basePrice: "40.00", volumeM3: "0.30" },
      { name: "Trolley",           sku: "R38-TROLLEY-RELOCATE",        category: "Storage & Misc", basePrice: "30.00", volumeM3: "0.15" },
      { name: "Standing Mirror",   sku: "R38-STANDING-MIRROR-RELOCATE",category: "Mirrors & Decor", basePrice: "54.00", volumeM3: "0.12" },
      { name: "Wedding Easel",     sku: "R38-WEDDING-EASEL-RELOCATE",  category: "Mirrors & Decor", basePrice: "25.00", volumeM3: "0.08" },
    ];
    let inserted = 0;
    for (const row of newRows) {
      const exists = await db.select().from(catalogItems).where(eq(catalogItems.sku, row.sku)).limit(1);
      if (exists.length === 0) {
        await db.insert(catalogItems).values({
          name: row.name,
          sku: row.sku,
          category: row.category,
          serviceType: "relocate",
          basePrice: row.basePrice,
          volumeM3: row.volumeM3,
          active: true,
        } as any);
        inserted++;
      }
    }

    await db.insert(catalogItems).values({
      name: "__loose_move_items_r38_marker__",
      sku: "LOOSE-MOVE-ITEMS-R38-MARKER",
      category: "_internal",
      serviceType: "install",
      basePrice: "0",
      active: false,
    } as any);

    console.log(`[startup] Round 38: Common loose move items — inserted ${inserted} new relocate SKU row(s).`);
  }

}