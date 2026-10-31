import type { BillingPeriod, DateStr } from "./db/types";

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateStr(d: Date): DateStr {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Today's date in the server's local timezone, as YYYY-MM-DD. */
export function todayStr(now: Date = new Date()): DateStr {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function parseDateStr(s: DateStr): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isDateStr(s: unknown): s is DateStr {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDateStr(s).getTime());
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDateStr(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}

function daysInMonth(y: number, m0: number) {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

/**
 * Add months, clamping to month end. `anchorDay` keeps the original billing day stable,
 * so Jan 31 -> Feb 28 -> Mar 31 (no drift).
 */
export function addMonths(s: DateStr, n: number, anchorDay?: number): DateStr {
  const [y, m, d] = s.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm));
  return `${ny}-${pad(nm + 1)}-${pad(day)}`;
}

export function addPeriod(
  s: DateStr,
  period: BillingPeriod,
  interval = 1,
  anchorDay?: number,
): DateStr {
  switch (period) {
    case "DAILY":
      return addDays(s, interval);
    case "WEEKLY":
      return addDays(s, 7 * interval);
    case "MONTHLY":
      return addMonths(s, interval, anchorDay);
    case "YEARLY":
      return addMonths(s, 12 * interval, anchorDay);
  }
}

export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((parseDateStr(a).getTime() - parseDateStr(b).getTime()) / 86_400_000);
}

export function monthKey(s: DateStr): string {
  return s.slice(0, 7);
}

export function startOfMonth(s: DateStr): DateStr {
  return `${s.slice(0, 7)}-01`;
}

export function lastNMonths(today: DateStr, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(addMonths(startOfMonth(today), -i)));
  return out;
}

export function formatDate(s: DateStr | null | undefined): string {
  if (!s) return "—";
  const d = parseDateStr(s);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function periodLabel(period: BillingPeriod, interval: number): string {
  const unit = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" }[period];
  return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
}
