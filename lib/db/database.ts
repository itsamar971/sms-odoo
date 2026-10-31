import { randomUUID } from "crypto";
import { Table, TxManager } from "./store";
import type * as T from "./types";

export function newId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 20);
}

export class Database {
  readonly tx = new TxManager();

  users = new Table<T.User>("users", this.tx, {
    unique: { email: (u) => u.email.trim().toLowerCase() },
    index: ["customerId", "role"],
  });
  resetTokens = new Table<T.PasswordResetToken>("password_reset_tokens", this.tx, {
    unique: { tokenHash: (t) => t.tokenHash },
    index: ["userId"],
  });
  sessions = new Table<T.Session>("sessions", this.tx, { index: ["userId"] });
  customers = new Table<T.Customer>("customers", this.tx, {
    unique: { email: (c) => c.email.trim().toLowerCase() },
  });
  products = new Table<T.Product>("products", this.tx);
  attributes = new Table<T.ProductAttribute>("product_attributes", this.tx, {
    unique: { name: (a) => a.name.trim().toLowerCase() },
  });
  attributeValues = new Table<T.AttributeValue>("attribute_values", this.tx, {
    unique: { value: (v) => `${v.attributeId}|${v.value.trim().toLowerCase()}` },
    index: ["attributeId"],
  });
  variants = new Table<T.ProductVariant>("product_variants", this.tx, {
    unique: { values: (v) => `${v.productId}|${[...v.valueIds].sort().join(",")}` },
    index: ["productId"],
  });
  plans = new Table<T.RecurringPlan>("recurring_plans", this.tx);
  taxes = new Table<T.Tax>("taxes", this.tx);
  templates = new Table<T.QuotationTemplate>("quotation_templates", this.tx);
  subscriptions = new Table<T.Subscription>("subscriptions", this.tx, {
    unique: { number: (s) => s.number },
    index: ["customerId", "status", "planId"],
  });
  subscriptionLines = new Table<T.SubscriptionLine>("subscription_lines", this.tx, {
    index: ["subscriptionId"],
  });
  statusHistory = new Table<T.StatusHistory>("status_history", this.tx, { index: ["entityId"] });
  discounts = new Table<T.Discount>("discounts", this.tx);
  discountUsages = new Table<T.DiscountUsage>("discount_usages", this.tx, {
    unique: { pair: (u) => `${u.discountId}|${u.invoiceId}` },
    index: ["invoiceId", "discountId"],
  });
  invoices = new Table<T.Invoice>("invoices", this.tx, {
    unique: {
      number: (i) => i.number,
      // THE double-billing guard. Cancelled invoices drop out of the key so a period can be re-billed.
      subscription_period: (i) => (i.status === "CANCELLED" ? null : `${i.subscriptionId}|${i.periodStart}`),
    },
    index: ["subscriptionId", "customerId", "status"],
  });
  invoiceLines = new Table<T.InvoiceLine>("invoice_lines", this.tx, { index: ["invoiceId"] });
  payments = new Table<T.Payment>("payments", this.tx, { index: ["invoiceId", "customerId"] });
  billingRuns = new Table<T.BillingRun>("billing_runs", this.tx);
  emails = new Table<T.EmailLog>("email_log", this.tx);

  private sequences = new Map<string, number>();
  meta = {
    seededAt: null as Date | null,
    billingRunning: false,
    lastScheduledRun: null as string | null,
  };

  /** DB-style sequence: like Postgres, values are never rolled back (gaps are fine). */
  nextSequence(name: string): number {
    const n = (this.sequences.get(name) ?? 0) + 1;
    this.sequences.set(name, n);
    return n;
  }

  nextNumber(prefix: "SUB" | "INV", year: number): string {
    const n = this.nextSequence(`${prefix}/${year}`);
    return `${prefix}/${year}/${String(n).padStart(5, "0")}`;
  }

  /** Run `fn` atomically. Any thrown error rolls back every write made inside it. */
  transaction<R>(fn: () => R): R {
    if (this.tx.journal) return fn(); // nested: join outer transaction
    this.tx.journal = [];
    try {
      const result = fn();
      if (result instanceof Promise) throw new Error("transaction() callbacks must be synchronous");
      this.tx.journal = null;
      return result;
    } catch (e) {
      const journal = this.tx.journal ?? [];
      this.tx.journal = null;
      for (let i = journal.length - 1; i >= 0; i--) journal[i]();
      throw e;
    }
  }
}
