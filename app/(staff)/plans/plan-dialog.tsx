"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { zodErrors } from "@/components/forms/zod-errors";
import { savePlanAction } from "@/app/actions/catalog";
import { planSchema } from "@/lib/validation";
import type { RecurringPlan } from "@/lib/db/types";

export function PlanDialog({ plan }: { plan?: RecurringPlan }) {
  const init = () => ({
    name: plan?.name ?? "",
    price: String(plan?.price ?? 0),
    billingPeriod: plan?.billingPeriod ?? "MONTHLY",
    intervalCount: String(plan?.intervalCount ?? 1),
    minQuantity: String(plan?.minQuantity ?? 1),
    startDate: plan?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: plan?.endDate ?? "",
    autoClose: plan?.autoClose ?? false,
    closable: plan?.closable ?? true,
    pausable: plan?.pausable ?? true,
    renewable: plan?.renewable ?? true,
    active: plan?.active ?? true,
  });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const set = (k: keyof ReturnType<typeof init>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = planSchema.safeParse(v);
    if (!parsed.success) return setErrors(zodErrors(parsed.error));
    setErrors({});
    const r = await run(() => savePlanAction(plan?.id ?? null, v));
    if (r.ok) setOpen(false);
  }

  return (
    <>
      {plan ? <Button variant="ghost" size="sm" onClick={() => { setV(init()); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
        : <Button onClick={() => { setV(init()); setOpen(true); }}><Plus className="h-4 w-4" /> New plan</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={plan ? "Edit plan" : "New recurring plan"}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" error={errors.name}><Input value={v.name} onChange={set("name")} /></Field>
            <Field label="Base price" error={errors.price}><Input inputMode="decimal" value={v.price} onChange={set("price")} /></Field>
            <Field label="Billing period" error={errors.billingPeriod}>
              <Select value={v.billingPeriod} onChange={set("billingPeriod")}>
                {["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
              </Select>
            </Field>
            <Field label="Every N periods" error={errors.intervalCount}><Input inputMode="numeric" value={v.intervalCount} onChange={set("intervalCount")} /></Field>
            <Field label="Minimum quantity" error={errors.minQuantity}><Input inputMode="numeric" value={v.minQuantity} onChange={set("minQuantity")} /></Field>
            <div />
            <Field label="Available from" error={errors.startDate}><Input type="date" value={v.startDate} onChange={set("startDate")} /></Field>
            <Field label="Available until (optional)" error={errors.endDate}><Input type="date" value={v.endDate} onChange={set("endDate")} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
            <Checkbox label="Pausable" checked={v.pausable} onChange={set("pausable")} />
            <Checkbox label="Closable" checked={v.closable} onChange={set("closable")} />
            <Checkbox label="Renewable" checked={v.renewable} onChange={set("renewable")} />
            <Checkbox label="Auto-close after end date" checked={v.autoClose} onChange={set("autoClose")} />
            <Checkbox label="Active" checked={v.active} onChange={set("active")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Save</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
