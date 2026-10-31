import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { ConfirmButton } from "@/components/confirm-button";
import { TaxDialog } from "./tax-dialog";
import { deleteTaxAction } from "@/app/actions/catalog";

export default function TaxesPage() {
  const user = requirePermission("config:read");
  const canEdit = can(user.role, "config:write");
  const db = getDb();
  const taxes = db.taxes.all();
  return (
    <>
      <PageHeader title="Taxes" description="Percent taxes apply to the post-discount line amount; fixed taxes apply per unit." actions={canEdit && <TaxDialog />} />
      {taxes.length === 0 ? <EmptyState title="No taxes configured" /> : (
        <Card>
          <Table>
            <THead><TR><TH>Name</TH><TH>Type</TH><TH className="text-right">Rate</TH><TH className="text-right">Products</TH><TH>Status</TH>{canEdit && <TH />}</TR></THead>
            <TBody>
              {taxes.map((t) => (
                <TR key={t.id}>
                  <TD className="font-medium">{t.name}</TD>
                  <TD><Badge tone={t.type === "PERCENT" ? "indigo" : "amber"}>{t.type}</Badge></TD>
                  <TD className="text-right tabular">{t.type === "PERCENT" ? `${t.rate}%` : `${formatMoney(t.rate)} / unit`}</TD>
                  <TD className="text-right tabular">{db.products.filter((p) => p.taxIds.includes(t.id)).length}</TD>
                  <TD>{t.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</TD>
                  {canEdit && (
                    <TD className="whitespace-nowrap text-right">
                      <TaxDialog tax={t} />
                      <ConfirmButton variant="ghost" size="sm" action={deleteTaxAction.bind(null, t.id)} title={`Delete tax "${t.name}"?`} description="Blocked if any subscription line uses it — deactivate instead." confirmLabel="Delete">Delete</ConfirmButton>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
