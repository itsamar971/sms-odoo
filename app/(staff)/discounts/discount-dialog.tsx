"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { zodErrors } from "@/components/forms/zod-errors";
import { saveDiscountAction } from "@/app/actions/catalog";
import { discountSchema } from "@/lib/validation";
import type { Discount } from "@/lib/db/types";

export function DiscountDialog({ discount: d, products }: { discount?: Discount; products: { id: string; name: string }[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const init = () => ({
    name: d?.name ?? "",
    type: d?.type ?? "PERCENT",
    value: String(d?.value ?? ""),
    minPurchase: d?.minPurchase != null ? String(d.minPurchase) : "",
    minQuantity: d?.minQuantity != null ? String(d.minQuantity) : "",
    startDate: d?.startDate ?? today,
    endDate: d?.endDate ?? `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`,
    usageLimit: d?.usageLimit != null ? String(d.usageLimit) : "",
    scope: d?.scope ?? "SUBSCRIPTION",
    productIds: d?.productIds ?? [],
    active: d?.active ?? true,
  });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = discountSchema.safeParse(v);
    if (!parsed.success) return setErrors(zodErrors(parsed.error));
    setErrors({});
    const r = await run(() => saveDiscountAction(d?.id ?? null, v));
    if (r.ok) setOpen(false);
  }

  return (
    <>
      {d ? <Button variant="ghost" size="sm" onClick={() => { setV(init()); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
        : <Button onClick={() => { setV(init()); setOpen(true); }}><Plus className="h-4 w-4" /> New discount</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={d ? "Edit discount" : "New discount"} className="max-w-xl">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Name" error={errors.name}><Input value={v.name} onChange={set("name")} placeholder="10% off for 10+ seats" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type"><Select value={v.type} onChange={set("type")}><option value="PERCENT">Percent</option><option value="FIXED">Fixed amount</option></Select></Field>
            <Field label={v.type === "PERCENT" ? "Percent" : "Amount"} error={errors.value}><Input inputMode="decimal" value={v.value} onChange={set("value")} /></Field>
            <Field label="Applies to"><Select value={v.scope} onChange={set("scope")}><option value="SUBSCRIPTION">Whole subscription</option><option value="PRODUCT">Specific products</option></Select></Field>
            <Field label="Min purchase" error={errors.minPurchase}><Input inputMode="decimal" value={v.minPurchase} onChange={set("minPurchase")} placeholder="—" /></Field>
            <Field label="Min quantity" error={errors.minQuantity}><Input inputMode="numeric" value={v.minQuantity} onChange={set("minQuantity")} placeholder="—" /></Field>
            <Field label="Usage limit" error={errors.usageLimit}><Input inputMode="numeric" value={v.usageLimit} onChange={set("usageLimit")} placeholder="Unlimited" /></Field>
            <Field label="Start" error={errors.startDate}><Input type="date" value={v.startDate} onChange={set("startDate")} /></Field>
            <Field label="End" error={errors.endDate}><Input type="date" value={v.endDate} onChange={set("endDate")} /></Field>
          </div>
          {v.scope === "PRODUCT" && (
            <Field label="Products" error={errors.productIds}>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                {products.map((p) => (
                  <Checkbox key={p.id} label={p.name} checked={v.productIds.includes(p.id)}
                    onChange={(e) => setV({ ...v, productIds: e.target.checked ? [...v.productIds, p.id] : v.productIds.filter((x) => x !== p.id) })} />
                ))}
              </div>
            </Field>
          )}
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
