// Phase E2c.1 — full client detail panel.
// Used by both List view's right pane AND Ranked view's slide-in drawer.
// Self-contained: header, side-by-side service+zoho, contact, notes, schedule.

import React, { useState } from "react";
import { P } from "./data.js";
import { EditableField } from "./components.jsx";
import {
  getSegment, clientValue, paymentDueStatus,
  SEGMENT_LABELS, generateScheduleForNew, deriveSegment, canEdit,
} from "./clientsHelpers.js";
import { StatusPill, SegmentPill, Pill, Avatar, SEGMENT_COLORS } from "./ClientPills.jsx";

const SERVICE_TYPES = [
  ["retainer",         "Retainer (Infinity Mirror)"],
  ["support-retainer", "Support Retainer"],
  ["bank-of-hours",    "Bank of Hours"],
  ["project",          "Full Project"],
  ["one-time",         "One-Time"],
];
const STATUS_OPTIONS = [
  ["active",  "Active"],
  ["at-risk", "At-risk"],
  ["churned", "Churned"],
  ["pipeline","Pipeline"],
];
const ZOHO_PRODUCTS = [
  ["One",              "Zoho One"],
  ["CRM Plus",         "CRM Plus"],
  ["CRM Ultimate",     "CRM Ultimate"],
  ["CRM Professional", "CRM Professional"],
  ["CRM Enterprise",   "CRM Enterprise"],
];
const FREQUENCY_OPTIONS = [["monthly", "Monthly"], ["annual", "Annual"]];

const PMT_COLORS = {
  paid:     { fg: P.g, label: "Paid" },
  late:     { fg: P.r, label: "Late" },
  due:      { fg: P.a, label: "Due" },
  upcoming: { fg: P.tm, label: "Upcoming" },
  unpaid:   { fg: P.tm, label: "Unpaid" },
};

const fmtMoney = (n) => {
  if (!n || n === 0) return "—";
  const a = Math.abs(Math.round(n));
  return n < 0 ? `($${a.toLocaleString()})` : `$${a.toLocaleString()}`;
};

