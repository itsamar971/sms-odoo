import { Check, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBSCRIPTION_STEPS } from "@/lib/services/state-machine";
import type { SubscriptionStatus } from "@/lib/db/types";

export function StatusStepper({ status }: { status: SubscriptionStatus }) {
  const effective = status === "PAUSED" ? "ACTIVE" : status;
  const idx = SUBSCRIPTION_STEPS.indexOf(effective);
  return (
    <ol className="flex w-full items-center">
      {SUBSCRIPTION_STEPS.map((s, i) => {
        const done = i < idx || (status === "CLOSED" && i === idx);
        const current = i === idx && status !== "CLOSED";
        const paused = status === "PAUSED" && s === "ACTIVE";
        return (
          <li key={s} className={cn("flex items-center", i < SUBSCRIPTION_STEPS.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center gap-1">
              <span className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold",
                done && "border-primary bg-primary text-white",
                current && !paused && "border-primary bg-accent text-primary",
                paused && "border-amber-500 bg-amber-50 text-amber-600",
                !done && !current && "border-border text-muted-foreground",
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : paused ? <Pause className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("text-[11px] font-medium", current || done ? "text-foreground" : "text-muted-foreground")}>
                {paused ? "Paused" : s.charAt(0) + s.slice(1).toLowerCase()}
              </span>
            </div>
            {i < SUBSCRIPTION_STEPS.length - 1 && <div className={cn("mx-2 mb-5 h-0.5 flex-1", i < idx ? "bg-primary" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}
