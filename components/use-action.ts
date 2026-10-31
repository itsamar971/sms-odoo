"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/** Run a server action with pending state, toasts and a router refresh. */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function run<T>(
    fn: () => Promise<ActionResult<T>>,
    opts: { success?: string; onSuccess?: (data: T | undefined) => void; refresh?: boolean } = {},
  ): Promise<ActionResult<T>> {
    setPending(true);
    setFieldErrors({});
    try {
      const res = await fn();
      if (res.ok) {
        const msg = res.message ?? opts.success;
        if (msg) toast.success(msg);
        opts.onSuccess?.(res.data);
        if (opts.refresh !== false) router.refresh();
      } else {
        toast.error(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      }
      return res;
    } catch (e) {
      // Redirects thrown by server actions are handled by Next; anything else is unexpected.
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
      toast.error("Network error. Please try again.");
      return { ok: false, error: "Network error" };
    } finally {
      setPending(false);
    }
  }

  return { run, pending, fieldErrors, setFieldErrors };
}
