import Decimal from "decimal.js";
import { pct, round2, sum } from "../money";
import type { DateStr, Discount } from "../db/types";

export interface EligibilityContext {
  today: DateStr;
  /** Pre-discount amount the discount is measured against. */
  purchaseAmount: number;
  quantity: number;
  productId?: string;
}

export type EligibilityResult = { eligible: true } | { eligible: false; reason: string };

/** A discount applies only while active, in-date, not exhausted, and when the minimums are met. */
export function checkDiscountEligibility(d: Discount, ctx: EligibilityContext): EligibilityResult {
  if (!d.active) return { eligible: false, reason: "inactive" };
  if (ctx.today < d.startDate) return { eligible: false, reason: "not started" };
  if (ctx.today > d.endDate) return { eligible: false, reason: "expired" };
  if (d.usageLimit !== null && d.usedCount >= d.usageLimit) return { eligible: false, reason: "usage limit reached" };
  if (d.minPurchase !== null && ctx.purchaseAmount < d.minPurchase)
    return { eligible: false, reason: "minimum purchase not met" };
  if (d.minQuantity !== null && ctx.quantity < d.minQuantity)
    return { eligible: false, reason: "minimum quantity not met" };
  if (d.scope === "PRODUCT" && ctx.productId && !d.productIds.includes(ctx.productId))
    return { eligible: false, reason: "product not covered" };
  return { eligible: true };
}

export function isDiscountEligible(d: Discount, ctx: EligibilityContext): boolean {
  return checkDiscountEligibility(d, ctx).eligible;
}

export function discountAmount(d: Pick<Discount, "type" | "value">, base: number): number {
  if (base <= 0) return 0;
  const raw = d.type === "PERCENT" ? pct(base, d.value) : round2(d.value);
  return Math.min(raw, round2(base));
}

export interface PricedLine {
  key: string;
  productId: string;
  quantity: number;
  gross: number; // qty * unitPrice
  /** Explicit discount chosen on the subscription line (optional). */
  discountId?: string | null;
}

export interface AppliedDiscount {
  discount: Discount;
  amount: number;
}

export interface DiscountResult {
  /** Total discount allocated to each line (product + share of subscription-level). */
  lineDiscounts: Map<string, number>;
  applied: AppliedDiscount[];
  total: number;
}

/**
 * Apply discounts to invoice lines.
 * - PRODUCT scope: best eligible discount per matching line (no stacking).
 * - SUBSCRIPTION scope: best eligible discount on the subtotal after product discounts,
 *   allocated pro-rata to lines so taxes are computed on the post-discount amount.
 */
export function applyDiscounts(lines: PricedLine[], discounts: Discount[], today: DateStr): DiscountResult {
  const lineDiscounts = new Map<string, number>(lines.map((l) => [l.key, 0]));
  const appliedMap = new Map<string, AppliedDiscount>();
  const subtotal = sum(lines.map((l) => l.gross));
  const totalQty = lines.reduce((a, l) => a + l.quantity, 0);

  const productDiscounts = discounts.filter((d) => d.scope === "PRODUCT");
  for (const line of lines) {
    let best: AppliedDiscount | null = null;
    for (const d of productDiscounts) {
      const covered = d.productIds.includes(line.productId) || line.discountId === d.id;
      if (!covered) continue;
      const ok = isDiscountEligible(d, {
        today,
        purchaseAmount: subtotal,
        quantity: line.quantity,
      });
      if (!ok) continue;
      const amount = discountAmount(d, line.gross);
      if (amount > 0 && (!best || amount > best.amount)) best = { discount: d, amount };
    }
    if (best) {
      lineDiscounts.set(line.key, best.amount);
      const prev = appliedMap.get(best.discount.id);
      appliedMap.set(best.discount.id, {
        discount: best.discount,
        amount: round2(new Decimal(prev?.amount ?? 0).plus(best.amount)),
      });
    }
  }

  const afterProduct = sum(lines.map((l) => new Decimal(l.gross).minus(lineDiscounts.get(l.key) ?? 0)));
  let bestSub: AppliedDiscount | null = null;
  for (const d of discounts.filter((x) => x.scope === "SUBSCRIPTION")) {
    if (!isDiscountEligible(d, { today, purchaseAmount: subtotal, quantity: totalQty })) continue;
    const amount = discountAmount(d, afterProduct);
    if (amount > 0 && (!bestSub || amount > bestSub.amount)) bestSub = { discount: d, amount };
  }
  if (bestSub && afterProduct > 0) {
    // Allocate pro-rata; last line absorbs rounding remainder.
    let remaining = new Decimal(bestSub.amount);
    lines.forEach((l, i) => {
      const net = new Decimal(l.gross).minus(lineDiscounts.get(l.key) ?? 0);
      const share =
        i === lines.length - 1 ? remaining : net.times(bestSub!.amount).dividedBy(afterProduct).toDecimalPlaces(2);
      remaining = remaining.minus(share);
      lineDiscounts.set(l.key, round2(new Decimal(lineDiscounts.get(l.key) ?? 0).plus(share)));
    });
    appliedMap.set(bestSub.discount.id, bestSub);
  }

  const applied = Array.from(appliedMap.values());
  return { lineDiscounts, applied, total: sum(applied.map((a) => a.amount)) };
}
