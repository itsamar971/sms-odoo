"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAction } from "@/components/use-action";
import { ConfirmButton } from "@/components/confirm-button";
import { formatMoney } from "@/lib/money";
import {
  createVariantAction, deleteAttributeAction, deleteAttributeValueAction, saveAttributeAction, saveAttributeValueAction,
} from "@/app/actions/catalog";
import type { AttributeValue, ProductAttribute } from "@/lib/db/types";

type Attr = ProductAttribute & { values: AttributeValue[] };

export function AddVariantForm({ productId, basePrice, attributes }: { productId: string; basePrice: number; attributes: Attr[] }) {
  const [sel, setSel] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const valueIds = Object.values(sel).filter(Boolean);
  const extra = attributes.flatMap((a) => a.values).filter((v) => valueIds.includes(v.id)).reduce((s, v) => s + v.extraPrice, 0);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-3">
      {attributes.map((a) => (
        <label key={a.id} className="space-y-1 text-xs font-medium">
          {a.name}
          <Select value={sel[a.id] ?? ""} onChange={(e) => setSel({ ...sel, [a.id]: e.target.value })} className="w-40">
            <option value="">—</option>
            {a.values.map((v) => <option key={v.id} value={v.id}>{v.value} (+{v.extraPrice})</option>)}
          </Select>
        </label>
      ))}
      <div className="text-xs text-muted-foreground">Price: <b className="text-foreground">{formatMoney(basePrice + extra)}</b></div>
      <Button size="sm" loading={pending} disabled={valueIds.length === 0}
        onClick={() => run(() => createVariantAction({ productId, valueIds }), { onSuccess: () => setSel({}) })}>
        <Plus className="h-3.5 w-3.5" /> Add variant
      </Button>
    </div>
  );
}

export function AttributesEditor({ attributes, canEdit }: { attributes: Attr[]; canEdit: boolean }) {
  const [newAttr, setNewAttr] = useState("");
  const { run, pending } = useAction();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {attributes.map((a) => (
          <div key={a.id} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{a.name}</p>
              {canEdit && (
                <ConfirmButton variant="ghost" size="icon" action={deleteAttributeAction.bind(null, a.id)} title={`Delete attribute "${a.name}"?`} description="Its values are deleted too. Blocked if any variant uses it." confirmLabel="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </ConfirmButton>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {a.values.map((v) => (
                <span key={v.id} className="inline-flex items-center gap-1">
                  <Badge tone="indigo">{v.value} · +{formatMoney(v.extraPrice)}</Badge>
                  {canEdit && (
                    <ConfirmButton variant="ghost" size="icon" className="h-5 w-5" action={deleteAttributeValueAction.bind(null, v.id)} title={`Delete value "${v.value}"?`} confirmLabel="Delete">
                      <Trash2 className="h-3 w-3" />
                    </ConfirmButton>
                  )}
                </span>
              ))}
              {a.values.length === 0 && <span className="text-xs text-muted-foreground">No values yet</span>}
            </div>
            {canEdit && <AddValue attributeId={a.id} />}
          </div>
        ))}
      </div>
      {canEdit && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => saveAttributeAction(null, { name: newAttr }), { onSuccess: () => setNewAttr("") }); }}>
          <Input placeholder="New attribute, e.g. Edition" value={newAttr} onChange={(e) => setNewAttr(e.target.value)} className="max-w-xs" />
          <Button type="submit" variant="outline" loading={pending} disabled={!newAttr.trim()}>Add attribute</Button>
        </form>
      )}
    </div>
  );
}

function AddValue({ attributeId }: { attributeId: string }) {
  const [value, setValue] = useState("");
  const [extra, setExtra] = useState("0");
  const { run, pending } = useAction();
  return (
    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => saveAttributeValueAction(null, { attributeId, value, extraPrice: extra }), { onSuccess: () => { setValue(""); setExtra("0"); } }); }}>
      <Input placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} className="h-8" />
      <Input placeholder="Extra" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} className="h-8 w-24" />
      <Button size="sm" type="submit" variant="secondary" loading={pending} disabled={!value.trim()}>Add</Button>
    </form>
  );
}
