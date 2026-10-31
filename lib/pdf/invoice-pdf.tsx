import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { getDb } from "../db/client";
import { formatDate, todayStr } from "../dates";
import { isOverdue } from "../services/invoices";

// Built-in Helvetica has no ₹ glyph, so the PDF uses "Rs.".
const money = (n: number) => `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, fontFamily: "Helvetica", color: "#0f172a" },
  row: { flexDirection: "row" },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#4f46e5" },
  muted: { color: "#64748b" },
  h: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "right" },
  box: { marginTop: 24, flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 8, color: "#64748b", textTransform: "uppercase", marginBottom: 3 },
  th: { flexDirection: "row", borderBottom: "1 solid #cbd5e1", paddingBottom: 5, marginTop: 24, fontFamily: "Helvetica-Bold", fontSize: 8.5, color: "#475569" },
  tr: { flexDirection: "row", borderBottom: "0.5 solid #e2e8f0", paddingVertical: 6 },
  c1: { flex: 4 }, c2: { flex: 1, textAlign: "right" }, c3: { flex: 1.6, textAlign: "right" }, c4: { flex: 1.4, textAlign: "right" }, c5: { flex: 1.4, textAlign: "right" }, c6: { flex: 1.7, textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 220 },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTop: "1 solid #0f172a", marginTop: 4, paddingTop: 5, fontFamily: "Helvetica-Bold", fontSize: 11 },
  stamp: { marginTop: 6, alignSelf: "flex-end", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 3, fontFamily: "Helvetica-Bold", fontSize: 9 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", color: "#94a3b8", fontSize: 8 },
});

export async function renderInvoicePdf(invoiceId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const db = getDb();
  const inv = db.invoices.get(invoiceId);
  if (!inv) return null;
  const customer = db.customers.get(inv.customerId);
  const sub = db.subscriptions.get(inv.subscriptionId);
  const lines = db.invoiceLines.by("invoiceId", inv.id);
  const overdue = isOverdue(inv, todayStr());
  const stamp = overdue ? { t: "OVERDUE", bg: "#fee2e2", c: "#b91c1c" } : inv.status === "PAID" ? { t: "PAID", bg: "#d1fae5", c: "#047857" } : inv.status === "CANCELLED" ? { t: "CANCELLED", bg: "#e2e8f0", c: "#475569" } : inv.status === "DRAFT" ? { t: "DRAFT", bg: "#f1f5f9", c: "#475569" } : { t: "DUE", bg: "#dbeafe", c: "#1d4ed8" };

  const doc = (
    <Document title={inv.number} author="Brightloop">
      <Page size="A4" style={s.page}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <View>
            <Text style={s.brand}>Brightloop</Text>
            <Text style={s.muted}>Brightloop Software Pvt Ltd</Text>
            <Text style={s.muted}>4th Floor, Koramangala, Bengaluru 560034</Text>
            <Text style={s.muted}>GSTIN 29AAKCB1234F1Z5</Text>
          </View>
          <View>
            <Text style={s.h}>TAX INVOICE</Text>
            <Text style={{ textAlign: "right", fontFamily: "Helvetica-Bold", marginTop: 4 }}>{inv.number}</Text>
            <Text style={[s.stamp, { backgroundColor: stamp.bg, color: stamp.c }]}>{stamp.t}</Text>
          </View>
        </View>
        <View style={s.box}>
          <View style={{ width: "50%" }}>
            <Text style={s.label}>Bill to</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{customer?.name}</Text>
            <Text style={s.muted}>{customer?.address}</Text>
            <Text style={s.muted}>{customer?.email}</Text>
            {customer?.gstin ? <Text style={s.muted}>GSTIN {customer.gstin}</Text> : null}
          </View>
          <View style={{ width: "40%" }}>
            {[["Invoice date", formatDate(inv.invoiceDate)], ["Due date", formatDate(inv.dueDate)], ["Service period", `${formatDate(inv.periodStart)} - ${formatDate(inv.periodEnd)}`], ["Subscription", sub?.number ?? ""]].map(([k, v]) => (
              <View key={k} style={s.tRow}><Text style={s.muted}>{k}</Text><Text>{v}</Text></View>
            ))}
          </View>
        </View>
        <View style={s.th}>
          <Text style={s.c1}>Description</Text><Text style={s.c2}>Qty</Text><Text style={s.c3}>Unit price</Text><Text style={s.c4}>Discount</Text><Text style={s.c5}>Tax</Text><Text style={s.c6}>Amount</Text>
        </View>
        {lines.map((l) => (
          <View key={l.id} style={s.tr} wrap={false}>
            <Text style={[s.c1, l.kind === "DISCOUNT" ? { color: "#047857" } : {}]}>{l.description}</Text>
            <Text style={s.c2}>{l.kind === "DISCOUNT" ? "" : l.quantity}</Text>
            <Text style={s.c3}>{l.kind === "DISCOUNT" ? "" : money(l.unitPrice)}</Text>
            <Text style={s.c4}>{l.discountAmount ? `-${money(l.discountAmount)}` : ""}</Text>
            <Text style={s.c5}>{l.taxAmount ? money(l.taxAmount) : ""}</Text>
            <Text style={[s.c6, l.kind === "DISCOUNT" ? { color: "#047857" } : {}]}>{money(l.amount)}</Text>
          </View>
        ))}
        <View style={s.totals}>
          <View style={s.tRow}><Text style={s.muted}>Subtotal</Text><Text>{money(inv.subtotal)}</Text></View>
          <View style={s.tRow}><Text style={s.muted}>Discounts</Text><Text>-{money(inv.discountTotal)}</Text></View>
          <View style={s.tRow}><Text style={s.muted}>Taxes</Text><Text>{money(inv.taxTotal)}</Text></View>
          <View style={s.grand}><Text>Total</Text><Text>{money(inv.total)}</Text></View>
          <View style={s.tRow}><Text style={s.muted}>Paid</Text><Text>{money(inv.amountPaid)}</Text></View>
          <View style={[s.tRow, { fontFamily: "Helvetica-Bold" }]}><Text>Amount due</Text><Text>{money(inv.amountDue)}</Text></View>
        </View>
        <Text style={s.footer} fixed>Thank you for your business. Pay by bank transfer to HDFC 50200012345678 (IFSC HDFC0000123) or UPI brightloop@hdfc, quoting {inv.number}.</Text>
      </Page>
    </Document>
  );
  const buffer = await renderToBuffer(doc);
  return { buffer, filename: `${inv.number.replace(/\//g, "-")}.pdf` };
}
