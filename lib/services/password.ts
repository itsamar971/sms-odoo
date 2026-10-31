import { z } from "zod";

/**
 * Password policy: length > 8, at least one uppercase, one lowercase and one special character.
 * Shared by client forms and server actions.
 */
export const passwordSchema = z
  .string()
  .min(9, "Password must be longer than 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Z]/, "Password needs at least one uppercase letter")
  .regex(/[a-z]/, "Password needs at least one lowercase letter")
  .regex(/[^A-Za-z0-9]/, "Password needs at least one special character");

export function validatePassword(pw: string): { valid: boolean; errors: string[] } {
  const r = passwordSchema.safeParse(pw);
  return r.success ? { valid: true, errors: [] } : { valid: false, errors: r.error.issues.map((i) => i.message) };
}

export const PASSWORD_RULES = [
  { label: "More than 8 characters", test: (p: string) => p.length > 8 },
  { label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "A special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];
