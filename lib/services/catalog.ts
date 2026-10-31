import { z } from "zod";
import { getDb } from "../db/client";
import { newId } from "../db/database";
import { isUniqueConstraintError } from "../db/store";
import { NotFoundError, ServiceError } from "../errors";
import {
  attributeSchema,
  attributeValueSchema,
  discountSchema,
  planSchema,
  productSchema,
  taxSchema,
  templateSchema,
  variantSchema,
} from "../validation";
import type { Discount, Product, QuotationTemplate, RecurringPlan, Tax } from "../db/types";

function friendlyUnique<T>(fn: () => T, message: string): T {
  try {
    return fn();
  } catch (e) {
    if (isUniqueConstraintError(e)) throw new ServiceError(message);
    throw e;
  }
}

// ---------- Products ----------
export function saveProduct(id: string | null, raw: z.input<typeof productSchema>): Product {
  const input = productSchema.parse(raw);
  const db = getDb();
  for (const t of input.taxIds) if (!db.taxes.get(t)) throw new NotFoundError("Tax");
  if (id) {
    if (!db.products.get(id)) throw new NotFoundError("Product");
    return db.products.update(id, input);
  }
  return db.products.insert({ id: newId(), ...input, createdAt: new Date() });
}

export function setProductActive(id: string, active: boolean) {
  const db = getDb();
  if (!db.products.get(id)) throw new NotFoundError("Product");
  return db.products.update(id, { active });
}

export function deleteProduct(id: string) {
  const db = getDb();
  if (!db.products.get(id)) throw new NotFoundError("Product");
  const used =
    db.subscriptionLines.find((l) => l.productId === id) || db.templates.find((t) => t.lines.some((l) => l.productId === id));
  if (used) throw new ServiceError("This product is used by subscriptions or templates. Archive it instead.");
  db.transaction(() => {
    for (const v of db.variants.by("productId", id)) db.variants.delete(v.id);
    db.products.delete(id);
  });
}

// ---------- Attributes & variants ----------
export function saveAttribute(id: string | null, raw: z.input<typeof attributeSchema>) {
  const input = attributeSchema.parse(raw);
  const db = getDb();
  return friendlyUnique(
    () => (id ? db.attributes.update(id, input) : db.attributes.insert({ id: newId(), ...input })),
    `Attribute "${input.name}" already exists`,
  );
}

export function deleteAttribute(id: string) {
  const db = getDb();
  const valueIds = new Set(db.attributeValues.by("attributeId", id).map((v) => v.id));
  if (db.variants.find((v) => v.valueIds.some((x) => valueIds.has(x))))
    throw new ServiceError("This attribute is used by product variants");
  db.transaction(() => {
    for (const v of valueIds) db.attributeValues.delete(v);
    db.attributes.delete(id);
  });
}

export function saveAttributeValue(id: string | null, raw: z.input<typeof attributeValueSchema>) {
  const input = attributeValueSchema.parse(raw);
  const db = getDb();
  if (!db.attributes.get(input.attributeId)) throw new NotFoundError("Attribute");
  return friendlyUnique(
    () => (id ? db.attributeValues.update(id, input) : db.attributeValues.insert({ id: newId(), ...input })),
    `Value "${input.value}" already exists on this attribute`,
  );
}

export function deleteAttributeValue(id: string) {
  const db = getDb();
  if (db.variants.find((v) => v.valueIds.includes(id))) throw new ServiceError("This value is used by product variants");
  db.attributeValues.delete(id);
}

export function createVariant(raw: z.input<typeof variantSchema>) {
  const input = variantSchema.parse(raw);
  const db = getDb();
  if (!db.products.get(input.productId)) throw new NotFoundError("Product");
  const seen = new Set<string>();
  for (const vid of input.valueIds) {
    const val = db.attributeValues.get(vid);
    if (!val) throw new NotFoundError("Attribute value");
    if (seen.has(val.attributeId)) throw new ServiceError("Pick only one value per attribute");
    seen.add(val.attributeId);
  }
  return friendlyUnique(
    () => db.variants.insert({ id: newId(), productId: input.productId, valueIds: input.valueIds }),
    "This variant already exists",
  );
}

export function deleteVariant(id: string) {
  const db = getDb();
  if (db.subscriptionLines.find((l) => l.variantId === id) || db.templates.find((t) => t.lines.some((l) => l.variantId === id)))
    throw new ServiceError("This variant is used by subscriptions or templates");
  db.variants.delete(id);
}

// ---------- Plans ----------
export function savePlan(id: string | null, raw: z.input<typeof planSchema>): RecurringPlan {
  const input = planSchema.parse(raw);
  const db = getDb();
  if (id) {
    if (!db.plans.get(id)) throw new NotFoundError("Plan");
    return db.plans.update(id, input);
  }
  return db.plans.insert({ id: newId(), ...input });
}

export function deletePlan(id: string) {
  const db = getDb();
  if (db.subscriptions.by("planId", id).length || db.templates.find((t) => t.planId === id))
    throw new ServiceError("This plan is in use. Archive it instead.");
  db.plans.delete(id);
}

// ---------- Taxes ----------
export function saveTax(id: string | null, raw: z.input<typeof taxSchema>): Tax {
  const input = taxSchema.parse(raw);
  const db = getDb();
  if (id) {
    if (!db.taxes.get(id)) throw new NotFoundError("Tax");
    return db.taxes.update(id, input);
  }
  return db.taxes.insert({ id: newId(), ...input });
}

export function deleteTax(id: string) {
  const db = getDb();
  if (db.subscriptionLines.find((l) => l.taxIds.includes(id)))
    throw new ServiceError("This tax is applied to subscription lines. Deactivate it instead.");
  db.transaction(() => {
    for (const p of db.products.filter((p) => p.taxIds.includes(id)))
      db.products.update(p.id, { taxIds: p.taxIds.filter((t) => t !== id) });
    db.taxes.delete(id);
  });
}

// ---------- Discounts ----------
export function saveDiscount(id: string | null, raw: z.input<typeof discountSchema>): Discount {
  const input = discountSchema.parse(raw);
  const db = getDb();
  const data = { ...input, productIds: input.scope === "PRODUCT" ? input.productIds : [] };
  if (id) {
    if (!db.discounts.get(id)) throw new NotFoundError("Discount");
    return db.discounts.update(id, data);
  }
  return db.discounts.insert({ id: newId(), ...data, usedCount: 0 });
}

export function deleteDiscount(id: string) {
  const db = getDb();
  if (db.discountUsages.by("discountId", id).length)
    throw new ServiceError("This discount has been used on invoices. Deactivate it instead.");
  db.discounts.delete(id);
}

// ---------- Quotation templates ----------
export function saveTemplate(id: string | null, raw: z.input<typeof templateSchema>): QuotationTemplate {
  const input = templateSchema.parse(raw);
  const db = getDb();
  const plan = db.plans.get(input.planId);
  if (!plan) throw new NotFoundError("Plan");
  for (const l of input.lines) {
    if (!db.products.get(l.productId)) throw new NotFoundError("Product");
    if (l.quantity < plan.minQuantity)
      throw new ServiceError(`Plan "${plan.name}" requires a quantity of at least ${plan.minQuantity}`);
  }
  const data = { ...input, lines: input.lines.map((l) => ({ ...l, id: newId() })) };
  if (id) {
    if (!db.templates.get(id)) throw new NotFoundError("Template");
    return db.templates.update(id, data);
  }
  return db.templates.insert({ id: newId(), ...data });
}

export function deleteTemplate(id: string) {
  getDb().templates.delete(id);
}
