import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { todayStr } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { SubscriptionForm } from "@/components/forms/subscription-form";
import { customerOptions, planOptions, productOptions } from "@/lib/services/lookups";
import { str, type SearchParams } from "@/lib/list";

export default function NewSubscriptionPage({ searchParams }: { searchParams: SearchParams }) {
  requirePermission("ops:write");
  const db = getDb();
  const template = db.templates.get(str(searchParams, "template"));
  const customerId = str(searchParams, "customer") ?? "";
  const initial = template
    ? {
        customerId, planId: template.planId, paymentTerms: template.paymentTerms, templateId: template.id, startDate: todayStr(),
        lines: template.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: String(l.quantity), unitPrice: l.unitPrice != null ? String(l.unitPrice) : "" })),
      }
    : { customerId, startDate: todayStr() };
  return (
    <>
      <PageHeader title={template ? "New quotation" : "New subscription"} description="Draft → Quotation → Confirmed → Active. Billing starts on activation." />
      <SubscriptionForm initial={initial} templateName={template?.name} customers={customerOptions()} plans={planOptions()} products={productOptions()} />
    </>
  );
}
