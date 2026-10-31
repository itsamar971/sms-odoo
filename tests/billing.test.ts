import { describe, expect, it } from "vitest";
import { makeFixture } from "./helpers";
import { billSubscription, runBilling } from "@/lib/services/billing";

describe("billing run", () => {
  it("creates one invoice per missed period (catch-up) and advances nextInvoiceDate", async () => {
    const { db, addSubscription } = makeFixture();
    const sub = addSubscription({ startDate: "2026-01-31", nextInvoiceDate: "2026-01-31" });
    const r = await runBilling({ asOf: "2026-04-30" });
    expect(r.created).toBe(4);
    const periods = db.invoices.by("subscriptionId", sub.id).map((i) => i.periodStart).sort();
    // anchored to the 31st: no drift after February
    expect(periods).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(db.subscriptions.get(sub.id)!.nextInvoiceDate).toBe("2026-05-31");
  });

  it("is idempotent: running billing twice creates 0 new invoices", async () => {
    const { db, addSubscription } = makeFixture();
    for (let i = 0; i < 150; i++) addSubscription();
    const first = await runBilling({ asOf: "2026-03-20" });
    expect(first.created).toBe(150 * 3);
    const count = db.invoices.size;
    const second = await runBilling({ asOf: "2026-03-20" });
    expect(second.created).toBe(0);
    expect(db.invoices.size).toBe(count);
  });

  it("never bills a period twice even if nextInvoiceDate is rewound (unique constraint)", async () => {
    const { db, addSubscription } = makeFixture();
    const sub = addSubscription();
    await runBilling({ asOf: "2026-02-20" });
    expect(db.invoices.size).toBe(2);
    db.subscriptions.update(sub.id, { nextInvoiceDate: "2026-01-15" }); // simulate a bad pointer
    const r = billSubscription(sub.id, "2026-02-20");
    expect(r.created).toBe(0);
    expect(r.skipped).toBe(2);
    expect(db.invoices.size).toBe(2);
  });

  it("computes totals: discount on subtotal, tax on post-discount amount", async () => {
    const { db, addSubscription, addDiscount } = makeFixture();
    addDiscount({ minQuantity: 10 });
    addSubscription({ quantity: 10 });
    await runBilling({ asOf: "2026-01-15" });
    const inv = db.invoices.all()[0];
    expect(inv.subtotal).toBe(1000);
    expect(inv.discountTotal).toBe(100);
    expect(inv.taxTotal).toBe(162); // 18% of 900
    expect(inv.total).toBe(1062);
    const lines = db.invoiceLines.by("invoiceId", inv.id);
    expect(lines.some((l) => l.kind === "DISCOUNT" && l.amount === -100)).toBe(true);
  });

  it("increments discount usedCount and stops applying once exhausted", async () => {
    const { db, addSubscription, addDiscount } = makeFixture();
    const d = addDiscount({ usageLimit: 2 });
    for (let i = 0; i < 3; i++) addSubscription();
    await runBilling({ asOf: "2026-01-15" });
    expect(db.discounts.get(d.id)!.usedCount).toBe(2);
    const discounted = db.invoices.all().filter((i) => i.discountTotal > 0);
    expect(discounted).toHaveLength(2);
  });

  it("rolls back the whole period if anything fails mid-transaction", async () => {
    const { db, addSubscription } = makeFixture();
    const sub = addSubscription();
    db.subscriptionLines.update(db.subscriptionLines.by("subscriptionId", sub.id)[0].id, { productId: "missing" });
    // Remove lines entirely to force a failure
    for (const l of db.subscriptionLines.by("subscriptionId", sub.id)) db.subscriptionLines.delete(l.id);
    const r = await runBilling({ asOf: "2026-01-15" });
    expect(r.failed).toBe(1);
    expect(db.invoices.size).toBe(0);
    expect(db.subscriptions.get(sub.id)!.nextInvoiceDate).toBe("2026-01-15");
  });

  it("skips non-ACTIVE subscriptions", async () => {
    const { db, addSubscription } = makeFixture();
    addSubscription({ status: "PAUSED" });
    addSubscription({ status: "QUOTATION" });
    const r = await runBilling({ asOf: "2026-03-01" });
    expect(r.created).toBe(0);
    expect(db.invoices.size).toBe(0);
  });
});
