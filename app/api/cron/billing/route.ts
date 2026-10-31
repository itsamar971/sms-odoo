import { NextResponse } from "next/server";
import { runBilling } from "@/lib/services/billing";
import { todayStr } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Protected endpoint for an external scheduler (e.g. Vercel Cron / GitHub Actions / crontab + curl). */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET ?? "dev-cron-secret";
  const given = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer /, "") ?? new URL(req.url).searchParams.get("secret");
  if (given !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const summary = await runBilling({ asOf: todayStr(), trigger: "CRON" });
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 409 });
  }
}

export const GET = handle;
export const POST = handle;
