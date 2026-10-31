import { getDb } from "../db/client";
import { addMonths, diffDays, lastNMonths, monthKey, startOfMonth, todayStr } from "../dates";
import { round2 } from "../money";
import { SUBSCRIPTION_STATUSES, type BillingPeriod, type DateStr } from "../db/types";

/** Multiplier to normalise one billing period to a month. */
export function monthlyFactor(period: BillingPeriod, interval: number): number {
  const perMonth = { DAILY: 365 / 12, WEEKLY: 52 / 12, MONTHLY: 1, YEARLY: 1 / 12 }[period];
  return perMonth / Math.max(1, interval);
}

/** Single-pass aggregates over the in-memory tables (the "GROUP BY" of the cache DB). */
export function dashboardMetrics(today: DateStr = todayStr()) {
  const db = getDb();
  const thisMonth = monthKey(today);
  const months = lastNMonths(today, 12);
  const trend = new Map(months.map((m) => [m, { invoiced: 0, collected: 0 }]));

  let mrr = 0;
  const active = db.subscriptions.by("status", "ACTIVE");
  for (const s of active) {
    const plan = db.plans.get(s.planId);
    if (!plan) continue;
    const amt = db.subscriptionLines.by("subscriptionId", s.id).reduce((a, l) => a + l.amount, 0);
    mrr += amt * monthlyFactor(plan.billingPeriod, plan.intervalCount);
  }

  let outstanding = 0, overdueCount = 0, overdueAmount = 0, invoicedThisMonth = 0, draftCount = 0;
  const overdueList: { id: string; daysOverdue: number; amountDue: number }[] = [];
  const aging = { "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const i of db.invoices.all()) {
    if (i.status === "CANCELLED") continue;
    if (i.status === "DRAFT") draftCount++;
    const m = monthKey(i.invoiceDate);
    if (i.status !== "DRAFT") {
      const t = trend.get(m);
      if (t) t.invoiced += i.total;
      if (m === thisMonth) invoicedThisMonth += i.total;
    }
    if (i.status === "CONFIRMED" && i.amountDue > 0) {
      outstanding += i.amountDue;
      if (i.dueDate < today) {
        overdueCount++;
        overdueAmount += i.amountDue;
        const d = diffDays(today, i.dueDate);
        overdueList.push({ id: i.id, daysOverdue: d, amountDue: i.amountDue });
        aging[d <= 30 ? "1-30" : d <= 60 ? "31-60" : d <= 90 ? "61-90" : "90+"] += i.amountDue;
      }
    }
  }
  let revenueThisMonth = 0, revenueLastMonth = 0;
  const lastMonth = monthKey(addMonths(startOfMonth(today), -1));
  for (const p of db.payments.all()) {
    const m = monthKey(p.date);
    const t = trend.get(m);
    if (t) t.collected += p.amount;
    if (m === thisMonth) revenueThisMonth += p.amount;
    if (m === lastMonth) revenueLastMonth += p.amount;
  }

  overdueList.sort((a, b) => b.amountDue - a.amountDue);
  const topOverdue = overdueList.slice(0, 10).map((o) => {
    const inv = db.invoices.get(o.id)!;
    return { ...o, number: inv.number, customer: db.customers.get(inv.customerId)?.name ?? "—", dueDate: inv.dueDate, lastReminderAt: inv.lastReminderAt?.toISOString() ?? null };
  });

  return {
    activeCount: active.length,
    mrr: round2(mrr),
    arr: round2(mrr * 12),
    revenueThisMonth: round2(revenueThisMonth),
    revenueLastMonth: round2(revenueLastMonth),
    invoicedThisMonth: round2(invoicedThisMonth),
    outstanding: round2(outstanding),
    overdueCount,
    overdueAmount: round2(overdueAmount),
    draftCount,
    dueForBilling: active.filter((s) => s.nextInvoiceDate <= today).length,
    trend: months.map((m) => ({ month: m, invoiced: round2(trend.get(m)!.invoiced), collected: round2(trend.get(m)!.collected) })),
    byStatus: SUBSCRIPTION_STATUSES.map((s) => ({ status: s, count: db.subscriptions.by("status", s).length })),
    aging: Object.entries(aging).map(([bucket, amount]) => ({ bucket, amount: round2(amount) })),
    topOverdue,
  };
}
