"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "./ui/input";
import { Button } from "./ui/button";

export type Filter =
  | { type: "search"; name: string; placeholder?: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { type: "date"; name: string; label: string };

/** URL-driven filters: every change resets to page 1 and re-renders the server page. */
export function FilterBar({ filters, children }: { filters: Filter[]; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const searchName = filters.find((f) => f.type === "search")?.name;
  const [q, setQ] = useState(searchName ? sp.get(searchName) ?? "" : "");
  useEffect(() => setQ(searchName ? sp.get(searchName) ?? "" : ""), [sp, searchName]);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  const active = filters.some((f) => sp.get(f.name));

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2">
      {filters.map((f) => {
        if (f.type === "search")
          return (
            <form key={f.name} onSubmit={(e) => { e.preventDefault(); set({ [f.name]: q }); }} className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q !== (sp.get(f.name) ?? "") && set({ [f.name]: q })} placeholder={f.placeholder ?? "Search…"} className="w-64 pl-8" />
            </form>
          );
        if (f.type === "select")
          return (
            <label key={f.name} className="space-y-1 text-[11px] font-medium text-muted-foreground">
              <span className="block">{f.label}</span>
              <Select value={sp.get(f.name) ?? ""} onChange={(e) => set({ [f.name]: e.target.value })} className="w-auto min-w-[140px] text-foreground">
                <option value="">All</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </label>
          );
        return (
          <label key={f.name} className="space-y-1 text-[11px] font-medium text-muted-foreground">
            <span className="block">{f.label}</span>
            <Input type="date" value={sp.get(f.name) ?? ""} onChange={(e) => set({ [f.name]: e.target.value })} className="w-40 text-foreground" />
          </label>
        );
      })}
      {active && (
        <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(filters.map((f) => [f.name, ""])))}>
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
      <div className="ml-auto flex gap-2">{children}</div>
    </div>
  );
}
