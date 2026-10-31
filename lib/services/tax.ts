import Decimal from "decimal.js";
import { pct, round2, sum } from "../money";
import type { Tax } from "../db/types";

export interface TaxBreakdown {
  taxId: string;
  name: string;
  amount: number;
}

/**
 * Compute taxes for one line.
 * - PERCENT applies to the post-discount line amount.
 * - FIXED applies per unit.
 * Each tax is rounded to 2dp half-up.
 */
export function computeLineTax(
  netAmount: number,
  quantity: number,
  taxes: Pick<Tax, "id" | "name" | "type" | "rate" | "active">[],
): { total: number; breakdown: TaxBreakdown[] } {
  const breakdown: TaxBreakdown[] = [];
  for (const t of taxes) {
    if (!t.active) continue;
    const amount =
      t.type === "PERCENT" ? pct(Math.max(0, netAmount), t.rate) : round2(new Decimal(t.rate).times(quantity));
    breakdown.push({ taxId: t.id, name: t.name, amount });
  }
  return { total: sum(breakdown.map((b) => b.amount)), breakdown };
}
