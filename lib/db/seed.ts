import bcrypt from "bcryptjs";
import { Database, newId } from "./database";
import { addDays, addMonths, diffDays, todayStr } from "../dates";
import { mul, round2 } from "../money";
import { variantPrice } from "../services/pricing";
import { billSubscription } from "../services/billing";
import type {
  Customer,
  PaymentMethod,
  PaymentTerms,
  Product,
  RecurringPlan,
  Subscription,
  SubscriptionStatus,
} from "./types";

/** Deterministic PRNG so every seed produces the same demo data. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_CREDENTIALS = {
  admin: { email: "admin@brightloop.com", password: "Admin@1234" },
  internal: { email: "ops@brightloop.com", password: "Internal@1234" },
  portal: { email: "accounts@acmeretail.in", password: "Customer@1234" },
};

const COMPANY_PREFIX = [
  "Acme", "Zenith", "Nimbus", "Vertex", "Saffron", "Lotus", "Indigo", "Banyan", "Kaveri", "Monsoon",
  "Peacock", "Himalaya", "Ganga", "Coral", "Orbit", "Quantum", "Sterling", "Emerald", "Falcon", "Neem",
  "Tusker", "Sapphire", "Crimson", "Aurora", "Pioneer",
];
const COMPANY_SUFFIX = ["Retail", "Logistics", "Foods", "Technologies", "Pharma", "Textiles", "Motors", "Hospitality", "Labs", "Traders"];
const CITIES = ["Mumbai", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Delhi", "Kolkata", "Ahmedabad", "Jaipur", "Kochi"];
const STATE_CODES = ["27", "29", "36", "33", "27", "07", "19", "24", "08", "32"];

export interface SeedOptions {
  subscriptions?: number;
  today?: string;
}

export function seedDatabase(db: Database, opts: SeedOptions = {}) {
  const rand = mulberry32(20261031);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const today = opts.today ?? todayStr();
  const N = opts.subscriptions ?? Number(process.env.SEED_SUBSCRIPTIONS ?? 5000);
  const now = new Date();

  // ---------- Users ----------
  const mkUser = (email: string, name: string, role: "ADMIN" | "INTERNAL" | "PORTAL", hash: string, customerId: string | null = null) =>
    db.users.insert({ id: newId(), email, name, role, passwordHash: hash, customerId, active: true, createdAt: now });
  const admin = mkUser(DEMO_CREDENTIALS.admin.email, "Aditi Rao (Admin)", "ADMIN", bcrypt.hashSync(DEMO_CREDENTIALS.admin.password, 10));
  const internalHash = bcrypt.hashSync(DEMO_CREDENTIALS.internal.password, 10);
  const ops = mkUser(DEMO_CREDENTIALS.internal.email, "Rohan Mehta", "INTERNAL", internalHash);
  mkUser("finance@brightloop.com", "Priya Nair", "INTERNAL", internalHash);
  const portalHash = bcrypt.hashSync(DEMO_CREDENTIALS.portal.password, 10);

  // ---------- Customers (+ portal logins) ----------
  const customers: Customer[] = [];
  for (let i = 0; i < 50; i++) {
    const name = `${COMPANY_PREFIX[i % COMPANY_PREFIX.length]} ${COMPANY_SUFFIX[(i * 7) % COMPANY_SUFFIX.length]} Pvt Ltd`;
    const slug = name.toLowerCase().replace(/ pvt ltd/, "").replace(/[^a-z]/g, "");
    const city = CITIES[i % CITIES.length];
    const email = i === 0 ? DEMO_CREDENTIALS.portal.email : `accounts@${slug}${i}.in`;
    const c = db.customers.insert({
      id: newId(),
      name,
      email,
      phone: `+91 9${String(800000000 + i * 7919).slice(0, 9)}`,
      address: `${between(1, 300)}, ${pick(["MG Road", "Ring Road", "Park Street", "Anna Salai", "FC Road"])}, ${city}`,
      gstin: i % 3 === 2 ? null : `${STATE_CODES[i % STATE_CODES.length]}AAACB${String(1000 + i).slice(-4)}F1Z${i % 10}`,
      createdAt: now,
    });
    customers.push(c);
    mkUser(email, name, "PORTAL", portalHash, c.id);
  }

  // ---------- Taxes ----------
  const gst = db.taxes.insert({ id: newId(), name: "GST 18%", type: "PERCENT", rate: 18, active: true });
  const cess = db.taxes.insert({ id: newId(), name: "E-waste cess (₹25/unit)", type: "FIXED", rate: 25, active: true });
  db.taxes.insert({ id: newId(), name: "GST 5%", type: "PERCENT", rate: 5, active: true });

  // ---------- Attributes ----------
  const brand = db.attributes.insert({ id: newId(), name: "Brand" });
  const odoo = db.attributeValues.insert({ id: newId(), attributeId: brand.id, value: "Odoo", extraPrice: 560 });
  const generic = db.attributeValues.insert({ id: newId(), attributeId: brand.id, value: "Generic", extraPrice: 0 });
  const edition = db.attributes.insert({ id: newId(), name: "Edition" });
  const std = db.attributeValues.insert({ id: newId(), attributeId: edition.id, value: "Standard", extraPrice: 0 });
  const ent = db.attributeValues.insert({ id: newId(), attributeId: edition.id, value: "Enterprise", extraPrice: 1200 });

  // ---------- Products & variants ----------
  const mkProduct = (name: string, type: "SERVICE" | "GOODS", salesPrice: number, costPrice: number, taxIds: string[], notes = "") =>
    db.products.insert({ id: newId(), name, type, salesPrice, costPrice, notes, active: true, taxIds, createdAt: now });
  const crm = mkProduct("CRM Seat", "SERVICE", 899, 300, [gst.id], "Per-user CRM licence");
  const acct = mkProduct("Accounting Suite", "SERVICE", 2499, 900, [gst.id], "Invoicing, GST returns, bank sync");
  const hosting = mkProduct("Cloud Hosting", "SERVICE", 1499, 700, [gst.id], "Managed hosting with daily backups");
  const support = mkProduct("Priority Support", "SERVICE", 999, 400, [gst.id]);
  const scanner = mkProduct("Barcode Scanner", "GOODS", 3499, 2100, [gst.id, cess.id], "Rental, swapped on failure");
  const pos = mkProduct("POS Terminal", "GOODS", 7999, 5200, [gst.id, cess.id], "Rental with on-site support");
  const products: Product[] = [crm, acct, hosting, support, scanner, pos];

  const variantsByProduct = new Map<string, { id: string; price: number }[]>();
  const addVariant = (p: Product, valueIds: string[]) => {
    const v = db.variants.insert({ id: newId(), productId: p.id, valueIds });
    const price = variantPrice(p, valueIds.map((id) => db.attributeValues.get(id)!));
    variantsByProduct.set(p.id, [...(variantsByProduct.get(p.id) ?? []), { id: v.id, price }]);
    return v;
  };
  const crmOdoo = addVariant(crm, [odoo.id]);
  const crmGeneric = addVariant(crm, [generic.id]);
  const acctOdooEnt = addVariant(acct, [odoo.id, ent.id]);
  addVariant(acct, [odoo.id, std.id]);
  addVariant(acct, [generic.id, std.id]);
  const hostOdoo = addVariant(hosting, [odoo.id]);
  addVariant(hosting, [generic.id]);

  // ---------- Plans ----------
  const mkPlan = (p: Omit<RecurringPlan, "id">) => db.plans.insert({ id: newId(), ...p });
  const monthly = mkPlan({ name: "Monthly", price: 0, billingPeriod: "MONTHLY", intervalCount: 1, minQuantity: 1, startDate: "2022-01-01", endDate: null, autoClose: false, closable: true, pausable: true, renewable: true, active: true });
  const yearly = mkPlan({ name: "Yearly", price: 0, billingPeriod: "YEARLY", intervalCount: 1, minQuantity: 1, startDate: "2022-01-01", endDate: null, autoClose: false, closable: true, pausable: false, renewable: true, active: true });
  const weekly = mkPlan({ name: "Weekly", price: 0, billingPeriod: "WEEKLY", intervalCount: 1, minQuantity: 1, startDate: "2022-01-01", endDate: null, autoClose: false, closable: true, pausable: true, renewable: false, active: true });
  const legacy = mkPlan({ name: "Legacy Starter (sunset)", price: 0, billingPeriod: "MONTHLY", intervalCount: 1, minQuantity: 1, startDate: "2023-01-01", endDate: addDays(today, -3), autoClose: true, closable: true, pausable: false, renewable: false, active: true });

  // ---------- Discounts ----------
  db.discounts.insert({ id: newId(), name: "10% off for 10+ seats", type: "PERCENT", value: 10, minPurchase: null, minQuantity: 10, startDate: "2022-01-01", endDate: "2027-12-31", usageLimit: null, usedCount: 0, scope: "SUBSCRIPTION", productIds: [], active: true });
  db.discounts.insert({ id: newId(), name: "Diwali ₹500 off Hosting", type: "FIXED", value: 500, minPurchase: null, minQuantity: null, startDate: addDays(today, -30), endDate: addDays(today, 20), usageLimit: 150, usedCount: 0, scope: "PRODUCT", productIds: [hosting.id], active: true });

  // ---------- Templates ----------
  db.templates.insert({ id: newId(), name: "Starter CRM (Monthly)", planId: monthly.id, validityDays: 15, paymentTerms: "NET15", lines: [
    { id: newId(), productId: crm.id, variantId: crmGeneric.id, quantity: 5, unitPrice: null },
    { id: newId(), productId: support.id, variantId: null, quantity: 1, unitPrice: null },
  ] });
  db.templates.insert({ id: newId(), name: "Enterprise Suite (Yearly)", planId: yearly.id, validityDays: 30, paymentTerms: "NET30", lines: [
    { id: newId(), productId: acct.id, variantId: acctOdooEnt.id, quantity: 12, unitPrice: null },
    { id: newId(), productId: hosting.id, variantId: hostOdoo.id, quantity: 1, unitPrice: null },
    { id: newId(), productId: crm.id, variantId: crmOdoo.id, quantity: 12, unitPrice: null },
  ] });

  // ---------- Subscriptions ----------
  const statusWeights: [SubscriptionStatus, number][] = [
    ["ACTIVE", 0.52], ["PAUSED", 0.08], ["CLOSED", 0.16], ["CONFIRMED", 0.06], ["QUOTATION", 0.1], ["DRAFT", 0.08],
  ];
  const pickStatus = (): SubscriptionStatus => {
    let r = rand();
    for (const [s, w] of statusWeights) if ((r -= w) <= 0) return s;
    return "ACTIVE";
  };
  const pickPlan = (): RecurringPlan => {
    const r = rand();
    return r < 0.68 ? monthly : r < 0.78 ? weekly : r < 0.97 ? yearly : legacy;
  };
  const historyDays = (plan: RecurringPlan) =>
    plan === weekly ? between(0, 112) : plan === yearly ? between(0, 1400) : plan === legacy ? between(60, 600) : between(0, 640);
  const terms: PaymentTerms[] = ["IMMEDIATE", "NET15", "NET15", "NET30", "NET30"];

  type Spec = { sub: Subscription; finalStatus: SubscriptionStatus; stopDate: string | null; plan: RecurringPlan };
  const specs: Spec[] = [];
  for (let i = 0; i < N; i++) {
    const status = pickStatus();
    const plan = pickPlan();
    let startDate: string;
    let stopDate: string | null = null;
    let quotationValidUntil: string | null = null;
    if (status === "ACTIVE" || status === "PAUSED" || status === "CLOSED") {
      startDate = addDays(today, -historyDays(plan));
      if (startDate < plan.startDate) startDate = plan.startDate;
      if (status === "ACTIVE") stopDate = rand() < 0.06 ? addDays(today, -between(1, 20)) : today; // leave some due for the demo run
      else stopDate = addDays(startDate, Math.floor(diffDays(today, startDate) * (0.3 + rand() * 0.6)));
    } else {
      startDate = addDays(today, between(-2, 45));
      if (status === "QUOTATION") quotationValidUntil = addDays(today, between(-12, 25));
    }
    const finalPlan = (status === "DRAFT" || status === "QUOTATION" || status === "CONFIRMED") && plan === legacy ? monthly : plan;
    if (stopDate && stopDate < startDate) stopDate = startDate;
    specs.push({
      plan: finalPlan,
      finalStatus: status,
      stopDate,
      sub: {
        id: newId(),
        number: "",
        customerId: pick(customers).id,
        planId: finalPlan.id,
        status: stopDate ? "ACTIVE" : status,
        startDate,
        expiryDate: finalPlan === yearly && rand() < 0.3 ? addMonths(startDate, 36) : null,
        nextInvoiceDate: startDate,
        paymentTerms: pick(terms),
        quotationValidUntil,
        templateId: null,
        notes: "",
        createdById: rand() < 0.5 ? ops.id : admin.id,
        createdAt: now,
        closedAt: null,
      },
    });
  }
  specs.sort((a, b) => (a.sub.startDate < b.sub.startDate ? -1 : 1));
  const productWeights = [crm, crm, crm, acct, acct, hosting, hosting, support, scanner, pos];
  for (const s of specs) {
    s.sub.number = db.nextNumber("SUB", Number(s.sub.startDate.slice(0, 4)));
    db.subscriptions.insert(s.sub);
    const used = new Set<string>();
    const lineCount = between(1, 3);
    for (let j = 0; j < lineCount; j++) {
      const p = pick(productWeights);
      if (used.has(p.id)) continue;
      used.add(p.id);
      const variants = variantsByProduct.get(p.id);
      const v = variants ? pick(variants) : null;
      const quantity = p === crm ? between(1, 25) : p.type === "GOODS" ? between(1, 4) : between(1, 3);
      const unitPrice = v ? v.price : p.salesPrice;
      db.subscriptionLines.insert({
        id: newId(), subscriptionId: s.sub.id, productId: p.id, variantId: v?.id ?? null, quantity, unitPrice,
        taxIds: [...p.taxIds], discountId: null, amount: mul(quantity, unitPrice),
      });
    }
    // Status history along the lifecycle
    const path: SubscriptionStatus[] = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "PAUSED", "CLOSED"];
    const target = path.indexOf(s.finalStatus);
    let prev: string | null = null;
    for (let k = 0; k <= target; k++) {
      if (path[k] === "PAUSED" && s.finalStatus === "CLOSED") continue;
      const at = new Date(s.sub.startDate + "T09:00:00Z");
      at.setUTCDate(at.getUTCDate() - (3 - Math.min(k, 3)));
      if (path[k] === "PAUSED" || path[k] === "CLOSED") at.setTime(new Date((s.stopDate ?? today) + "T10:00:00Z").getTime());
      db.statusHistory.insert({ id: newId(), entity: "SUBSCRIPTION", entityId: s.sub.id, from: prev, to: path[k], byUserId: s.sub.createdById, at });
      prev = path[k];
    }
  }

  // ---------- Historical billing through the real engine (chronological, month by month) ----------
  const billable = specs.filter((s) => s.stopDate);
  const earliest = billable.reduce((m, s) => (s.sub.startDate < m ? s.sub.startDate : m), today);
  for (let step = earliest; ; step = addMonths(step, 1)) {
    const asOfStep = step > today ? today : step;
    for (const s of billable) {
      const limit = s.stopDate! < asOfStep ? s.stopDate! : asOfStep;
      billSubscription(s.sub.id, limit);
    }
    if (step >= today) break;
  }
  for (const s of billable) {
    if (s.finalStatus !== "ACTIVE") db.subscriptions.update(s.sub.id, { status: s.finalStatus, closedAt: s.finalStatus === "CLOSED" ? s.stopDate : null });
  }

  // ---------- Invoice statuses, payments (incl. partial + overdue) ----------
  const methods: PaymentMethod[] = ["BANK_TRANSFER", "BANK_TRANSFER", "UPI", "UPI", "CARD", "CASH", "CHEQUE"];
  const pay = (invId: string, customerId: string, amount: number, date: string) => {
    db.payments.insert({ id: newId(), invoiceId: invId, customerId, method: pick(methods), amount, date: date > today ? today : date, note: "", recordedById: pick([ops.id, admin.id]), createdAt: now });
  };
  for (const inv of db.invoices.all().slice()) {
    const age = diffDays(today, inv.invoiceDate);
    const r = rand();
    if (age <= 0 || (age <= 3 && r < 0.7)) continue; // stays DRAFT
    if (age > 45 ? r < 0.015 : r < 0.03) {
      db.invoices.update(inv.id, { status: "CANCELLED", amountDue: 0 });
      continue;
    }
    const paidShare = age > 45 ? (r < 0.93 ? 1 : r < 0.96 ? 0.5 : 0) : r < 0.55 ? 1 : r < 0.66 ? 0.4 : 0;
    if (paidShare === 1) {
      const date = addDays(inv.invoiceDate, between(0, 25));
      pay(inv.id, inv.customerId, inv.total, date);
      db.invoices.update(inv.id, { status: "PAID", amountPaid: inv.total, amountDue: 0 });
    } else if (paidShare > 0) {
      const amount = round2(inv.total * paidShare);
      pay(inv.id, inv.customerId, amount, addDays(inv.invoiceDate, between(0, 10)));
      db.invoices.update(inv.id, { status: "CONFIRMED", amountPaid: amount, amountDue: round2(inv.total - amount) });
    } else {
      db.invoices.update(inv.id, { status: "CONFIRMED" });
    }
  }

  db.billingRuns.insert({
    id: newId(), asOf: today, startedAt: now, finishedAt: new Date(), trigger: "SCHEDULER", triggeredById: null,
    created: db.invoices.size, skipped: 0, failed: 0, closed: 0, errors: ["Initial historical load (seed)"],
  });
  db.meta.seededAt = new Date();
  return db;
}
