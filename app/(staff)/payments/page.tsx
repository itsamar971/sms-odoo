import { Suspense } from "react";
import { requirePermission } from "@/lib/auth/session";
import { listPayments } from "@/lib/services/queries";
import { customerOptions } from "@/lib/services/lookups";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PAYMENT_METHODS } from "@/lib/db/types";
import type { SearchParams } from "@/lib/list";

const columns: Column[] = [
  { key: "date", header: "Date", sortable: true, format: "date" },
  { key: "invoice", header: "Invoice", sortable: true, href: "/invoices/{invoiceId}" },
  { key: "customer", header: "Customer", sortable: true },
  { key: "method", header: "Method", sortable: true },
  { key: "note", header: "Reference" },
  { key: "recordedBy", header: "Recorded by" },
  { key: "amount", header: "Amount", sortable: true, format: "money", align: "right" },
];

export default function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  requirePermission("ops:read");
  return (
    <>
      <PageHeader title="Payments" description="Payments are recorded against confirmed invoices from the invoice page." />
      <FilterBar
        filters={[
          { type: "select", name: "method", label: "Method", options: PAYMENT_METHODS.map((m) => ({ value: m, label: m.replace("_", " ") })) },
          { type: "select", name: "customer", label: "Customer", options: customerOptions().map((c) => ({ value: c.id, label: c.name })) },
          { type: "date", name: "from", label: "From" },
          { type: "date", name: "to", label: "To" },
        ]}
      />
      <Suspense key={JSON.stringify(searchParams)} fallback={<TableSkeleton />}>
        <Results sp={searchParams} />
      </Suspense>
    </>
  );
}

function Results({ sp }: { sp: SearchParams }) {
  return <DataTable columns={columns} {...listPayments(sp)} emptyTitle="No payments match" />;
}
