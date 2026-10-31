import Link from "next/link";
import { Download } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { parseReportFilters, reportData } from "@/lib/services/reports";
import { customerOptions, planOptions } from "@/lib/services/lookups";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";
import { RevenueTrendChart } from "@/components/charts/charts";
import type { SearchParams } from "@/lib/list";

export default function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  requirePermission("ops:read");
  const f = parseReportFilters(searchParams);
  const d = reportData(f);
  const qs = new URLSearchParams(Object.entries({ from: f.from, to: f.to, customer: f.customerId ?? "", plan: f.planId ?? "" }).filter(([, v]) => v)).toString();
  const csv = (type: string, label = "CSV") => (
    <a href={`/api/reports/export?type=${type}&${qs}`} className={buttonClass("outline", "sm")}><Download className="h-3.5 w-3.5" /> {label}</a>
  );
  const s = d.summary;
  return (
    <>
      <PageHeader title="Reports" description={`${formatDate(f.from)} – ${formatDate(f.to)}. Receivables are as of today.`}
        actions={<>{csv("invoices", "Invoices CSV")}{csv("payments", "Payments CSV")}{csv("subscriptions", "Subscriptions CSV")}</>} />
      <FilterBar filters={[
        { type: "date", name: "from", label: "From" },
        { type: "date", name: "to", label: "To" },
        { type: "select", name: "customer", label: "Customer", options: customerOptions().map((c) => ({ value: c.id, label: c.name })) },
        { type: "select", name: "plan", label: "Plan", options: planOptions(true).map((p) => ({ value: p.id, label: p.name })) },
      ]} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Invoiced", formatMoney(s.invoiced), `${s.invoiceCount.toLocaleString()} invoices · tax ${formatMoney(s.tax)}`],
          ["Collected", formatMoney(s.collected), `${s.paymentCount.toLocaleString()} payments · ${s.collectionRate}% of invoiced`],
          ["Outstanding / overdue", formatMoney(s.outstanding), `${formatMoney(s.overdueAmount)} overdue on ${s.overdueCount} invoices`],
          ["Active subscriptions", s.activeCount.toLocaleString(), `${s.newSubs} new · ${s.churned} closed in range`],
        ].map(([k, v, sub]) => (
          <Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-xl font-semibold tabular">{v}</p><p className="mt-1 text-xs text-muted-foreground">{sub}</p></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Revenue by month</CardTitle><CardDescription>Invoiced (confirmed + paid) vs collected</CardDescription></div>{csv("revenue")}</CardHeader>
          <CardContent>
            <RevenueTrendChart data={d.byMonth} />
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground">Show as table</summary>
              <Table>
                <THead><TR><TH>Month</TH><TH className="text-right">Invoices</TH><TH className="text-right">Invoiced</TH><TH className="text-right">Collected</TH></TR></THead>
                <TBody>{d.byMonth.map((r) => <TR key={r.month}><TD>{r.month}</TD><TD className="text-right tabular">{r.count}</TD><TD className="text-right tabular">{formatMoney(r.invoiced)}</TD><TD className="text-right tabular">{formatMoney(r.collected)}</TD></TR>)}</TBody>
              </Table>
            </details>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Payments by method</CardTitle></CardHeader>
            <Table>
              <TBody>{d.byMethod.map((m) => <TR key={m.method}><TD>{m.method.replace("_", " ")}</TD><TD className="text-right text-muted-foreground tabular">{m.count}</TD><TD className="text-right font-medium tabular">{formatMoney(m.amount)}</TD></TR>)}</TBody>
            </Table>
          </Card>
          <Card>
            <CardHeader><CardTitle>Active by plan</CardTitle></CardHeader>
            <Table>
              <THead><TR><TH>Plan</TH><TH className="text-right">Active</TH><TH className="text-right">MRR</TH></TR></THead>
              <TBody>{d.byPlan.map((p) => <TR key={p.plan}><TD>{p.plan}</TD><TD className="text-right tabular">{p.active.toLocaleString()}</TD><TD className="text-right font-medium tabular">{formatMoney(p.mrr)}</TD></TR>)}</TBody>
            </Table>
          </Card>
        </div>
      </div>
      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Overdue invoices</CardTitle><CardDescription>{d.overdue.length} invoices · top 25 by balance</CardDescription></div>{csv("overdue")}</CardHeader>
        <Table>
          <THead><TR><TH>Invoice</TH><TH>Customer</TH><TH>Due</TH><TH className="text-right">Days late</TH><TH className="text-right">Total</TH><TH className="text-right">Amount due</TH></TR></THead>
          <TBody>
            {d.overdue.slice(0, 25).map((o) => (
              <TR key={o.id}>
                <TD><Link href={`/invoices/${o.id}`} className="font-medium text-primary hover:underline">{o.number}</Link></TD>
                <TD>{o.customer}</TD><TD>{formatDate(o.dueDate)}</TD><TD className="text-right tabular">{o.daysOverdue}</TD>
                <TD className="text-right tabular">{formatMoney(o.total)}</TD><TD className="text-right font-medium tabular text-destructive">{formatMoney(o.amountDue)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
