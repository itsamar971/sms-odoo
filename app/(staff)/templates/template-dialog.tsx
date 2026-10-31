"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { zodErrors } from "@/components/forms/zod-errors";
import { LinesEditor, emptyLine, toLineInput, type LineDraft } from "@/components/forms/lines-editor";
import { saveTemplateAction } from "@/app/actions/catalog";
import { templateSchema } from "@/lib/validation";
import type { QuotationTemplate } from "@/lib/db/types";
import type { ProductOption } from "@/lib/services/lookups";

type PlanOpt = { id: string; name: string; minQuantity: number };

export function TemplateDialog({ template: t, products, plans }: { template?: QuotationTemplate; products: ProductOption[]; plans: PlanOpt[] }) {
  const init = () => ({
    name: t?.name ?? "",
    planId: t?.planId ?? plans[0]?.id ?? "",
    validityDays: String(t?.validityDays ?? 30),
    paymentTerms: t?.paymentTerms ?? "NET15",
    lines: (t?.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: String(l.quantity), unitPrice: l.unitPrice != null ? String(l.unitPrice) : "" })) ?? [emptyLine()]) as LineDraft[],
  });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const plan = plans.find((p) => p.id === v.planId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...v, lines: toLineInput(v.lines) };
    const parsed = templateSchema.safeParse(payload);
    if (!parsed.success) return setErrors(zodErrors(parsed.error));
    setErrors({});
    const r = await run(() => saveTemplateAction(t?.id ?? null, payload));
    if (r.ok) setOpen(false);
  }

  return (
    <>
      {t ? <Button variant="ghost" size="sm" onClick={() => { setV(init()); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
        : <Button onClick={() => { setV(init()); setOpen(true); }}><Plus className="h-4 w-4" /> New template</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={t ? "Edit template" : "New quotation template"} className="max-w-4xl">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Name" error={errors.name} className="col-span-2"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
            <Field label="Plan" error={errors.planId}>
              <Select value={v.planId} onChange={(e) => setV({ ...v, planId: e.target.value })}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            </Field>
            <Field label="Validity (days)" error={errors.validityDays}><Input inputMode="numeric" value={v.validityDays} onChange={(e) => setV({ ...v, validityDays: e.target.value })} /></Field>
            <Field label="Payment terms">
              <Select value={v.paymentTerms} onChange={(e) => setV({ ...v, paymentTerms: e.target.value as "NET15" })}>
                <option value="IMMEDIATE">Immediate</option><option value="NET15">Net 15</option><option value="NET30">Net 30</option>
              </Select>
            </Field>
          </div>
          <LinesEditor lines={v.lines} onChange={(lines) => setV({ ...v, lines })} products={products} errors={errors} minQuantity={plan?.minQuantity} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Save template</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
