import Link from "next/link";
import { checkResetToken } from "@/lib/services/auth";
import { ResetForm } from "./reset-form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  const check = checkResetToken(params.token);
  if (!check.ok)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Link not valid</h1>
        <p className="text-sm text-muted-foreground">{check.reason}. Request a new one.</p>
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">Request a new link</Link>
      </div>
    );
  return <ResetForm token={params.token} />;
}
