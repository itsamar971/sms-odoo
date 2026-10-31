import { describe, expect, it } from "vitest";
import { Database } from "@/lib/db/database";
import { setDb } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";
import { runBilling } from "@/lib/services/billing";

describe("seed", () => {
  it("generates 5,000 subscriptions and ~30,000 invoices, and billing stays idempotent", async () => {
    const db = setDb(new Database());
    const t0 = Date.now();
    seedDatabase(db, { today: "2026-10-31" });
    const ms = Date.now() - t0;
    console.log(`seed: ${db.subscriptions.size} subs, ${db.invoices.size} invoices, ${db.payments.size} payments in ${ms}ms`);
    expect(db.subscriptions.size).toBe(5000);
    expect(db.invoices.size).toBeGreaterThan(20000);
    const r1 = await runBilling({ asOf: "2026-10-31" });
    const r2 = await runBilling({ asOf: "2026-10-31" });
    console.log("run1", r1, "run2", r2);
    expect(r2.created).toBe(0);
  }, 60_000);
});
