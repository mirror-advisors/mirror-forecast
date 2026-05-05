// Phase E2d — Sara's Payments tab.
// Full-screen invoice worklist. Status-chip clicks and note edits are batched
// via the App-level SaveBar (not direct Supabase writes), matching the rest
// of the app. Click client name → navigate to Clients tab via App callback.

import React, { useMemo, useState, useEffect } from "react";
import { P } from "./data.js";
import { Card, Lbl } from "./components.jsx";
import { Avatar } from "./ClientPills.jsx";
import { applyStatusToEntry, daysUntil, getSegment } from "./clientsHelpers.js";

const STATUS_META = {
  P: { color: P.g, bg: P.gB, label: "Paid",     short: "P" },
  U: { color: P.a, bg: P.aB, label: "Unpaid",   short: "U" },
  L: { color: P.r, bg: P.rB, label: "Late",     short: "L" },
  C: { color: P.b, bg: P.bB, label: "Credited", short: "C" },
};
const STATUSES = ["P", "U", "L", "C"];

const fmtMoney = (n) => {
  if (!n || n === 0) return "—";
  const a = Math.abs(Math.round(n));
  return n < 0 ? `($${a.toLocaleString()})` : `$${a.toLocaleString()}`;
};

function StatusChips({ value, onChange }) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {STATUSES.map(s => {
        const meta = STATUS_META[s];
        const selected = value === s;
        return (
          <button
            key={s}
            onClick={() => { if (!selected) onChange(s); }}
            title={meta.label}
            style={{
              width: 26, height: 26, borderRadius: 4,
              fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
              background: selected ? meta.bg : "transparent",
              color: meta.color,
              border: `1px solid ${selected ? meta.color : P.bd}`,
              cursor: selected ? "default" : "pointer",
              padding: 0, lineHeight: 1, userSelect: "none",
            }}
          >{meta.short}</button>
        );
      })}
    </span>
  );
}

// Inline note input — blur commits.
function NoteCell({ value, onCommit }) {
  const [draft, setDraft] = useState(value || "");
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(value || ""); }, [value, focused]);
  return (
    <input
      type="text"
      value={draft}
      placeholder="Add note…"
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); if (draft !== (value || "")) onCommit(draft); }}
      onChange={e => setDraft(e.target.value)}
      style={{
        background: "transparent", border: `1px solid ${P.bd}40`, borderRadius: 4,
        color: P.tm, fontSize: 11, padding: "5px 8px",
        fontFamily: "'DM Sans', sans-serif", width: "100%", boxSizing: "border-box", outline: "none",
      }}
    />
  );
}

