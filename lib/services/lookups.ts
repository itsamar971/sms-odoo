import { getDb } from "../db/client";
import { unitPriceFor, variantLabel } from "./catalog-helpers";

export type ProductOption = {
  id: string;
  name: string;
  price: number;
  active: boolean;
  variants: { id: string; label: string; price: number }[];
};

export function productOptions(includeArchived = false): ProductOption[] {
  const db = getDb();
  return db.products
    .all()
    .filter((p) => includeArchived || p.active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.salesPrice,
      active: p.active,
      variants: db.variants.by("productId", p.id).map((v) => ({ id: v.id, label: variantLabel(v.id), price: unitPriceFor(p, v.id) })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function planOptions(includeArchived = false) {
  return getDb()
    .plans.all()
    .filter((p) => includeArchived || p.active)
    .map((p) => ({ id: p.id, name: p.name, minQuantity: p.minQuantity, startDate: p.startDate, endDate: p.endDate, billingPeriod: p.billingPeriod }));
}

export function taxOptions() {
  return getDb().taxes.all().map((t) => ({ id: t.id, name: t.name, active: t.active }));
}

export function customerOptions() {
  return getDb()
    .customers.all()
    .map((c) => ({ id: c.id, name: c.name, email: c.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
