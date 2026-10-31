import { z } from "zod";
import { getDb } from "../db/client";
import { newId } from "../db/database";
import { D, round2 } from "../money";
import { NotFoundError, ServiceError } from "../errors";
import { paymentSchema } from "../validation";
import { logStatus } from "./history";
import type { Invoice, Payment } from "../db/types";

export type PaymentInput = z.input<typeof paymentSchema>;

/**
 * Record a payment against a CONFIRMED invoice. Partial payments allowed, overpayment blocked.
 * amountPaid/amountDue update atomically; when amountDue reaches 0 the invoice becomes PAID.
 */
export function recordPayment(raw: PaymentInput, userId: string | null): { payment: Payment; invoice: Invoice } {
  const input = paymentSchema.parse(raw);
  const db = getDb();
  return db.transaction(() => {
    const inv = db.invoices.get(input.invoiceId);
    if (!inv) throw new NotFoundError("Invoice");
    if (inv.status !== "CONFIRMED")
      throw new ServiceError(
        inv.status === "PAID" ? "This invoice is already fully paid" : "Payments can only be recorded against confirmed invoices",
      );
    const amount = round2(input.amount);
    if (amount <= 0) throw new ServiceError("Amount must be greater than 0");
    if (D(amount).greaterThan(inv.amountDue))
      throw new ServiceError(`Overpayment blocked: only ${inv.amountDue.toFixed(2)} is due on ${inv.number}`);

    const payment: Payment = {
      id: newId(),
      invoiceId: inv.id,
      customerId: inv.customerId,
      method: input.method,
      amount,
      date: input.date,
      note: input.note,
      recordedById: userId,
      createdAt: new Date(),
    };
    db.payments.insert(payment);
    const amountPaid = round2(D(inv.amountPaid).plus(amount));
    const amountDue = round2(D(inv.total).minus(amountPaid));
    const status = amountDue <= 0 ? "PAID" : inv.status;
    const invoice = db.invoices.update(inv.id, { amountPaid, amountDue: Math.max(0, amountDue), status });
    if (status === "PAID") logStatus("INVOICE", inv.id, "CONFIRMED", "PAID", userId, "Fully paid");
    return { payment, invoice };
  });
}
