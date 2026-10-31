import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { diffDays, formatDate, todayStr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceDocument } from "@/components/invoice-document";
import { InvoiceActions } from "./invoice-actions";
import { isOverdue } from "@/lib/services/invoices";

export default function InvoiceDetail({ params }: { params: { id: string } }) {
  requirePermission("ops:read");
  const db = getDb();
  const inv = db.invoices.get(params.id);
  if (!inv) notFound();
  const today = todayStr();
  const overdue = isOverdue(inv, today);
  const payments = db.payments.by("invoiceId", inv.id).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const history = db.statusHistory.by("entityId", inv.id).slice().sort((a, b) => b.at.getTime() - a.at.getTime());
  const sameperiodActive = inv.status === "CANCELLED" && db.invoices.byUnique("subscription_period", `${inv.subscriptionId}|${inv.periodStart}`);
  return (
    <>
      <Link href="/invoices" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Invoices</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{inv.number}</h1>
            <StatusBadge status={inv.status} />
            {overdue && <Badge tone="red">Overdue {diffDays(today, inv.dueDate)}d</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/customers/${inv.customerId}`} className="text-primary hover:underline">{db.customers.get(inv.customerId)?.name}</Link>
            {" · "}
            <Link href={`/subscriptions/${inv.subscriptionId}`} className="text-primary hover:underline">{db.subscriptions.get(inv.subscriptionId)?.number}</Link>
          </p>
        </div>
        <InvoiceActions
          id={inv.id}
          status={inv.status}
          amountDue={inv.amountDue}
          overdue={overdue}
          canRegenerate={inv.status === "CANCELLED" && !sameperiodActive}
        />
      </div>
      {sameperiodActive && (
        <p className="mb-4 rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
          This period was re-billed as <Link className="text-primary hover:underline" href={`/invoices/${sameperiodActive.id}`}>{sameperiodActive.number}</Link>.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><InvoiceDocument invoice={inv} /></div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
            <CardContent>
              {payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments recorded.</p> : (
                <ul className="divide-y text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium tabular">{formatMoney(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(p.date)} · {p.method.replace("_", " ")}{p.note ? ` · ${p.note}` : ""}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{p.recordedById ? db.users.get(p.recordedById)?.name : "Portal"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">Created {inv.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              {history.map((h) => (
                <p key={h.id}><b>{h.from ?? "—"} → {h.to}</b> <span className="text-muted-foreground">· {h.at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {h.byUserId ? db.users.get(h.byUserId)?.name : "System"}{h.note ? ` · ${h.note}` : ""}</span></p>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
