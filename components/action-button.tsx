"use client";
import { Button, type ButtonProps } from "./ui/button";
import { useAction } from "./use-action";
import type { ActionResult } from "@/lib/action-result";

/** Non-destructive one-click server action. */
export function ActionButton({
  action,
  success,
  onDone,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: () => Promise<ActionResult<unknown>>;
  success?: string;
  onDone?: (data: unknown) => void;
}) {
  const { run, pending } = useAction();
  return <Button {...props} loading={pending} onClick={() => run(action, { success, onSuccess: onDone })} />;
}
