"use server";
import { guarded } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { NotFoundError, ServiceError } from "@/lib/errors";
import { transitionSubscription } from "@/lib/services/subscriptions";
import { recordPayment } from "@/lib/services/payments";
import { paymentSchema } from "@/lib/validation";
import type { SubscriptionStatus, User } from "@/lib/db/types";

/** Ownership check: a portal user can only touch records of their own customer. */
function ownSubscription(user: User, id: string) {
  const sub = getDb().subscriptions.get(id);
  if (!sub || sub.customerId !== user.customerId) throw new NotFoundError("Subscription");
  return sub;
}

const PORTAL_MOVES: Partial<Record<SubscriptionStatus, { from: SubscriptionStatus[]; msg: string }>> = {
  CONFIRMED: { from: ["QUOTATION"], msg: "Quotation accepted — we'll activate it shortly" },
  PAUSED: { from: ["ACTIVE"], msg: "Subscription paused" },
  ACTIVE: { from: ["PAUSED"], msg: "Subscription resumed" },
  CLOSED: { from: ["ACTIVE", "PAUSED"], msg: "Subscription cancelled" },
};

export async function portalTransitionAction(id: string, to: SubscriptionStatus) {
  return guarded("portal", (u) => {
    const sub = ownSubscription(u, id);
    const rule = PORTAL_MOVES[to];
    if (!rule || !rule.from.includes(sub.status)) throw new ServiceError("That change isn't available from the portal");
    transitionSubscription(id, to, u.id, { note: "Requested via customer portal" });
    return rule.msg;
  }).then((r) => (r.ok ? { ...r, message: r.data as string } : r));
}

export async function portalPayAction(input: unknown) {
  return guarded("portal", (u) => {
    const data = paymentSchema.parse(input);
    const inv = getDb().invoices.get(data.invoiceId);
    if (!inv || inv.customerId !== u.customerId) throw new NotFoundError("Invoice");
    if (data.method !== "CARD" && data.method !== "UPI") throw new ServiceError("Pay online by card or UPI");
    const r = recordPayment({ ...data, note: data.note || "Paid online via portal (demo gateway)" }, u.id);
    return { status: r.invoice.status, amountDue: r.invoice.amountDue };
  });
}
