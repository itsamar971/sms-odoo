import { describe, expect, it } from "vitest";
import { makeFixture } from "./helpers";
import { createSubscription, transitionSubscription } from "@/lib/services/subscriptions";
import { canTransitionSubscription } from "@/lib/services/state-machine";

describe("subscription state machine", () => {
  it("allows only explicit transitions", () => {
    expect(canTransitionSubscription("DRAFT", "QUOTATION")).toBe(true);
    expect(canTransitionSubscription("DRAFT", "ACTIVE")).toBe(false);
    expect(canTransitionSubscription("PAUSED", "ACTIVE")).toBe(true);
    expect(canTransitionSubscription("CLOSED", "ACTIVE")).toBe(false);
  });

  it("walks the lifecycle, logs history, and rejects illegal moves", () => {
    const { db, customer, plan, product, admin } = makeFixture();
    const sub = createSubscription(
      { customerId: customer.id, planId: plan.id, startDate: "2026-02-01", paymentTerms: "NET15", lines: [{ productId: product.id, quantity: 2 }] },
      admin.id,
    );
    expect(sub.status).toBe("DRAFT");
    expect(() => transitionSubscription(sub.id, "ACTIVE", admin.id)).toThrow(/Cannot move/);
    transitionSubscription(sub.id, "QUOTATION", admin.id, { today: "2026-01-20" });
    transitionSubscription(sub.id, "CONFIRMED", admin.id, { today: "2026-01-21" });
    transitionSubscription(sub.id, "ACTIVE", admin.id, { today: "2026-01-21" });
    expect(db.statusHistory.by("entityId", sub.id).map((h) => h.to)).toEqual(["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE"]);
  });

  it("expired quotations cannot be confirmed", () => {
    const { customer, plan, product, admin } = makeFixture();
    const sub = createSubscription(
      { customerId: customer.id, planId: plan.id, startDate: "2026-02-01", paymentTerms: "NET15", lines: [{ productId: product.id, quantity: 1 }] },
      admin.id,
    );
    transitionSubscription(sub.id, "QUOTATION", admin.id, { today: "2026-01-01" }); // valid until 2026-01-31
    expect(() => transitionSubscription(sub.id, "CONFIRMED", admin.id, { today: "2026-02-01" })).toThrow(/expired/);
  });

  it("enforces plan availability and minimum quantity", () => {
    const { db, customer, plan, product, admin } = makeFixture();
    db.plans.update(plan.id, { minQuantity: 5, endDate: "2026-06-30" });
    const base = { customerId: customer.id, planId: plan.id, paymentTerms: "NET15" as const };
    expect(() => createSubscription({ ...base, startDate: "2026-02-01", lines: [{ productId: product.id, quantity: 2 }] }, admin.id)).toThrow(/at least 5/);
    expect(() => createSubscription({ ...base, startDate: "2026-07-01", lines: [{ productId: product.id, quantity: 5 }] }, admin.id)).toThrow(/ended/);
  });

  it("blocks pause when the plan is not pausable", () => {
    const { db, plan, addSubscription, admin } = makeFixture();
    db.plans.update(plan.id, { pausable: false });
    const sub = addSubscription();
    expect(() => transitionSubscription(sub.id, "PAUSED", admin.id)).toThrow(/does not allow pausing/);
  });
});

describe("line validation", () => {
  it("treats an empty unit price as 'use the catalog price', not 0", () => {
    const { customer, plan, product, admin, db } = makeFixture();
    const sub = createSubscription(
      { customerId: customer.id, planId: plan.id, startDate: "2026-02-01", paymentTerms: "NET15", lines: [{ productId: product.id, quantity: "2", unitPrice: "" } as never] },
      admin.id,
    );
    expect(db.subscriptionLines.by("subscriptionId", sub.id)[0].unitPrice).toBe(100);
  });
});
