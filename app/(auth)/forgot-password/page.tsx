"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { forgotPasswordAction } from "@/app/actions/auth";
import { forgotSchema } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = forgotSchema.safeParse({ email });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(undefined);
    setPending(true);
    const res = await forgotPasswordAction({ email });
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    setSent(true);
    setDevLink(res.data?.devLink);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <p className="text-sm text-muted-foreground">We will email you a single-use link, valid for 30 minutes.</p>
      </div>
      {sent ? (
        <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
          <p>If an account exists for <b>{email}</b>, a reset link has been sent.</p>
          {devLink && (
            <div className="rounded-md bg-amber-50 p-3 text-amber-900 ring-1 ring-amber-200">
              <p className="text-xs font-semibold">Dev mode (no SMTP configured) — link also logged to the server console:</p>
              <Link href={devLink} className="break-all text-xs text-primary underline">{devLink}</Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" error={error}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button className="w-full" loading={pending} type="submit">Send reset link</Button>
        </form>
      )}
      <p className="text-center text-sm"><Link href="/login" className="text-primary hover:underline">Back to sign in</Link></p>
    </div>
  );
}
