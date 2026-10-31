import { requirePermission } from "@/lib/auth/session";
import { listPayments } from "@/lib/services/queries";
import { DataTable, type Column } from "@/components/data-table";

const columns: Column[] = [
  { key: "date", header: "Date", sortable: true, format: "date" },
  { key: "invoice", header: "Invoice", href: "/portal/invoices/{invoiceId}" },
  { key: "method", header: "Method" },
  { key: "note", header: "Reference" },
  { key: "amount", header: "Amount", sortable: true, format: "money", align: "right" },
];

export default function PortalPayments({ searchParams }: { searchParams: Record<string, string> }) {
  const user = requirePermission("portal");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Payment history</h1>
      <DataTable columns={columns} {...listPayments(searchParams, { customerId: user.customerId! })} emptyTitle="No payments yet" />
    </div>
  );
}
