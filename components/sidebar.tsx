"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Boxes, CalendarClock, CreditCard, FileText, LayoutDashboard, LayoutTemplate, Percent, Receipt,
  Repeat, ScrollText, Tag, Users, UserCog, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard, customers: Users, subscriptions: Repeat, invoices: FileText, payments: CreditCard,
  billing: Zap, reports: BarChart3, products: Boxes, plans: CalendarClock, taxes: Receipt, discounts: Percent,
  templates: LayoutTemplate, users: UserCog, portal: ScrollText, tag: Tag,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; section: string; readOnly?: boolean };

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const sections = Array.from(new Set(items.map((i) => i.section)));
  return (
    <nav className="space-y-5">
      {sections.map((s) => (
        <div key={s}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s}</p>
          <ul className="space-y-0.5">
            {items.filter((i) => i.section === s).map((i) => {
              const Icon = ICONS[i.icon];
              const active = pathname === i.href || pathname.startsWith(i.href + "/");
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                      active ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{i.label}</span>
                    {i.readOnly && <span className="rounded bg-white/10 px-1 text-[9px] uppercase text-slate-400">view</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
