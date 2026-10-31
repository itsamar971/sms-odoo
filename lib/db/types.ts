/**
 * Domain model for the in-memory "cache DB".
 * Date-only fields use ISO "YYYY-MM-DD" strings (no timezone bugs, cheap comparisons).
 * Money fields are numbers that are always rounded to 2dp via lib/money (Decimal.js, half-up).
 */
export type DateStr = string;

export type Role = "ADMIN" | "INTERNAL" | "PORTAL";
export const ROLES: Role[] = ["ADMIN", "INTERNAL", "PORTAL"];

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  name: string;
  customerId: string | null;
  active: boolean;
  createdAt: Date;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface Session {
  id: string; // token
  userId: string;
  expiresAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string | null;
  createdAt: Date;
}

export type ProductType = "SERVICE" | "GOODS";
export const PRODUCT_TYPES: ProductType[] = ["SERVICE", "GOODS"];

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  salesPrice: number;
  costPrice: number;
  notes: string;
  active: boolean;
  taxIds: string[];
  createdAt: Date;
}

export interface ProductAttribute {
  id: string;
  name: string;
}

export interface AttributeValue {
  id: string;
  attributeId: string;
  value: string;
  extraPrice: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  valueIds: string[];
}

export type BillingPeriod = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export const BILLING_PERIODS: BillingPeriod[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

export interface RecurringPlan {
  id: string;
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  intervalCount: number;
  minQuantity: number;
  startDate: DateStr;
  endDate: DateStr | null;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  active: boolean;
}

export type AmountType = "PERCENT" | "FIXED";
export const AMOUNT_TYPES: AmountType[] = ["PERCENT", "FIXED"];

export interface Tax {
  id: string;
  name: string;
  type: AmountType;
  rate: number;
  active: boolean;
}

export interface TemplateLine {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number | null;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  planId: string;
  validityDays: number;
  paymentTerms: PaymentTerms;
  lines: TemplateLine[];
}

export type SubscriptionStatus = "DRAFT" | "QUOTATION" | "CONFIRMED" | "ACTIVE" | "PAUSED" | "CLOSED";
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "DRAFT",
  "QUOTATION",
  "CONFIRMED",
  "ACTIVE",
  "PAUSED",
  "CLOSED",
];

export type PaymentTerms = "IMMEDIATE" | "NET15" | "NET30";
export const PAYMENT_TERMS: PaymentTerms[] = ["IMMEDIATE", "NET15", "NET30"];
export const PAYMENT_TERM_DAYS: Record<PaymentTerms, number> = { IMMEDIATE: 0, NET15: 15, NET30: 30 };

export interface Subscription {
  id: string;
  number: string;
  customerId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: DateStr;
  expiryDate: DateStr | null;
  nextInvoiceDate: DateStr;
  paymentTerms: PaymentTerms;
  quotationValidUntil: DateStr | null;
  templateId: string | null;
  notes: string;
  createdById: string;
  createdAt: Date;
  closedAt: DateStr | null;
}

export interface SubscriptionLine {
  id: string;
  subscriptionId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
  taxIds: string[];
  discountId: string | null;
  amount: number;
}

export interface StatusHistory {
  id: string;
  entity: "SUBSCRIPTION" | "INVOICE";
  entityId: string;
  from: string | null;
  to: string;
  byUserId: string | null;
  at: Date;
  note?: string;
}

export type DiscountScope = "PRODUCT" | "SUBSCRIPTION";
export const DISCOUNT_SCOPES: DiscountScope[] = ["PRODUCT", "SUBSCRIPTION"];

export interface Discount {
  id: string;
  name: string;
  type: AmountType;
  value: number;
  minPurchase: number | null;
  minQuantity: number | null;
  startDate: DateStr;
  endDate: DateStr;
  usageLimit: number | null;
  usedCount: number;
  scope: DiscountScope;
  productIds: string[];
  active: boolean;
}

export interface DiscountUsage {
  id: string;
  discountId: string;
  invoiceId: string;
}

export type InvoiceStatus = "DRAFT" | "CONFIRMED" | "PAID" | "CANCELLED";
export const INVOICE_STATUSES: InvoiceStatus[] = ["DRAFT", "CONFIRMED", "PAID", "CANCELLED"];

export interface Invoice {
  id: string;
  number: string;
  subscriptionId: string;
  customerId: string;
  periodStart: DateStr;
  periodEnd: DateStr;
  invoiceDate: DateStr;
  dueDate: DateStr;
  status: InvoiceStatus;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  lastReminderAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  kind: "PRODUCT" | "DISCOUNT";
  description: string;
  productId: string | null;
  discountId: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  amount: number;
}

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "UPI" | "CHEQUE";
export const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD", "UPI", "CHEQUE"];

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  method: PaymentMethod;
  amount: number;
  date: DateStr;
  note: string;
  recordedById: string | null;
  createdAt: Date;
}

export interface BillingRun {
  id: string;
  asOf: DateStr;
  startedAt: Date;
  finishedAt: Date | null;
  trigger: "MANUAL" | "CRON" | "SCHEDULER";
  triggeredById: string | null;
  created: number;
  skipped: number;
  failed: number;
  closed: number;
  errors: string[];
}

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  kind: string;
  at: Date;
}
