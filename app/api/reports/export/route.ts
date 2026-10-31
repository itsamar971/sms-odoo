import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { parseReportFilters, reportCsv, type ReportKind } from "@/lib/services/reports";

export const dynamic = "force-dynamic";
const KINDS: ReportKind[] = ["revenue", "invoices", "payments", "overdue", "subscriptions"];

export async function GET(req: Request) {
  const user = getSessionUser();
  if (!user || !can(user.role, "ops:read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("type") as ReportKind;
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  const f = parseReportFilters(Object.fromEntries(url.searchParams));
  const csv = reportCsv(kind, f);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brightloop-${kind}-${f.from}-to-${f.to}.csv"`,
    },
  });
}
