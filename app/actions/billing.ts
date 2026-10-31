"use server";
import { guarded } from "@/lib/auth/guard";
import { getDb, resetDb } from "@/lib/db/client";
import { runBilling } from "@/lib/services/billing";
import {
  cancelInvoice, confirmInvoice, deleteCancelledInvoice, markReminded, markSent, regenerateInvoice,
} from "@/lib/services/invoices";
import { recordPayment } from "@/lib/services/payments";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { appUrl, sendMail } from "@/lib/email";
import { formatDate, todayStr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { NotFoundError, ServiceError } from "@/lib/errors";

export async function runBillingAction(asOf?: string) {
  return guarded("billing:run", async (u) => {
    if (asOf && asOf > todayStr()) throw new ServiceError("Billing cannot run for a future date");
    return runBilling({ asOf: asOf || todayStr(), trigger: "MANUAL", userId: u.id });
  });
}

export async function confirmInvoiceAction(id: string) {
  return guarded("ops:write", (u) => void confirmInvoice(id, u.id), "Invoice confirmed");
}
export async function cancelInvoiceAction(id: string) {
  return guarded("ops:write", (u) => void cancelInvoice(id, u.id), "Invoice cancelled");
}
export async function regenerateInvoiceAction(id: string) {
  return guarded("ops:write", (u) => ({ id: regenerateInvoice(id, u.id).id }), "New draft invoice generated for the same period");
}
export async function deleteInvoiceAction(id: string) {
  return guarded("ops:write", () => deleteCancelledInvoice(id), "Cancelled invoice deleted");
}

export async function sendInvoiceAction(id: string) {
  return guarded("ops:write", async () => {
    const db = getDb();
    const inv = db.invoices.get(id);
    if (!inv) throw new NotFoundError("Invoice");
    if (inv.status === "DRAFT" || inv.status === "CANCELLED") throw new ServiceError("Confirm the invoice before sending it");
    const customer = db.customers.get(inv.customerId)!;
    const pdf = await renderInvoicePdf(id);
    await sendMail({
      to: customer.email,
      kind: "invoice",
      subject: `Invoice ${inv.number} from Brightloop — ${formatMoney(inv.total)}`,
      text: `Hi ${customer.name},\n\nPlease find attached invoice ${inv.number} for ${formatMoney(inv.total)}, due ${formatDate(inv.dueDate)}.\nView it any time in your portal: ${appUrl()}/portal/invoices/${inv.id}\n\nThanks,\nBrightloop`,
      html: `<p>Hi ${customer.name},</p><p>Please find attached invoice <b>${inv.number}</b> for <b>${formatMoney(inv.total)}</b>, due ${formatDate(inv.dueDate)}.</p><p><a href="${appUrl()}/portal/invoices/${inv.id}">View in your portal</a></p>`,
      attachments: pdf ? [{ filename: pdf.filename, content: pdf.buffer, contentType: "application/pdf" }] : [],
    });
    markSent(id);
  }, "Invoice emailed to the customer");
}

export async function chaseInvoiceAction(id: string) {
  return guarded("ops:write", async () => {
    const db = getDb();
    const inv = db.invoices.get(id);
    if (!inv) throw new NotFoundError("Invoice");
    if (inv.status !== "CONFIRMED" || inv.amountDue <= 0) throw new ServiceError("Only unpaid confirmed invoices can be chased");
    const customer = db.customers.get(inv.customerId)!;
    await sendMail({
      to: customer.email,
      kind: "reminder",
      subject: `Payment reminder: ${inv.number} (${formatMoney(inv.amountDue)} due)`,
      text: `Hi ${customer.name},\n\nInvoice ${inv.number} had a due date of ${formatDate(inv.dueDate)} and ${formatMoney(inv.amountDue)} is still outstanding.\nPay or download it here: ${appUrl()}/portal/invoices/${inv.id}\n\nThank you,\nBrightloop Accounts`,
      html: `<p>Hi ${customer.name},</p><p>Invoice <b>${inv.number}</b> was due on ${formatDate(inv.dueDate)} and <b>${formatMoney(inv.amountDue)}</b> is still outstanding.</p><p><a href="${appUrl()}/portal/invoices/${inv.id}">Pay or download it here</a>.</p>`,
    });
    markReminded(id);
  }, "Reminder sent");
}

export async function recordPaymentAction(input: unknown) {
  return guarded("ops:write", (u) => {
    const r = recordPayment(input as never, u.id);
    return { status: r.invoice.status, amountDue: r.invoice.amountDue };
  });
}

export async function resetDemoDataAction() {
  return guarded("demo:reset", () => {
    const db = getDb();
    const sessions = db.sessions.all().slice();
    const fresh = resetDb();
    // Keep everyone signed in where the user still exists (same emails in the fresh seed).
    for (const s of sessions) {
      const old = db.users.get(s.userId);
      const nu = old && fresh.users.byUnique("email", old.email.toLowerCase());
      if (nu) fresh.sessions.insert({ ...s, userId: nu.id });
    }
  }, "Demo data reset — fresh seed loaded");
}
