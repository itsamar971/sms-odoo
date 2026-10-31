import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmButton } from "@/components/confirm-button";
import { ProductDialog } from "../product-dialog";
import { AddVariantForm, AttributesEditor } from "./variant-editor";
import { deleteProductAction, deleteVariantAction, setProductActiveAction } from "@/app/actions/catalog";
import { taxOptions } from "@/lib/services/lookups";
import { unitPriceFor, variantLabel } from "@/lib/services/catalog-helpers";

export default function ProductDetail({ params }: { params: { id: string } }) {
  const user = requirePermission("config:read");
  const canEdit = can(user.role, "config:write");
  const db = getDb();
  const product = db.products.get(params.id);
  if (!product) notFound();
  const variants = db.variants.by("productId", product.id);
  const attributes = db.attributes.all().map((a) => ({ ...a, values: db.attributeValues.by("attributeId", a.id) }));
  const subCount = db.subscriptionLines.filter((l) => l.productId === product.id).length;

  return (
    <>
      <Link href="/products" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Products</Link>
      <PageHeader
        title={product.name}
        description={`${product.type === "SERVICE" ? "Service" : "Goods"} · used on ${subCount} subscription lines`}
        actions={canEdit && (
          <>
            <ProductDialog product={product} taxes={taxOptions()} />
            <ConfirmButton variant="outline" size="sm" destructive={product.active}
              action={setProductActiveAction.bind(null, product.id, !product.active)}
              title={product.active ? "Archive product?" : "Restore product?"}
              description={product.active ? "Archived products cannot be added to new subscriptions. Existing subscriptions keep billing." : undefined}
              confirmLabel={product.active ? "Archive" : "Restore"}>
              {product.active ? "Archive" : "Restore"}
            </ConfirmButton>
            {subCount === 0 && (
              <ConfirmButton variant="destructive" size="sm" action={deleteProductAction.bind(null, product.id)} title="Delete product?" description="This permanently removes the product and its variants." confirmLabel="Delete" onDone={() => { if (typeof window !== "undefined") window.location.href = "/products"; }}>Delete</ConfirmButton>
            )}
          </>
        )}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row k="Status" v={product.active ? <Badge tone="green">Active</Badge> : <Badge>Archived</Badge>} />
            <Row k="Sales price" v={formatMoney(product.salesPrice)} />
            <Row k="Cost price" v={formatMoney(product.costPrice)} />
            <Row k="Margin" v={product.salesPrice ? `${Math.round(((product.salesPrice - product.costPrice) / product.salesPrice) * 100)}%` : "—"} />
            <Row k="Default taxes" v={product.taxIds.map((t) => db.taxes.get(t)?.name).join(", ") || "None"} />
            {product.notes && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{product.notes}</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Variants</CardTitle>
            <CardDescription>Unit price = sales price + Σ attribute extra prices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <THead><TR><TH>Variant</TH><TH className="text-right">Extra</TH><TH className="text-right">Unit price</TH>{canEdit && <TH />}</TR></THead>
              <TBody>
                {variants.length === 0 && <TR><TD colSpan={4} className="text-center text-muted-foreground">No variants — sold at the base price.</TD></TR>}
                {variants.map((v) => {
                  const price = unitPriceFor(product, v.id);
                  return (
                    <TR key={v.id}>
                      <TD>{variantLabel(v.id)}</TD>
                      <TD className="text-right tabular text-muted-foreground">+{formatMoney(price - product.salesPrice)}</TD>
                      <TD className="text-right font-medium tabular">{formatMoney(price)}</TD>
                      {canEdit && (
                        <TD className="text-right">
                          <ConfirmButton variant="ghost" size="sm" action={deleteVariantAction.bind(null, v.id)} title="Delete variant?" confirmLabel="Delete">Delete</ConfirmButton>
                        </TD>
                      )}
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            {canEdit && <AddVariantForm productId={product.id} basePrice={product.salesPrice} attributes={attributes} />}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Attributes</CardTitle>
            <CardDescription>Shared across all products, e.g. Brand = Odoo (+₹560)</CardDescription>
          </CardHeader>
          <CardContent><AttributesEditor attributes={attributes} canEdit={canEdit} /></CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
