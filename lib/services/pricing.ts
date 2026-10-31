import { sum } from "../money";
import type { AttributeValue, Product } from "../db/types";

/** Variant unit price = product.salesPrice + Σ extraPrice of the variant's attribute values. */
export function variantPrice(
  product: Pick<Product, "salesPrice">,
  values: Pick<AttributeValue, "extraPrice">[],
): number {
  return sum([product.salesPrice, ...values.map((v) => v.extraPrice)]);
}
