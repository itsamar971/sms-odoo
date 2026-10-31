"use server";
import { guarded } from "@/lib/auth/guard";
import { deleteCustomer, saveCustomer } from "@/lib/services/customers";
import {
  createSubscription, deleteDraftSubscription, renewSubscription, transitionSubscription, updateSubscription,
} from "@/lib/services/subscriptions";
import { billSubscription } from "@/lib/services/billing";
import { todayStr } from "@/lib/dates";
import type { SubscriptionStatus } from "@/lib/db/types";

export async function saveCustomerAction(id: string | null, input: unknown) {
  return guarded("ops:write", () => ({ id: saveCustomer(id, input as never).id }), id ? "Customer updated" : "Customer created");
}
export async function deleteCustomerAction(id: string) {
  return guarded("ops:write", () => deleteCustomer(id), "Customer deleted");
}

export async function createSubscriptionAction(input: unknown) {
  return guarded("ops:write", (u) => {
    const s = createSubscription(input as never, u.id);
    return { id: s.id, number: s.number };
  });
}
export async function updateSubscriptionAction(id: string, input: unknown) {
  return guarded("ops:write", (u) => ({ id: updateSubscription(id, input as never, u.id).id }), "Subscription updated");
}
export async function deleteSubscriptionAction(id: string) {
  return guarded("ops:write", () => deleteDraftSubscription(id), "Draft deleted");
}

const LABEL: Record<SubscriptionStatus, string> = {
  DRAFT: "Moved to draft", QUOTATION: "Quotation sent", CONFIRMED: "Subscription confirmed", ACTIVE: "Subscription is active",
  PAUSED: "Subscription paused", CLOSED: "Subscription closed",
};
export async function transitionSubscriptionAction(id: string, to: SubscriptionStatus) {
  return guarded("ops:write", (u) => void transitionSubscription(id, to, u.id), LABEL[to]);
}
export async function renewSubscriptionAction(id: string) {
  return guarded("ops:write", (u) => void renewSubscription(id, u.id), "Subscription renewed");
}
export async function billSubscriptionNowAction(id: string) {
  return guarded("billing:run", () => {
    const r = billSubscription(id, todayStr());
    if (r.error) throw Object.assign(new Error(r.error), { name: "ServiceError" });
    return r;
  });
}
