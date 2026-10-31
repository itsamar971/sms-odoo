import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db/client";
import { mul, sum, formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { ConfirmButton } from "@/components/confirm-button";
import { buttonClass } from "@/components/ui/button";
import { TemplateDialog } from "./template-dialog";
import { deleteTemplateAction } from "@/app/actions/catalog";
import { planOptions, productOptions } from "@/lib/services/lookups";
import { productDisplayName, unitPriceFor } from "@/lib/services/catalog-helpers";

export default function TemplatesPage() {
  const user = requirePermission("config:read");
  const canEdit = can(user.role, "config:write");
  const db = getDb();
  const templates = db.templates.all();
  const products = productOptions();
  const plans = planOptions();
  return (
    <>
      <PageHeader title="Quotation templates" description="Reusable plan + product bundles. A quotation copies the template and is valid for its validity window." actions={canEdit && <TemplateDialog products={products} plans={plans} />} />
      {templates.length === 0 ? <EmptyState title="No templates yet" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => {
            const plan = db.plans.get(t.planId);
            const lines = t.lines.map((l) => {
              const p = db.products.get(l.productId);
              const price = l.unitPrice ?? (p ? unitPriceFor(p, l.variantId) : 0);
              return { ...l, name: productDisplayName(l.productId, l.variantId), price, amount: mul(price, l.quantity) };
            });
            return (
              <Card key={t.id}>
                <CardHeader className="flex-row items-start justify-between">
                  <div>
                    <CardTitle>{t.name}</CardTitle>
                    <CardDescription>{plan?.name} plan · valid {t.validityDays} days · {t.paymentTerms}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {canEdit && <TemplateDialog template={t} products={products} plans={plans} />}
                    {canEdit && <ConfirmButton variant="ghost" size="sm" action={deleteTemplateAction.bind(null, t.id)} title={`Delete template "${t.name}"?`} confirmLabel="Delete">Delete</ConfirmButton>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="divide-y rounded-md border text-sm">
                    {lines.map((l) => (
                      <li key={l.id} className="flex justify-between px-3 py-2"><span>{l.quantity} × {l.name}</span><span className="tabular">{formatMoney(l.amount)}</span></li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Subtotal <b className="text-foreground">{formatMoney(sum(lines.map((l) => l.amount)))}</b></span>
                    <Link href={`/subscriptions/new?template=${t.id}`} className={buttonClass("default", "sm")}>Create quotation</Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
