import { ImageResponse } from "next/og"

import { formatINR, invoiceTotals, sampleInvoice as inv } from "@/lib/landing/invoice"

export const alt = "Prettybill: a GST invoice for ₹27,140 from Rahul Design Studio, marked paid"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/** Open Graph image: the hero sample invoice beside the headline. */
export default function OpengraphImage() {
  const t = invoiceTotals(inv)
  const muted = "#737373"

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", padding: 64, gap: 56, fontSize: 22, color: "#0c111d" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#0a0a0a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
              P
            </div>
            Prettybill
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 44, fontSize: 68, lineHeight: 1.04, letterSpacing: -2.5 }}>
            <span>Pretty invoices.</span>
            <span style={{ color: "#737373" }}>Paid faster.</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 26, color: muted, display: "flex" }}>Free GST invoice maker · UPI QR · WhatsApp</div>
          <div
            style={{
              marginTop: 40,
              display: "flex",
              alignSelf: "flex-start",
              padding: "16px 26px",
              borderRadius: 8,
              background: "#0a0a0a",
              color: "white",
              fontSize: 22,
            }}
          >
            Create free invoice
          </div>
        </div>

        <div
          style={{
            width: 470,
            display: "flex",
            flexDirection: "column",
            background: "white",
            borderRadius: 10,
            border: "1px solid #e5e5e5",
            boxShadow: "0 24px 60px -24px rgba(0,0,0,0.25)",
            padding: 34,
            fontSize: 17,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 34, letterSpacing: -1 }}>Invoice</span>
              <span style={{ color: muted, marginTop: 4 }}>{inv.number}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", color: muted }}>
              <span>{inv.issueDate}</span>
              <span>Due {inv.dueDate}</span>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 26, gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <span style={{ color: "#737373", fontSize: 13, letterSpacing: 1 }}>FROM</span>
              <span>{inv.from.name}</span>
              <span style={{ color: muted, fontSize: 14 }}>GSTIN {inv.from.gstin}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <span style={{ color: "#737373", fontSize: 13, letterSpacing: 1 }}>BILL TO</span>
              <span>{inv.billTo.name}</span>
              <span style={{ color: muted, fontSize: 14 }}>{inv.billTo.city}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 24, borderTop: "2px solid #0c111d" }}>
            {t.lines.map((l) => (
              <div key={l.name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e6e8ed" }}>
                <span>
                  {l.name} × {l.qty}
                </span>
                <span>{formatINR(l.amount)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, color: muted }}>
            <span>
              {inv.tax.type} {inv.tax.rate}%
            </span>
            <span>{formatINR(t.tax)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 }}>
            <span>Total</span>
            <span style={{ fontSize: 34, letterSpacing: -1 }}>{formatINR(t.total)}</span>
          </div>
          <div
            style={{
              position: "absolute",
              right: 44,
              bottom: 34,
              display: "flex",
              border: "4px solid #12805c",
              color: "#12805c",
              borderRadius: 6,
              padding: "2px 14px",
              fontSize: 34,
              letterSpacing: 4,
              transform: "rotate(-12deg)",
            }}
          >
            PAID
          </div>
        </div>
      </div>
    ),
    size
  )
}
