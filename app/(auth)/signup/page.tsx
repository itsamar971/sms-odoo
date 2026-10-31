"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordRules } from "@/components/password-rules";
import { signupAction } from "@/app/actions/auth";
import { signupSchema } from "@/lib/validation";

export default function SignupPage() {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse(v);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    setPending(true);
    const res = await signupAction(v);
    setPending(false);
    if (!res.ok) {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      return void toast.error(res.error);
    }
    toast.success(res.message ?? "Account created");
    router.push(res.data!.redirectTo);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">Manage your subscriptions, invoices and payments.</p>
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Company or full name" error={errors.name}><Input value={v.name} onChange={set("name")} /></Field>
        <Field label="Email" error={errors.email}><Input type="email" value={v.email} onChange={set("email")} /></Field>
        <Field label="Phone (optional)" error={errors.phone}><Input value={v.phone} onChange={set("phone")} /></Field>
        <Field label="Password" error={errors.password}><Input type="password" autoComplete="new-password" value={v.password} onChange={set("password")} /></Field>
        <PasswordRules value={v.password} />
        <Field label="Confirm password" error={errors.confirmPassword}><Input type="password" autoComplete="new-password" value={v.confirmPassword} onChange={set("confirmPassword")} /></Field>
        <Button className="w-full" loading={pending} type="submit">Create account</Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
