"use client";
import { useState } from "react";
import { Button, type ButtonProps } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { useAction } from "./use-action";
import type { ActionResult } from "@/lib/action-result";

/** A button that asks for confirmation before running a (usually destructive) server action. */
export function ConfirmButton({
  action,
  title,
  description,
  confirmLabel = "Confirm",
  success,
  destructive = true,
  onDone,
  children,
  ...buttonProps
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: () => Promise<ActionResult<unknown>>;
  title: string;
  description?: string;
  confirmLabel?: string;
  success?: string;
  destructive?: boolean;
  onDone?: (data: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  return (
    <>
      <Button {...buttonProps} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onClose={() => !pending && setOpen(false)} title={title} description={description}>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            loading={pending}
            onClick={async () => {
              const r = await run(action, { success, onSuccess: onDone });
              if (r.ok) setOpen(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
