// Phase E2a — unified Clients tab with three view modes (segment / value / Sara).
// Read-only. Edit affordances disabled. Sara auto-routes to her view.

import React, { useState, useMemo } from "react";
import { P } from "./data.js";
import { Card, Lbl } from "./components.jsx";
import ClientCard from "./ClientCard.jsx";
import {
  getSegment, clientValue, daysUntil, paymentDueStatus,
  SEGMENT_LABELS,
} from "./clientsHelpers.js";

const fmtMoney = (n) => {
  if (!n || n === 0) return "—";
  const a = Math.abs(Math.round(n));
  return n < 0 ? `($${a.toLocaleString()})` : `$${a.toLocaleString()}`;
};

const SEGMENT_ORDER = ["infinityMirror", "scopeOnly", "fullProject", "supportOnly"];
const SEGMENT_COLORS = { infinityMirror: P.g, scopeOnly: P.a, fullProject: P.b, supportOnly: P.t };

const filterPills = [
  ["all", "All"],
  ["active", "Active"],
  ["at-risk", "At-risk"],
  ["churned", "Churned"],
  ["pipeline", "Pipeline"],
];

function clientStatus(c) {
  return c.serviceContract?.status || c.zohoCommission?.status || "active";
}

function matchesSearch(c, q) {
  if (!q) return true;
  return c.nm.toLowerCase().includes(q.toLowerCase());
}

