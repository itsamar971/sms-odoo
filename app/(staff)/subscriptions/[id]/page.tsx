import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatDate, periodLabel, todayStr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataTable, type Column } from "@/components/data-table";
import { StatusStepper } from "@/components/status-stepper";
import { SubscriptionActions } from "./subscription-actions";
import { availableActions } from "@/lib/services/subscriptions";
import { priceSubscription } from "@/lib/services/billing";
import { productDisplayName } from "@/lib/services/catalog-helpers";
import { listInvoices } from "@/lib/services/queries";
import type { SearchParams } from "@/lib/list";

const invCols: Column[] = [
  { key: "number", header: "Invoice", href: "/invoices/{id}", sortable: true },
  { key: "period", header: "Period" },
  { key: "dueDate", header: "Due", format: "date", sortable: true },
  { key: "status", header: "Status", format: "status" },
  { key: "total", header: "Total", format: "money", align: "right", sortable: true },
  { key: "amountDue", header: "Amount due", format: "money", align: "right" },
];

export default function SubscriptionDetail({ params, searchParams }: { params: { id: string }; searchParams: SearchParams }) {
  requirePermission("ops:read");
  const db = getDb();
  const sub = db.subscriptions.get(params.id);
  if (!sub) notFound();
  const today = todayStr();
  const plan = db.plans.get(sub.planId)!;
  const customer = db.customers.get(sub.customerId);
  const lines = db.subscriptionLines.by("subscriptionId", sub.id);
  const actions = availableActions(sub, plan, today);
  let preview: ReturnType<typeof priceSubscription> | null = null;
  try { preview = priceSubscription(sub, today); } catch { preview = null; }
  const history = db.statusHistory.by("entityId", sub.id).map((h, i) => ({ h, i })).sort((a, b) => b.h.at.getTime() - a.h.at.getTime() || b.i - a.i).map((x) => x.h);
  const invoices = listInvoices(searchParams, { subscriptionId: sub.id });
  const template = sub.templateId ? db.templates.get(sub.templateId) : undefined;
  const quotationExpired = sub.status === "QUOTATION" && sub.quotationValidUntil && sub.quotationValidUntil < today;

  return (
    <>
      <Link href="/subscriptions" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Subscriptions</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{sub.number}</h1>
            <StatusBadge status={sub.status} />
            {quotationExpired && <Badge tone="red">Quotation expired</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/customers/${sub.customerId}`} className="text-primary hover:underline">{customer?.name}</Link> · {plan.name} plan · {periodLabel(plan.billingPeriod, plan.intervalCount)}
          </p>
        </div>
        <SubscriptionActions id={sub.id} actions={actions} status={sub.status} dueNow={sub.status === "ACTIVE" && sub.nextInvoiceDate <= today} />
      </div>

      <Card className="mb-6"><CardContent className="px-8 py-5"><StatusStepper status={sub.status} /></CardContent></Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Row k="Start date" v={formatDate(sub.startDate)} />
            <Row k="Expiry" v={sub.expiryDate ? formatDate(sub.expiryDate) : "Open-ended"} />
            <Row k="Next invoice" v={sub.status === "ACTIVE" ? formatDate(sub.nextInvoiceDate) : "—"} />
            <Row k="Payment terms" v={sub.paymentTerms} />
            {sub.quotationValidUntil && <Row k="Quotation valid until" v={formatDate(sub.quotationValidUntil)} />}
            {template && <Row k="Template" v={template.name} />}
            {sub.closedAt && <Row k="Closed on" v={formatDate(sub.closedAt)} />}
            <Row k="Plan rules" v={<span className="flex flex-wrap justify-end gap-1">
              {plan.pausable && <Badge tone="amber">Pausable</Badge>}{plan.closable && <Badge>Closable</Badge>}{plan.renewable && <Badge tone="green">Renewable</Badge>}{plan.autoClose && <Badge tone="red">Auto-close</Badge>}
            </span>} />
            <Row k="Created by" v={db.users.get(sub.createdById)?.name ?? "—"} />
            {sub.notes && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{sub.notes}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Order lines & next invoice preview</CardTitle>
            <CardDescription>Discounts and taxes as they would apply if billed today.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <THead><TR><TH>Product</TH><TH className="text-right">Qty</TH><TH className="text-right">Unit price</TH><TH>Taxes</TH><TH className="text-right">Amount</TH></TR></THead>
              <TBody>
                {lines.map((l) => (
                  <TR key={l.id}>
                    <TD>{productDisplayName(l.productId, l.variantId)}</TD>
                    <TD className="text-right tabular">{l.quantity}</TD>
                    <TD className="text-right tabular">{formatMoney(l.unitPrice)}</TD>
                    <TD className="text-xs text-muted-foreground">{l.taxIds.map((t) => db.taxes.get(t)?.name).join(", ") || "—"}</TD>
                    <TD className="text-right font-medium tabular">{formatMoney(l.amount)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {preview && (
              <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
                <Row k="Subtotal" v={formatMoney(preview.subtotal)} />
                {preview.lines.filter((l) => l.kind === "DISCOUNT").map((l) => <Row key={l.description} k={l.description} v={<span className="text-emerald-600">{formatMoney(l.amount)}</span>} />)}
                <Row k="Taxes" v={formatMoney(preview.taxTotal)} />
                <div className="border-t pt-1.5"><Row k="Total per period" v={<span className="text-base">{formatMoney(preview.total)}</span>} /></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Invoices</h2>
          <DataTable columns={invCols} {...invoices} emptyTitle="No invoices yet" emptyDescription={sub.status === "ACTIVE" ? "Run billing to generate the first invoice." : "Invoices are generated once the subscription is active."} />
        </div>
        <Card>
          <CardHeader><CardTitle>Status history</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l pl-4">
              {history.map((h) => (
                <li key={h.id} className="text-sm">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-card bg-primary" />
                  <p className="font-medium">{h.from ? `${h.from} → ${h.to}` : `Created as ${h.to}`}</p>
                  {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                  <p className="text-xs text-muted-foreground">{h.at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {h.byUserId ? db.users.get(h.byUserId)?.name : "System"}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium tabular">{v}</span></div>;
}
