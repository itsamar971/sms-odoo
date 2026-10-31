import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { formatDate, periodLabel, todayStr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { ConfirmButton } from "@/components/confirm-button";
import { PlanDialog } from "./plan-dialog";
import { deletePlanAction } from "@/app/actions/catalog";

export default function PlansPage() {
  const user = requirePermission("config:read");
  const canEdit = can(user.role, "config:write");
  const db = getDb();
  const today = todayStr();
  const plans = db.plans.all();
  return (
    <>
      <PageHeader title="Recurring plans" description="Billing frequency, availability window and lifecycle rules (pause / close / renew)." actions={canEdit && <PlanDialog />} />
      {plans.length === 0 ? <EmptyState title="No plans yet" /> : (
        <Card>
          <Table>
            <THead><TR><TH>Plan</TH><TH>Billing</TH><TH className="text-right">Base price</TH><TH className="text-right">Min qty</TH><TH>Available</TH><TH>Rules</TH><TH className="text-right">Subscriptions</TH>{canEdit && <TH />}</TR></THead>
            <TBody>
              {plans.map((p) => {
                const count = db.subscriptions.by("planId", p.id).length;
                const ended = p.endDate && p.endDate < today;
                return (
                  <TR key={p.id}>
                    <TD className="font-medium">{p.name} {!p.active && <Badge>Archived</Badge>} {ended && <Badge tone="red">Ended</Badge>}</TD>
                    <TD>{periodLabel(p.billingPeriod, p.intervalCount)}</TD>
                    <TD className="text-right tabular">{formatMoney(p.price)}</TD>
                    <TD className="text-right tabular">{p.minQuantity}</TD>
                    <TD className="text-xs text-muted-foreground">{formatDate(p.startDate)} → {p.endDate ? formatDate(p.endDate) : "open-ended"}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {p.pausable && <Badge tone="amber">Pausable</Badge>}
                        {p.closable && <Badge tone="gray">Closable</Badge>}
                        {p.renewable && <Badge tone="green">Renewable</Badge>}
                        {p.autoClose && <Badge tone="red">Auto-close</Badge>}
                      </div>
                    </TD>
                    <TD className="text-right tabular">{count.toLocaleString()}</TD>
                    {canEdit && (
                      <TD className="whitespace-nowrap text-right">
                        <PlanDialog plan={p} />
                        {count === 0 && <ConfirmButton variant="ghost" size="sm" action={deletePlanAction.bind(null, p.id)} title={`Delete plan "${p.name}"?`} confirmLabel="Delete">Delete</ConfirmButton>}
                      </TD>
                    )}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
