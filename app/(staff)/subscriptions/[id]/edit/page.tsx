import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PageHeader } from "@/components/page-header";
import { SubscriptionForm } from "@/components/forms/subscription-form";
import { customerOptions, planOptions, productOptions } from "@/lib/services/lookups";

export default function EditSubscriptionPage({ params }: { params: { id: string } }) {
  requirePermission("ops:write");
  const db = getDb();
  const s = db.subscriptions.get(params.id);
  if (!s) notFound();
  if (s.status !== "DRAFT" && s.status !== "QUOTATION") redirect(`/subscriptions/${s.id}`);
  const lines = db.subscriptionLines.by("subscriptionId", s.id);
  return (
    <>
      <PageHeader title={`Edit ${s.number}`} />
      <SubscriptionForm
        subscriptionId={s.id}
        initial={{
          customerId: s.customerId, planId: s.planId, startDate: s.startDate, expiryDate: s.expiryDate ?? "", paymentTerms: s.paymentTerms,
          notes: s.notes, templateId: s.templateId,
          lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: String(l.quantity), unitPrice: String(l.unitPrice) })),
        }}
        customers={customerOptions()} plans={planOptions(true)} products={productOptions(true)}
      />
    </>
  );
}
