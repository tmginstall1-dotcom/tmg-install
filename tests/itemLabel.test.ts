// =============================================================================
// Quote/invoice line description formatting tests
//
// Run: npx tsx --test tests/itemLabel.test.ts
//
// Guards the regression where every manually-keyed quote line was prefixed
// with a service verb (defaulting to "Installation of …"), so fee / labour /
// charge lines wrongly read "Installation of Standard Mobilisation Fee" or
// "Installation of Purchase & Handling Fee" on the customer quote and job
// order. formatItemDescription() in client/src/lib/itemLabel.ts is the single
// formatter feeding every render surface (Invoice, ExportPDF, QuoteDetail
// view + print), so testing it covers all of them.
//
// Pure logic only — no DB, network, or secrets required. Deterministic.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatItemDescription } from "../client/src/lib/itemLabel.ts";

test("fee / labour / purchase lines show verbatim even when keyed as 'install'", () => {
  // These are the exact lines from the reported job order — all were stored
  // with serviceType 'install' (the dropdown default) and must NOT get a verb.
  assert.equal(formatItemDescription({ detectedName: "LED Light Purchase", serviceType: "install" }), "LED Light Purchase");
  assert.equal(formatItemDescription({ detectedName: "Purchase & Handling Fee", serviceType: "install" }), "Purchase & Handling Fee");
  assert.equal(formatItemDescription({ detectedName: "Basic LED Light Replacement Labour", serviceType: "install" }), "Basic LED Light Replacement Labour");
  assert.equal(formatItemDescription({ detectedName: "Standard Mobilisation Fee", serviceType: "install" }), "Standard Mobilisation Fee");
});

test("explicit 'fee' service type always shows verbatim", () => {
  assert.equal(formatItemDescription({ detectedName: "Standard Mobilisation Fee", serviceType: "fee" }), "Standard Mobilisation Fee");
  // Even a furniture-sounding name marked as a fee is shown as typed.
  assert.equal(formatItemDescription({ detectedName: "Wardrobe top-up", serviceType: "fee" }), "Wardrobe top-up");
});

test("genuine service items still get the BCA-style verb prefix", () => {
  assert.equal(formatItemDescription({ detectedName: "Wardrobe 2-door", serviceType: "install" }), "Installation of Wardrobe 2-door");
  assert.equal(formatItemDescription({ detectedName: "Height adjustable desk", serviceType: "dismantle" }), "Dismantling of Height adjustable desk");
  assert.equal(formatItemDescription({ detectedName: "Sofa", serviceType: "relocate" }), "Relocation of Sofa");
});

test("install line that ALSO has a matching dismantle line reads 'Reinstallation of …'", () => {
  const items = [
    { detectedName: "Office chair", serviceType: "install" },
    { detectedName: "Office chair", serviceType: "dismantle" },
  ];
  assert.equal(formatItemDescription(items[0], items), "Reinstallation of Office chair");
  assert.equal(formatItemDescription(items[1], items), "Dismantling of Office chair");
});

test("admin-typed leading verbs are still respected (no double prefix)", () => {
  assert.equal(formatItemDescription({ detectedName: "To supply labour for LED swap", serviceType: "install" }), "To supply labour for LED swap");
  assert.equal(formatItemDescription({ detectedName: "Site survey fee", serviceType: "install" }), "Site survey fee");
});
