// Phase E2a — read-only client card with collapsed/expanded states.
// All edit affordances are rendered DISABLED (no handlers); E2b wires them up.

import React from "react";
import { P } from "./data.js";
import { Card } from "./components.jsx";
import { getSegment, clientValue, paymentDueStatus, SEGMENT_LABELS, STATUS_LABELS } from "./clientsHelpers.js";

const STATUS_COLORS = {
  active:    { bg: P.gB, fg: P.g },
  "at-risk": { bg: P.aB, fg: P.a },
  churned:   { bg: P.rB, fg: P.r },
  pipeline:  { bg: P.c2, fg: P.tm },
};
const SEGMENT_COLORS = {
  infinityMirror: P.g,
  scopeOnly:      P.a,
  fullProject:    P.b,
  supportOnly:    P.t,
};
const RISK_COLORS = { low: P.g, medium: P.a, high: P.r };
const PMT_COLORS = {
  paid:     { bg: P.gB, fg: P.g, label: "Paid" },
  late:     { bg: P.rB, fg: P.r, label: "Late" },
  due:      { bg: P.aB, fg: P.a, label: "Due" },
  upcoming: { bg: P.c2, fg: P.tm, label: "Upcoming" },
  unpaid:   { bg: P.c2, fg: P.tm, label: "Unpaid" },
};

const fmtMoney = (n) => {
  if (!n || n === 0) return "—";
  const a = Math.abs(Math.round(n));
  return n < 0 ? `($${a.toLocaleString()})` : `$${a.toLocaleString()}`;
};

const Pill = ({ children, color = P.tm, bg = `${P.c2}80`, fontSize = 9 }) => (
  <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 9, background: bg, color, fontSize, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{children}</span>
);

const StatusPill = ({ status }) => {
  const co = STATUS_COLORS[status] || STATUS_COLORS.pipeline;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 11, background: co.bg, color: co.fg, fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: co.fg }} />
      {STATUS_LABELS[status] || status || "—"}
    </span>
  );
};

const SegmentPill = ({ segment }) => (
  <Pill color={SEGMENT_COLORS[segment] || P.tm} bg={`${SEGMENT_COLORS[segment] || P.tm}15`}>
    {SEGMENT_LABELS[segment] || "—"}
  </Pill>
);

const StreamPills = ({ client }) => (
  <div style={{ display: "inline-flex", gap: 5 }}>
    {client.serviceContract && <Pill color={P.g} bg={`${P.g}18`}>Service</Pill>}
    {client.zohoCommission && <Pill color={P.t} bg={`${P.t}18`}>Zoho</Pill>}
  </div>
);

