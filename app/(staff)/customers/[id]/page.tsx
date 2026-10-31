import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatMoney } from "@/lib/money";
import { todayStr } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/data-table";
import { buttonClass } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { CustomerDialog } from "../customer-dialog";
import { deleteCustomerAction } from "@/app/actions/ops";
import { listInvoices, listSubscriptions } from "@/lib/services/queries";
import { isOverdue } from "@/lib/services/invoices";
import type { SearchParams } from "@/lib/list";

const subCols: Column[] = [
  { key: "number", header: "Number", href: "/subscriptions/{id}", sortable: true },
  { key: "plan", header: "Plan" },
  { key: "status", header: "Status", format: "status" },
  { key: "startDate", header: "Start", format: "date", sortable: true },
  { key: "amount", header: "Recurring", format: "money", align: "right" },
];
const invCols: Column[] = [
  { key: "number", header: "Invoice", href: "/invoices/{id}" },
  { key: "invoiceDate", header: "Date", format: "date" },
  { key: "dueDate", header: "Due", format: "date" },
  { key: "status", header: "Status", format: "status" },
  { key: "total", header: "Total", format: "money", align: "right" },
  { key: "amountDue", header: "Due", format: "money", align: "right" },
];

export default function CustomerDetail({ params, searchParams }: { params: { id: string }; searchParams: SearchParams }) {
  requirePermission("ops:read");
  const db = getDb();
  const c = db.customers.get(params.id);
  if (!c) notFound();
  const today = todayStr();
  const invoices = db.invoices.by("customerId", c.id);
  const outstanding = invoices.filter((i) => i.status === "CONFIRMED").reduce((a, i) => a + i.amountDue, 0);
  const overdue = invoices.filter((i) => isOverdue(i, today)).reduce((a, i) => a + i.amountDue, 0);
  const paid = db.payments.by("customerId", c.id).reduce((a, p) => a + p.amount, 0);
  const subs = listSubscriptions({ page: searchParams.page, sort: searchParams.sort, dir: searchParams.dir }, { customerId: c.id });
  const invs = listInvoices({ page: searchParams.ipage, sort: searchParams.isort, dir: searchParams.idir }, { customerId: c.id });
  const portalUser = db.users.by("customerId", c.id)[0];
  const deletable = subs.total === 0 && invoices.length === 0;
  return (
    <>
      <Link href="/customers" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Customers</Link>
      <PageHeader
        title={c.name}
        description={`${c.email}${c.phone ? " · " + c.phone : ""}${portalUser ? " · has portal login" : " · no portal login yet"}`}
        actions={<>
          <Link href={`/subscriptions/new?customer=${c.id}`} className={buttonClass("default", "sm")}><Plus className="h-3.5 w-3.5" /> New subscription</Link>
          <CustomerDialog customer={c} />
          {deletable && <ConfirmButton variant="destructive" size="sm" action={deleteCustomerAction.bind(null, c.id)} title="Delete customer?" description="This also removes their portal login." confirmLabel="Delete" onDone={() => { window.location.href = "/customers"; }}>Delete</ConfirmButton>}
        </>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[["Outstanding", formatMoney(outstanding)], ["Overdue", formatMoney(overdue)], ["Lifetime paid", formatMoney(paid)], ["GSTIN", c.gstin ?? "—"]].map(([k, v]) => (
          <Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-lg font-semibold tabular">{v}</p></CardContent></Card>
        ))}
      </div>
      {c.address && <p className="mb-6 text-sm text-muted-foreground">Billing address: {c.address}</p>}
      <div className="space-y-6">
        <Card className="border-0 shadow-none"><CardHeader className="px-0"><CardTitle>Subscriptions</CardTitle></CardHeader><DataTable columns={subCols} {...subs} emptyTitle="No subscriptions yet" emptyDescription="Create one from a template or from scratch." /></Card>
        <Card className="border-0 shadow-none"><CardHeader className="px-0"><CardTitle>Invoices</CardTitle></CardHeader><DataTable prefix="i" columns={invCols} {...invs} emptyTitle="No invoices yet" emptyDescription="Invoices appear after the first billing run." /></Card>
      </div>
    </>
  );
}
