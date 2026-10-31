import { Suspense } from "react";
import { requirePermission } from "@/lib/auth/session";
import { listInvoices } from "@/lib/services/queries";
import { customerOptions } from "@/lib/services/lookups";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { TableSkeleton } from "@/components/ui/skeleton";
import { buttonClass } from "@/components/ui/button";
import Link from "next/link";
import type { SearchParams } from "@/lib/list";

const columns: Column[] = [
  { key: "number", header: "Invoice", sortable: true, href: "/invoices/{id}", sub: "subscription" },
  { key: "customer", header: "Customer", sortable: true },
  { key: "invoiceDate", header: "Date", sortable: true, format: "date" },
  { key: "dueDate", header: "Due", sortable: true, format: "date" },
  { key: "status", header: "Status", sortable: true, format: "status" },
  { key: "total", header: "Total", sortable: true, format: "money", align: "right" },
  { key: "amountDue", header: "Amount due", sortable: true, format: "money", align: "right" },
];

export default function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  requirePermission("ops:read");
  return (
    <>
      <PageHeader title="Invoices" description="Draft → Confirmed → Paid. Overdue is computed live from the due date." actions={<Link href="/billing" className={buttonClass()}>Run billing</Link>} />
      <FilterBar
        filters={[
          { type: "search", name: "q", placeholder: "Search INV/2026/…" },
          { type: "select", name: "status", label: "Status", options: ["DRAFT", "CONFIRMED", "OVERDUE", "PAID", "CANCELLED"].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })) },
          { type: "select", name: "customer", label: "Customer", options: customerOptions().map((c) => ({ value: c.id, label: c.name })) },
          { type: "date", name: "from", label: "Invoice date from" },
          { type: "date", name: "to", label: "Invoice date to" },
        ]}
      />
      <Suspense key={JSON.stringify(searchParams)} fallback={<TableSkeleton />}>
        <Results sp={searchParams} />
      </Suspense>
    </>
  );
}

function Results({ sp }: { sp: SearchParams }) {
  return <DataTable columns={columns} {...listInvoices(sp)} emptyTitle="No invoices match" />;
}
