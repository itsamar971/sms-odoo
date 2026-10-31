import type { ZodError } from "zod";

export function zodErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".");
    out[k] ??= i.message;
  }
  return out;
}
