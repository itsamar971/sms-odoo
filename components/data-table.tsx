"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
import { EmptyState } from "./ui/empty";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Serialisable column config so server pages can describe columns. */
export type Column = {
  key: string;
  header: string;
  sortable?: boolean;
  format?: "text" | "money" | "date" | "status" | "number";
  align?: "right";
  /** Link template, e.g. "/invoices/{id}" */
  href?: string;
  /** Secondary muted line under the value */
  sub?: string;
  className?: string;
};

type Row = Record<string, unknown> & { id: string };

function fmt(v: unknown, f: Column["format"]) {
  if (v === null || v === undefined || v === "") return "—";
  switch (f) {
    case "money": return formatMoney(Number(v));
    case "date": return formatDate(String(v));
    case "number": return Number(v).toLocaleString("en-IN");
    case "status": return <StatusBadge status={String(v)} />;
    default: return String(v);
  }
}

export function DataTable({
  columns, rows, total, page, pageCount, sort, dir, emptyTitle = "Nothing found", emptyDescription, prefix = "",
}: {
  columns: Column[]; rows: Row[]; total: number; page: number; pageCount: number; sort: string; dir: "asc" | "desc";
  emptyTitle?: string; emptyDescription?: string;
  /** Prefix for URL params so several tables can live on one page. */
  prefix?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) next.set(prefix + k, v);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const defs: ColumnDef<Row>[] = columns.map((c) => ({
    id: c.key,
    accessorFn: (r) => r[c.key],
    header: () => {
      if (!c.sortable) return c.header;
      const active = sort === c.key;
      const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
      return (
        <button className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
          onClick={() => go({ sort: c.key, dir: active && dir === "desc" ? "asc" : "desc", page: "1" })}>
          {c.header} <Icon className="h-3 w-3" />
        </button>
      );
    },
    cell: ({ row }) => {
      const r = row.original;
      const value = fmt(r[c.key], c.format);
      const content = c.href ? (
        <Link href={c.href.replace(/\{(\w+)\}/g, (_, k) => String(r[k]))} className="font-medium text-primary hover:underline">{value}</Link>
      ) : value;
      return (
        <div>
          {content}
          {c.sub && r[c.sub] ? <div className="text-xs text-muted-foreground">{String(r[c.sub])}</div> : null}
        </div>
      );
    },
  }));

  const table = useReactTable({ data: rows, columns: defs, getCoreRowModel: getCoreRowModel(), manualSorting: true, manualPagination: true, pageCount });

  if (total === 0) return <EmptyState title={emptyTitle} description={emptyDescription ?? "Try adjusting the filters."} />;

  return (
    <Card className={cn("overflow-hidden transition-opacity", isPending && "opacity-60")}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h, i) => (
                  <th key={h.id} className={cn("h-10 whitespace-nowrap px-3 text-left text-xs font-semibold text-muted-foreground", columns[i].align === "right" && "text-right")}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                {r.getVisibleCells().map((cell, i) => (
                  <td key={cell.id} className={cn("px-3 py-2.5", columns[i].align === "right" && "text-right tabular", columns[i].className)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">
          {((page - 1) * 25 + 1).toLocaleString()}–{Math.min(page * 25, total).toLocaleString()} of <b className="text-foreground">{total.toLocaleString()}</b>
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-2 text-muted-foreground">Page {page} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => go({ page: String(page + 1) })}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </Card>
  );
}
