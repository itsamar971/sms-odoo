import { getDb } from "../db/client";
import { todayStr } from "../dates";
import { round2 } from "../money";
import { isOverdue } from "./invoices";
import { recurringAmount } from "./subscriptions";

/** Everything here is filtered by customerId on the server. */
export function portalOverview(customerId: string) {
  const db = getDb();
  const today = todayStr();
  const subs = db.subscriptions.by("customerId", customerId).filter((s) => s.status !== "DRAFT");
  const invoices = db.invoices.by("customerId", customerId).filter((i) => i.status !== "DRAFT");
  const open = invoices.filter((i) => i.status === "CONFIRMED" && i.amountDue > 0).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  return {
    subscriptions: subs
      .sort((a, b) => (a.status === "ACTIVE" ? -1 : 1) - (b.status === "ACTIVE" ? -1 : 1) || (a.number < b.number ? 1 : -1))
      .map((s) => {
        const plan = db.plans.get(s.planId)!;
        return { ...s, planName: plan.name, plan, amount: round2(recurringAmount(s.id)) };
      }),
    outstanding: round2(open.reduce((a, i) => a + i.amountDue, 0)),
    overdue: open.filter((i) => isOverdue(i, today)),
    nextDue: open[0] ?? null,
    open,
    recentInvoices: invoices.sort((a, b) => (a.invoiceDate < b.invoiceDate ? 1 : -1)).slice(0, 8),
    paidTotal: round2(db.payments.by("customerId", customerId).reduce((a, p) => a + p.amount, 0)),
  };
}
