import { Repeat } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-10 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="rounded-lg bg-white/15 p-1.5"><Repeat className="h-5 w-5" /></span> Brightloop
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight">Recurring revenue,<br />on autopilot.</h1>
          <p className="max-w-md text-indigo-100">
            Plans, quotations, subscriptions, idempotent billing, invoices, payments and a self-service customer portal — in one place.
          </p>
          <div className="grid max-w-md grid-cols-3 gap-3 pt-4 text-sm">
            {[["5,000", "subscriptions"], ["30k", "invoices"], ["< 2s", "page loads"]].map(([v, l]) => (
              <div key={l} className="rounded-lg bg-white/10 p-3">
                <div className="text-xl font-semibold">{v}</div>
                <div className="text-indigo-200">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-indigo-200">© {new Date().getFullYear()} Brightloop SMS</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