const fieldRow = (label, value, valueStyle = {}) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: `1px solid ${P.bd}30` }}>
    <span style={{ color: P.tm, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
    <span style={{ color: P.tx, fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, ...valueStyle }}>{value}</span>
  </div>
);

const sectionLabel = (text) => (
  <div style={{ fontSize: 10, color: P.td, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", marginBottom: 12, marginTop: 6 }}>{text}</div>
);

const disabledBtn = (label) => (
  <button disabled style={{ background: "transparent", border: `1px solid ${P.bd}`, borderRadius: 6, padding: "6px 12px", color: P.td, fontSize: 11, fontWeight: 600, cursor: "not-allowed", fontFamily: "'DM Sans', sans-serif", opacity: 0.55 }}>
    {label}
  </button>
);

const PaymentScheduleTable = ({ entries, today }) => {
  if (!entries || entries.length === 0) return <div style={{ fontSize: 11, color: P.td, fontStyle: "italic", padding: "4px 0" }}>No scheduled payments.</div>;
  return (
    <div style={{ marginTop: 4, maxHeight: 220, overflowY: "auto", border: `1px solid ${P.bd}40`, borderRadius: 6 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
        <thead>
          <tr style={{ background: P.c2 }}>
            <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 9, color: P.td, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Due</th>
            <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 9, color: P.td, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Amount</th>
            <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 9, color: P.td, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const status = paymentDueStatus(e, today);
            const co = PMT_COLORS[status];
            return (
              <tr key={i} style={{ borderBottom: `1px solid ${P.bd}25` }}>
                <td style={{ padding: "5px 10px", fontSize: 11, color: P.tx, fontFamily: "'DM Sans', sans-serif" }}>{e.dueDate}</td>
                <td style={{ padding: "5px 10px", fontSize: 11, color: P.tx, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(e.amount)}</td>
                <td style={{ padding: "5px 10px", fontSize: 10, textAlign: "right" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: co.fg }}>
                    <span style={{ width: 5, height: 5, borderRadius: 3, background: co.fg }} />
                    {co.label}{e.note ? ` · ${e.note}` : ""}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default function ClientCard({ client, today, expanded, onToggle, isAdmin, isViewer }) {
  const sc = client.serviceContract;
  const zc = client.zohoCommission;
  const segment = getSegment(client);
  const monthlyValue = (sc?.monthlyAmount || 0) + (zc?.monthlyAmount || 0);
  const annualValue = zc?.annualAmount || 0;
  const totalValue = clientValue(client, today);
  const status = sc?.status || zc?.status || "active";

  // === Collapsed row ===
  if (!expanded) {
    return (
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: P.c1, border: `1px solid ${P.bd}`, borderRadius: 8, cursor: "pointer", transition: "background 120ms" }}
           onMouseEnter={e => e.currentTarget.style.background = P.c2}
           onMouseLeave={e => e.currentTarget.style.background = P.c1}>
        <span style={{ fontSize: 10, color: P.td, width: 12, display: "inline-block" }}>▶</span>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: P.tx, fontFamily: "'DM Sans', sans-serif" }}>{client.nm}</span>
          {segment && <SegmentPill segment={segment} />}
          <StreamPills client={client} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, fontFamily: "'JetBrains Mono', monospace" }}>
          <span style={{ fontSize: 12, color: P.tx, fontWeight: 600 }}>{fmtMoney(monthlyValue)}<span style={{ color: P.td, fontWeight: 400 }}>/mo</span></span>
          <span style={{ fontSize: 11, color: P.tm }}>{annualValue > 0 ? fmtMoney(annualValue) + "/yr" : "—"}</span>
        </div>
        <StatusPill status={status} />
      </div>
    );
  }

  // === Expanded card ===
  const lastEdited = client.lastEditedAt ? new Date(client.lastEditedAt).toLocaleDateString() : "—";
  const lastEditedBy = client.lastEditedBy || "—";

  return (
    <Card style={{ padding: 0, overflow: "hidden", border: `1px solid ${P.bd}` }}>
      {/* Header zone */}
      <div onClick={onToggle} style={{ padding: "14px 18px", background: P.c2, borderBottom: `1px solid ${P.bd}`, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14 }}>
        <span style={{ fontSize: 10, color: P.td, marginTop: 6 }}>▼</span>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: SEGMENT_COLORS[segment] || P.tm, opacity: 0.6, display: "flex", alignItems: "center", justifyContent: "center", color: P.bg, fontWeight: 700, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
          {client.nm.split(" ").slice(0, 2).map(s => s[0]).join("").toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: P.tx, fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.01em" }}>{client.nm}</span>
            <StatusPill status={status} />
            {segment && <SegmentPill segment={segment} />}
          </div>
          <div style={{ fontSize: 11, color: P.tm }}>last edited {lastEdited} by {lastEditedBy}</div>
        </div>
        <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: P.g }}>{fmtMoney(monthlyValue)}<span style={{ color: P.td, fontWeight: 400, fontSize: 12 }}>/mo</span></div>
          <div style={{ fontSize: 11, color: P.tm, marginTop: 2 }}>{annualValue > 0 ? fmtMoney(annualValue) + "/yr" : "—"}</div>
          <div style={{ fontSize: 10, color: P.td, marginTop: 4 }}>value: {fmtMoney(totalValue)}</div>
        </div>
      </div>

      <div style={{ padding: 18 }}>
        {/* Service Contract */}
        {sc ? (
          <div style={{ marginBottom: 16 }}>
            {sectionLabel("Service Contract")}
            {fieldRow("Type", sc.type)}
            {fieldRow("Segment", SEGMENT_LABELS[segment] || "—")}
            {fieldRow("Monthly", fmtMoney(sc.monthlyAmount), { fontFamily: "'JetBrains Mono', monospace" })}
            {fieldRow("Total Value", sc.totalContractValue ? fmtMoney(sc.totalContractValue) : "—", { fontFamily: "'JetBrains Mono', monospace" })}
            {fieldRow("Term", sc.termMonths ? `${sc.termMonths} months` : "—")}
            {fieldRow("Start", sc.startDate || "—")}
            {fieldRow("End", sc.endDate || "—")}
            {fieldRow("Renewal", sc.renewalDate || "—")}
            {fieldRow("Auto-renew", sc.autoRenew ? "Yes" : "No")}
            {fieldRow("Payment Method", sc.payMethod || "—")}
            {fieldRow("In Forecast", sc.inForecast === false ? "No (excluded)" : "Yes")}
            {fieldRow("Risk", <span style={{ color: RISK_COLORS[sc.churnRisk] || P.tm, textTransform: "capitalize" }}>● {sc.churnRisk || "—"}</span>)}

            <div style={{ marginTop: 12 }}>
              {sectionLabel(`Payment Schedule (${sc.paymentSchedule?.length || 0} entries)`)}
              <PaymentScheduleTable entries={sc.paymentSchedule} today={today} />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              {!zc && disabledBtn("+ Add Zoho commission")}
              {disabledBtn("Remove service contract")}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 16, padding: 14, background: P.c2, borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: P.td, marginBottom: 8, fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>No service contract</div>
            {disabledBtn("+ Add service contract")}
          </div>
        )}

        {/* Zoho Commission */}
        {zc ? (
          <div style={{ marginBottom: 16 }}>
            {sectionLabel("Zoho Commission")}
            {fieldRow("License Type", zc.licenseType || "Not set")}
            {fieldRow("Frequency", zc.frequency.charAt(0).toUpperCase() + zc.frequency.slice(1))}
            {fieldRow("Monthly Amount", fmtMoney(zc.monthlyAmount), { fontFamily: "'JetBrains Mono', monospace" })}
            {fieldRow("Annual Amount", fmtMoney(zc.annualAmount), { fontFamily: "'JetBrains Mono', monospace" })}
            {fieldRow("Renewal Date", zc.renewalDate || "—")}
            {fieldRow("Renewal Month", zc.renewalMonth !== null ? `idx ${zc.renewalMonth}` : "—")}
            {fieldRow("Seats", zc.seats || "—")}
            {fieldRow("Status", <StatusPill status={zc.status} />)}
            {fieldRow("Note", <span style={{ fontStyle: zc.note ? "normal" : "italic", color: zc.note ? P.tx : P.td }}>{zc.note || "—"}</span>)}
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              {disabledBtn("Remove Zoho commission")}
            </div>
          </div>
        ) : sc ? null : (
          <div style={{ marginBottom: 16, padding: 14, background: P.c2, borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: P.td, marginBottom: 8, fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>No Zoho commission</div>
            {disabledBtn("+ Add Zoho commission")}
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 8 }}>
          {sectionLabel("Notes")}
          <div style={{ color: client.notes ? P.tx : P.td, fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontStyle: client.notes ? "normal" : "italic", lineHeight: 1.5, padding: "8px 0" }}>
            {client.notes || "No notes."}
          </div>
        </div>
      </div>
    </Card>
  );
}
