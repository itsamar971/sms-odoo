"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { zodErrors } from "./zod-errors";
import { LinesEditor, emptyLine, toLineInput, type LineDraft } from "./lines-editor";
import { createSubscriptionAction, updateSubscriptionAction } from "@/app/actions/ops";
import { subscriptionSchema } from "@/lib/validation";
import { formatDate } from "@/lib/dates";
import type { ProductOption } from "@/lib/services/lookups";

type PlanOpt = { id: string; name: string; minQuantity: number; startDate: string; endDate: string | null };

export type SubscriptionFormValues = {
  customerId: string;
  planId: string;
  startDate: string;
  expiryDate: string;
  paymentTerms: string;
  notes: string;
  templateId: string | null;
  lines: LineDraft[];
};

export function SubscriptionForm({
  initial, customers, plans, products, subscriptionId, templateName,
}: {
  initial: Partial<SubscriptionFormValues>;
  customers: { id: string; name: string; email: string }[];
  plans: PlanOpt[];
  products: ProductOption[];
  subscriptionId?: string;
  templateName?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<SubscriptionFormValues>({
    customerId: "", planId: plans[0]?.id ?? "", startDate: new Date().toISOString().slice(0, 10), expiryDate: "", paymentTerms: "NET15",
    notes: "", templateId: null, lines: [emptyLine()], ...initial,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const plan = plans.find((p) => p.id === v.planId);
  const planWarning = plan && (v.startDate < plan.startDate || (plan.endDate && v.startDate > plan.endDate))
    ? `"${plan.name}" is available ${formatDate(plan.startDate)} → ${plan.endDate ? formatDate(plan.endDate) : "open-ended"}` : undefined;

  async function submit(asQuotation: boolean) {
    const payload = { ...v, asQuotation, lines: toLineInput(v.lines) };
    const parsed = subscriptionSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error));
      return void toast.error(parsed.error.issues[0].message);
    }
    setErrors({});
    if (subscriptionId) {
      const r = await run(() => updateSubscriptionAction(subscriptionId, payload), { refresh: false });
      if (r.ok) router.push(`/subscriptions/${subscriptionId}`);
      return;
    }
    const r = await run(() => createSubscriptionAction(payload), { refresh: false });
    if (r.ok && r.data) {
      const d = r.data as { id: string; number: string };
      toast.success(`${d.number} created${asQuotation ? " as a quotation" : " as a draft"}`);
      router.push(`/subscriptions/${d.id}`);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-6" noValidate>
      {templateName && (
        <div className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
          Prefilled from template <b>{templateName}</b>. Creating a quotation sets its validity from the template.
        </div>
      )}
      <Card>
        <CardHeader><CardTitle>Customer & plan</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Customer" error={errors.customerId} className="md:col-span-2">
            <Select value={v.customerId} onChange={(e) => setV({ ...v, customerId: e.target.value })}>
              <option value="">Select a customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.email}</option>)}
            </Select>
          </Field>
          <Field label="Recurring plan" error={errors.planId}>
            <Select value={v.planId} onChange={(e) => setV({ ...v, planId: e.target.value })}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Start date" error={errors.startDate ?? planWarning}><Input type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} /></Field>
          <Field label="Expiry date (optional)" error={errors.expiryDate} hint="Leave empty for an open-ended subscription"><Input type="date" value={v.expiryDate} onChange={(e) => setV({ ...v, expiryDate: e.target.value })} /></Field>
          <Field label="Payment terms" error={errors.paymentTerms}>
            <Select value={v.paymentTerms} onChange={(e) => setV({ ...v, paymentTerms: e.target.value })}>
              <option value="IMMEDIATE">Immediate</option><option value="NET15">Net 15</option><option value="NET30">Net 30</option>
            </Select>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>Unit price defaults to the variant price; override it if needed.{plan && plan.minQuantity > 1 ? ` This plan needs ≥ ${plan.minQuantity} per line.` : ""}</CardDescription>
        </CardHeader>
        <CardContent><LinesEditor lines={v.lines} onChange={(lines) => setV({ ...v, lines })} products={products} errors={errors} minQuantity={plan?.minQuantity} /></CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5"><Field label="Internal notes"><Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field></CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        {subscriptionId ? (
          <Button type="submit" loading={pending}>Save changes</Button>
        ) : (
          <>
            <Button type="submit" variant="outline" loading={pending}>Save as draft</Button>
            <Button type="button" loading={pending} onClick={() => submit(true)}>Create quotation</Button>
          </>
        )}
      </div>
    </form>
  );
}
