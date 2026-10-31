import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listSubscriptions } from "@/lib/services/queries";
import { customerOptions, planOptions } from "@/lib/services/lookups";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { TableSkeleton } from "@/components/ui/skeleton";
import { buttonClass } from "@/components/ui/button";
import { SUBSCRIPTION_STATUSES } from "@/lib/db/types";
import type { SearchParams } from "@/lib/list";

const columns: Column[] = [
  { key: "number", header: "Number", sortable: true, href: "/subscriptions/{id}" },
  { key: "customer", header: "Customer", sortable: true, sub: "customerEmail" },
  { key: "plan", header: "Plan", sortable: true },
  { key: "status", header: "Status", sortable: true, format: "status" },
  { key: "startDate", header: "Start", sortable: true, format: "date" },
  { key: "nextInvoiceDate", header: "Next invoice", sortable: true, format: "date" },
  { key: "amount", header: "Recurring", sortable: true, format: "money", align: "right" },
];

export default function SubscriptionsPage({ searchParams }: { searchParams: SearchParams }) {
  requirePermission("ops:read");
  const db = getDb();
  const counts = Object.fromEntries(SUBSCRIPTION_STATUSES.map((s) => [s, db.subscriptions.by("status", s).length]));
  return (
    <>
      <PageHeader
        title="Subscriptions"
        description={`${db.subscriptions.size.toLocaleString()} total · ${counts.ACTIVE.toLocaleString()} active`}
        actions={<>
          <Link href="/templates" className={buttonClass("outline")}>From template</Link>
          <Link href="/subscriptions/new" className={buttonClass()}><Plus className="h-4 w-4" /> New subscription</Link>
        </>}
      />
      <FilterBar
        filters={[
          { type: "search", name: "q", placeholder: "Search SUB/2026/…" },
          { type: "select", name: "status", label: "Status", options: SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: `${s.charAt(0) + s.slice(1).toLowerCase()} (${counts[s]})` })) },
          { type: "select", name: "plan", label: "Plan", options: planOptions(true).map((p) => ({ value: p.id, label: p.name })) },
          { type: "select", name: "customer", label: "Customer", options: customerOptions().map((c) => ({ value: c.id, label: c.name })) },
          { type: "date", name: "from", label: "Start from" },
          { type: "date", name: "to", label: "Start to" },
        ]}
      />
      <Suspense key={JSON.stringify(searchParams)} fallback={<TableSkeleton />}>
        <Results sp={searchParams} />
      </Suspense>
    </>
  );
}

function Results({ sp }: { sp: SearchParams }) {
  return <DataTable columns={columns} {...listSubscriptions(sp)} emptyTitle="No subscriptions match" />;
}
