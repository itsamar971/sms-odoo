import { describe, expect, it } from "vitest";
import { makeFixture } from "./helpers";
import { runBilling } from "@/lib/services/billing";
import { confirmInvoice, isOverdue } from "@/lib/services/invoices";
import { recordPayment } from "@/lib/services/payments";

async function confirmedInvoice() {
  const f = makeFixture();
  f.addSubscription();
  await runBilling({ asOf: "2026-01-15" });
  const inv = f.db.invoices.all()[0];
  return { ...f, inv };
}

describe("payments", () => {
  it("rejects payments on DRAFT invoices", async () => {
    const { inv } = await confirmedInvoice();
    expect(() => recordPayment({ invoiceId: inv.id, method: "CASH", amount: 10, date: "2026-01-20" }, null)).toThrow(/confirmed/);
  });

  it("partial payment keeps CONFIRMED, final payment flips to PAID", async () => {
    const { db, inv, admin } = await confirmedInvoice();
    confirmInvoice(inv.id, admin.id);
    expect(inv.total).toBe(118);
    const r1 = recordPayment({ invoiceId: inv.id, method: "UPI", amount: 50, date: "2026-01-20" }, admin.id);
    expect(r1.invoice.status).toBe("CONFIRMED");
    expect(r1.invoice.amountPaid).toBe(50);
    expect(r1.invoice.amountDue).toBe(68);
    const r2 = recordPayment({ invoiceId: inv.id, method: "CARD", amount: 68, date: "2026-01-21" }, admin.id);
    expect(r2.invoice.status).toBe("PAID");
    expect(r2.invoice.amountDue).toBe(0);
    expect(db.payments.by("invoiceId", inv.id)).toHaveLength(2);
  });

  it("blocks overpayment and leaves the invoice untouched", async () => {
    const { db, inv, admin } = await confirmedInvoice();
    confirmInvoice(inv.id, admin.id);
    expect(() => recordPayment({ invoiceId: inv.id, method: "CASH", amount: 118.01, date: "2026-01-20" }, admin.id)).toThrow(/Overpayment/);
    expect(db.invoices.get(inv.id)!.amountPaid).toBe(0);
    expect(db.payments.size).toBe(0);
  });

  it("overdue is computed from status, amountDue and dueDate", async () => {
    const { db, inv, admin } = await confirmedInvoice();
    confirmInvoice(inv.id, admin.id);
    const fresh = db.invoices.get(inv.id)!;
    expect(fresh.dueDate).toBe("2026-01-30"); // NET15
    expect(isOverdue(fresh, "2026-01-30")).toBe(false);
    expect(isOverdue(fresh, "2026-01-31")).toBe(true);
    recordPayment({ invoiceId: inv.id, method: "CASH", amount: 118, date: "2026-02-01" }, admin.id);
    expect(isOverdue(db.invoices.get(inv.id)!, "2026-02-05")).toBe(false);
  });
});
