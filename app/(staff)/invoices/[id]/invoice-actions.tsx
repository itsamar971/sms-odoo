"use client";
import { useRouter } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { ConfirmButton } from "@/components/confirm-button";
import { PaymentDialog } from "@/components/payment-dialog";
import { buttonClass } from "@/components/ui/button";
import {
  cancelInvoiceAction, chaseInvoiceAction, confirmInvoiceAction, deleteInvoiceAction, recordPaymentAction, regenerateInvoiceAction, sendInvoiceAction,
} from "@/app/actions/billing";
import type { InvoiceStatus } from "@/lib/db/types";

export function InvoiceActions({ id, status, amountDue, overdue, canRegenerate }: { id: string; status: InvoiceStatus; amountDue: number; overdue: boolean; canRegenerate: boolean }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/api/invoices/${id}/pdf`} target="_blank" rel="noreferrer" className={buttonClass("outline", "sm")}><Printer className="h-3.5 w-3.5" /> Print</a>
      <a href={`/api/invoices/${id}/pdf?download=1`} className={buttonClass("outline", "sm")}><Download className="h-3.5 w-3.5" /> PDF</a>
      {status === "DRAFT" && <ActionButton size="sm" action={confirmInvoiceAction.bind(null, id)}>Confirm</ActionButton>}
      {(status === "CONFIRMED" || status === "PAID") && <ActionButton size="sm" variant="outline" action={sendInvoiceAction.bind(null, id)}>Send by email</ActionButton>}
      {status === "CONFIRMED" && overdue && <ActionButton size="sm" variant="outline" action={chaseInvoiceAction.bind(null, id)}>Chase</ActionButton>}
      {status === "CONFIRMED" && amountDue > 0 && <PaymentDialog invoiceId={id} amountDue={amountDue} action={recordPaymentAction} />}
      {(status === "DRAFT" || status === "CONFIRMED") && (
        <ConfirmButton size="sm" variant="ghost" action={cancelInvoiceAction.bind(null, id)} title="Cancel this invoice?" description="Discount usage is released and the period can be re-billed. Invoices with payments cannot be cancelled." confirmLabel="Cancel invoice">Cancel</ConfirmButton>
      )}
      {canRegenerate && (
        <ActionButton size="sm" action={regenerateInvoiceAction.bind(null, id)} onDone={(d) => router.push(`/invoices/${(d as { id: string }).id}`)}>Regenerate</ActionButton>
      )}
      {status === "CANCELLED" && (
        <ConfirmButton size="sm" variant="destructive" action={deleteInvoiceAction.bind(null, id)} title="Delete cancelled invoice?" description="This permanently removes the cancelled invoice." confirmLabel="Delete" onDone={() => router.push("/invoices")}>Delete</ConfirmButton>
      )}
    </div>
  );
}