export default function PaymentsTab({ d, save, today, onNavigateToClient }) {
  const todayMonth = today.getFullYear() * 12 + today.getMonth();

  // Build worklist:
  //   - skip clients without serviceContract or with inForecast===false
  //   - include current-month entries (paid or not — Sara may want to verify)
  //   - include past-month entries that are still unpaid (rolling overdue)
  //   - skip past-month entries already paid
  const items = useMemo(() => {
    const out = [];
    for (const c of d.cl) {
      const sc = c.serviceContract;
      if (!sc || sc.inForecast === false) continue;
      const sched = sc.paymentSchedule || [];
      sched.forEach((entry, i) => {
        const due = new Date(entry.dueDate);
        if (isNaN(due)) return;
        const dueMonth = due.getFullYear() * 12 + due.getMonth();
        const isCurrentMonth = dueMonth === todayMonth;
        const isPastUnpaid = dueMonth < todayMonth && !entry.paid;
        if (!isCurrentMonth && !isPastUnpaid) return;
        out.push({
          clientId: c.id,
          clientName: c.nm,
          segment: getSegment(c),
          entryIndex: i,
          entry,
          dueDate: entry.dueDate,
          dueDateObj: due,
          amount: entry.amount || 0,
          isLate: isPastUnpaid,
        });
      });
    }
    // Late first (oldest dueDate first), then current-month asc
    out.sort((a, b) => {
      if (a.isLate !== b.isLate) return a.isLate ? -1 : 1;
      return a.dueDateObj - b.dueDateObj;
    });
    return out;
  }, [d.cl, todayMonth]);

  const stats = useMemo(() => {
    const lateItems = items.filter(x => x.isLate);
    const lateAmount = lateItems.reduce((s, x) => s + x.amount, 0);
    const monthItems = items.filter(x => !x.isLate);
    const monthDueUnpaid = monthItems.filter(x => !x.entry.paid);
    const dueAmount = monthDueUnpaid.reduce((s, x) => s + x.amount, 0);
    const monthPaid = monthItems.filter(x => x.entry.paid);
    const collectedAmount = monthPaid.reduce((s, x) => s + x.amount, 0);
    return {
      lateCount: lateItems.length, lateAmount,
      paidCount: monthPaid.length, collectedAmount,
      dueCount: monthDueUnpaid.length, dueAmount,
    };
  }, [items]);

  const monthLabel = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Patch a single paymentSchedule entry inside d.cl, bubbling up via save().
  const patchEntry = (clientId, entryIndex, newEntry) => {
    if (!save) return;
    save({
      ...d,
      cl: d.cl.map(c => {
        if (c.id !== clientId) return c;
        const sc = c.serviceContract;
        const sched = sc?.paymentSchedule || [];
        const next = sched.map((e, i) => i === entryIndex ? newEntry : e);
        return {
          ...c,
          serviceContract: { ...sc, paymentSchedule: next },
          lastEditedAt: new Date().toISOString(),
        };
      }),
    });
  };

  const onStatusChange = (clientId, entryIndex, currentEntry, newStatus) => {
    patchEntry(clientId, entryIndex, applyStatusToEntry(currentEntry, newStatus, today));
  };

  const onNoteChange = (clientId, entryIndex, currentEntry, newNote) => {
    patchEntry(clientId, entryIndex, { ...currentEntry, note: newNote });
  };

  return (
    <div>
      {/* Header counter */}
      <Card style={{ padding: 16, marginBottom: 16, borderLeft: `3px solid ${P.t}` }}>
        <Lbl>{monthLabel} payments</Lbl>
        <div style={{ fontSize: 13, color: P.tx, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: stats.paidCount > 0 ? P.g : P.tm }}>
            {stats.paidCount} paid ({fmtMoney(stats.collectedAmount)})
          </span>
          <span style={{ color: P.td }}> · </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: stats.lateCount > 0 ? P.r : P.tm }}>
            {stats.lateCount} late ({fmtMoney(stats.lateAmount)})
          </span>
          <span style={{ color: P.td }}> · </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: stats.dueCount > 0 ? P.a : P.tm }}>
            {stats.dueCount} due this month ({fmtMoney(stats.dueAmount)})
          </span>
        </div>
      </Card>

      {/* Worklist */}
      {items.length === 0 ? (
        <Card style={{ padding: 32, textAlign: "center" }}>
          <div style={{ color: P.tm, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
            No payments to track this month.
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map(item => {
            const status = item.entry.status || (item.entry.paid ? "P" : item.isLate ? "L" : "U");
            const lateDays = item.isLate ? -daysUntil(item.dueDateObj, today) : 0;
            return (
              <div
                key={`${item.clientId}-${item.entryIndex}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(200px, 1.5fr) 130px 110px auto minmax(200px, 2fr)",
                  gap: 14,
                  padding: "10px 14px",
                  background: P.c1,
                  border: `1px solid ${P.bd}`,
                  borderRadius: 6,
                  alignItems: "center",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                }}
              >
                {/* Client name + avatar (button → routes to Clients tab) */}
                <button
                  onClick={() => onNavigateToClient && onNavigateToClient(item.clientId)}
                  title="Open in Clients tab"
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "transparent", border: "none", padding: 0, cursor: "pointer",
                    color: P.tx, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                    textAlign: "left", minWidth: 0,
                  }}
                >
                  <Avatar name={item.clientName} segment={item.segment} size={28} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.clientName}
                  </span>
                </button>

                {/* Due date + late stamp */}
                <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  <div style={{ color: P.td, fontSize: 11 }}>{item.dueDate}</div>
                  {item.isLate && (
                    <div style={{ color: P.r, fontSize: 10, fontWeight: 600 }}>
                      {lateDays} day{lateDays === 1 ? "" : "s"} late
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div style={{ color: P.tx, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, textAlign: "right" }}>
                  {fmtMoney(item.amount)}
                </div>

                {/* Status chips */}
                <StatusChips
                  value={status}
                  onChange={(s) => onStatusChange(item.clientId, item.entryIndex, item.entry, s)}
                />

                {/* Inline note */}
                <NoteCell
                  value={item.entry.note}
                  onCommit={(v) => onNoteChange(item.clientId, item.entryIndex, item.entry, v)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
