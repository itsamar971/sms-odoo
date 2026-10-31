import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { formatDate, todayStr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { ConfirmButton } from "@/components/confirm-button";
import { DiscountDialog } from "./discount-dialog";
import { deleteDiscountAction } from "@/app/actions/catalog";
import { checkDiscountEligibility } from "@/lib/services/discounts";
import { productOptions } from "@/lib/services/lookups";

export default function DiscountsPage() {
  const user = requirePermission("config:read");
  const canEdit = can(user.role, "config:write");
  const db = getDb();
  const today = todayStr();
  const products = productOptions(true).map((p) => ({ id: p.id, name: p.name }));
  const discounts = db.discounts.all();
  return (
    <>
      <PageHeader title="Discounts" description="Applied automatically at invoice build while active, in date, under the usage limit and when minimums are met." actions={canEdit && <DiscountDialog products={products} />} />
      {discounts.length === 0 ? <EmptyState title="No discounts yet" /> : (
        <Card>
          <Table>
            <THead><TR><TH>Name</TH><TH>Value</TH><TH>Scope</TH><TH>Conditions</TH><TH>Valid</TH><TH className="text-right">Usage</TH><TH>Status</TH>{canEdit && <TH />}</TR></THead>
            <TBody>
              {discounts.map((d) => {
                const st = checkDiscountEligibility(d, { today, purchaseAmount: Infinity, quantity: Infinity });
                return (
                  <TR key={d.id}>
                    <TD className="font-medium">{d.name}</TD>
                    <TD className="tabular">{d.type === "PERCENT" ? `${d.value}%` : formatMoney(d.value)}</TD>
                    <TD>
                      <Badge tone={d.scope === "PRODUCT" ? "violet" : "indigo"}>{d.scope}</Badge>
                      {d.scope === "PRODUCT" && <p className="mt-1 text-xs text-muted-foreground">{d.productIds.map((id) => db.products.get(id)?.name).join(", ")}</p>}
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {d.minQuantity ? `Qty ≥ ${d.minQuantity}` : ""}{d.minQuantity && d.minPurchase ? " · " : ""}{d.minPurchase ? `Purchase ≥ ${formatMoney(d.minPurchase)}` : ""}{!d.minQuantity && !d.minPurchase ? "None" : ""}
                    </TD>
                    <TD className="text-xs text-muted-foreground">{formatDate(d.startDate)} → {formatDate(d.endDate)}</TD>
                    <TD className="text-right tabular">{d.usedCount.toLocaleString()}{d.usageLimit !== null ? ` / ${d.usageLimit}` : ""}</TD>
                    <TD>{st.eligible ? <Badge tone="green">Applying</Badge> : <Badge tone={st.reason === "inactive" ? "gray" : "red"}>{st.reason}</Badge>}</TD>
                    {canEdit && (
                      <TD className="whitespace-nowrap text-right">
                        <DiscountDialog discount={d} products={products} />
                        <ConfirmButton variant="ghost" size="sm" action={deleteDiscountAction.bind(null, d.id)} title={`Delete "${d.name}"?`} description="Discounts already used on invoices can only be deactivated." confirmLabel="Delete">Delete</ConfirmButton>
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
