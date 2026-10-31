"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { saveProductAction } from "@/app/actions/catalog";
import { productSchema } from "@/lib/validation";
import { zodErrors } from "@/components/forms/zod-errors";
import type { Product } from "@/lib/db/types";

export function ProductDialog({ product, taxes }: { product?: Product; taxes: { id: string; name: string; active: boolean }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const empty = { name: "", type: "SERVICE", salesPrice: "", costPrice: "", notes: "", active: true, taxIds: [] as string[] };
  const [v, setV] = useState(product ? { ...product, salesPrice: String(product.salesPrice), costPrice: String(product.costPrice) } : empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = productSchema.safeParse(v);
    if (!parsed.success) return setErrors(zodErrors(parsed.error));
    setErrors({});
    const res = await run(() => saveProductAction(product?.id ?? null, v as never));
    if (res.ok) {
      setOpen(false);
      if (!product && res.data) router.push(`/products/${(res.data as { id: string }).id}`);
    }
  }

  return (
    <>
      {product ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
      ) : (
        <Button onClick={() => { setV(empty); setOpen(true); }}><Plus className="h-4 w-4" /> New product</Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={product ? "Edit product" : "New product"}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Name" error={errors.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type" error={errors.type}>
              <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as "SERVICE" })}>
                <option value="SERVICE">Service</option><option value="GOODS">Goods</option>
              </Select>
            </Field>
            <Field label="Sales price" error={errors.salesPrice}><Input inputMode="decimal" value={v.salesPrice} onChange={(e) => setV({ ...v, salesPrice: e.target.value })} /></Field>
            <Field label="Cost price" error={errors.costPrice}><Input inputMode="decimal" value={v.costPrice} onChange={(e) => setV({ ...v, costPrice: e.target.value })} /></Field>
          </div>
          <Field label="Default taxes">
            <div className="flex flex-wrap gap-3 rounded-md border p-3">
              {taxes.length === 0 && <span className="text-xs text-muted-foreground">No taxes configured</span>}
              {taxes.map((t) => (
                <Checkbox key={t.id} label={t.name + (t.active ? "" : " (inactive)")} checked={v.taxIds.includes(t.id)}
                  onChange={(e) => setV({ ...v, taxIds: e.target.checked ? [...v.taxIds, t.id] : v.taxIds.filter((x) => x !== t.id) })} />
              ))}
            </div>
          </Field>
          <Field label="Notes"><Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
          <Checkbox label="Active (available on new subscriptions)" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Save</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
