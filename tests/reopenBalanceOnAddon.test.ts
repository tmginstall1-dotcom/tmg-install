import { test } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Verifies the "add-on during installation" fix: when an admin raises the
// total on a job that was already marked PAID IN FULL, editQuote must re-open
// the outstanding balance (clear finalPaidAt, drop paymentStatus) and keep
// "paid so far" correct so ONLY the newly-added amount is billable.
//
// Drives the REAL storage layer (skips cleanly if no DB is configured), the
// same style as the other storage integration tests in this repo.
// ---------------------------------------------------------------------------

function balanceOf(q: any): { paidSoFar: number; balance: number } {
  // Mirror the server invoice formula (routes.ts amountPaid/balanceDue) which
  // is also what the admin UI shows once finalPaidAt is cleared.
  const total = parseFloat(q.total || "0");
  const paidInFull = !!q.finalPaidAt || q.paymentStatus === "paid_in_full";
  const depBaseline = q.depositPaidAt ? parseFloat(q.depositAmount || "0") : 0;
  const ledger = ((q.payments || []) as any[]).reduce(
    (s, p) => s + (parseFloat(p.amount || "0") || 0),
    0,
  );
  const paidSoFar = paidInFull ? total : Math.min(total, depBaseline + ledger);
  const balance = paidInFull ? 0 : Math.max(0, total - (depBaseline + ledger));
  return { paidSoFar, balance };
}

test("editQuote re-opens balance when an add-on raises a full-upfront paid job", async (t) => {
  let storage: any;
  try {
    ({ storage } = await import("../server/storage.ts"));
  } catch {
    t.skip("storage not importable");
    return;
  }

  const refNo = `TEST-ADDON-FULL-${Date.now()}`;
  let quoteId: number | undefined;
  try {
    // Small job ($129.90 < $150) paid IN FULL up front: deposit == total,
    // depositPaidAt + finalPaidAt stamped, status paid_in_full.
    const created = await storage.createQuote(
      { name: "Addon Full Cust", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000010" },
      {
        referenceNo: refNo,
        serviceAddress: "1 Addon Rd, Singapore",
        status: "in_progress",
        subtotal: "129.90",
        total: "129.90",
        depositAmount: "129.90",
        finalAmount: "0",
        depositPaidAt: new Date(),
        finalPaidAt: new Date(),
        paymentStatus: "paid_in_full",
      } as any,
      [{ detectedName: "Wardrobe install", originalDescription: "Wardrobe install", serviceType: "install", quantity: 1, unitPrice: "129.90", subtotal: "129.90", catalogItemId: null } as any],
    );
    quoteId = created.id;

    let q = await storage.getQuote(quoteId!);
    assert.equal(balanceOf(q).balance, 0, "starts fully paid, balance $0");

    // Admin adds a $30 add-on item during installation.
    await storage.editQuote(quoteId!, {
      items: [
        { detectedName: "Wardrobe install", originalDescription: "Wardrobe install", serviceType: "install", quantity: 1, unitPrice: "129.90", subtotal: "129.90", catalogItemId: null } as any,
        { detectedName: "Extra shelf", originalDescription: "Extra shelf add-on", serviceType: "install", quantity: 1, unitPrice: "30.00", subtotal: "30.00", catalogItemId: null } as any,
      ],
    });

    q = await storage.getQuote(quoteId!);
    assert.equal(parseFloat(q.total), 159.9, "total grows to $159.90");
    assert.equal(q.finalPaidAt, null, "finalPaidAt cleared → balance re-opened");
    assert.notEqual(q.paymentStatus, "paid_in_full", "status dropped from paid_in_full");
    const b = balanceOf(q);
    assert.equal(b.paidSoFar, 129.9, "paid so far still $129.90 (already collected)");
    assert.equal(b.balance, 30, "only the $30 add-on is now owing");
  } finally {
    if (quoteId) await storage.deleteQuote?.(quoteId).catch?.(() => {});
  }
});

test("editQuote re-opens balance for a 50/50 fully-paid job without double-billing", async (t) => {
  let storage: any;
  try {
    ({ storage } = await import("../server/storage.ts"));
  } catch {
    t.skip("storage not importable");
    return;
  }

  const refNo = `TEST-ADDON-5050-${Date.now()}`;
  let quoteId: number | undefined;
  try {
    // Larger job: $400 total, $200 deposit paid + $200 final paid (finalPaidAt
    // stamped, but the final was NEVER a ledger row — the legacy final-payment
    // flow only stamps the date).
    const created = await storage.createQuote(
      { name: "Addon 5050 Cust", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000011" },
      {
        referenceNo: refNo,
        serviceAddress: "2 Addon Rd, Singapore",
        status: "in_progress",
        subtotal: "400",
        total: "400",
        depositAmount: "200",
        finalAmount: "200",
        depositPaidAt: new Date(),
        finalPaidAt: new Date(),
        paymentStatus: "paid_in_full",
      } as any,
      [{ detectedName: "Full install", originalDescription: "Full install", serviceType: "install", quantity: 1, unitPrice: "400", subtotal: "400", catalogItemId: null } as any],
    );
    quoteId = created.id;

    let q = await storage.getQuote(quoteId!);
    assert.equal(balanceOf(q).balance, 0, "starts fully paid, balance $0");

    // Admin adds a $30 add-on.
    await storage.editQuote(quoteId!, {
      items: [
        { detectedName: "Full install", originalDescription: "Full install", serviceType: "install", quantity: 1, unitPrice: "400", subtotal: "400", catalogItemId: null } as any,
        { detectedName: "Extra shelf", originalDescription: "Extra shelf add-on", serviceType: "install", quantity: 1, unitPrice: "30.00", subtotal: "30.00", catalogItemId: null } as any,
      ],
    });

    q = await storage.getQuote(quoteId!);
    assert.equal(parseFloat(q.total), 430, "total grows to $430");
    assert.equal(q.finalPaidAt, null, "finalPaidAt cleared → balance re-opened");
    const b = balanceOf(q);
    assert.equal(b.paidSoFar, 400, "paid so far still $400 (deposit + reconciled final)");
    assert.equal(b.balance, 30, "only the $30 add-on is owing — no double-billing");

    // A SECOND edit while the balance is already open must NOT insert another
    // reconciled row (finalPaidAt is null now) and must track the new total.
    await storage.editQuote(quoteId!, {
      items: [
        { detectedName: "Full install", originalDescription: "Full install", serviceType: "install", quantity: 1, unitPrice: "400", subtotal: "400", catalogItemId: null } as any,
        { detectedName: "Extra shelf", originalDescription: "Extra shelf add-on", serviceType: "install", quantity: 1, unitPrice: "50.00", subtotal: "50.00", catalogItemId: null } as any,
      ],
    });
    q = await storage.getQuote(quoteId!);
    const reconciledRows = ((q.payments || []) as any[]).filter((p) => p.method === "reconciled");
    assert.equal(reconciledRows.length, 1, "no duplicate reconciled row on a second edit");
    assert.equal(parseFloat(q.total), 450, "total tracks the larger add-on ($450)");
    assert.equal(balanceOf(q).balance, 50, "balance owing follows the new add-on total");
  } finally {
    if (quoteId) await storage.deleteQuote?.(quoteId).catch?.(() => {});
  }
});
