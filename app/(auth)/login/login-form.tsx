"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { loginAction } from "@/app/actions/auth";
import { loginSchema } from "@/lib/validation";

type Demo = Record<"admin" | "internal" | "portal", { email: string; password: string }>;

export function LoginForm({ next, demo }: { next?: string; demo: Demo }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit(e?: React.FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault();
    const values = creds ?? { email, password };
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setPending(true);
    const res = await loginAction({ ...values, next });
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    router.push(res.data!.redirectTo);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Welcome back to Brightloop.</p>
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email}>
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        <Field label="Password" error={errors.password}>
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
        </div>
        <Button className="w-full" loading={pending} type="submit">Sign in</Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        New customer? <Link href="/signup" className="text-primary hover:underline">Create an account</Link>
      </p>
      <div className="rounded-lg border border-dashed bg-muted/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Demo accounts (one click)</p>
        <div className="grid gap-1.5">
          {([["Admin", demo.admin], ["Internal staff", demo.internal], ["Customer portal", demo.portal]] as const).map(([label, c]) => (
            <button
              key={label}
              type="button"
              disabled={pending}
              onClick={() => { setEmail(c.email); setPassword(c.password); submit(undefined, c); }}
              className="flex items-center justify-between rounded-md bg-card px-3 py-2 text-left text-xs ring-1 ring-border hover:ring-primary"
            >
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">{c.email} · {c.password}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
