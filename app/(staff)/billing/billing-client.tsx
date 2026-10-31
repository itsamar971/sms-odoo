"use client";
import { useState } from "react";
import { CheckCircle2, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { useAction } from "@/components/use-action";
import { resetDemoDataAction, runBillingAction } from "@/app/actions/billing";
import type { BillingSummary } from "@/lib/services/billing";

export function RunBillingPanel({ today, dueCount, autoCloseCount }: { today: string; dueCount: number; autoCloseCount: number }) {
  const [asOf, setAsOf] = useState(today);
  const [result, setResult] = useState<BillingSummary | null>(null);
  const { run, pending } = useAction();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Run as of"><Input type="date" value={asOf} max={today} onChange={(e) => setAsOf(e.target.value)} className="w-44" /></Field>
        <Button size="lg" loading={pending} onClick={() => run(() => runBillingAction(asOf), { onSuccess: (d) => setResult(d as BillingSummary) })}>
          <Zap className="h-4 w-4" /> Run Billing Now
        </Button>
        <p className="text-sm text-muted-foreground"><b className="text-foreground">{dueCount.toLocaleString()}</b> subscriptions due today · <b className="text-foreground">{autoCloseCount}</b> to auto-close</p>
      </div>
      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Billing run complete in {result.durationMs} ms</p>
          <div className="mt-3 grid grid-cols-4 gap-3 text-center">
            {([["Created", result.created], ["Skipped (already billed)", result.skipped], ["Failed", result.failed], ["Auto-closed", result.closed]] as const).map(([k, v]) => (
              <div key={k} className="rounded-md bg-white p-2 ring-1 ring-emerald-100">
                <p className="text-xl font-semibold tabular">{v}</p>
                <p className="text-[11px] text-muted-foreground">{k}</p>
              </div>
            ))}
          </div>
          {result.created === 0 && result.failed === 0 && <p className="mt-3 text-xs text-emerald-800">Nothing new to bill — running again is always safe (idempotent).</p>}
          {result.errors.length > 0 && <pre className="mt-3 max-h-32 overflow-auto rounded bg-white p-2 text-xs text-destructive">{result.errors.join("\n")}</pre>}
        </div>
      )}
    </div>
  );
}

export function ResetDemoButton() {
  return (
    <ConfirmButton variant="outline" action={resetDemoDataAction} title="Reset all demo data?" description="Wipes the in-memory database and re-seeds 5,000 subscriptions and ~30,000 invoices. Everything created since start-up is lost." confirmLabel="Reset data">
      <RotateCcw className="h-4 w-4" /> Reset demo data
    </ConfirmButton>
  );
}
