import { getDb } from "../db/client";
import { variantPrice } from "./pricing";
import type { Product } from "../db/types";

export function variantLabel(variantId: string | null | undefined): string {
  if (!variantId) return "";
  const db = getDb();
  const v = db.variants.get(variantId);
  if (!v) return "";
  return v.valueIds
    .map((id) => {
      const val = db.attributeValues.get(id);
      const attr = val ? db.attributes.get(val.attributeId) : undefined;
      return val ? `${attr?.name ?? ""}: ${val.value}` : "";
    })
    .filter(Boolean)
    .join(", ");
}

export function productDisplayName(productId: string, variantId?: string | null): string {
  const p = getDb().products.get(productId);
  const label = variantLabel(variantId);
  return `${p?.name ?? "Unknown product"}${label ? ` (${label})` : ""}`;
}

/** Unit price for a product / variant pair. */
export function unitPriceFor(product: Product, variantId: string | null): number {
  if (!variantId) return product.salesPrice;
  const db = getDb();
  const v = db.variants.get(variantId);
  if (!v || v.productId !== product.id) return product.salesPrice;
  const values = v.valueIds.map((id) => db.attributeValues.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
  return variantPrice(product, values);
}
