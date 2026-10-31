"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { ConfirmButton } from "@/components/confirm-button";
import { buttonClass } from "@/components/ui/button";
import {
  billSubscriptionNowAction, deleteSubscriptionAction, renewSubscriptionAction, transitionSubscriptionAction,
} from "@/app/actions/ops";
import type { availableActions } from "@/lib/services/subscriptions";
import type { SubscriptionStatus } from "@/lib/db/types";
import { toast } from "sonner";

export function SubscriptionActions({ id, actions: a, dueNow }: { id: string; actions: ReturnType<typeof availableActions>; status: SubscriptionStatus; dueNow: boolean }) {
  const router = useRouter();
  const t = (to: SubscriptionStatus) => transitionSubscriptionAction.bind(null, id, to);
  return (
    <div className="flex flex-wrap gap-2">
      {a.edit && <Link href={`/subscriptions/${id}/edit`} className={buttonClass("outline", "sm")}><Pencil className="h-3.5 w-3.5" /> Edit</Link>}
      {a.delete && <ConfirmButton size="sm" variant="ghost" action={deleteSubscriptionAction.bind(null, id)} title="Delete this draft?" confirmLabel="Delete" onDone={() => router.push("/subscriptions")}>Delete draft</ConfirmButton>}
      {a.sendQuotation && <ActionButton size="sm" action={t("QUOTATION")}>Send quotation</ActionButton>}
      {a.confirm && <ActionButton size="sm" action={t("CONFIRMED")}>Confirm</ActionButton>}
      {a.quotationExpired && <span className="self-center text-xs text-destructive">Expired quotations cannot be confirmed — edit to re-quote.</span>}
      {a.activate && <ActionButton size="sm" action={t("ACTIVE")}>Activate</ActionButton>}
      {dueNow && (
        <ActionButton size="sm" variant="outline" action={billSubscriptionNowAction.bind(null, id)}
          onDone={(d) => { const r = d as { created: number; skipped: number }; toast.success(`${r.created} invoice(s) created${r.skipped ? `, ${r.skipped} already billed` : ""}`); }}>
          Bill now
        </ActionButton>
      )}
      {a.renew && <ConfirmButton size="sm" variant="outline" destructive={false} action={renewSubscriptionAction.bind(null, id)} title="Renew subscription?" description="Extends the expiry date by one billing period." confirmLabel="Renew">Renew</ConfirmButton>}
      {a.resume && <ActionButton size="sm" action={t("ACTIVE")}>Resume</ActionButton>}
      {a.pause && <ConfirmButton size="sm" variant="outline" action={t("PAUSED")} title="Pause subscription?" description="No invoices are generated while paused. Billing resumes from the resume date." confirmLabel="Pause">Pause</ConfirmButton>}
      {a.close && <ConfirmButton size="sm" variant="destructive" action={t("CLOSED")} title="Close subscription?" description="This is final: closed subscriptions cannot be reopened and stop billing." confirmLabel="Close subscription">Close</ConfirmButton>}
    </div>
  );
}
