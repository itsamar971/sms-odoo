"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { zodErrors } from "@/components/forms/zod-errors";
import { saveCustomerAction } from "@/app/actions/ops";
import { customerSchema } from "@/lib/validation";
import type { Customer } from "@/lib/db/types";

export function CustomerDialog({ customer: c }: { customer?: Customer }) {
  const router = useRouter();
  const init = () => ({ name: c?.name ?? "", email: c?.email ?? "", phone: c?.phone ?? "", address: c?.address ?? "", gstin: c?.gstin ?? "" });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const set = (k: keyof ReturnType<typeof init>) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = customerSchema.safeParse(v);
    if (!parsed.success) return setErrors(zodErrors(parsed.error));
    setErrors({});
    const r = await run(() => saveCustomerAction(c?.id ?? null, v));
    if (r.ok) {
      setOpen(false);
      if (!c && r.data) router.push(`/customers/${(r.data as { id: string }).id}`);
    }
  }
  return (
    <>
      {c ? <Button variant="outline" size="sm" onClick={() => { setV(init()); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
        : <Button onClick={() => { setV(init()); setOpen(true); }}><Plus className="h-4 w-4" /> New customer</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={c ? "Edit customer" : "New customer"}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Name" error={errors.name}><Input value={v.name} onChange={set("name")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" error={errors.email}><Input type="email" value={v.email} onChange={set("email")} /></Field>
            <Field label="Phone" error={errors.phone}><Input value={v.phone} onChange={set("phone")} /></Field>
          </div>
          <Field label="GSTIN (optional)" error={errors.gstin}><Input value={v.gstin} onChange={set("gstin")} maxLength={15} /></Field>
          <Field label="Billing address" error={errors.address}><Textarea value={v.address} onChange={set("address")} /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Save</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
