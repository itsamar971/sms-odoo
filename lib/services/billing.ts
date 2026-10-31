import { getDb } from "../db/client";
import { newId } from "../db/database";
import { isUniqueConstraintError } from "../db/store";
import { addDays, addPeriod, todayStr } from "../dates";
import { D, mul, round2, sub as subtract, sum } from "../money";
import { ServiceError } from "../errors";
import { applyDiscounts } from "./discounts";
import { computeLineTax } from "./tax";
import { productDisplayName } from "./catalog-helpers";
import { logStatus } from "./history";
import {
  PAYMENT_TERM_DAYS,
  type BillingRun,
  type DateStr,
  type Invoice,
  type InvoiceLine,
  type RecurringPlan,
  type Subscription,
} from "../db/types";

export const BATCH_SIZE = 100;

export function anchorDay(sub: Pick<Subscription, "startDate">): number {
  return Number(sub.startDate.slice(8, 10));
}

export function nextPeriodStart(sub: Subscription, plan: RecurringPlan, from: DateStr): DateStr {
  return addPeriod(from, plan.billingPeriod, plan.intervalCount, anchorDay(sub));
}

export function periodEndFor(sub: Subscription, plan: RecurringPlan, periodStart: DateStr): DateStr {
  return addDays(nextPeriodStart(sub, plan, periodStart), -1);
}

export interface InvoicePreview {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  lines: Omit<InvoiceLine, "id" | "invoiceId">[];
  discountIds: string[];
}

/** Price a subscription's lines for one period: discounts, then taxes on the post-discount amount. */
export function priceSubscription(sub: Subscription, asOf: DateStr, periodLabel = ""): InvoicePreview {
  const db = getDb();
  const subLines = db.subscriptionLines.by("subscriptionId", sub.id);
  if (subLines.length === 0) throw new ServiceError(`${sub.number} has no product lines to bill`);

  const priced = subLines.map((l) => ({
    key: l.id,
    productId: l.productId,
    quantity: l.quantity,
    gross: mul(l.quantity, l.unitPrice),
    discountId: l.discountId,
  }));
  const discountResult = applyDiscounts(priced, db.discounts.all(), asOf);

  const lines: InvoicePreview["lines"] = subLines.map((l, i) => {
    const gross = priced[i].gross;
    const discountAmount = discountResult.lineDiscounts.get(l.id) ?? 0;
    const net = subtract(gross, discountAmount);
    const taxes = l.taxIds.map((id) => db.taxes.get(id)).filter((t): t is NonNullable<typeof t> => !!t);
    const tax = computeLineTax(net, l.quantity, taxes);
    return {
      kind: "PRODUCT",
      description: `${productDisplayName(l.productId, l.variantId)}${periodLabel}`,
      productId: l.productId,
      discountId: null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountAmount,
      taxAmount: tax.total,
      amount: gross,
    };
  });
  for (const a of discountResult.applied) {
    lines.push({
      kind: "DISCOUNT",
      description: `Discount: ${a.discount.name}`,
      productId: null,
      discountId: a.discount.id,
      quantity: 1,
      unitPrice: -a.amount,
      discountAmount: 0,
      taxAmount: 0,
      amount: -a.amount,
    });
  }
  const subtotal = sum(lines.filter((l) => l.kind === "PRODUCT").map((l) => l.amount));
  const discountTotal = discountResult.total;
  const taxTotal = sum(lines.map((l) => l.taxAmount));
  const total = round2(D(subtotal).minus(discountTotal).plus(taxTotal));
  return { subtotal, discountTotal, taxTotal, total, lines, discountIds: discountResult.applied.map((a) => a.discount.id) };
}

/**
 * Create a DRAFT invoice for one billing period. Must run inside a transaction.
 * Throws UniqueConstraintError if (subscriptionId, periodStart) is already billed.
 */
export function createInvoiceForPeriod(sub: Subscription, plan: RecurringPlan, periodStart: DateStr, asOf: DateStr): Invoice {
  const db = getDb();
  const periodEnd = periodEndFor(sub, plan, periodStart);
  const preview = priceSubscription(sub, asOf);
  const invoiceDate = periodStart;
  const invoice: Invoice = {
    id: newId(),
    number: db.nextNumber("INV", Number(invoiceDate.slice(0, 4))),
    subscriptionId: sub.id,
    customerId: sub.customerId,
    periodStart,
    periodEnd,
    invoiceDate,
    dueDate: addDays(invoiceDate, PAYMENT_TERM_DAYS[sub.paymentTerms]),
    status: "DRAFT",
    subtotal: preview.subtotal,
    discountTotal: preview.discountTotal,
    taxTotal: preview.taxTotal,
    total: preview.total,
    amountPaid: 0,
    amountDue: preview.total,
    lastReminderAt: null,
    sentAt: null,
    createdAt: new Date(),
  };
  db.invoices.insert(invoice); // unique (subscriptionId, periodStart) guard fires here
  for (const l of preview.lines) db.invoiceLines.insert({ ...l, id: newId(), invoiceId: invoice.id });
  for (const discountId of preview.discountIds) {
    db.discountUsages.insert({ id: newId(), discountId, invoiceId: invoice.id });
    db.discounts.update(discountId, (d) => ({ usedCount: d.usedCount + 1 }));
  }
  return invoice;
}

