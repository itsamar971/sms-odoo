"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordRules } from "@/components/password-rules";
import { resetPasswordAction } from "@/app/actions/auth";
import { resetSchema } from "@/lib/validation";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = resetSchema.safeParse({ token, password, confirmPassword });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    setPending(true);
    const res = await resetPasswordAction({ token, password, confirmPassword });
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message);
    router.push("/login");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="New password" error={errors.password}><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <PasswordRules value={password} />
        <Field label="Confirm password" error={errors.confirmPassword}><Input type="password" value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <Button className="w-full" loading={pending} type="submit">Update password</Button>
      </form>
    </div>
  );
}
