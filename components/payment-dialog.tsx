"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Field, Input, Select } from "./ui/input";
import { useAction } from "./use-action";
import { zodErrors } from "./forms/zod-errors";
import { paymentSchema } from "@/lib/validation";
import { formatMoney } from "@/lib/money";
import type { ActionResult } from "@/lib/action-result";

export function PaymentDialog({
  invoiceId, amountDue, action, methods = ["BANK_TRANSFER", "UPI", "CARD", "CASH", "CHEQUE"], label = "Record payment", title = "Record payment",
}: {
  invoiceId: string;
  amountDue: number;
  action: (input: unknown) => Promise<ActionResult<{ status: string; amountDue: number }>>;
  methods?: string[];
  label?: string;
  title?: string;
}) {
  const init = () => ({ invoiceId, method: methods[0], amount: amountDue.toFixed(2), date: new Date().toISOString().slice(0, 10), note: "" });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = paymentSchema.safeParse(v);
    if (!parsed.success) return setErrors(zodErrors(parsed.error));
    if (Number(v.amount) > amountDue + 1e-9) return setErrors({ amount: `Cannot exceed the amount due (${formatMoney(amountDue)})` });
    setErrors({});
    const r = await run(() => action(v), {
      onSuccess: (d) => toast.success(d?.status === "PAID" ? "Payment recorded — invoice is now PAID" : `Payment recorded — ${formatMoney(d?.amountDue)} still due`),
    });
    if (r.ok) setOpen(false);
  }
  return (
    <>
      <Button size="sm" onClick={() => { setV(init()); setOpen(true); }}><Banknote className="h-3.5 w-3.5" /> {label}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={`Amount due: ${formatMoney(amountDue)}. Partial payments are allowed; overpayments are blocked.`}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" error={errors.amount}><Input inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
            <Field label="Method" error={errors.method}>
              <Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>{methods.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}</Select>
            </Field>
            <Field label="Date" error={errors.date}><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
            <Field label="Reference / note" error={errors.note}><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="UTR / cheque no." /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Save payment</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
