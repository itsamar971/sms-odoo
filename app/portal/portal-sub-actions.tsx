"use client";
import { ConfirmButton } from "@/components/confirm-button";
import { ActionButton } from "@/components/action-button";
import { portalTransitionAction } from "@/app/actions/portal";
import type { SubscriptionStatus } from "@/lib/db/types";

export function PortalSubActions({ id, status, pausable, closable, quotationExpired }: { id: string; status: SubscriptionStatus; pausable: boolean; closable: boolean; quotationExpired: boolean }) {
  const t = (to: SubscriptionStatus) => portalTransitionAction.bind(null, id, to);
  return (
    <div className="flex flex-wrap gap-2">
      {status === "QUOTATION" && !quotationExpired && (
        <ConfirmButton size="sm" destructive={false} action={t("CONFIRMED")} title="Accept this quotation?" description="You agree to the plan and prices shown. Billing starts once the subscription is activated." confirmLabel="Accept quotation">Accept quotation</ConfirmButton>
      )}
      {status === "QUOTATION" && quotationExpired && <span className="text-xs text-destructive">Quotation expired — contact us for a new one.</span>}
      {status === "ACTIVE" && pausable && <ConfirmButton size="sm" variant="outline" action={t("PAUSED")} title="Pause subscription?" description="You won't be billed while paused. You can resume any time." confirmLabel="Pause">Pause</ConfirmButton>}
      {status === "PAUSED" && pausable && <ActionButton size="sm" action={t("ACTIVE")}>Resume</ActionButton>}
      {(status === "ACTIVE" || status === "PAUSED") && closable && (
        <ConfirmButton size="sm" variant="ghost" className="text-destructive" action={t("CLOSED")} title="Cancel subscription?" description="This is permanent. Outstanding invoices remain payable." confirmLabel="Cancel subscription">Cancel</ConfirmButton>
      )}
    </div>
  );
}
