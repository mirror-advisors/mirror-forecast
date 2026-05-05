// Phase E2c.4 — paymentSchedule editor.
// Recurring (retainer/support-retainer): status chips only, no add/delete.
// Non-recurring (project/bank-of-hours/one-time): full edit + add + delete.
// Project: F1-extended (paymentSchedule canonical for forecast) + Regenerate
// from contract terms button when schedule is empty or sum mismatches.

import React, { useMemo, useState } from "react";
import { P } from "./data.js";
import { effectiveStatus, monthIdxFromDate, dateForMonth, applyStatusToEntry } from "./clientsHelpers.js";

const STATUS_META = {
  P: { color: P.g, bg: P.gB, label: "Paid",     short: "P" },
  U: { color: P.a, bg: P.aB, label: "Unpaid",   short: "U" },
  L: { color: P.r, bg: P.rB, label: "Late",     short: "L" },
  C: { color: P.b, bg: P.bB, label: "Credited", short: "C" },
};
const STATUSES = ["P", "U", "L", "C"];

const fmtMoney = (n) => {
  if (n == null || n === 0) return "—";
  const a = Math.abs(Math.round(n));
  return n < 0 ? `($${a.toLocaleString()})` : `$${a.toLocaleString()}`;
};

const todayISO = (today) => today.toISOString().slice(0, 10);

// === Status chip selector — click to flip ===
function StatusChips({ value, onChange, editable }) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {STATUSES.map(s => {
        const meta = STATUS_META[s];
        const selected = value === s;
        return (
          <button
            key={s}
            disabled={!editable}
            onClick={() => editable && onChange(s)}
            title={meta.label}
            style={{
              width: 22, height: 22, borderRadius: 4,
              fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
              background: selected ? meta.bg : "transparent",
              color: meta.color,
              border: `1px solid ${selected ? meta.color : P.bd}`,
              cursor: editable ? "pointer" : "default",
              padding: 0, lineHeight: 1, userSelect: "none",
              opacity: editable ? 1 : 0.6,
            }}
          >{meta.short}</button>
        );
      })}
    </span>
  );
}

// === Inline editable date / amount cell (used in non-recurring rows) ===
function DateCell({ value, onCommit, editable }) {
  const [draft, setDraft] = useState(value || "");
  const [focused, setFocused] = useState(false);
  // sync if parent value changes from outside (regenerate, discard) and we're not editing
  React.useEffect(() => { if (!focused) setDraft(value || ""); }, [value, focused]);
  const commit = () => {
    if (draft !== value) onCommit(draft || null);
  };
  if (!editable) return <span style={{ fontSize: 11, color: P.tx }}>{value || "—"}</span>;
  return (
    <input
      type="date"
      value={draft}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onChange={e => setDraft(e.target.value)}
      style={{ background: P.c2, border: `1px solid ${P.bd}`, borderRadius: 3, color: P.tx, fontSize: 11, padding: "3px 6px", fontFamily: "'DM Sans', sans-serif", width: 134 }}
    />
  );
}

function AmountCell({ value, onCommit, editable }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState(null);
  React.useEffect(() => { if (!focused) setDraft(value == null ? "" : String(value)); }, [value, focused]);
  const commit = () => {
    const raw = draft.trim();
    if (raw === "") { if (value !== 0 && value != null) onCommit(0); setError(null); return; }
    const n = Number(raw);
    if (isNaN(n)) { setDraft(value == null ? "" : String(value)); setError(null); return; }
    if (n < 0) { setError("Amounts must be positive. For credits, set status to 'C'."); setDraft(String(value || 0)); return; }
    setError(null);
    if (n !== value) onCommit(n);
  };
  if (!editable) {
    return <span style={{ fontSize: 11, color: P.tx, fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(value)}</span>;
  }
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <input
        type="number"
        step="0.01"
        value={draft}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); commit(); }}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { setDraft(value == null ? "" : String(value)); setError(null); e.currentTarget.blur(); } }}
        style={{ background: P.c2, border: `1px solid ${error ? P.r : P.bd}`, borderRadius: 3, color: P.a, fontSize: 11, padding: "3px 6px", fontFamily: "'JetBrains Mono', monospace", width: 100, textAlign: "right" }}
      />
      {error && <span style={{ fontSize: 9, color: P.r, maxWidth: 200, textAlign: "right" }}>{error}</span>}
    </span>
  );
}

