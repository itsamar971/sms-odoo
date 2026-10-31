"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import type { ProductOption } from "@/lib/services/lookups";

export type LineDraft = { productId: string; variantId: string | null; quantity: string; unitPrice: string };

export function emptyLine(): LineDraft {
  return { productId: "", variantId: null, quantity: "1", unitPrice: "" };
}

export function linePrice(products: ProductOption[], l: LineDraft): number {
  if (l.unitPrice !== "" && !Number.isNaN(Number(l.unitPrice))) return Number(l.unitPrice);
  const p = products.find((x) => x.id === l.productId);
  if (!p) return 0;
  const v = p.variants.find((x) => x.id === l.variantId);
  return v ? v.price : p.price;
}

export function LinesEditor({
  lines,
  onChange,
  products,
  errors,
  minQuantity = 1,
}: {
  lines: LineDraft[];
  onChange: (l: LineDraft[]) => void;
  products: ProductOption[];
  errors?: Record<string, string>;
  minQuantity?: number;
}) {
  const update = (i: number, patch: Partial<LineDraft>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + linePrice(products, l) * (Number(l.quantity) || 0), 0);
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1fr_1fr_90px_120px_110px_32px] gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
        <span>Product</span><span>Variant</span><span>Qty</span><span>Unit price</span><span className="text-right">Amount</span><span />
      </div>
      {lines.map((l, i) => {
        const p = products.find((x) => x.id === l.productId);
        const price = linePrice(products, l);
        const qtyErr = errors?.[`lines.${i}.quantity`] ?? (Number(l.quantity) < minQuantity ? `Min ${minQuantity}` : undefined);
        return (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-md border p-2 md:grid-cols-[1fr_1fr_90px_120px_110px_32px] md:border-0 md:p-0">
            <Select value={l.productId} onChange={(e) => update(i, { productId: e.target.value, variantId: null, unitPrice: "" })}>
              <option value="">Select product…</option>
              {products.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
            <Select value={l.variantId ?? ""} disabled={!p?.variants.length} onChange={(e) => update(i, { variantId: e.target.value || null, unitPrice: "" })}>
              <option value="">{p?.variants.length ? "Base (no variant)" : "—"}</option>
              {p?.variants.map((v) => <option key={v.id} value={v.id}>{v.label} · {formatMoney(v.price)}</option>)}
            </Select>
            <div>
              <Input inputMode="numeric" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className={qtyErr ? "border-destructive" : ""} />
              {qtyErr && <p className="mt-0.5 text-[11px] text-destructive">{qtyErr}</p>}
            </div>
            <Input inputMode="decimal" placeholder={p ? String(linePrice(products, { ...l, unitPrice: "" })) : "auto"} value={l.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} />
            <div className="flex items-center justify-end text-sm font-medium tabular">{formatMoney(price * (Number(l.quantity) || 0))}</div>
            <Button type="button" variant="ghost" size="icon" onClick={() => onChange(lines.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label="Remove line">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      {errors?.lines && <p className="text-xs text-destructive">{errors.lines}</p>}
      <div className="flex items-center justify-between pt-1">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, emptyLine()])}><Plus className="h-3.5 w-3.5" /> Add line</Button>
        <p className="text-sm text-muted-foreground">Recurring subtotal (pre-tax): <b className="text-foreground tabular">{formatMoney(total)}</b></p>
      </div>
    </div>
  );
}

export function toLineInput(lines: LineDraft[]) {
  return lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice }));
}
