import { describe, expect, it } from "vitest";
import { applyDiscounts, checkDiscountEligibility, isDiscountEligible } from "@/lib/services/discounts";
import type { Discount } from "@/lib/db/types";

const base: Discount = {
  id: "d1", name: "10% off for 10+ seats", type: "PERCENT", value: 10, minPurchase: null, minQuantity: 10,
  startDate: "2026-01-01", endDate: "2026-12-31", usageLimit: null, usedCount: 0, scope: "SUBSCRIPTION", productIds: [], active: true,
};
const ctx = { today: "2026-06-01", purchaseAmount: 5000, quantity: 10 };

describe("discount eligibility", () => {
  it("is eligible when active, in date, under limit and minimums met", () => {
    expect(isDiscountEligible(base, ctx)).toBe(true);
  });
  it("rejects inactive", () => {
    expect(checkDiscountEligibility({ ...base, active: false }, ctx)).toEqual({ eligible: false, reason: "inactive" });
  });
  it("rejects before start and after end", () => {
    expect(isDiscountEligible(base, { ...ctx, today: "2025-12-31" })).toBe(false);
    expect(checkDiscountEligibility(base, { ...ctx, today: "2027-01-01" })).toEqual({ eligible: false, reason: "expired" });
  });
  it("stops applying once exhausted", () => {
    expect(isDiscountEligible({ ...base, usageLimit: 5, usedCount: 4 }, ctx)).toBe(true);
    expect(isDiscountEligible({ ...base, usageLimit: 5, usedCount: 5 }, ctx)).toBe(false);
  });
  it("enforces minimum quantity and minimum purchase", () => {
    expect(isDiscountEligible(base, { ...ctx, quantity: 9 })).toBe(false);
    expect(isDiscountEligible({ ...base, minQuantity: null, minPurchase: 6000 }, ctx)).toBe(false);
    expect(isDiscountEligible({ ...base, minQuantity: null, minPurchase: 5000 }, ctx)).toBe(true);
  });
  it("PRODUCT scope only covers its products", () => {
    const d = { ...base, scope: "PRODUCT" as const, productIds: ["p1"], minQuantity: null };
    expect(isDiscountEligible(d, { ...ctx, productId: "p1" })).toBe(true);
    expect(isDiscountEligible(d, { ...ctx, productId: "p2" })).toBe(false);
  });
});

describe("applyDiscounts", () => {
  const lines = [
    { key: "a", productId: "p1", quantity: 6, gross: 600 },
    { key: "b", productId: "p2", quantity: 4, gross: 400 },
  ];
  it("applies SUBSCRIPTION scope to the subtotal and allocates it to lines", () => {
    const r = applyDiscounts(lines, [base], "2026-06-01");
    expect(r.total).toBe(100);
    expect(r.lineDiscounts.get("a")).toBe(60);
    expect(r.lineDiscounts.get("b")).toBe(40);
  });
  it("applies PRODUCT scope only to matching lines", () => {
    const d: Discount = { ...base, id: "d2", scope: "PRODUCT", productIds: ["p2"], minQuantity: null, type: "FIXED", value: 50 };
    const r = applyDiscounts(lines, [d], "2026-06-01");
    expect(r.lineDiscounts.get("a")).toBe(0);
    expect(r.lineDiscounts.get("b")).toBe(50);
    expect(r.total).toBe(50);
  });
  it("applies nothing when not eligible", () => {
    const r = applyDiscounts([{ key: "a", productId: "p1", quantity: 2, gross: 200 }], [base], "2026-06-01");
    expect(r.total).toBe(0);
    expect(r.applied).toHaveLength(0);
  });
});
