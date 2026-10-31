import Link from "next/link";
import { Repeat } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { UserMenu } from "@/components/user-menu";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = requirePermission("portal");
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/portal" className="flex items-center gap-2 font-semibold">
              <span className="rounded-md bg-primary p-1 text-white"><Repeat className="h-4 w-4" /></span> Brightloop
            </Link>
            <nav className="hidden gap-4 text-sm text-muted-foreground sm:flex">
              <Link href="/portal" className="hover:text-foreground">Overview</Link>
              <Link href="/portal/invoices" className="hover:text-foreground">Invoices</Link>
              <Link href="/portal/payments" className="hover:text-foreground">Payments</Link>
            </nav>
          </div>
          <UserMenu user={user} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
