import { Suspense } from "react";
import { requirePermission } from "@/lib/auth/session";
import { listCustomers } from "@/lib/services/queries";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { TableSkeleton } from "@/components/ui/skeleton";
import { CustomerDialog } from "./customer-dialog";
import type { SearchParams } from "@/lib/list";

const columns: Column[] = [
  { key: "name", header: "Customer", sortable: true, href: "/customers/{id}", sub: "email" },
  { key: "phone", header: "Phone" },
  { key: "gstin", header: "GSTIN" },
  { key: "activeSubs", header: "Active subs", sortable: true, align: "right", format: "number" },
  { key: "outstanding", header: "Outstanding", sortable: true, align: "right", format: "money" },
];

export default function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  requirePermission("ops:read");
  return (
    <>
      <PageHeader title="Customers" description="Companies and people you bill." actions={<CustomerDialog />} />
      <FilterBar filters={[{ type: "search", name: "q", placeholder: "Name, email or GSTIN" }]} />
      <Suspense key={JSON.stringify(searchParams)} fallback={<TableSkeleton />}>
        <Results sp={searchParams} />
      </Suspense>
    </>
  );
}

function Results({ sp }: { sp: SearchParams }) {
  const page = listCustomers(sp);
  return <DataTable columns={columns} {...page} emptyTitle="No customers found" />;
}
