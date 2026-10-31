import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatDate, periodLabel, todayStr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { PaymentDialog } from "@/components/payment-dialog";
import { buttonClass } from "@/components/ui/button";
import { PortalSubActions } from "./portal-sub-actions";
import { portalOverview } from "@/lib/services/portal";
import { isOverdue } from "@/lib/services/invoices";
import { portalPayAction } from "@/app/actions/portal";

export default function PortalHome() {
  const user = requirePermission("portal");
  const customer = getDb().customers.get(user.customerId);
  const o = portalOverview(user.customerId!);
  const today = todayStr();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome, {customer?.name ?? user.name}</h1>
        <p className="text-sm text-muted-foreground">Your subscriptions, invoices and payments.</p>
      </div>
      {o.overdue.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4" /> You have {o.overdue.length} overdue invoice{o.overdue.length > 1 ? "s" : ""} totalling <b>{formatMoney(o.overdue.reduce((a, i) => a + i.amountDue, 0))}</b>.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active subscriptions</p><p className="mt-1 text-2xl font-semibold">{o.subscriptions.filter((s) => s.status === "ACTIVE").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Balance due</p><p className="mt-1 text-2xl font-semibold tabular">{formatMoney(o.outstanding)}</p>{o.nextDue && <p className="text-xs text-muted-foreground">Next due {formatDate(o.nextDue.dueDate)}</p>}</CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid to date</p><p className="mt-1 text-2xl font-semibold tabular">{formatMoney(o.paidTotal)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Subscriptions</CardTitle><CardDescription>Pause or cancel where your plan allows it.</CardDescription></CardHeader>
        {o.subscriptions.length === 0 ? <CardContent><EmptyState title="No subscriptions yet" description="Our team will send you a quotation." /></CardContent> : (
          <Table>
            <THead><TR><TH>Subscription</TH><TH>Plan</TH><TH>Status</TH><TH>Next invoice</TH><TH className="text-right">Amount</TH><TH /></TR></THead>
            <TBody>
              {o.subscriptions.map((s) => (
                <TR key={s.id}>
                  <TD><Link href={`/portal/subscriptions/${s.id}`} className="font-medium text-primary hover:underline">{s.number}</Link></TD>
                  <TD>{s.planName} <span className="text-xs text-muted-foreground">· {periodLabel(s.plan.billingPeriod, s.plan.intervalCount).toLowerCase()}</span></TD>
                  <TD><StatusBadge status={s.status} /></TD>
                  <TD className="text-muted-foreground">{s.status === "ACTIVE" ? formatDate(s.nextInvoiceDate) : s.status === "QUOTATION" ? `Valid until ${formatDate(s.quotationValidUntil)}` : "—"}</TD>
                  <TD className="text-right tabular">{formatMoney(s.amount)}</TD>
                  <TD className="text-right"><PortalSubActions id={s.id} status={s.status} pausable={s.plan.pausable} closable={s.plan.closable} quotationExpired={!!s.quotationValidUntil && s.quotationValidUntil < today} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div><CardTitle>Recent invoices</CardTitle></div>
          <Link href="/portal/invoices" className={buttonClass("outline", "sm")}>All invoices</Link>
        </CardHeader>
        {o.recentInvoices.length === 0 ? <CardContent><EmptyState title="No invoices yet" /></CardContent> : (
          <Table>
            <THead><TR><TH>Invoice</TH><TH>Date</TH><TH>Due</TH><TH>Status</TH><TH className="text-right">Total</TH><TH className="text-right">Due</TH><TH /></TR></THead>
            <TBody>
              {o.recentInvoices.map((i) => (
                <TR key={i.id}>
                  <TD><Link href={`/portal/invoices/${i.id}`} className="font-medium text-primary hover:underline">{i.number}</Link></TD>
                  <TD>{formatDate(i.invoiceDate)}</TD><TD>{formatDate(i.dueDate)}</TD>
                  <TD>{isOverdue(i, today) ? <Badge tone="red">Overdue</Badge> : <StatusBadge status={i.status} />}</TD>
                  <TD className="text-right tabular">{formatMoney(i.total)}</TD>
                  <TD className="text-right tabular">{formatMoney(i.amountDue)}</TD>
                  <TD className="whitespace-nowrap text-right">
                    <a href={`/api/invoices/${i.id}/pdf?download=1`} className={buttonClass("ghost", "sm")}><Download className="h-3.5 w-3.5" /></a>
                    {i.status === "CONFIRMED" && i.amountDue > 0 && <PaymentDialog invoiceId={i.id} amountDue={i.amountDue} action={portalPayAction} methods={["CARD", "UPI"]} label="Pay" title={`Pay ${i.number}`} />}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
