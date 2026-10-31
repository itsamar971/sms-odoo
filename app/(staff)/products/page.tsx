import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { can } from "@/lib/auth/rbac";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { ProductDialog } from "./product-dialog";
import { taxOptions } from "@/lib/services/lookups";

export default function ProductsPage() {
  const user = requirePermission("config:read");
  const canEdit = can(user.role, "config:write");
  const db = getDb();
  const products = db.products.all().slice().sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader
        title="Products"
        description="Services and goods you sell on subscription. Variants add attribute-based pricing."
        actions={canEdit && <ProductDialog taxes={taxOptions()} />}
      />
      {products.length === 0 ? (
        <EmptyState title="No products yet" description="Create your first product to start selling subscriptions." />
      ) : (
        <Card>
          <Table>
            <THead><TR><TH>Name</TH><TH>Type</TH><TH className="text-right">Sales price</TH><TH className="text-right">Cost</TH><TH>Taxes</TH><TH className="text-right">Variants</TH><TH>Status</TH></TR></THead>
            <TBody>
              {products.map((p) => (
                <TR key={p.id}>
                  <TD><Link href={`/products/${p.id}`} className="font-medium text-primary hover:underline">{p.name}</Link></TD>
                  <TD><Badge tone={p.type === "SERVICE" ? "indigo" : "amber"}>{p.type}</Badge></TD>
                  <TD className="text-right tabular">{formatMoney(p.salesPrice)}</TD>
                  <TD className="text-right tabular text-muted-foreground">{formatMoney(p.costPrice)}</TD>
                  <TD className="text-xs text-muted-foreground">{p.taxIds.map((t) => db.taxes.get(t)?.name).join(", ") || "—"}</TD>
                  <TD className="text-right tabular">{db.variants.by("productId", p.id).length}</TD>
                  <TD>{p.active ? <Badge tone="green">Active</Badge> : <Badge>Archived</Badge>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
