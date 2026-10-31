import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, Printer } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { todayStr } from "@/lib/dates";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/invoice-document";
import { PaymentDialog } from "@/components/payment-dialog";
import { isOverdue } from "@/lib/services/invoices";
import { portalPayAction } from "@/app/actions/portal";

export default function PortalInvoice({ params }: { params: { id: string } }) {
  const user = requirePermission("portal");
  const inv = getDb().invoices.get(params.id);
  if (!inv || inv.customerId !== user.customerId || inv.status === "DRAFT") notFound();
  return (
    <div className="space-y-4">
      <Link href="/portal/invoices" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Invoices</Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{inv.number}</h1>
          <StatusBadge status={inv.status} />
          {isOverdue(inv, todayStr()) && <Badge tone="red">Overdue</Badge>}
        </div>
        <div className="flex gap-2">
          <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className={buttonClass("outline", "sm")}><Printer className="h-3.5 w-3.5" /> Print</a>
          <a href={`/api/invoices/${inv.id}/pdf?download=1`} className={buttonClass("outline", "sm")}><Download className="h-3.5 w-3.5" /> Download PDF</a>
          {inv.status === "CONFIRMED" && inv.amountDue > 0 && <PaymentDialog invoiceId={inv.id} amountDue={inv.amountDue} action={portalPayAction} methods={["CARD", "UPI"]} label="Pay now" title={`Pay ${inv.number}`} />}
        </div>
      </div>
      <InvoiceDocument invoice={inv} />
    </div>
  );
}
