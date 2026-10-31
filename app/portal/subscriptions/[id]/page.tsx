import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatDate, periodLabel, todayStr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusStepper } from "@/components/status-stepper";
import { PortalSubActions } from "../../portal-sub-actions";
import { priceSubscription } from "@/lib/services/billing";
import { productDisplayName } from "@/lib/services/catalog-helpers";

export default function PortalSubscription({ params }: { params: { id: string } }) {
  const user = requirePermission("portal");
  const db = getDb();
  const s = db.subscriptions.get(params.id);
  if (!s || s.customerId !== user.customerId || s.status === "DRAFT") notFound(); // never leak other customers' data
  const plan = db.plans.get(s.planId)!;
  const today = todayStr();
  const lines = db.subscriptionLines.by("subscriptionId", s.id);
  let preview = null;
  try { preview = priceSubscription(s, today); } catch { /* no lines */ }
  const invoices = db.invoices.by("subscriptionId", s.id).filter((i) => i.status !== "DRAFT").sort((a, b) => (a.invoiceDate < b.invoiceDate ? 1 : -1));
  return (
    <div className="space-y-6">
      <Link href="/portal" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Overview</Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><h1 className="text-xl font-semibold">{s.number}</h1><StatusBadge status={s.status} /></div>
        <PortalSubActions id={s.id} status={s.status} pausable={plan.pausable} closable={plan.closable} quotationExpired={!!s.quotationValidUntil && s.quotationValidUntil < today} />
      </div>
      <Card><CardContent className="px-8 py-5"><StatusStepper status={s.status} /></CardContent></Card>
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Plan</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Plan:</span> {plan.name} ({periodLabel(plan.billingPeriod, plan.intervalCount).toLowerCase()})</p>
            <p><span className="text-muted-foreground">Started:</span> {formatDate(s.startDate)}</p>
            {s.expiryDate && <p><span className="text-muted-foreground">Expires:</span> {formatDate(s.expiryDate)}</p>}
            {s.status === "ACTIVE" && <p><span className="text-muted-foreground">Next invoice:</span> {formatDate(s.nextInvoiceDate)}</p>}
            {s.quotationValidUntil && s.status === "QUOTATION" && <p><span className="text-muted-foreground">Quote valid until:</span> {formatDate(s.quotationValidUntil)}</p>}
            <p><span className="text-muted-foreground">Payment terms:</span> {s.paymentTerms}</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>What you get</CardTitle></CardHeader>
          <Table>
            <THead><TR><TH>Item</TH><TH className="text-right">Qty</TH><TH className="text-right">Price</TH><TH className="text-right">Amount</TH></TR></THead>
            <TBody>{lines.map((l) => <TR key={l.id}><TD>{productDisplayName(l.productId, l.variantId)}</TD><TD className="text-right">{l.quantity}</TD><TD className="text-right tabular">{formatMoney(l.unitPrice)}</TD><TD className="text-right tabular">{formatMoney(l.amount)}</TD></TR>)}</TBody>
          </Table>
          {preview && <CardContent className="pt-4 text-right text-sm">Estimated per period incl. discounts & taxes: <b>{formatMoney(preview.total)}</b></CardContent>}
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <Table>
          <THead><TR><TH>Invoice</TH><TH>Period</TH><TH>Status</TH><TH className="text-right">Total</TH></TR></THead>
          <TBody>
            {invoices.length === 0 && <TR><TD colSpan={4} className="py-6 text-center text-muted-foreground">No invoices yet.</TD></TR>}
            {invoices.map((i) => <TR key={i.id}><TD><Link href={`/portal/invoices/${i.id}`} className="text-primary hover:underline">{i.number}</Link></TD><TD>{formatDate(i.periodStart)} – {formatDate(i.periodEnd)}</TD><TD><StatusBadge status={i.status} /></TD><TD className="text-right tabular">{formatMoney(i.total)}</TD></TR>)}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
