import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, IndianRupee, Repeat, TrendingUp, Wallet } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { dashboardMetrics } from "@/lib/services/dashboard";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { buttonClass } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { AgingChart, RevenueTrendChart, StatusBarChart } from "@/components/charts/charts";
import { chaseInvoiceAction } from "@/app/actions/billing";

export default function DashboardPage() {
  const user = requirePermission("ops:read");
  return (
    <>
      <PageHeader title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`} description="Recurring revenue at a glance." />
      <Suspense fallback={<PageSkeleton />}><Metrics /></Suspense>
    </>
  );
}

function Kpi({ label, value, sub, icon: Icon, tone = "default", href }: { label: string; value: string; sub?: React.ReactNode; icon: React.ElementType; tone?: "default" | "danger"; href?: string }) {
  const body = (
    <Card className={`h-full transition-shadow ${href ? "hover:shadow-md" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${tone === "danger" ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <p className={`mt-2 text-2xl font-semibold tracking-tight tabular ${tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Metrics() {
  const m = dashboardMetrics();
  const delta = m.revenueLastMonth ? Math.round(((m.revenueThisMonth - m.revenueLastMonth) / m.revenueLastMonth) * 100) : 0;
  return (
    <div className="space-y-6">
      {m.dueForBilling > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span><b>{m.dueForBilling}</b> active subscriptions are due for billing today.</span>
          <Link href="/billing" className="inline-flex items-center gap-1 font-medium hover:underline">Run billing <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Active subscriptions" value={m.activeCount.toLocaleString("en-IN")} icon={Repeat} href="/subscriptions?status=ACTIVE" sub={`${m.draftCount} draft invoices to review`} />
        <Kpi label="MRR" value={formatMoneyCompact(m.mrr)} icon={TrendingUp} sub={formatMoney(m.mrr)} />
        <Kpi label="ARR" value={formatMoneyCompact(m.arr)} icon={CalendarClock} sub="MRR × 12" />
        <Kpi label="Revenue this month" value={formatMoneyCompact(m.revenueThisMonth)} icon={IndianRupee} sub={<>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs last month (collected)</>} />
        <Kpi label="Outstanding" value={formatMoneyCompact(m.outstanding)} icon={Wallet} href="/invoices?status=CONFIRMED" sub="Confirmed, unpaid" />
        <Kpi label="Overdue" value={formatMoneyCompact(m.overdueAmount)} icon={AlertTriangle} tone="danger" href="/invoices?status=OVERDUE" sub={`${m.overdueCount.toLocaleString("en-IN")} invoices past due`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue trend</CardTitle><CardDescription>Invoiced vs collected, last 12 months</CardDescription></CardHeader>
          <CardContent><RevenueTrendChart data={m.trend} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Subscriptions by status</CardTitle><CardDescription>{m.byStatus.reduce((a, b) => a + b.count, 0).toLocaleString("en-IN")} total</CardDescription></CardHeader>
          <CardContent><StatusBarChart data={m.byStatus} /></CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Overdue invoices</CardTitle><CardDescription>Largest balances first</CardDescription></div>
            <Link href="/invoices?status=OVERDUE" className={buttonClass("outline", "sm")}>View all</Link>
          </CardHeader>
          <Table>
            <THead><TR><TH>Invoice</TH><TH>Customer</TH><TH>Due</TH><TH className="text-right">Days late</TH><TH className="text-right">Amount due</TH><TH /></TR></THead>
            <TBody>
              {m.topOverdue.length === 0 && <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Nothing overdue 🎉</TD></TR>}
              {m.topOverdue.map((o) => (
                <TR key={o.id}>
                  <TD><Link href={`/invoices/${o.id}`} className="font-medium text-primary hover:underline">{o.number}</Link></TD>
                  <TD>{o.customer}</TD>
                  <TD className="text-muted-foreground">{formatDate(o.dueDate)}</TD>
                  <TD className="text-right"><Badge tone={o.daysOverdue > 60 ? "red" : "amber"}>{o.daysOverdue}d</Badge></TD>
                  <TD className="text-right font-medium tabular">{formatMoney(o.amountDue)}</TD>
                  <TD className="text-right">
                    <ActionButton size="sm" variant="outline" action={chaseInvoiceAction.bind(null, o.id)}>{o.lastReminderAt ? "Chase again" : "Chase"}</ActionButton>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <Card>
          <CardHeader><CardTitle>Receivables aging</CardTitle><CardDescription>Overdue amount by days past due</CardDescription></CardHeader>
          <CardContent><AgingChart data={m.aging} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
