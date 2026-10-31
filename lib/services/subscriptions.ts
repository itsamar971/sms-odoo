import { z } from "zod";
import { getDb } from "../db/client";
import { newId } from "../db/database";
import { addDays, addPeriod, formatDate, todayStr } from "../dates";
import { mul } from "../money";
import { NotFoundError, ServiceError } from "../errors";
import { subscriptionSchema, type LineInput } from "../validation";
import { canTransitionSubscription } from "./state-machine";
import { unitPriceFor } from "./catalog-helpers";
import { logStatus } from "./history";
import { anchorDay } from "./billing";
import type { DateStr, RecurringPlan, Subscription, SubscriptionLine, SubscriptionStatus } from "../db/types";

export type SubscriptionInput = z.input<typeof subscriptionSchema>;

const DEFAULT_QUOTATION_VALIDITY = 30;

/** Plan availability: the start date must fall inside [plan.startDate, plan.endDate]. */
export function assertStartWithinPlan(plan: RecurringPlan, startDate: DateStr) {
  if (startDate < plan.startDate)
    throw new ServiceError(`Plan "${plan.name}" is only available from ${formatDate(plan.startDate)}`);
  if (plan.endDate && startDate > plan.endDate)
    throw new ServiceError(`Plan "${plan.name}" ended on ${formatDate(plan.endDate)}`);
}

export function assertMinQuantity(plan: RecurringPlan, lines: { quantity: number }[]) {
  const bad = lines.find((l) => l.quantity < plan.minQuantity);
  if (bad) throw new ServiceError(`Plan "${plan.name}" requires a quantity of at least ${plan.minQuantity} per line`);
}

function buildLines(subscriptionId: string, lines: LineInput[]): SubscriptionLine[] {
  const db = getDb();
  return lines.map((l) => {
    const product = db.products.get(l.productId);
    if (!product) throw new NotFoundError("Product");
    if (!product.active) throw new ServiceError(`Product "${product.name}" is archived`);
    if (l.variantId) {
      const v = db.variants.get(l.variantId);
      if (!v || v.productId !== product.id) throw new ServiceError(`Invalid variant for "${product.name}"`);
    }
    const unitPrice = l.unitPrice ?? unitPriceFor(product, l.variantId);
    return {
      id: newId(),
      subscriptionId,
      productId: product.id,
      variantId: l.variantId,
      quantity: l.quantity,
      unitPrice,
      taxIds: [...product.taxIds],
      discountId: null,
      amount: mul(l.quantity, unitPrice),
    };
  });
}

function validate(input: z.output<typeof subscriptionSchema>) {
  const db = getDb();
  if (!db.customers.get(input.customerId)) throw new NotFoundError("Customer");
  const plan = db.plans.get(input.planId);
  if (!plan) throw new NotFoundError("Plan");
  if (!plan.active) throw new ServiceError(`Plan "${plan.name}" is archived`);
  assertStartWithinPlan(plan, input.startDate);
  assertMinQuantity(plan, input.lines);
  if (input.expiryDate && input.expiryDate <= input.startDate)
    throw new ServiceError("Expiry date must be after the start date");
  return plan;
}

export function createSubscription(raw: SubscriptionInput, userId: string): Subscription {
  const input = subscriptionSchema.parse(raw);
  const db = getDb();
  validate(input);
  const template = input.templateId ? db.templates.get(input.templateId) : undefined;
  return db.transaction(() => {
    const sub: Subscription = {
      id: newId(),
      number: db.nextNumber("SUB", Number(todayStr().slice(0, 4))),
      customerId: input.customerId,
      planId: input.planId,
      status: "DRAFT",
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      nextInvoiceDate: input.startDate,
      paymentTerms: input.paymentTerms,
      quotationValidUntil: null,
      templateId: template?.id ?? null,
      notes: input.notes,
      createdById: userId,
      createdAt: new Date(),
      closedAt: null,
    };
    db.subscriptions.insert(sub);
    for (const l of buildLines(sub.id, input.lines)) db.subscriptionLines.insert(l);
    logStatus("SUBSCRIPTION", sub.id, null, "DRAFT", userId, template ? `Created from template "${template.name}"` : undefined);
    if (input.asQuotation) return transitionSubscription(sub.id, "QUOTATION", userId);
    return sub;
  });
}

/**
 * Quotation from template: copies the plan, terms and lines, and sets
 * quotationValidUntil = today + validityDays.
 */
export function createQuotationFromTemplate(
  templateId: string,
  customerId: string,
  startDate: DateStr,
  userId: string,
): Subscription {
  const t = getDb().templates.get(templateId);
  if (!t) throw new NotFoundError("Template");
  return createSubscription(
    {
      customerId,
      planId: t.planId,
      startDate,
      paymentTerms: t.paymentTerms,
      templateId: t.id,
      asQuotation: true,
      lines: t.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice })),
    },
    userId,
  );
}

export function updateSubscription(id: string, raw: SubscriptionInput, userId: string): Subscription {
  const db = getDb();
  const existing = db.subscriptions.get(id);
  if (!existing) throw new NotFoundError("Subscription");
  if (existing.status !== "DRAFT" && existing.status !== "QUOTATION")
    throw new ServiceError("Only draft or quotation subscriptions can be edited");
  const input = subscriptionSchema.parse(raw);
  validate(input);
  return db.transaction(() => {
    for (const l of db.subscriptionLines.by("subscriptionId", id)) db.subscriptionLines.delete(l.id);
    for (const l of buildLines(id, input.lines)) db.subscriptionLines.insert(l);
    void userId;
    return db.subscriptions.update(id, {
      customerId: input.customerId,
      planId: input.planId,
      startDate: input.startDate,
      nextInvoiceDate: input.startDate,
      expiryDate: input.expiryDate,
      paymentTerms: input.paymentTerms,
      notes: input.notes,
    });
  });
}

