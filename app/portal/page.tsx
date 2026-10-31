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

const TABS = [
  { key: "active", label: "Active", statuses: ["ACTIVE"] },
  { key: "quotes", label: "Quotations", statuses: ["QUOTATION", "CONFIRMED"] },
  { key: "paused", label: "Paused", statuses: ["PAUSED"] },
  { key: "closed", label: "Closed", statuses: ["CLOSED"] },
] as const;
const PER_PAGE = 25;

export default function PortalHome({ searchParams }: { searchParams: { tab?: string; page?: string } }) {
  const user = requirePermission("portal");
  const customer = getDb().customers.get(user.customerId);
  const o = portalOverview(user.customerId!);
  const today = todayStr();
  const tab = TABS.find((t) => t.key === searchParams.tab) ?? TABS[0];
  const inTab = o.subscriptions.filter((s) => (tab.statuses as readonly string[]).includes(s.status));
  const pageCount = Math.max(1, Math.ceil(inTab.length / PER_PAGE));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), pageCount);
  const visible = inTab.slice((page - 1) * PER_PAGE, page * PER_PAGE);
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
        <div className="flex gap-1 border-b px-5">
          {TABS.map((t) => {
            const n = o.subscriptions.filter((s) => (t.statuses as readonly string[]).includes(s.status)).length;
            return (
              <Link key={t.key} href={`/portal?tab=${t.key}`} scroll={false}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${t.key === tab.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t.label} <span className="text-xs text-muted-foreground">{n}</span>
              </Link>
            );
          })}
        </div>
        {visible.length === 0 ? <CardContent className="pt-5"><EmptyState title={`No ${tab.label.toLowerCase()} subscriptions`} /></CardContent> : (
          <Table>
            <THead><TR><TH>Subscription</TH><TH>Plan</TH><TH>Status</TH><TH>Next invoice</TH><TH className="text-right">Amount</TH><TH /></TR></THead>
            <TBody>
              {visible.map((s) => (
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
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-2.5 text-sm text-muted-foreground">
            <span>Page {page} of {pageCount} · {inTab.length} subscriptions</span>
            <div className="flex gap-2">
              {page > 1 && <Link scroll={false} className={buttonClass("outline", "sm")} href={`/portal?tab=${tab.key}&page=${page - 1}`}>Previous</Link>}
              {page < pageCount && <Link scroll={false} className={buttonClass("outline", "sm")} href={`/portal?tab=${tab.key}&page=${page + 1}`}>Next</Link>}
            </div>
          </div>
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