const sectionLabel = (text) => (
  <div style={{ fontSize: 10, color: P.td, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", marginBottom: 12, marginTop: 6 }}>{text}</div>
);

const fieldRow = (label, valueEl) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${P.bd}30`, gap: 12 }}>
    <span style={{ color: P.tm, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
    <span style={{ minWidth: 0, textAlign: "right" }}>{valueEl}</span>
  </div>
);

// === Read-only payment schedule (E2c.4 turns this into an editor) ===
function PaymentScheduleTable({ entries, today }) {
  if (!entries || entries.length === 0) return <div style={{ fontSize: 11, color: P.td, fontStyle: "italic", padding: "4px 0" }}>No scheduled payments.</div>;
  return (
    <div style={{ marginTop: 4, maxHeight: 240, overflowY: "auto", border: `1px solid ${P.bd}40`, borderRadius: 6 }}>
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
                <td style={{ padding: "5px 10px", fontSize: 11, color: P.tx }}>{e.dueDate}</td>
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
}

// === Add service contract inline form ===
function AddServiceContractForm({ onCancel, onAdd }) {
  const [type, setType] = useState("retainer");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [monthlyRenewalDay, setMonthlyRenewalDay] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const submit = () => {
    const sc = {
      type,
      segment: deriveSegment(type),
      monthlyAmount: monthlyAmount ? Number(monthlyAmount) : null,
      monthlyRenewalDay: monthlyRenewalDay ? Number(monthlyRenewalDay) : null,
      startDate: startDate || null,
      endDate: endDate || null,
      status: "active",
      inForecast: true,
      paymentSchedule: [],
    };
    sc.paymentSchedule = generateScheduleForNew(sc, new Date());
    onAdd(sc);
  };

  const inputSty = { background: P.c2, border: `1px solid ${P.bd}`, borderRadius: 4, color: P.tx, fontSize: 12, padding: "5px 8px", fontFamily: "'DM Sans', sans-serif", width: "100%", boxSizing: "border-box" };
  const lblSty = { fontSize: 9, color: P.td, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontWeight: 600 };

  return (
    <div style={{ padding: 14, background: P.c2, borderRadius: 6, marginBottom: 16, border: `1px solid ${P.bd}` }}>
      {sectionLabel("Add service contract")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={lblSty}>Type</div>
          <select value={type} onChange={e => setType(e.target.value)} style={inputSty}>
            {SERVICE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={lblSty}>Monthly Amount</div>
          <input type="number" value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} placeholder="e.g. 2000" style={{ ...inputSty, color: P.a, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
        </div>
        <div>
          <div style={lblSty}>Renewal Day (1-31)</div>
          <input type="number" min="1" max="31" value={monthlyRenewalDay} onChange={e => setMonthlyRenewalDay(e.target.value)} placeholder="e.g. 15" style={inputSty} />
        </div>
        <div>
          <div style={lblSty}>Start Date</div>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputSty} />
        </div>
        <div>
          <div style={lblSty}>End Date</div>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputSty} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ background: "transparent", color: P.tm, border: `1px solid ${P.bd}`, borderRadius: 4, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Cancel</button>
        <button onClick={submit} style={{ background: P.g, color: P.bg, border: "none", borderRadius: 4, padding: "6px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>+ Add Service Contract</button>
      </div>
    </div>
  );
}

// === Add Zoho commission inline form ===
function AddZohoCommissionForm({ onCancel, onAdd }) {
  const [zohoProduct, setZohoProduct] = useState("One");
  const [licenses, setLicenses] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [annualAmount, setAnnualAmount] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [renewalDay, setRenewalDay] = useState("");

  const submit = () => {
    const zc = {
      zohoProduct,
      licenses: licenses ? Number(licenses) : 0,
      frequency,
      monthlyAmount: frequency === "monthly" ? (monthlyAmount ? Number(monthlyAmount) : 0) : 0,
      annualAmount:  frequency === "annual"  ? (annualAmount  ? Number(annualAmount)  : 0) : 0,
      renewalDate: frequency === "annual" ? (renewalDate || null) : null,
      renewalDay: frequency === "monthly" ? (renewalDay ? Number(renewalDay) : null) : null,
      status: "active",
      inForecast: true,
      note: "",
    };
    onAdd(zc);
  };

  const inputSty = { background: P.c2, border: `1px solid ${P.bd}`, borderRadius: 4, color: P.tx, fontSize: 12, padding: "5px 8px", fontFamily: "'DM Sans', sans-serif", width: "100%", boxSizing: "border-box" };
  const lblSty = { fontSize: 9, color: P.td, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontWeight: 600 };

  return (
    <div style={{ padding: 14, background: P.c2, borderRadius: 6, marginBottom: 16, border: `1px solid ${P.bd}` }}>
      {sectionLabel("Add Zoho commission")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={lblSty}>Zoho Product</div>
          <select value={zohoProduct} onChange={e => setZohoProduct(e.target.value)} style={inputSty}>
            {ZOHO_PRODUCTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={lblSty}>Licenses</div>
          <input type="number" value={licenses} onChange={e => setLicenses(e.target.value)} placeholder="e.g. 21" style={inputSty} />
        </div>
        <div>
          <div style={lblSty}>Frequency</div>
          <select value={frequency} onChange={e => setFrequency(e.target.value)} style={inputSty}>
            {FREQUENCY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {frequency === "monthly" ? (
          <>
            <div>
              <div style={lblSty}>Monthly Amount</div>
              <input type="number" step="0.01" value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} placeholder="e.g. 810" style={{ ...inputSty, color: P.a, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
            </div>
            <div>
              <div style={lblSty}>Renewal Day (1-31)</div>
              <input type="number" min="1" max="31" value={renewalDay} onChange={e => setRenewalDay(e.target.value)} placeholder="e.g. 5" style={inputSty} />
            </div>
          </>
        ) : (
          <>
            <div>
              <div style={lblSty}>Annual Amount</div>
              <input type="number" step="0.01" value={annualAmount} onChange={e => setAnnualAmount(e.target.value)} placeholder="e.g. 3942" style={{ ...inputSty, color: P.a, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }} />
            </div>
            <div>
              <div style={lblSty}>Renewal Date</div>
              <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} style={inputSty} />
            </div>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ background: "transparent", color: P.tm, border: `1px solid ${P.bd}`, borderRadius: 4, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Cancel</button>
        <button onClick={submit} style={{ background: P.t, color: P.bg, border: "none", borderRadius: 4, padding: "6px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>+ Add Zoho Commission</button>
      </div>
    </div>
  );
}

// === Service Contract section ===
function ServiceContractBlock({ client, sc, segment, editable, onPatch, onAdd }) {
  const [adding, setAdding] = useState(false);
  if (!sc) {
    if (adding) return <AddServiceContractForm onCancel={() => setAdding(false)} onAdd={(newSc) => { onAdd(newSc); setAdding(false); }} />;
    return (
      <div style={{ padding: 14, background: P.c2, borderRadius: 6, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: P.td, marginBottom: 8, fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>No service contract</div>
        {editable && (
          <button onClick={() => setAdding(true)} style={{ background: P.g, color: P.bg, border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>+ Add service contract</button>
        )}
      </div>
    );
  }
  return (
    <div>
      {sectionLabel("Service Contract")}
      {fieldRow("Type", <EditableField type="enum" options={SERVICE_TYPES} value={sc.type} onChange={(v) => onPatch({ type: v, segment: deriveSegment(v) })} canEdit={editable} />)}
      {fieldRow("Segment", <span style={{ color: P.tx, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>{SEGMENT_LABELS[segment] || "—"}</span>)}
      {fieldRow("Monthly", <EditableField type="currency" value={sc.monthlyAmount} placeholder="—" onChange={(v) => onPatch({ monthlyAmount: v })} canEdit={editable} />)}
      {fieldRow("Renewal Day", <EditableField type="integer" value={sc.monthlyRenewalDay} placeholder="1-31" onChange={(v) => onPatch({ monthlyRenewalDay: v })} canEdit={editable} />)}
      {fieldRow("Start", <EditableField type="date" value={sc.startDate} placeholder="—" onChange={(v) => onPatch({ startDate: v || null })} canEdit={editable} />)}
      {fieldRow("End", <EditableField type="date" value={sc.endDate} placeholder="—" onChange={(v) => onPatch({ endDate: v || null })} canEdit={editable} />)}
      {fieldRow("Status", <EditableField type="enum" options={STATUS_OPTIONS} value={sc.status} onChange={(v) => onPatch({ status: v })} canEdit={editable} />)}
      {fieldRow("In Forecast", <EditableField type="boolean" value={sc.inForecast !== false} onChange={(v) => onPatch({ inForecast: v })} canEdit={editable} />)}
    </div>
  );
}

// === Zoho Commission section ===
function ZohoBlock({ zc, editable, onPatch, onAdd }) {
  const [adding, setAdding] = useState(false);
  if (!zc) {
    if (adding) return <AddZohoCommissionForm onCancel={() => setAdding(false)} onAdd={(newZc) => { onAdd(newZc); setAdding(false); }} />;
    return (
      <div style={{ padding: 14, background: P.c2, borderRadius: 6, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: P.td, marginBottom: 8, fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>No Zoho commission</div>
        {editable && (
          <button onClick={() => setAdding(true)} style={{ background: P.t, color: P.bg, border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>+ Add Zoho commission</button>
        )}
      </div>
    );
  }
  return (
    <div>
      {sectionLabel("Zoho Commission")}
      {fieldRow("Zoho Product", <EditableField type="enum" options={ZOHO_PRODUCTS} value={zc.zohoProduct} onChange={(v) => onPatch({ zohoProduct: v })} canEdit={editable} />)}
      {fieldRow("Licenses", <EditableField type="integer" value={zc.licenses} placeholder="0" onChange={(v) => onPatch({ licenses: v ?? 0 })} canEdit={editable} />)}
      {/* B2 fix: zc.frequency null guard */}
      {fieldRow("Frequency", <EditableField type="enum" options={FREQUENCY_OPTIONS} value={zc.frequency || "annual"} onChange={(v) => onPatch({ frequency: v })} canEdit={editable} />)}
      {zc.frequency === "monthly" ? (
        <>
          {fieldRow("Monthly Amount", <EditableField type="currency" value={zc.monthlyAmount} placeholder="—" onChange={(v) => onPatch({ monthlyAmount: v ?? 0 })} canEdit={editable} />)}
          {fieldRow("Renewal Day", <EditableField type="integer" value={zc.renewalDay} placeholder="1-31" onChange={(v) => onPatch({ renewalDay: v })} canEdit={editable} />)}
        </>
      ) : (
        <>
          {fieldRow("Annual Amount", <EditableField type="currency" value={zc.annualAmount} placeholder="—" onChange={(v) => onPatch({ annualAmount: v ?? 0 })} canEdit={editable} />)}
          {fieldRow(
            "Renewal Date",
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {!zc.renewalDate && <span style={{ color: P.a, fontSize: 10, fontWeight: 700 }}>⚠ unset → $0 in forecast</span>}
              <EditableField type="date" value={zc.renewalDate} placeholder="—" onChange={(v) => onPatch({ renewalDate: v || null })} canEdit={editable} />
            </span>
          )}
        </>
      )}
      {fieldRow("Status", <EditableField type="enum" options={STATUS_OPTIONS} value={zc.status} onChange={(v) => onPatch({ status: v })} canEdit={editable} />)}
      {fieldRow("In Forecast", <EditableField type="boolean" value={zc.inForecast !== false} onChange={(v) => onPatch({ inForecast: v })} canEdit={editable} />)}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, color: P.tm, marginBottom: 4 }}>Note</div>
        <EditableField type="longText" value={zc.note} placeholder="Add Zoho-specific note…" onChange={(v) => onPatch({ note: v })} canEdit={editable} />
      </div>
    </div>
  );
}

// === Main detail panel ===
export default function ClientDetail({ client, today, onChange, onClose, isAdmin, isViewer, narrow }) {
  const sc = client.serviceContract;
  const zc = client.zohoCommission;
  const segment = getSegment(client);
  const monthlyValue = (sc?.monthlyAmount || 0) + (zc?.monthlyAmount || 0);
  const annualValue = zc?.annualAmount || 0;
  const totalValue = clientValue(client, today);
  const status = sc?.status || zc?.status || "active";

  const editable = canEdit() && !isViewer;
  const patch = (changes) => onChange && onChange({ ...client, ...changes });
  const patchSc = (changes) => patch({ serviceContract: { ...sc, ...changes } });
  const patchZc = (changes) => patch({ zohoCommission: { ...zc, ...changes } });

  const lastEdited = client.lastEditedAt ? new Date(client.lastEditedAt).toLocaleString() : "—";
  const lastEditedBy = client.lastEditedBy || "—";

  // Service + Zoho side-by-side on wide layout, stacked when narrow (drawer at <520px etc.)
  const twoColumn = !narrow;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.c1, borderRadius: 8, border: `1px solid ${P.bd}`, overflow: "hidden" }}>
      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 1,
        padding: "14px 18px", background: P.c2,
        borderBottom: `1px solid ${P.bd}`,
        display: "flex", alignItems: "flex-start", gap: 14,
      }}>
        <Avatar name={client.nm} segment={segment} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: P.tx, fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.01em" }}>{client.nm}</span>
            <StatusPill status={status} />
            {segment && <SegmentPill segment={segment} />}
            {sc?.inForecast === false && <Pill color={P.r} bg={`${P.r}18`}>Out of forecast</Pill>}
            {!client.email && <Pill color={P.a} bg={`${P.a}15`}>⚠ no email</Pill>}
          </div>
        </div>
        <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: P.g }}>{fmtMoney(monthlyValue)}<span style={{ color: P.td, fontWeight: 400, fontSize: 12 }}>/mo</span></div>
          <div style={{ fontSize: 11, color: P.tm, marginTop: 2 }}>{annualValue > 0 ? fmtMoney(annualValue) + "/yr" : "—"}</div>
          <div style={{ fontSize: 10, color: P.td, marginTop: 4 }}>value: {fmtMoney(totalValue)}</div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: P.tm, fontSize: 22, lineHeight: 1, cursor: "pointer", padding: "0 6px", marginLeft: 4 }}>×</button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        {/* Name (separate row so it's editable even though it's also in header) */}
        <div style={{ marginBottom: 16 }}>
          {sectionLabel("Client")}
          {fieldRow("Name", <EditableField type="text" value={client.nm} onChange={(v) => patch({ nm: v || client.nm })} canEdit={editable} />)}
          {fieldRow(
            "Email",
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {!client.email && <span style={{ color: P.a, fontSize: 10, fontWeight: 700 }}>⚠ none on file</span>}
              <EditableField type="text" value={client.email} placeholder="add email…" onChange={(v) => patch({ email: v || null })} canEdit={editable} />
            </span>
          )}
        </div>

        {/* Side-by-side service + zoho */}
        <div style={{ display: "grid", gridTemplateColumns: twoColumn ? "1fr 1fr" : "1fr", gap: 18, marginBottom: 16 }}>
          <ServiceContractBlock
            client={client} sc={sc} segment={segment} editable={editable}
            onPatch={patchSc}
            onAdd={(newSc) => patch({ serviceContract: newSc })}
          />
          <ZohoBlock
            zc={zc} editable={editable}
            onPatch={patchZc}
            onAdd={(newZc) => patch({ zohoCommission: newZc })}
          />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          {sectionLabel("Notes")}
          <EditableField type="longText" value={client.notes} placeholder="Click to add notes…" onChange={(v) => patch({ notes: v })} canEdit={editable} />
        </div>

        {/* Payment schedule (read-only in E2c.1; editor in E2c.4) */}
        {sc && (
          <div style={{ marginBottom: 8 }}>
            {sectionLabel(`Payment Schedule (${sc.paymentSchedule?.length || 0} entries)`)}
            <PaymentScheduleTable entries={sc.paymentSchedule} today={today} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 18px", borderTop: `1px solid ${P.bd}`, fontSize: 11, color: P.tm, background: P.c1 }}>
        last edited {lastEdited} by {lastEditedBy}
      </div>
    </div>
  );
}
