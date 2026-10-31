import Link from "next/link";
import { Repeat } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { Sidebar, type NavItem } from "@/components/sidebar";
import { UserMenu } from "@/components/user-menu";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = requirePermission("ops:read");
  const isAdmin = user.role === "ADMIN";
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard", section: "Overview" },
    { href: "/reports", label: "Reports", icon: "reports", section: "Overview" },
    { href: "/customers", label: "Customers", icon: "customers", section: "Sales" },
    { href: "/subscriptions", label: "Subscriptions", icon: "subscriptions", section: "Sales" },
    { href: "/invoices", label: "Invoices", icon: "invoices", section: "Billing" },
    { href: "/payments", label: "Payments", icon: "payments", section: "Billing" },
    { href: "/billing", label: "Billing runs", icon: "billing", section: "Billing" },
    { href: "/products", label: "Products", icon: "products", section: "Configuration", readOnly: !isAdmin },
    { href: "/plans", label: "Recurring plans", icon: "plans", section: "Configuration", readOnly: !isAdmin },
    { href: "/templates", label: "Quotation templates", icon: "templates", section: "Configuration", readOnly: !isAdmin },
    { href: "/taxes", label: "Taxes", icon: "taxes", section: "Configuration", readOnly: !isAdmin },
    { href: "/discounts", label: "Discounts", icon: "discounts", section: "Configuration", readOnly: !isAdmin },
    ...(isAdmin ? [{ href: "/users", label: "Users", icon: "users", section: "Configuration" } as NavItem] : []),
  ];
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto bg-slate-900 px-3 py-5 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-3 text-base font-semibold text-white">
          <span className="rounded-md bg-indigo-500 p-1"><Repeat className="h-4 w-4" /></span> Brightloop
        </Link>
        <Sidebar items={items} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/90 px-6 backdrop-blur">
          <span className="text-sm text-muted-foreground">Subscription Management System</span>
          <UserMenu user={user} />
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
