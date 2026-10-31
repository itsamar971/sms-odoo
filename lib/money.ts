import Decimal from "decimal.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 30 });

export type Num = number | string | Decimal;

export const D = (n: Num) => new Decimal(n);

/** Round to 2 decimal places, half-up. */
export function round2(n: Num): number {
  return new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function sum(values: Num[]): number {
  return round2(values.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0)));
}

export function mul(a: Num, b: Num): number {
  return round2(new Decimal(a).times(b));
}

export function sub(a: Num, b: Num): number {
  return round2(new Decimal(a).minus(b));
}

export function add(a: Num, b: Num): number {
  return round2(new Decimal(a).plus(b));
}

export function pct(base: Num, rate: Num): number {
  return round2(new Decimal(base).times(rate).dividedBy(100));
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(n: number | null | undefined): string {
  return inr.format(n ?? 0);
}

export function formatMoneyCompact(n: number | null | undefined): string {
  return inrCompact.format(n ?? 0);
}