// === Renewal Watch banner ===
function RenewalWatch({ clients, today }) {
  const within60 = clients
    .filter(c => c.serviceContract?.endDate)
    .map(c => ({ client: c, days: daysUntil(new Date(c.serviceContract.endDate), today) }))
    .filter(x => x.days >= 0 && x.days <= 60)
    .sort((a, b) => a.days - b.days);

  const beyond60 = clients
    .filter(c => c.serviceContract?.endDate)
    .map(c => ({ client: c, days: daysUntil(new Date(c.serviceContract.endDate), today) }))
    .filter(x => x.days > 60)
    .sort((a, b) => a.days - b.days)[0];

  return (
    <Card style={{ padding: 16, marginBottom: 16, borderLeft: `3px solid ${P.a}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: within60.length > 0 ? 10 : 0 }}>
        <Lbl>Renewal Watch ({within60.length} contract{within60.length === 1 ? "" : "s"} up in next 60 days)</Lbl>
      </div>
      {within60.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {within60.map(({ client, days }) => (
            <div key={client.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: P.c2, borderRadius: 5, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: P.tx, fontWeight: 600 }}>{client.nm}</span>
              <span style={{ color: P.a, fontFamily: "'JetBrains Mono', monospace" }}>{days} days · {client.serviceContract.endDate}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: P.tm, fontStyle: "italic" }}>
          No contracts up for renewal in the next 60 days.
          {beyond60 && (
            <span style={{ display: "block", marginTop: 6, color: P.td, fontStyle: "normal" }}>
              Next: <span style={{ color: P.tx, fontWeight: 600 }}>{beyond60.client.nm}</span> — <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{beyond60.days} days ({beyond60.client.serviceContract.endDate})</span>
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

// === By segment view ===
function BySegmentView({ clients, today, expandedId, setExpandedId, isAdmin, isViewer }) {
  const grouped = useMemo(() => {
    const out = { infinityMirror: [], scopeOnly: [], fullProject: [], supportOnly: [] };
    clients.forEach(c => {
      const seg = getSegment(c);
      if (seg && out[seg]) out[seg].push(c);
    });
    return out;
  }, [clients]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {SEGMENT_ORDER.map(seg => {
        const list = grouped[seg];
        if (list.length === 0) return null;
        return (
          <div key={seg}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: SEGMENT_COLORS[seg] }} />
              <span style={{ fontSize: 12, color: P.tx, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em" }}>{SEGMENT_LABELS[seg]}</span>
              <span style={{ fontSize: 11, color: P.td }}>({list.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {list.map(c => (
                <ClientCard key={c.id} client={c} today={today} expanded={expandedId === c.id} onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)} isAdmin={isAdmin} isViewer={isViewer} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// === By value view ===
function ByValueView({ clients, today, expandedId, setExpandedId, isAdmin, isViewer }) {
  const ranked = useMemo(() => {
    return [...clients]
      .map(c => ({
        client: c,
        value: clientValue(c, today),
        breakdown: (() => {
          const sc = c.serviceContract;
          const zc = c.zohoCommission;
          const sched = sc?.paymentSchedule || [];
          const unpaidFuture = sched.filter(p => !p.paid && new Date(p.dueDate) >= today).reduce((s, p) => s + (p.amount || 0), 0);
          const zohoMonthly12 = (zc?.monthlyAmount || 0) * 12;
          const zohoAnnual = zc?.annualAmount || 0;
          const parts = [];
          if (unpaidFuture > 0) parts.push(`${fmtMoney(unpaidFuture)} unpaid future`);
          if (zohoMonthly12 > 0) parts.push(`${fmtMoney(zohoMonthly12)} Zoho/yr`);
          if (zohoAnnual > 0) parts.push(`${fmtMoney(zohoAnnual)} Zoho annual`);
          return parts.length ? parts.join(" + ") : "—";
        })(),
      }))
      .sort((a, b) => b.value - a.value || a.client.nm.localeCompare(b.client.nm));
  }, [clients, today]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {ranked.map(({ client, value, breakdown }) => (
        <div key={client.id}>
          <ClientCard client={client} today={today} expanded={expandedId === client.id} onToggle={() => setExpandedId(expandedId === client.id ? null : client.id)} isAdmin={isAdmin} isViewer={isViewer} />
          {expandedId !== client.id && (
            <div style={{ padding: "4px 14px 0 26px", fontSize: 10, color: P.td, fontFamily: "'DM Sans', sans-serif" }}>
              value <span style={{ color: P.t, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{fmtMoney(value)}</span> — {breakdown}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// === Sara's view ===
function SaraView({ clients, today, expandedId, setExpandedId }) {
  // Build worklist from all clients' paymentSchedule
  const todayMonth = today.getFullYear() * 12 + today.getMonth();

  const allEntries = clients.flatMap(c =>
    (c.serviceContract?.paymentSchedule || []).map(p => ({
      ...p,
      clientId: c.id,
      clientName: c.nm,
      _due: new Date(p.dueDate),
    }))
  );
  const worklist = allEntries.filter(e => {
    const dueMonth = e._due.getFullYear() * 12 + e._due.getMonth();
    if (dueMonth === todayMonth) return true; // current month
    if (dueMonth < todayMonth && !e.paid) return true; // past unpaid
    return false;
  }).sort((a, b) => a._due - b._due);

  const lateEntries = worklist.filter(e => !e.paid && e._due < today && (e._due.getFullYear() * 12 + e._due.getMonth()) < todayMonth);
  const thisMonthEntries = worklist.filter(e => (e._due.getFullYear() * 12 + e._due.getMonth()) === todayMonth);

  const paidCount = worklist.filter(e => e.paid).length;
  const totalCount = worklist.length;
  const collected = worklist.filter(e => e.paid).reduce((s, e) => s + e.amount, 0);
  const outstanding = worklist.filter(e => !e.paid).reduce((s, e) => s + e.amount, 0);

  const monthLabel = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const renderEntry = (e) => {
    const status = paymentDueStatus(e, today);
    const isLate = status === "late";
    const days = isLate ? -daysUntil(e._due, today) : 0;
    const statusColor = status === "paid" ? P.g : status === "late" ? P.r : status === "due" ? P.a : P.tm;
    return (
      <div key={`${e.clientId}-${e.dueDate}`} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 12, padding: "10px 12px", background: P.c1, border: `1px solid ${P.bd}`, borderRadius: 6, alignItems: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>
        <div style={{ color: P.tx, fontWeight: 600 }}>{e.clientName}</div>
        <div style={{ color: P.tx, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{fmtMoney(e.amount)}</div>
        <div style={{ color: P.td, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{e.dueDate}</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, color: statusColor, fontWeight: 600, fontSize: 11 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: statusColor }} />
          {status === "paid" ? "Paid" : status === "late" ? `${days} days late` : status === "due" ? "Due" : "Upcoming"}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button disabled style={{ background: "transparent", border: `1px solid ${P.bd}`, borderRadius: 4, padding: "3px 8px", color: P.td, fontSize: 10, cursor: "not-allowed", fontFamily: "'DM Sans', sans-serif", opacity: 0.55 }}>Mark paid</button>
          <button disabled style={{ background: "transparent", border: `1px solid ${P.bd}`, borderRadius: 4, padding: "3px 8px", color: P.td, fontSize: 10, cursor: "not-allowed", fontFamily: "'DM Sans', sans-serif", opacity: 0.55 }}>Note</button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Worklist header */}
      <Card style={{ padding: 16, marginBottom: 16, borderLeft: `3px solid ${P.t}` }}>
        <Lbl>{monthLabel} invoices</Lbl>
        <div style={{ fontSize: 13, color: P.tx, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: P.g }}>{paidCount} of {totalCount} paid</span>
          <span style={{ color: P.td }}> · </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: P.g }}>{fmtMoney(collected)} collected</span>
          <span style={{ color: P.td }}> · </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: P.r }}>{fmtMoney(outstanding)} outstanding</span>
        </div>
      </Card>

      {/* Late section */}
      {lateEntries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Lbl style={{ color: P.r }}>! Late ({lateEntries.length})</Lbl>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{lateEntries.map(renderEntry)}</div>
        </div>
      )}

      {/* This month section */}
      <div style={{ marginBottom: 24 }}>
        <Lbl>This month ({thisMonthEntries.length})</Lbl>
        {thisMonthEntries.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{thisMonthEntries.map(renderEntry)}</div>
        ) : (
          <div style={{ fontSize: 12, color: P.tm, fontStyle: "italic", padding: "8px 12px" }}>No invoices this month.</div>
        )}
      </div>

      {/* All clients (simple list, no segmentation) */}
      <div>
        <Lbl>All clients ({clients.length})</Lbl>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {clients.map(c => (
            <ClientCard key={c.id} client={c} today={today} expanded={expandedId === c.id} onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)} isAdmin={false} isViewer={true} />
          ))}
        </div>
      </div>
    </div>
  );
}

// === Main ClientsTab ===
export default function ClientsTab({ d, isAdmin, isViewer, isIntern }) {
  const today = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState(isIntern ? "sara" : "segment");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // Filter clients based on status + search (used by segment & value views)
  const filteredClients = useMemo(() => {
    return d.cl.filter(c => {
      if (!matchesSearch(c, searchQuery)) return false;
      if (filterStatus === "all") return true;
      return clientStatus(c) === filterStatus;
    });
  }, [d.cl, filterStatus, searchQuery]);

  if (isIntern || viewMode === "sara") {
    return <SaraView clients={d.cl} today={today} expandedId={expandedId} setExpandedId={setExpandedId} />;
  }

  return (
    <div>
      {/* View toggle (Paul/Mark only) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, padding: 3, background: P.c2, borderRadius: 7, border: `1px solid ${P.bd}` }}>
          {[["segment", "By segment"], ["value", "By value"]].map(([k, l]) => (
            <button key={k} onClick={() => setViewMode(k)} style={{ padding: "6px 14px", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", background: viewMode === k ? P.bg : "transparent", color: viewMode === k ? P.tx : P.tm, border: "none", borderRadius: 5, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search clients..." style={{ background: P.c2, border: `1px solid ${P.bd}`, borderRadius: 6, padding: "6px 12px", color: P.tx, fontSize: 12, fontFamily: "'DM Sans', sans-serif", width: 220 }} />
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {filterPills.map(([k, l]) => (
          <button key={k} onClick={() => setFilterStatus(k)} style={{ padding: "5px 12px", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, background: filterStatus === k ? P.c2 : "transparent", color: filterStatus === k ? P.tx : P.tm, border: `1px solid ${filterStatus === k ? P.bd : "transparent"}`, borderRadius: 5, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {/* Renewal Watch (hidden for Sara — handled by isIntern branch above) */}
      <RenewalWatch clients={d.cl} today={today} />

      {/* Body */}
      {filteredClients.length === 0 ? (
        <Card style={{ padding: 32, textAlign: "center" }}>
          <div style={{ color: P.tm, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No clients match this filter.</div>
        </Card>
      ) : viewMode === "value" ? (
        <ByValueView clients={filteredClients} today={today} expandedId={expandedId} setExpandedId={setExpandedId} isAdmin={isAdmin} isViewer={isViewer} />
      ) : (
        <BySegmentView clients={filteredClients} today={today} expandedId={expandedId} setExpandedId={setExpandedId} isAdmin={isAdmin} isViewer={isViewer} />
      )}
    </div>
  );
}
