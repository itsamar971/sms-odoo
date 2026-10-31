"use client";
import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/services/password";

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="grid grid-cols-2 gap-1 text-xs">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.label} className={ok ? "flex items-center gap-1 text-emerald-600" : "flex items-center gap-1 text-muted-foreground"}>
            {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {r.label}
          </li>
        );
      })}
    </ul>
  );
}