export interface SubscriptionBillingResult {
  created: number;
  skipped: number;
  failed: number;
  invoiceIds: string[];
  error?: string;
}

/**
 * Bill every missed period of one ACTIVE subscription up to `asOf` (catch-up: one invoice per period).
 * Each period runs in its own transaction: invoice + nextInvoiceDate advance are atomic.
 */
export function billSubscription(subscriptionId: string, asOf: DateStr): SubscriptionBillingResult {
  const db = getDb();
  const res: SubscriptionBillingResult = { created: 0, skipped: 0, failed: 0, invoiceIds: [] };
  for (let guard = 0; guard < 5000; guard++) {
    const sub = db.subscriptions.get(subscriptionId);
    if (!sub || sub.status !== "ACTIVE" || sub.nextInvoiceDate > asOf) break;
    const plan = db.plans.get(sub.planId);
    if (!plan) {
      res.failed++;
      res.error = `${sub.number}: plan missing`;
      break;
    }
    if (sub.expiryDate && sub.nextInvoiceDate > sub.expiryDate) break;
    if (plan.autoClose && plan.endDate && sub.nextInvoiceDate > plan.endDate) break;

    const periodStart = sub.nextInvoiceDate;
    const next = nextPeriodStart(sub, plan, periodStart);
    try {
      const invoice = db.transaction(() => {
        const inv = createInvoiceForPeriod(sub, plan, periodStart, asOf);
        db.subscriptions.update(sub.id, { nextInvoiceDate: next });
        return inv;
      });
      res.created++;
      res.invoiceIds.push(invoice.id);
    } catch (e) {
      if (isUniqueConstraintError(e) && e.constraint === "invoices.subscription_period") {
        // Already billed for this period: never bill twice, just move the pointer forward.
        db.subscriptions.update(sub.id, { nextInvoiceDate: next });
        res.skipped++;
        continue;
      }
      res.failed++;
      res.error = `${sub.number}: ${e instanceof Error ? e.message : String(e)}`;
      break;
    }
  }
  return res;
}

/** Close subscriptions whose plan has autoClose and whose plan end / expiry date has passed. */
export function autoCloseSubscriptions(asOf: DateStr): number {
  const db = getDb();
  let closed = 0;
  for (const status of ["ACTIVE", "PAUSED"] as const) {
    for (const sub of db.subscriptions.by("status", status)) {
      const plan = db.plans.get(sub.planId);
      if (!plan?.autoClose) continue;
      const ended = (plan.endDate && plan.endDate < asOf) || (sub.expiryDate && sub.expiryDate < asOf);
      if (!ended) continue;
      db.transaction(() => {
        db.subscriptions.update(sub.id, { status: "CLOSED", closedAt: asOf });
        logStatus("SUBSCRIPTION", sub.id, status, "CLOSED", null, "Auto-closed: plan/expiry date passed");
      });
      closed++;
    }
  }
  return closed;
}

export interface BillingSummary {
  runId: string;
  asOf: DateStr;
  created: number;
  skipped: number;
  failed: number;
  closed: number;
  errors: string[];
  durationMs: number;
}

const yieldToEventLoop = () => new Promise<void>((r) => setImmediate(r));

/**
 * The billing run. Idempotent: running it twice for the same date creates 0 new invoices,
 * because each subscription's nextInvoiceDate advances atomically with its invoice and the
 * (subscriptionId, periodStart) unique key rejects any duplicate.
 */
export async function runBilling(
  opts: { asOf?: DateStr; trigger?: BillingRun["trigger"]; userId?: string | null } = {},
): Promise<BillingSummary> {
  const db = getDb();
  const asOf = opts.asOf ?? todayStr();
  if (db.meta.billingRunning) throw new ServiceError("A billing run is already in progress");
  db.meta.billingRunning = true;
  const started = Date.now();
  const run: BillingRun = {
    id: newId(),
    asOf,
    startedAt: new Date(),
    finishedAt: null,
    trigger: opts.trigger ?? "MANUAL",
    triggeredById: opts.userId ?? null,
    created: 0,
    skipped: 0,
    failed: 0,
    closed: 0,
    errors: [],
  };
  db.billingRuns.insert(run);
  try {
    const due = db.subscriptions
      .by("status", "ACTIVE")
      .filter((s) => s.nextInvoiceDate <= asOf)
      .map((s) => s.id);
    for (let i = 0; i < due.length; i += BATCH_SIZE) {
      for (const id of due.slice(i, i + BATCH_SIZE)) {
        const r = billSubscription(id, asOf);
        run.created += r.created;
        run.skipped += r.skipped;
        run.failed += r.failed;
        if (r.error && run.errors.length < 50) run.errors.push(r.error);
      }
      await yieldToEventLoop();
    }
    run.closed = autoCloseSubscriptions(asOf);
  } finally {
    db.meta.billingRunning = false;
    db.billingRuns.update(run.id, { ...run, finishedAt: new Date() });
  }
  return {
    runId: run.id,
    asOf,
    created: run.created,
    skipped: run.skipped,
    failed: run.failed,
    closed: run.closed,
    errors: run.errors,
    durationMs: Date.now() - started,
  };
}