// === Main editor ===
export default function ScheduleEditor({ serviceContract: sc, onChange, today, editable }) {
  const schedule = sc?.paymentSchedule || [];
  const isRecurring = sc?.type === "retainer" || sc?.type === "support-retainer";
  const isProject = sc?.type === "project";
  const canAddDelete = !isRecurring && editable;
  const canRegenerate = isProject && editable;

  // Reconciliation check (project only): paymentSchedule sum vs contract math
  const reconciliation = useMemo(() => {
    if (!isProject || !sc.monthlyAmount || !sc.startDate || !sc.endDate) return null;
    const startIdx = monthIdxFromDate(sc.startDate);
    const endIdx = monthIdxFromDate(sc.endDate);
    if (startIdx === null || endIdx === null) return null;
    const expectedTerm = endIdx - startIdx + 1;
    const expectedSum = sc.monthlyAmount * expectedTerm;
    const actualSum = schedule.reduce((s, p) => s + (p.amount || 0), 0);
    if (Math.abs(expectedSum - actualSum) < 0.01) return null;
    return { expectedSum, actualSum, expectedTerm, monthlyAmount: sc.monthlyAmount, startDate: sc.startDate, endDate: sc.endDate };
  }, [schedule, sc, isProject]);

  const showRegenerate = canRegenerate && (schedule.length === 0 || reconciliation !== null);

  // Past-endDate test (project only — informational)
  const isPastEndDate = (dueDate) => {
    if (!isProject || !sc.endDate || !dueDate) return false;
    return new Date(dueDate) > new Date(sc.endDate);
  };

  const total = schedule.reduce((s, p) => s + (p.amount || 0), 0);
  const paidSum = schedule.filter(p => p.paid).reduce((s, p) => s + (p.amount || 0), 0);
  const outstanding = total - paidSum;

  // === Mutators ===
  const setEntry = (idx, patch) => {
    const updated = [...schedule];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const setStatus = (idx, newStatus) => {
    const updated = applyStatusToEntry(schedule[idx], newStatus, today);
    const next = [...schedule];
    next[idx] = updated;
    onChange(next);
  };

  const setPaidDate = (idx, newDate) => {
    setEntry(idx, { paidDate: newDate || null });
  };

  const addEntry = () => {
    if (!canAddDelete) return;
    const newEntry = {
      dueDate: todayISO(today),
      amount: 0,
      paid: false,
      paidDate: null,
      note: "",
      status: "U",
    };
    onChange([...schedule, newEntry]);
  };

  const deleteEntry = (idx) => {
    const entry = schedule[idx];
    const isPaid = entry.paid;
    const baseMsg = "Remove this payment entry? Click Discard to revert all unsaved changes.";
    const paidMsg = "This entry is marked Paid; removing it will delete the payment record.\n\nRemove anyway? Click Discard to revert all unsaved changes.";
    if (!window.confirm(isPaid ? paidMsg : baseMsg)) return;
    onChange(schedule.filter((_, i) => i !== idx));
  };

  const regenerate = () => {
    if (!sc.monthlyAmount || !sc.startDate || !sc.endDate) {
      window.alert("Cannot regenerate: contract needs monthlyAmount, startDate, and endDate set.");
      return;
    }
    const startIdx = monthIdxFromDate(sc.startDate);
    const endIdx = monthIdxFromDate(sc.endDate);
    const term = endIdx - startIdx + 1;
    const day = sc.monthlyRenewalDay || 1;
    const startISO = sc.startDate;
    const endISO = sc.endDate;
    const msg = `This will replace all current schedule entries with ${term} entries of $${sc.monthlyAmount.toLocaleString()} (one per month from ${startISO} through ${endISO}). Existing entries will be lost. Continue?`;
    if (!window.confirm(msg)) return;
    const newSched = [];
    for (let i = startIdx; i <= endIdx; i++) {
      newSched.push({
        dueDate: dateForMonth(i, day),
        amount: sc.monthlyAmount,
        paid: false,
        paidDate: null,
        note: "",
        status: "U",
      });
    }
    onChange(newSched);
  };

  // === Render ===
  const lblSty = { fontSize: 9, color: P.td, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" };
  const cellSty = { padding: "6px 10px", borderBottom: `1px solid ${P.bd}25`, verticalAlign: "middle" };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ ...lblSty, fontFamily: "'DM Sans', sans-serif" }}>
          Payment Schedule ({schedule.length} entr{schedule.length === 1 ? "y" : "ies"})
        </span>
        {canAddDelete && (
          <button onClick={addEntry} style={{ background: P.b, color: "#fff", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            + Add payment
          </button>
        )}
      </div>

      {/* Reconciliation mismatch note (project only) */}
      {reconciliation && (
        <div style={{ padding: "8px 10px", marginBottom: 8, background: `${P.a}15`, borderLeft: `3px solid ${P.a}`, borderRadius: 4, fontSize: 11, color: P.a, fontFamily: "'DM Sans', sans-serif" }}>
          ⓘ Schedule sum <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{fmtMoney(reconciliation.actualSum)}</span> does not match contract terms <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{fmtMoney(reconciliation.expectedSum)}</span> ({fmtMoney(reconciliation.monthlyAmount)}/mo × {reconciliation.expectedTerm} months).
          {canRegenerate && <span style={{ display: "block", marginTop: 4, color: P.tm, fontSize: 10 }}>Use "Regenerate from contract terms" below to reset.</span>}
        </div>
      )}

      {/* Empty state */}
      {schedule.length === 0 ? (
        <div style={{ padding: 12, fontSize: 11, color: P.td, fontStyle: "italic", textAlign: "center", border: `1px dashed ${P.bd}`, borderRadius: 4 }}>
          No scheduled payments.
          {canAddDelete && <span style={{ display: "block", marginTop: 4 }}>Click "+ Add payment" to start.</span>}
        </div>
      ) : (
        <div style={{ border: `1px solid ${P.bd}40`, borderRadius: 6, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
            <thead>
              <tr style={{ background: P.c2 }}>
                <th style={{ ...cellSty, ...lblSty, textAlign: "left", borderBottom: `1px solid ${P.bd}` }}>Due</th>
                <th style={{ ...cellSty, ...lblSty, textAlign: "right", borderBottom: `1px solid ${P.bd}` }}>Amount</th>
                <th style={{ ...cellSty, ...lblSty, textAlign: "left", borderBottom: `1px solid ${P.bd}` }}>Status</th>
                <th style={{ ...cellSty, ...lblSty, textAlign: "left", borderBottom: `1px solid ${P.bd}` }}>Paid</th>
                {canAddDelete && <th style={{ ...cellSty, ...lblSty, borderBottom: `1px solid ${P.bd}`, width: 36 }}></th>}
              </tr>
            </thead>
            <tbody>
              {schedule.map((entry, i) => {
                const status = effectiveStatus(entry);
                const past = isPastEndDate(entry.dueDate);
                return (
                  <tr key={i} style={{ background: i % 2 ? `${P.c2}30` : "transparent" }}>
                    <td style={cellSty}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <DateCell value={entry.dueDate} onCommit={(v) => setEntry(i, { dueDate: v })} editable={canAddDelete} />
                        {past && (
                          <span title={`This payment falls after contract end date ${sc.endDate}.`} style={{ fontSize: 11, color: P.b, cursor: "help" }}>ⓘ</span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...cellSty, textAlign: "right" }}>
                      <AmountCell value={entry.amount} onCommit={(v) => setEntry(i, { amount: v })} editable={canAddDelete} />
                    </td>
                    <td style={cellSty}>
                      <StatusChips value={status} onChange={(s) => setStatus(i, s)} editable={editable} />
                    </td>
                    <td style={cellSty}>
                      {entry.paid ? (
                        <DateCell value={entry.paidDate} onCommit={(v) => setPaidDate(i, v)} editable={editable} />
                      ) : (
                        <span style={{ fontSize: 10, color: P.td }}>—</span>
                      )}
                    </td>
                    {canAddDelete && (
                      <td style={cellSty}>
                        <button
                          onClick={() => deleteEntry(i)}
                          title="Remove entry"
                          style={{ background: "transparent", color: P.tm, border: "none", fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1 }}
                        >×</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer summary + regenerate (project only) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: P.tm, fontFamily: "'DM Sans', sans-serif" }}>
          Total <span style={{ color: P.tx, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(total)}</span>
          <span style={{ color: P.td }}> · </span>
          Paid <span style={{ color: P.g, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(paidSum)}</span>
          <span style={{ color: P.td }}> · </span>
          Outstanding <span style={{ color: outstanding > 0 ? P.a : P.tm, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(outstanding)}</span>
        </div>
        {showRegenerate && (
          <button
            onClick={regenerate}
            style={{ background: "transparent", color: P.a, border: `1px solid ${P.a}66`, borderRadius: 4, padding: "5px 12px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >Regenerate from contract terms</button>
        )}
      </div>
    </div>
  );
}