export function deleteDraftSubscription(id: string) {
  const db = getDb();
  const sub = db.subscriptions.get(id);
  if (!sub) throw new NotFoundError("Subscription");
  if (sub.status !== "DRAFT") throw new ServiceError("Only draft subscriptions can be deleted");
  db.transaction(() => {
    for (const l of db.subscriptionLines.by("subscriptionId", id)) db.subscriptionLines.delete(l.id);
    db.subscriptions.delete(id);
  });
}

export interface TransitionOptions {
  today?: DateStr;
  /** Skip plan-flag checks (system jobs). */
  system?: boolean;
  note?: string;
}

/** The subscription state machine. Rejects any move not in the allow-list and logs every move. */
export function transitionSubscription(
  id: string,
  to: SubscriptionStatus,
  userId: string | null,
  opts: TransitionOptions = {},
): Subscription {
  const db = getDb();
  const today = opts.today ?? todayStr();
  const sub = db.subscriptions.get(id);
  if (!sub) throw new NotFoundError("Subscription");
  if (!canTransitionSubscription(sub.status, to))
    throw new ServiceError(`Cannot move a subscription from ${sub.status} to ${to}`);
  const plan = db.plans.get(sub.planId);
  if (!plan) throw new NotFoundError("Plan");

  const patch: Partial<Subscription> = { status: to };
  switch (to) {
    case "QUOTATION": {
      const t = sub.templateId ? db.templates.get(sub.templateId) : undefined;
      patch.quotationValidUntil = addDays(today, t?.validityDays ?? DEFAULT_QUOTATION_VALIDITY);
      break;
    }
    case "CONFIRMED":
      if (sub.quotationValidUntil && sub.quotationValidUntil < today)
        throw new ServiceError(`This quotation expired on ${formatDate(sub.quotationValidUntil)} and cannot be confirmed`);
      assertStartWithinPlan(plan, sub.startDate);
      assertMinQuantity(plan, db.subscriptionLines.by("subscriptionId", id));
      break;
    case "ACTIVE":
      if (sub.status === "PAUSED") {
        if (!opts.system && !plan.pausable) throw new ServiceError("This plan does not allow pausing/resuming");
        // Paused periods are not billed: resume billing from today.
        if (sub.nextInvoiceDate < today) patch.nextInvoiceDate = today;
      } else {
        patch.nextInvoiceDate = sub.startDate;
      }
      break;
    case "PAUSED":
      if (!opts.system && !plan.pausable) throw new ServiceError(`Plan "${plan.name}" does not allow pausing`);
      break;
    case "CLOSED":
      if (!opts.system && !plan.closable) throw new ServiceError(`Plan "${plan.name}" does not allow closing`);
      patch.closedAt = today;
      break;
  }
  return db.transaction(() => {
    const updated = db.subscriptions.update(id, patch);
    logStatus("SUBSCRIPTION", id, sub.status, to, userId, opts.note);
    return updated;
  });
}

/** Renew: extend the expiry date by one plan period (only if the plan is renewable). */
export function renewSubscription(id: string, userId: string | null, today = todayStr()): Subscription {
  const db = getDb();
  const sub = db.subscriptions.get(id);
  if (!sub) throw new NotFoundError("Subscription");
  const plan = db.plans.get(sub.planId);
  if (!plan) throw new NotFoundError("Plan");
  if (!plan.renewable) throw new ServiceError(`Plan "${plan.name}" is not renewable`);
  if (sub.status !== "ACTIVE" && sub.status !== "PAUSED") throw new ServiceError("Only running subscriptions can be renewed");
  const base = sub.expiryDate && sub.expiryDate > today ? sub.expiryDate : today;
  const expiryDate = addPeriod(base, plan.billingPeriod, plan.intervalCount, anchorDay(sub));
  return db.transaction(() => {
    const u = db.subscriptions.update(id, { expiryDate });
    logStatus("SUBSCRIPTION", id, sub.status, sub.status, userId, `Renewed until ${formatDate(expiryDate)}`);
    return u;
  });
}

/** Which lifecycle actions to show for a subscription (plan flags + state machine). */
export function availableActions(sub: Subscription, plan: RecurringPlan, today = todayStr()) {
  const quotationExpired = !!sub.quotationValidUntil && sub.quotationValidUntil < today;
  return {
    sendQuotation: sub.status === "DRAFT",
    confirm: sub.status === "QUOTATION" && !quotationExpired,
    quotationExpired: sub.status === "QUOTATION" && quotationExpired,
    activate: sub.status === "CONFIRMED",
    pause: sub.status === "ACTIVE" && plan.pausable,
    resume: sub.status === "PAUSED" && plan.pausable,
    close: (sub.status === "ACTIVE" || sub.status === "PAUSED") && plan.closable,
    renew: (sub.status === "ACTIVE" || sub.status === "PAUSED") && plan.renewable,
    edit: sub.status === "DRAFT" || sub.status === "QUOTATION",
    delete: sub.status === "DRAFT",
  };
}

/** Recurring amount per billing period (pre-tax, pre-discount). */
export function recurringAmount(subscriptionId: string): number {
  return getDb()
    .subscriptionLines.by("subscriptionId", subscriptionId)
    .reduce((a, l) => a + l.amount, 0);
}
