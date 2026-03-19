import { db } from "./db";
import { users, catalogItems } from "@shared/schema";
import { eq } from "drizzle-orm";
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

    // Height-Adjustable Sit-Stand Desk — motorised units need more care, $160 install
    await db.update(catalogItems).set({ basePrice: "160.00" }).where(eq(catalogItems.sku, "STND-INSTALL"));
    await db.update(catalogItems).set({ basePrice: "120.00" }).where(eq(catalogItems.sku, "STND-DISMANTLE"));

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

  // Round 8: Add missing relocate variants + comprehensive volumeM3 for all relocate items
  const r8 = await db.select().from(catalogItems).where(eq(catalogItems.sku, "VOL2-UPDATED"));
  if (r8.length === 0) {
    await db.insert(catalogItems).values([
      { name: "__volume_seed_r8_marker__", sku: "VOL2-UPDATED", category: "System", serviceType: "install", basePrice: "0", active: false },
    ]);

    // ── Add missing relocate variants ────────────────────────────────────────
    await db.insert(catalogItems).values([
      // Office Panel / Partition — relocate (move configured panels to new office)
      { name: "Office Panel / Partition",             sku: "PANEL-RELOCATE",      category: "Office",      serviceType: "relocate", basePrice: "80.00",  volumeM3: "0.15" },
      // Monitor Arm / Desk Mount — relocate
      { name: "Monitor Arm / Desk Mount",             sku: "MONARM-RELOCATE",     category: "Office",      serviceType: "relocate", basePrice: "50.00",  volumeM3: "0.05" },
      // Modular Pod Panel — relocate
      { name: "Modular Pod Panel (per panel)",        sku: "PODPANEL-RELOCATE",   category: "Office",      serviceType: "relocate", basePrice: "90.00",  volumeM3: "0.18" },
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
      { sku: "PANEL-RELOCATE",         volumeM3: "0.15" },
      { sku: "MONARM-RELOCATE",        volumeM3: "0.05" },
      { sku: "PODPANEL-RELOCATE",      volumeM3: "0.18" },
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
      { sku:"PANEL-INSTALL", vol:"0.15" }, { sku:"PANEL-DISMANTLE", vol:"0.15" },
      { sku:"MONARM-INSTALL", vol:"0.05" },{ sku:"MONARM-DISMANTLE", vol:"0.05" },
      { sku:"PODPANEL-INSTALL", vol:"0.18" },{ sku:"PODPANEL-DISMANTLE", vol:"0.18" },
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
}
