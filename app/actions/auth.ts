"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession } from "@/lib/auth/session";
import { errorResult, toResult } from "@/lib/auth/guard";
import { homeFor } from "@/lib/auth/rbac";
import { authenticate, createPasswordResetToken, resetPassword, signup } from "@/lib/services/auth";
import { forgotSchema, loginSchema, resetSchema, signupSchema } from "@/lib/validation";
import { appUrl, sendMail, smtpConfigured } from "@/lib/email";
import type { ActionResult } from "@/lib/action-result";

function safeNext(next: unknown, fallback: string) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export async function loginAction(raw: z.input<typeof loginSchema> & { next?: string }): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const input = loginSchema.parse(raw);
    const user = await authenticate(input.email, input.password);
    if (!user) return { ok: false, error: "Invalid email or password" };
    createSession(user.id);
    const home = homeFor(user.role);
    const next = safeNext(raw.next, home);
    // Never send a portal user into staff pages (or vice versa).
    const redirectTo = user.role === "PORTAL" ? (next.startsWith("/portal") ? next : home) : next.startsWith("/portal") ? home : next;
    return { ok: true, data: { redirectTo } };
  } catch (e) {
    return errorResult(e);
  }
}

export async function signupAction(raw: z.input<typeof signupSchema>): Promise<ActionResult<{ redirectTo: string }>> {
  return toResult(async () => {
    const user = await signup(raw);
    createSession(user.id);
    return { redirectTo: "/portal" };
  }, "Welcome to Brightloop!");
}

export async function forgotPasswordAction(raw: z.input<typeof forgotSchema>): Promise<ActionResult<{ devLink?: string }>> {
  return toResult(async () => {
    const { email } = forgotSchema.parse(raw);
    const created = createPasswordResetToken(email);
    let devLink: string | undefined;
    if (created) {
      const link = `${appUrl()}/reset-password/${created.token}`;
      await sendMail({
        to: created.user.email,
        kind: "password-reset",
        subject: "Reset your Brightloop password",
        text: `Hi ${created.user.name},\n\nReset your password using this link (valid for 30 minutes, single use):\n${link}\n\nIf you did not request this, ignore this email.`,
        html: `<p>Hi ${created.user.name},</p><p>Reset your password using <a href="${link}">this link</a>. It is valid for 30 minutes and can be used once.</p>`,
      });
      if (!smtpConfigured()) devLink = `/reset-password/${created.token}`;
    }
    // Same response whether or not the email exists (no account enumeration).
    return { devLink };
  }, "If that email has an account, a reset link is on its way.");
}

export async function resetPasswordAction(raw: z.input<typeof resetSchema>): Promise<ActionResult> {
  return toResult(() => resetPassword(raw).then(() => undefined), "Password updated. Please sign in.");
}

export async function logoutAction() {
  destroySession();
  redirect("/login");
}
