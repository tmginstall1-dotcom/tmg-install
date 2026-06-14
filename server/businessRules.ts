// Server-side helpers for loading and saving the editable Business Rules.
// Values are persisted in the existing app_settings key-value table under the
// "br.<field>" namespace; everything reads through shared/businessRules so the
// defaults and parsing stay in one place.

import { db } from "./db";
import { appSettings } from "@shared/schema";
import { eq, like } from "drizzle-orm";
import {
  BUSINESS_RULES_PREFIX,
  parseBusinessRules,
  serializeBusinessRules,
  type BusinessRules,
} from "@shared/businessRules";

/** Load the current business rules (defaults merged with any admin overrides). */
export async function loadBusinessRules(): Promise<BusinessRules> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(like(appSettings.key, `${BUSINESS_RULES_PREFIX}%`));
  return parseBusinessRules(rows.map((r) => ({ key: r.key, value: r.value })));
}

/** Persist a partial set of business-rule overrides. Returns the merged rules. */
export async function saveBusinessRules(partial: Partial<BusinessRules>): Promise<BusinessRules> {
  const kv = serializeBusinessRules(partial);
  for (const [key, value] of Object.entries(kv)) {
    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  }
  return loadBusinessRules();
}
