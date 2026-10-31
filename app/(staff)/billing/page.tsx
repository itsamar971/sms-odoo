import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { todayStr } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RunBillingPanel, ResetDemoButton } from "./billing-client";

export default function BillingPage() {
  const user = requirePermission("billing:run");
  const db = getDb();
  const today = todayStr();
  const due = db.subscriptions.by("status", "ACTIVE").filter((s) => s.nextInvoiceDate <= today);
  const autoCloseDue = db.subscriptions.all().filter((s) => {
    if (s.status !== "ACTIVE" && s.status !== "PAUSED") return false;
    const p = db.plans.get(s.planId);
    return p?.autoClose && ((p.endDate && p.endDate < today) || (s.expiryDate && s.expiryDate < today));
  }).length;
  const runs = db.billingRuns.all().slice().sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, 25);
  return (
    <>
      <PageHeader title="Billing runs" description="Idempotent: each subscription period is billed exactly once, guaranteed by a unique (subscription, period start) key." actions={can(user.role, "demo:reset") && <ResetDemoButton />} />
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Run billing now</CardTitle>
            <CardDescription>Bills every ACTIVE subscription whose next invoice date is on or before the run date — one DRAFT invoice per missed period — then auto-closes ended plans. Processed in batches of 100.</CardDescription>
          </CardHeader>
          <CardContent><RunBillingPanel today={today} dueCount={due.length} autoCloseCount={autoCloseDue} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Schedules</CardTitle><CardDescription>Three ways billing runs</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><Badge tone="indigo">Manual</Badge> The button on this page.</p>
            <p><Badge tone="green">Scheduler</Badge> In-process daily job (checked hourly).</p>
            <div>
              <p><Badge tone="amber">Cron</Badge> Protected endpoint:</p>
              <code className="mt-1 block break-all rounded bg-muted p-2 text-xs">curl -H &quot;x-cron-secret: $CRON_SECRET&quot; /api/cron/billing</code>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Run history</CardTitle></CardHeader>
        <Table>
          <THead><TR><TH>Started</TH><TH>As of</TH><TH>Trigger</TH><TH>By</TH><TH className="text-right">Created</TH><TH className="text-right">Skipped</TH><TH className="text-right">Failed</TH><TH className="text-right">Auto-closed</TH><TH className="text-right">Duration</TH><TH>Notes</TH></TR></THead>
          <TBody>
            {runs.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap">{r.startedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}</TD>
                <TD>{r.asOf}</TD>
                <TD><Badge tone={r.trigger === "MANUAL" ? "indigo" : r.trigger === "CRON" ? "amber" : "green"}>{r.trigger}</Badge></TD>
                <TD className="text-muted-foreground">{r.triggeredById ? db.users.get(r.triggeredById)?.name : "System"}</TD>
                <TD className="text-right font-medium tabular">{r.created.toLocaleString()}</TD>
                <TD className="text-right tabular">{r.skipped}</TD>
                <TD className={`text-right tabular ${r.failed ? "font-semibold text-destructive" : ""}`}>{r.failed}</TD>
                <TD className="text-right tabular">{r.closed}</TD>
                <TD className="text-right tabular text-muted-foreground">{r.finishedAt ? `${r.finishedAt.getTime() - r.startedAt.getTime()} ms` : "running"}</TD>
                <TD className="max-w-xs truncate text-xs text-muted-foreground" title={r.errors.join("\n")}>{r.errors[0] ?? ""}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
