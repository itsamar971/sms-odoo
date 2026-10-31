"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { zodErrors } from "@/components/forms/zod-errors";
import { saveTaxAction } from "@/app/actions/catalog";
import { taxSchema } from "@/lib/validation";
import type { Tax } from "@/lib/db/types";

export function TaxDialog({ tax }: { tax?: Tax }) {
  const init = () => ({ name: tax?.name ?? "", type: tax?.type ?? "PERCENT", rate: String(tax?.rate ?? ""), active: tax?.active ?? true });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = taxSchema.safeParse(v);
    if (!parsed.success) return setErrors(zodErrors(parsed.error));
    setErrors({});
    const r = await run(() => saveTaxAction(tax?.id ?? null, v));
    if (r.ok) setOpen(false);
  }
  return (
    <>
      {tax ? <Button variant="ghost" size="sm" onClick={() => { setV(init()); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
        : <Button onClick={() => { setV(init()); setOpen(true); }}><Plus className="h-4 w-4" /> New tax</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={tax ? "Edit tax" : "New tax"}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Name" error={errors.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="GST 18%" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as "PERCENT" })}><option value="PERCENT">Percent</option><option value="FIXED">Fixed per unit</option></Select></Field>
            <Field label={v.type === "PERCENT" ? "Rate (%)" : "Amount per unit"} error={errors.rate}><Input inputMode="decimal" value={v.rate} onChange={(e) => setV({ ...v, rate: e.target.value })} /></Field>
          </div>
          <Checkbox label="Active" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Save</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
