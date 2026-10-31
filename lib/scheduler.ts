import { getDb } from "./db/client";
import { todayStr } from "./dates";
import { runBilling } from "./services/billing";

const g = globalThis as unknown as { __blScheduler?: NodeJS.Timeout };

/** In-process daily job: runs billing + auto-close once per day (checked hourly). */
export function startScheduler() {
  if (g.__blScheduler || process.env.DISABLE_SCHEDULER === "1") return;
  const tick = async () => {
    const db = getDb();
    const today = todayStr();
    if (db.meta.lastScheduledRun === today || db.meta.billingRunning) return;
    db.meta.lastScheduledRun = today;
    try {
      const r = await runBilling({ asOf: today, trigger: "SCHEDULER" });
      console.log(`[scheduler] billing ${today}: created=${r.created} skipped=${r.skipped} failed=${r.failed} closed=${r.closed}`);
    } catch (e) {
      console.error("[scheduler] billing failed", e);
    }
  };
  g.__blScheduler = setInterval(tick, 60 * 60 * 1000);
  // First tick after start-up, not at boot, so the demo still shows due subscriptions for "Run Billing Now".
}
