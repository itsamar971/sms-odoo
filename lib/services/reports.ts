import { getDb } from "../db/client";
import { addMonths, diffDays, monthKey, startOfMonth, todayStr } from "../dates";
import { round2 } from "../money";
import { str, type SearchParams } from "../list";
import { isOverdue } from "./invoices";
import { monthlyFactor } from "./dashboard";
import type { DateStr } from "../db/types";

export interface ReportFilters {
  from: DateStr;
  to: DateStr;
  customerId?: string;
  planId?: string;
}

export function parseReportFilters(sp: SearchParams): ReportFilters {
  const today = todayStr();
  return {
    from: str(sp, "from") ?? addMonths(startOfMonth(today), -11),
    to: str(sp, "to") ?? today,
    customerId: str(sp, "customer"),
    planId: str(sp, "plan"),
  };
}

function subMatches(f: ReportFilters, subscriptionId: string) {
  if (!f.planId) return true;
  return getDb().subscriptions.get(subscriptionId)?.planId === f.planId;
}

export function reportData(f: ReportFilters) {
  const db = getDb();
  const today = todayStr();
  const invoices = db.invoices.all().filter(
    (i) => i.status !== "CANCELLED" && i.status !== "DRAFT" && i.invoiceDate >= f.from && i.invoiceDate <= f.to &&
      (!f.customerId || i.customerId === f.customerId) && subMatches(f, i.subscriptionId),
  );
  const payments = db.payments.all().filter((p) => {
    if (p.date < f.from || p.date > f.to || (f.customerId && p.customerId !== f.customerId)) return false;
    if (!f.planId) return true;
    const inv = db.invoices.get(p.invoiceId);
    return !!inv && subMatches(f, inv.subscriptionId);
  });
  const byMonth = new Map<string, { invoiced: number; collected: number; count: number }>();
  for (let m = startOfMonth(f.from); m <= f.to; m = addMonths(m, 1)) byMonth.set(monthKey(m), { invoiced: 0, collected: 0, count: 0 });
  let invoiced = 0, tax = 0, discounts = 0;
  for (const i of invoices) {
    invoiced += i.total; tax += i.taxTotal; discounts += i.discountTotal;
    const b = byMonth.get(monthKey(i.invoiceDate));
    if (b) { b.invoiced += i.total; b.count++; }
  }
  let collected = 0;
  const byMethod = new Map<string, { amount: number; count: number }>();
  for (const p of payments) {
    collected += p.amount;
    const b = byMonth.get(monthKey(p.date));
    if (b) b.collected += p.amount;
    const m = byMethod.get(p.method) ?? { amount: 0, count: 0 };
    m.amount += p.amount; m.count++;
    byMethod.set(p.method, m);
  }
  // Point-in-time (as of today) receivables for the filtered customer/plan.
  const open = db.invoices.all().filter((i) => i.status === "CONFIRMED" && i.amountDue > 0 && (!f.customerId || i.customerId === f.customerId) && subMatches(f, i.subscriptionId));
  const overdue = open.filter((i) => isOverdue(i, today)).sort((a, b) => b.amountDue - a.amountDue);

  const subs = db.subscriptions.all().filter((s) => (!f.customerId || s.customerId === f.customerId) && (!f.planId || s.planId === f.planId));
  const byPlan = new Map<string, { plan: string; active: number; mrr: number }>();
  let activeCount = 0, newSubs = 0, churned = 0;
  for (const s of subs) {
    if (s.startDate >= f.from && s.startDate <= f.to && s.status !== "DRAFT" && s.status !== "QUOTATION") newSubs++;
    if (s.closedAt && s.closedAt >= f.from && s.closedAt <= f.to) churned++;
    if (s.status !== "ACTIVE") continue;
    activeCount++;
    const plan = db.plans.get(s.planId)!;
    const row = byPlan.get(plan.id) ?? { plan: plan.name, active: 0, mrr: 0 };
    row.active++;
    row.mrr += db.subscriptionLines.by("subscriptionId", s.id).reduce((a, l) => a + l.amount, 0) * monthlyFactor(plan.billingPeriod, plan.intervalCount);
    byPlan.set(plan.id, row);
  }

  return {
    filters: f,
    summary: {
      invoiced: round2(invoiced), collected: round2(collected), tax: round2(tax), discounts: round2(discounts), invoiceCount: invoices.length,
      paymentCount: payments.length, outstanding: round2(open.reduce((a, i) => a + i.amountDue, 0)), overdueAmount: round2(overdue.reduce((a, i) => a + i.amountDue, 0)),
      overdueCount: overdue.length, activeCount, newSubs, churned, collectionRate: invoiced ? Math.round((collected / invoiced) * 100) : 0,
    },
    byMonth: Array.from(byMonth, ([month, v]) => ({ month, invoiced: round2(v.invoiced), collected: round2(v.collected), count: v.count })),
    byMethod: Array.from(byMethod, ([method, v]) => ({ method, amount: round2(v.amount), count: v.count })).sort((a, b) => b.amount - a.amount),
    byPlan: Array.from(byPlan.values()).map((r) => ({ ...r, mrr: round2(r.mrr) })).sort((a, b) => b.mrr - a.mrr),
    overdue: overdue.map((i) => ({
      id: i.id, number: i.number, customer: db.customers.get(i.customerId)?.name ?? "", dueDate: i.dueDate, daysOverdue: diffDays(today, i.dueDate), total: i.total, amountDue: i.amountDue,
    })),
    invoices, payments, subs,
  };
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], headers: string[]) {
  return [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n");
}

export type ReportKind = "revenue" | "invoices" | "payments" | "overdue" | "subscriptions";

export function reportCsv(kind: ReportKind, f: ReportFilters): string {
  const db = getDb();
  const d = reportData(f);
  switch (kind) {
    case "revenue":
      return toCsv(d.byMonth, ["month", "invoiced", "collected", "count"]);
    case "invoices":
      return toCsv(d.invoices.map((i) => ({ number: i.number, customer: db.customers.get(i.customerId)?.name, subscription: db.subscriptions.get(i.subscriptionId)?.number, invoiceDate: i.invoiceDate, dueDate: i.dueDate, periodStart: i.periodStart, periodEnd: i.periodEnd, status: isOverdue(i) ? "OVERDUE" : i.status, subtotal: i.subtotal, discountTotal: i.discountTotal, taxTotal: i.taxTotal, total: i.total, amountPaid: i.amountPaid, amountDue: i.amountDue })),
        ["number", "customer", "subscription", "invoiceDate", "dueDate", "periodStart", "periodEnd", "status", "subtotal", "discountTotal", "taxTotal", "total", "amountPaid", "amountDue"]);
    case "payments":
      return toCsv(d.payments.map((p) => ({ date: p.date, invoice: db.invoices.get(p.invoiceId)?.number, customer: db.customers.get(p.customerId)?.name, method: p.method, amount: p.amount, note: p.note })), ["date", "invoice", "customer", "method", "amount", "note"]);
    case "overdue":
      return toCsv(d.overdue, ["number", "customer", "dueDate", "daysOverdue", "total", "amountDue"]);
    case "subscriptions":
      return toCsv(d.subs.map((s) => ({ number: s.number, customer: db.customers.get(s.customerId)?.name, plan: db.plans.get(s.planId)?.name, status: s.status, startDate: s.startDate, nextInvoiceDate: s.nextInvoiceDate, expiryDate: s.expiryDate, recurringAmount: round2(db.subscriptionLines.by("subscriptionId", s.id).reduce((a, l) => a + l.amount, 0)) })),
        ["number", "customer", "plan", "status", "startDate", "nextInvoiceDate", "expiryDate", "recurringAmount"]);
  }
}
