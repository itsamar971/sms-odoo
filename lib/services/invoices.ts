import { getDb } from "../db/client";
import { todayStr } from "../dates";
import { NotFoundError, ServiceError } from "../errors";
import { canTransitionInvoice } from "./state-machine";
import { createInvoiceForPeriod } from "./billing";
import { logStatus } from "./history";
import type { DateStr, Invoice } from "../db/types";

/** Overdue is computed, never stored: CONFIRMED, amountDue > 0 and dueDate < today. */
export function isOverdue(inv: Pick<Invoice, "status" | "amountDue" | "dueDate">, today: DateStr = todayStr()): boolean {
  return inv.status === "CONFIRMED" && inv.amountDue > 0 && inv.dueDate < today;
}

export function getInvoiceOrThrow(id: string): Invoice {
  const inv = getDb().invoices.get(id);
  if (!inv) throw new NotFoundError("Invoice");
  return inv;
}

export function confirmInvoice(id: string, userId: string | null): Invoice {
  const db = getDb();
  const inv = getInvoiceOrThrow(id);
  if (!canTransitionInvoice(inv.status, "CONFIRMED")) throw new ServiceError(`Cannot confirm a ${inv.status} invoice`);
  return db.transaction(() => {
    const to = inv.amountDue <= 0 ? "PAID" : "CONFIRMED";
    const u = db.invoices.update(id, { status: to });
    logStatus("INVOICE", id, inv.status, to, userId);
    return u;
  });
}

export function cancelInvoice(id: string, userId: string | null): Invoice {
  const db = getDb();
  const inv = getInvoiceOrThrow(id);
  if (!canTransitionInvoice(inv.status, "CANCELLED")) throw new ServiceError(`Cannot cancel a ${inv.status} invoice`);
  if (inv.amountPaid > 0) throw new ServiceError("This invoice has payments recorded and cannot be cancelled");
  return db.transaction(() => {
    // Release discount usage so the discount budget is not burnt by a cancelled invoice.
    for (const u of db.discountUsages.by("invoiceId", id)) {
      db.discountUsages.delete(u.id);
      db.discounts.update(u.discountId, (d) => ({ usedCount: Math.max(0, d.usedCount - 1) }));
    }
    const u = db.invoices.update(id, { status: "CANCELLED", amountDue: 0 });
    logStatus("INVOICE", id, inv.status, "CANCELLED", userId);
    return u;
  });
}

/** Re-bill the same period of a cancelled invoice as a fresh DRAFT. */
export function regenerateInvoice(id: string, userId: string | null): Invoice {
  const db = getDb();
  const inv = getInvoiceOrThrow(id);
  if (inv.status !== "CANCELLED") throw new ServiceError("Only cancelled invoices can be regenerated");
  const sub = db.subscriptions.get(inv.subscriptionId);
  if (!sub) throw new NotFoundError("Subscription");
  const plan = db.plans.get(sub.planId);
  if (!plan) throw new NotFoundError("Plan");
  return db.transaction(() => {
    const fresh = createInvoiceForPeriod(sub, plan, inv.periodStart, todayStr());
    logStatus("INVOICE", fresh.id, null, "DRAFT", userId, `Regenerated from ${inv.number}`);
    return fresh;
  });
}

export function deleteCancelledInvoice(id: string) {
  const db = getDb();
  const inv = getInvoiceOrThrow(id);
  if (inv.status !== "CANCELLED") throw new ServiceError("Only cancelled invoices can be deleted");
  db.transaction(() => {
    for (const l of db.invoiceLines.by("invoiceId", id)) db.invoiceLines.delete(l.id);
    db.invoices.delete(id);
  });
}

export function markSent(id: string) {
  return getDb().invoices.update(id, { sentAt: new Date() });
}

export function markReminded(id: string) {
  return getDb().invoices.update(id, { lastReminderAt: new Date() });
}
