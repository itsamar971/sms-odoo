import "server-only";
import { ZodError } from "zod";
import { isServiceError } from "../errors";
import { can, type Permission } from "./rbac";
import { getSessionUser } from "./session";
import type { ActionResult } from "../action-result";
import type { User } from "../db/types";

/**
 * Wrap every server action: authenticates, checks RBAC, and converts validation / business
 * errors into a serialisable result the client can toast.
 */
export async function guarded<T>(
  perm: Permission,
  fn: (user: User) => T | Promise<T>,
  successMessage?: string,
): Promise<ActionResult<T>> {
  const user = getSessionUser();
  if (!user) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (!can(user.role, perm)) return { ok: false, error: "You do not have permission to do that" };
  return toResult(() => fn(user), successMessage);
}

export async function toResult<T>(fn: () => T | Promise<T>, successMessage?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message: successMessage };
  } catch (e) {
    return errorResult(e);
  }
}

export function errorResult(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (e instanceof ZodError || (e instanceof Error && e.name === "ZodError")) {
    const z = e as ZodError;
    const fieldErrors: Record<string, string> = {};
    for (const i of z.issues) {
      const k = i.path.join(".");
      if (!fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, error: z.issues[0]?.message ?? "Invalid input", fieldErrors };
  }
  if (isServiceError(e)) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Something went wrong. Please try again." };
}
