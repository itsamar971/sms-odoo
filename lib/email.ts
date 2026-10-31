import nodemailer from "nodemailer";
import { getDb } from "./db/client";
import { newId } from "./db/database";

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  kind: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

let transporter: nodemailer.Transporter | null = null;

export function smtpConfigured() {
  return !!process.env.SMTP_HOST;
}

/** Sends via SMTP when configured; otherwise logs the email (and links) to the server console. */
export async function sendMail(mail: MailInput): Promise<{ delivered: boolean }> {
  getDb().emails.insert({ id: newId(), to: mail.to, subject: mail.subject, kind: mail.kind, at: new Date() });
  if (!smtpConfigured()) {
    console.log(
      `\n[email:${mail.kind}] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text ?? mail.html.replace(/<[^>]+>/g, " ")}\n` +
        (mail.attachments?.length ? `Attachments: ${mail.attachments.map((a) => a.filename).join(", ")}\n` : ""),
    );
    return { delivered: false };
  }
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? "Brightloop <billing@brightloop.com>",
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: mail.attachments,
  });
  return { delivered: true };
}

export function appUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}
