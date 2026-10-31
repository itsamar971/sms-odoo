import { getDb } from "../db/client";
import { todayStr } from "../dates";
import { round2 } from "../money";
import { paginate, parseList, str, type SearchParams } from "../list";
import { isOverdue } from "./invoices";
import type { InvoiceStatus, PaymentMethod, SubscriptionStatus } from "../db/types";

function lc(s: string) {
  return s.toLowerCase();
}

/** Per-customer outstanding (single pass over invoices). */
function outstandingByCustomer() {
  const map = new Map<string, number>();
  for (const i of getDb().invoices.all()) if (i.status === "CONFIRMED") map.set(i.customerId, (map.get(i.customerId) ?? 0) + i.amountDue);
  return map;
}

export function listCustomers(sp: SearchParams) {
  const db = getDb();
  const q = str(sp, "q");
  let rows = db.customers.all();
  if (q) {
    const n = lc(q);
    rows = rows.filter((c) => lc(c.name).includes(n) || lc(c.email).includes(n) || (c.gstin ?? "").toLowerCase().includes(n));
  }
  const out = outstandingByCustomer();
  const active = new Map<string, number>();
  for (const s of db.subscriptions.by("status", "ACTIVE")) active.set(s.customerId, (active.get(s.customerId) ?? 0) + 1);
  const mapped = rows.map((c) => ({
    id: c.id, name: c.name, email: c.email, phone: c.phone, gstin: c.gstin ?? "",
    activeSubs: active.get(c.id) ?? 0, outstanding: round2(out.get(c.id) ?? 0), createdAt: c.createdAt.toISOString(),
  }));
  return paginate(mapped, parseList(sp, { sort: "name", dir: "asc" }), {
    name: (r) => lc(r.name), email: (r) => r.email, activeSubs: (r) => r.activeSubs, outstanding: (r) => r.outstanding,
  });
}

export function listSubscriptions(sp: SearchParams, scope: { customerId?: string } = {}) {
  const db = getDb();
  const status = str(sp, "status") as SubscriptionStatus | undefined;
  const planId = str(sp, "plan");
  const customerId = scope.customerId ?? str(sp, "customer");
  const from = str(sp, "from");
  const to = str(sp, "to");
  const q = str(sp, "q");
  // Use the narrowest index available, then filter.
  let rows = customerId ? db.subscriptions.by("customerId", customerId) : status ? db.subscriptions.by("status", status) : planId ? db.subscriptions.by("planId", planId) : db.subscriptions.all();
  rows = rows.filter(
    (s) =>
      (!status || s.status === status) && (!planId || s.planId === planId) && (!customerId || s.customerId === customerId) &&
      (!from || s.startDate >= from) && (!to || s.startDate <= to) && (!q || lc(s.number).includes(lc(q))),
  );
  const mapped = rows.map((s) => {
    const customer = db.customers.get(s.customerId);
    const lines = db.subscriptionLines.by("subscriptionId", s.id);
    return {
      id: s.id, number: s.number, customer: customer?.name ?? "—", customerEmail: customer?.email ?? "", plan: db.plans.get(s.planId)?.name ?? "—",
      status: s.status, startDate: s.startDate, nextInvoiceDate: s.status === "ACTIVE" ? s.nextInvoiceDate : null,
      amount: round2(lines.reduce((a, l) => a + l.amount, 0)), lines: lines.length,
    };
  });
  return paginate(mapped, parseList(sp, { sort: "number", dir: "desc" }), {
    number: (r) => r.number, customer: (r) => lc(r.customer), startDate: (r) => r.startDate, nextInvoiceDate: (r) => r.nextInvoiceDate ?? "9999",
    amount: (r) => r.amount, status: (r) => r.status, plan: (r) => r.plan,
  });
}

export function listInvoices(sp: SearchParams, scope: { customerId?: string; subscriptionId?: string; excludeDraft?: boolean } = {}) {
  const db = getDb();
  const today = todayStr();
  const status = str(sp, "status") as InvoiceStatus | "OVERDUE" | undefined;
  const overdue = str(sp, "overdue") === "1" || status === "OVERDUE";
  const customerId = scope.customerId ?? str(sp, "customer");
  const from = str(sp, "from");
  const to = str(sp, "to");
  const q = str(sp, "q");
  let rows = scope.subscriptionId
    ? db.invoices.by("subscriptionId", scope.subscriptionId)
    : customerId
      ? db.invoices.by("customerId", customerId)
      : overdue
        ? db.invoices.by("status", "CONFIRMED")
        : status
          ? db.invoices.by("status", status as InvoiceStatus)
          : db.invoices.all();
  rows = rows.filter(
    (i) =>
      (!scope.excludeDraft || i.status !== "DRAFT") && (!status || status === "OVERDUE" || i.status === status) && (!overdue || isOverdue(i, today)) && (!customerId || i.customerId === customerId) &&
      (!from || i.invoiceDate >= from) && (!to || i.invoiceDate <= to) && (!q || lc(i.number).includes(lc(q))),
  );
  const mapped = rows.map((i) => {
    const od = isOverdue(i, today);
    return {
      id: i.id, number: i.number, customer: db.customers.get(i.customerId)?.name ?? "—", subscription: db.subscriptions.get(i.subscriptionId)?.number ?? "",
      subscriptionId: i.subscriptionId, invoiceDate: i.invoiceDate, dueDate: i.dueDate, status: od ? "OVERDUE" : i.status,
      total: i.total, amountDue: i.amountDue, period: `${i.periodStart} → ${i.periodEnd}`,
    };
  });
  return paginate(mapped, parseList(sp, { sort: "invoiceDate", dir: "desc" }), {
    invoiceDate: (r) => r.invoiceDate + r.number, number: (r) => r.number, customer: (r) => lc(r.customer), dueDate: (r) => r.dueDate,
    total: (r) => r.total, amountDue: (r) => r.amountDue, status: (r) => r.status,
  });
}

export function listPayments(sp: SearchParams, scope: { customerId?: string } = {}) {
  const db = getDb();
  const method = str(sp, "method") as PaymentMethod | undefined;
  const customerId = scope.customerId ?? str(sp, "customer");
  const from = str(sp, "from");
  const to = str(sp, "to");
  let rows = customerId ? db.payments.by("customerId", customerId) : db.payments.all();
  rows = rows.filter((p) => (!method || p.method === method) && (!from || p.date >= from) && (!to || p.date <= to));
  const mapped = rows.map((p) => {
    const inv = db.invoices.get(p.invoiceId);
    return {
      id: p.id, date: p.date, amount: p.amount, method: p.method.replace("_", " "), invoice: inv?.number ?? "—", invoiceId: p.invoiceId,
      customer: db.customers.get(p.customerId)?.name ?? "—", note: p.note, recordedBy: p.recordedById ? db.users.get(p.recordedById)?.name ?? "" : "Customer (portal)",
    };
  });
  return paginate(mapped, parseList(sp, { sort: "date", dir: "desc" }), {
    date: (r) => r.date + r.id, amount: (r) => r.amount, customer: (r) => lc(r.customer), invoice: (r) => r.invoice, method: (r) => r.method,
  });
}
