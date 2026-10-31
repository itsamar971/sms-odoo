import { z } from "zod";
import { passwordSchema } from "./services/password";
import {
  AMOUNT_TYPES,
  BILLING_PERIODS,
  DISCOUNT_SCOPES,
  PAYMENT_METHODS,
  PAYMENT_TERMS,
  PRODUCT_TYPES,
} from "./db/types";

export { passwordSchema };

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
const optDate = z
  .union([dateStr, z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v ? v : null));
const money = z.coerce.number({ invalid_type_error: "Enter a number" }).min(0, "Must be 0 or more").max(1e9);
const optNum = z
  .union([z.coerce.number().min(0), z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)));
const email = z.string().trim().toLowerCase().email("Enter a valid email");
const name = z.string().trim().min(1, "Required").max(120);
const id = z.string().min(1, "Required");

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password") });

export const signupSchema = z
  .object({
    name,
    email,
    phone: z.string().trim().max(30).optional().default(""),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ token: z.string().min(10), password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const staffUserSchema = z.object({
  name,
  email,
  role: z.enum(["INTERNAL", "ADMIN"]).default("INTERNAL"),
  password: passwordSchema,
});

export const customerSchema = z.object({
  name,
  email,
  phone: z.string().trim().max(30).default(""),
  address: z.string().trim().max(500).default(""),
  gstin: z
    .string()
    .trim()
    .max(15)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
});

export const productSchema = z.object({
  name,
  type: z.enum(PRODUCT_TYPES as [string, ...string[]]).transform((v) => v as "SERVICE" | "GOODS"),
  salesPrice: money,
  costPrice: money,
  notes: z.string().max(2000).default(""),
  active: z.boolean().default(true),
  taxIds: z.array(z.string()).default([]),
});

export const attributeSchema = z.object({ name });
export const attributeValueSchema = z.object({ attributeId: id, value: name, extraPrice: money });
export const variantSchema = z.object({ productId: id, valueIds: z.array(z.string()).min(1, "Pick at least one value") });

export const planSchema = z
  .object({
    name,
    price: money,
    billingPeriod: z.enum(BILLING_PERIODS as [string, ...string[]]).transform((v) => v as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"),
    intervalCount: z.coerce.number().int().min(1).max(36).default(1),
    minQuantity: z.coerce.number().int().min(1).default(1),
    startDate: dateStr,
    endDate: optDate,
    autoClose: z.boolean().default(false),
    closable: z.boolean().default(true),
    pausable: z.boolean().default(true),
    renewable: z.boolean().default(true),
    active: z.boolean().default(true),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { message: "End date must be after start date", path: ["endDate"] });

export const taxSchema = z.object({
  name,
  type: z.enum(AMOUNT_TYPES as [string, ...string[]]).transform((v) => v as "PERCENT" | "FIXED"),
  rate: money,
  active: z.boolean().default(true),
}).refine((v) => v.type !== "PERCENT" || v.rate <= 100, { message: "Percent must be ≤ 100", path: ["rate"] });

export const discountSchema = z
  .object({
    name,
    type: z.enum(AMOUNT_TYPES as [string, ...string[]]).transform((v) => v as "PERCENT" | "FIXED"),
    value: money,
    minPurchase: optNum,
    minQuantity: optNum,
    startDate: dateStr,
    endDate: dateStr,
    usageLimit: optNum,
    scope: z.enum(DISCOUNT_SCOPES as [string, ...string[]]).transform((v) => v as "PRODUCT" | "SUBSCRIPTION"),
    productIds: z.array(z.string()).default([]),
    active: z.boolean().default(true),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "End date must be after start date", path: ["endDate"] })
  .refine((v) => v.type !== "PERCENT" || v.value <= 100, { message: "Percent must be ≤ 100", path: ["value"] })
  .refine((v) => v.scope !== "PRODUCT" || v.productIds.length > 0, {
    message: "Pick at least one product for a product-scoped discount",
    path: ["productIds"],
  });

const lineSchema = z.object({
  productId: id,
  variantId: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null)),
  quantity: z.coerce.number().int("Whole numbers only").min(1, "Quantity must be at least 1").max(100000),
  unitPrice: optNum,
});

export const templateSchema = z.object({
  name,
  planId: id,
  validityDays: z.coerce.number().int().min(1).max(365),
  paymentTerms: z.enum(PAYMENT_TERMS as [string, ...string[]]).transform((v) => v as "IMMEDIATE" | "NET15" | "NET30"),
  lines: z.array(lineSchema).min(1, "Add at least one line"),
});

export const subscriptionSchema = z.object({
  customerId: id,
  planId: id,
  startDate: dateStr,
  expiryDate: optDate,
  paymentTerms: z.enum(PAYMENT_TERMS as [string, ...string[]]).transform((v) => v as "IMMEDIATE" | "NET15" | "NET30"),
  notes: z.string().max(2000).default(""),
  templateId: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null)),
  asQuotation: z.boolean().default(false),
  lines: z.array(lineSchema).min(1, "Add at least one product line"),
});

export const paymentSchema = z.object({
  invoiceId: id,
  method: z.enum(PAYMENT_METHODS as [string, ...string[]]).transform((v) => v as "CASH" | "BANK_TRANSFER" | "CARD" | "UPI" | "CHEQUE"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: dateStr,
  note: z.string().max(500).default(""),
});

export type LineInput = z.infer<typeof lineSchema>;
