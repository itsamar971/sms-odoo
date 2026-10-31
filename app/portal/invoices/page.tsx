import { requirePermission } from "@/lib/auth/session";
import { listInvoices } from "@/lib/services/queries";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import type { SearchParams } from "@/lib/list";

const columns: Column[] = [
  { key: "number", header: "Invoice", sortable: true, href: "/portal/invoices/{id}" },
  { key: "invoiceDate", header: "Date", sortable: true, format: "date" },
  { key: "dueDate", header: "Due", sortable: true, format: "date" },
  { key: "status", header: "Status", format: "status" },
  { key: "total", header: "Total", sortable: true, format: "money", align: "right" },
  { key: "amountDue", header: "Amount due", sortable: true, format: "money", align: "right" },
];

export default function PortalInvoices({ searchParams }: { searchParams: SearchParams }) {
  const user = requirePermission("portal");
  // Customers never see draft invoices; scope is enforced server-side by customerId.
  const page = listInvoices(searchParams, { customerId: user.customerId!, excludeDraft: true });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Invoices</h1>
      <FilterBar filters={[{ type: "select", name: "status", label: "Status", options: ["CONFIRMED", "OVERDUE", "PAID"].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })) }, { type: "date", name: "from", label: "From" }, { type: "date", name: "to", label: "To" }]} />
      <DataTable columns={columns} {...page} emptyTitle="No invoices" />
    </div>
  );
}
