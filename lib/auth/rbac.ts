import type { Role } from "../db/types";

/** Central permission map. Every page and server action checks one of these. */
export const PERMISSIONS = {
  "config:read": ["ADMIN", "INTERNAL"], // products, plans, taxes, discounts, templates
  "config:write": ["ADMIN"],
  "users:manage": ["ADMIN"],
  "ops:read": ["ADMIN", "INTERNAL"], // customers, subscriptions, invoices, payments, reports
  "ops:write": ["ADMIN", "INTERNAL"],
  "billing:run": ["ADMIN", "INTERNAL"],
  "demo:reset": ["ADMIN"],
  portal: ["PORTAL"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, perm: Permission): boolean {
  return !!role && (PERMISSIONS[perm] as readonly Role[]).includes(role);
}

export function homeFor(role: Role): string {
  return role === "PORTAL" ? "/portal" : "/dashboard";
}
