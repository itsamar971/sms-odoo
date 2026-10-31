import { getDb } from "@/lib/db/client";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Card, CardContent } from "./ui/card";
import { Table, TBody, TD, TH, THead, TR } from "./ui/table";
import type { Invoice } from "@/lib/db/types";

/** The invoice "paper": shared by staff and portal views. */
export function InvoiceDocument({ invoice: inv }: { invoice: Invoice }) {
  const db = getDb();
  const customer = db.customers.get(inv.customerId);
  const sub = db.subscriptions.get(inv.subscriptionId);
  const lines = db.invoiceLines.by("invoiceId", inv.id);
  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Bill to</p>
            <p className="mt-1 font-medium">{customer?.name}</p>
            <p className="text-sm text-muted-foreground">{customer?.address}</p>
            <p className="text-sm text-muted-foreground">{customer?.email}</p>
            {customer?.gstin && <p className="text-sm text-muted-foreground">GSTIN {customer.gstin}</p>}
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Invoice date:</span> {formatDate(inv.invoiceDate)}</p>
            <p><span className="text-muted-foreground">Due date:</span> {formatDate(inv.dueDate)}</p>
            <p><span className="text-muted-foreground">Period:</span> {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Subscription:</span> {sub?.number}</p>
            <p><span className="text-muted-foreground">Terms:</span> {sub?.paymentTerms}</p>
            {inv.sentAt && <p><span className="text-muted-foreground">Emailed:</span> {inv.sentAt.toLocaleDateString("en-IN")}</p>}
            {inv.lastReminderAt && <p><span className="text-muted-foreground">Last reminder:</span> {inv.lastReminderAt.toLocaleDateString("en-IN")}</p>}
          </div>
        </div>
        <Table>
          <THead><TR><TH>Description</TH><TH className="text-right">Qty</TH><TH className="text-right">Unit price</TH><TH className="text-right">Discount</TH><TH className="text-right">Tax</TH><TH className="text-right">Amount</TH></TR></THead>
          <TBody>
            {lines.map((l) => (
              <TR key={l.id} className={l.kind === "DISCOUNT" ? "bg-emerald-50/50" : ""}>
                <TD className={l.kind === "DISCOUNT" ? "font-medium text-emerald-700" : ""}>{l.description}</TD>
                <TD className="text-right tabular">{l.kind === "DISCOUNT" ? "" : l.quantity}</TD>
                <TD className="text-right tabular">{l.kind === "DISCOUNT" ? "" : formatMoney(l.unitPrice)}</TD>
                <TD className="text-right tabular text-emerald-700">{l.discountAmount ? `−${formatMoney(l.discountAmount)}` : ""}</TD>
                <TD className="text-right tabular">{l.taxAmount ? formatMoney(l.taxAmount) : ""}</TD>
                <TD className={`text-right font-medium tabular ${l.kind === "DISCOUNT" ? "text-emerald-700" : ""}`}>{formatMoney(l.amount)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
          <T k="Subtotal" v={formatMoney(inv.subtotal)} />
          <T k="Discounts" v={`−${formatMoney(inv.discountTotal)}`} />
          <T k="Taxes" v={formatMoney(inv.taxTotal)} />
          <div className="border-t pt-1.5"><T k="Total" v={<b className="text-base">{formatMoney(inv.total)}</b>} /></div>
          <T k="Paid" v={formatMoney(inv.amountPaid)} />
          <T k="Amount due" v={<b className={inv.amountDue > 0 ? "text-destructive" : "text-emerald-600"}>{formatMoney(inv.amountDue)}</b>} />
        </div>
      </CardContent>
    </Card>
  );
}

function T({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="tabular">{v}</span></div>;
}
