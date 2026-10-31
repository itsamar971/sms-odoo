import { Database, newId } from "@/lib/db/database";
import { setDb } from "@/lib/db/client";
import type { Discount, RecurringPlan, Subscription } from "@/lib/db/types";

/** Fresh, empty in-memory DB with a tiny catalog. */
export function makeFixture() {
  const db = setDb(new Database());
  const admin = db.users.insert({
    id: newId(), email: "a@x.com", passwordHash: "x", role: "ADMIN", name: "A", customerId: null, active: true, createdAt: new Date(),
  });
  const customer = db.customers.insert({
    id: newId(), name: "Cust", email: "c@x.com", phone: "", address: "", gstin: null, createdAt: new Date(),
  });
  const gst = db.taxes.insert({ id: newId(), name: "GST 18%", type: "PERCENT", rate: 18, active: true });
  const product = db.products.insert({
    id: newId(), name: "Seat", type: "SERVICE", salesPrice: 100, costPrice: 10, notes: "", active: true, taxIds: [gst.id], createdAt: new Date(),
  });
  const plan: RecurringPlan = db.plans.insert({
    id: newId(), name: "Monthly", price: 0, billingPeriod: "MONTHLY", intervalCount: 1, minQuantity: 1, startDate: "2020-01-01",
    endDate: null, autoClose: false, closable: true, pausable: true, renewable: true, active: true,
  });

  function addSubscription(opts: Partial<Subscription> & { quantity?: number } = {}): Subscription {
    const { quantity = 1, ...rest } = opts;
    const sub = db.subscriptions.insert({
      id: newId(), number: db.nextNumber("SUB", 2026), customerId: customer.id, planId: plan.id, status: "ACTIVE",
      startDate: "2026-01-15", expiryDate: null, nextInvoiceDate: "2026-01-15", paymentTerms: "NET15", quotationValidUntil: null,
      templateId: null, notes: "", createdById: admin.id, createdAt: new Date(), closedAt: null, ...rest,
    });
    db.subscriptionLines.insert({
      id: newId(), subscriptionId: sub.id, productId: product.id, variantId: null, quantity, unitPrice: 100, taxIds: [gst.id],
      discountId: null, amount: 100 * quantity,
    });
    return sub;
  }

  function addDiscount(d: Partial<Discount> = {}): Discount {
    return db.discounts.insert({
      id: newId(), name: "10% off", type: "PERCENT", value: 10, minPurchase: null, minQuantity: null, startDate: "2020-01-01",
      endDate: "2030-12-31", usageLimit: null, usedCount: 0, scope: "SUBSCRIPTION", productIds: [], active: true, ...d,
    });
  }

  return { db, admin, customer, gst, product, plan, addSubscription, addDiscount };
}
