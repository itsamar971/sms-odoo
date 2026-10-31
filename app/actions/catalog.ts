"use server";
import { guarded } from "@/lib/auth/guard";
import * as catalog from "@/lib/services/catalog";
import { createStaffUser, setUserActive } from "@/lib/services/auth";


// Products
export async function saveProductAction(id: string | null, input: unknown) {
  return guarded("config:write", () => ({ id: catalog.saveProduct(id, input as never).id }), id ? "Product updated" : "Product created");
}
export async function deleteProductAction(id: string) {
  return guarded("config:write", () => catalog.deleteProduct(id), "Product deleted");
}
export async function setProductActiveAction(id: string, active: boolean) {
  return guarded("config:write", () => void catalog.setProductActive(id, active), active ? "Product restored" : "Product archived");
}

// Attributes & variants
export async function saveAttributeAction(id: string | null, input: unknown) {
  return guarded("config:write", () => void catalog.saveAttribute(id, input as never), "Attribute saved");
}
export async function deleteAttributeAction(id: string) {
  return guarded("config:write", () => catalog.deleteAttribute(id), "Attribute deleted");
}
export async function saveAttributeValueAction(id: string | null, input: unknown) {
  return guarded("config:write", () => void catalog.saveAttributeValue(id, input as never), "Value saved");
}
export async function deleteAttributeValueAction(id: string) {
  return guarded("config:write", () => catalog.deleteAttributeValue(id), "Value deleted");
}
export async function createVariantAction(input: unknown) {
  return guarded("config:write", () => void catalog.createVariant(input as never), "Variant added");
}
export async function deleteVariantAction(id: string) {
  return guarded("config:write", () => catalog.deleteVariant(id), "Variant deleted");
}

// Plans
export async function savePlanAction(id: string | null, input: unknown) {
  return guarded("config:write", () => void catalog.savePlan(id, input as never), id ? "Plan updated" : "Plan created");
}
export async function deletePlanAction(id: string) {
  return guarded("config:write", () => catalog.deletePlan(id), "Plan deleted");
}

// Taxes
export async function saveTaxAction(id: string | null, input: unknown) {
  return guarded("config:write", () => void catalog.saveTax(id, input as never), id ? "Tax updated" : "Tax created");
}
export async function deleteTaxAction(id: string) {
  return guarded("config:write", () => catalog.deleteTax(id), "Tax deleted");
}

// Discounts
export async function saveDiscountAction(id: string | null, input: unknown) {
  return guarded("config:write", () => void catalog.saveDiscount(id, input as never), id ? "Discount updated" : "Discount created");
}
export async function deleteDiscountAction(id: string) {
  return guarded("config:write", () => catalog.deleteDiscount(id), "Discount deleted");
}

// Templates
export async function saveTemplateAction(id: string | null, input: unknown) {
  return guarded("config:write", () => void catalog.saveTemplate(id, input as never), id ? "Template updated" : "Template created");
}
export async function deleteTemplateAction(id: string) {
  return guarded("config:write", () => catalog.deleteTemplate(id), "Template deleted");
}

// Users (ADMIN only)
export async function createStaffUserAction(input: unknown) {
  return guarded("users:manage", async (actor) => void (await createStaffUser(input as never, actor)), "User created");
}
export async function setUserActiveAction(id: string, active: boolean) {
  return guarded("users:manage", (actor) => setUserActive(id, active, actor), active ? "User activated" : "User deactivated");
}
