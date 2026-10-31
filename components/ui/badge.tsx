import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export const STATUS_TONE: Record<string, keyof typeof tones> = {
  DRAFT: "gray",
  QUOTATION: "violet",
  CONFIRMED: "blue",
  ACTIVE: "green",
  PAUSED: "amber",
  CLOSED: "gray",
  PAID: "green",
  CANCELLED: "gray",
  OVERDUE: "red",
  ADMIN: "indigo",
  INTERNAL: "blue",
  PORTAL: "gray",
  EXPIRED: "red",
};

export function Badge({ tone = "gray", className, children }: { tone?: keyof typeof tones; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ")}</Badge>;
}
