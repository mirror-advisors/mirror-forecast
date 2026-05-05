// Phase E2c.1 — unified Clients tab with master/detail (List) + sortable
// table (Ranked) views. View pref + selection persisted per user in
// localStorage. Sara still routes to her worklist view (unchanged); her
// view-pref key is stubbed for future-proofing (Q7) but no toggle UI surfaces.

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { P } from "./data.js";
import { Card, Lbl } from "./components.jsx";
import ClientList from "./ClientList.jsx";
import ClientDetail from "./ClientDetail.jsx";
import ClientTable from "./ClientTable.jsx";
import ClientDrawer from "./ClientDrawer.jsx";
import {
  daysUntil, paymentDueStatus, nextClientId,
} from "./clientsHelpers.js";

const fmtMoney = (n) => {
  if (!n || n === 0) return "—";
  const a = Math.abs(Math.round(n));
  return n < 0 ? `($${a.toLocaleString()})` : `$${a.toLocaleString()}`;
};

const FILTER_PILLS = [
  ["all",            "All"],
  ["active",         "Active"],
  ["at-risk",        "At-risk"],
  ["out-of-forecast","Out of forecast"],
];

function clientStatus(c) {
  return c.serviceContract?.status || c.zohoCommission?.status || "active";
}

function matchesFilter(c, filterStatus) {
  if (filterStatus === "all") return true;
  if (filterStatus === "out-of-forecast") {
    return c.serviceContract?.inForecast === false || c.zohoCommission?.inForecast === false;
  }
  return clientStatus(c) === filterStatus;
}

function matchesSearch(c, q) {
  if (!q) return true;
  const ql = q.toLowerCase();
  return (c.nm || "").toLowerCase().includes(ql)
      || (c.email || "").toLowerCase().includes(ql);
}

// === Sara's worklist view (unchanged from E2b — she's not in scope for E2c.1) ===
function SaraView({ clients, today }) {
  const todayMonth = today.getFullYear() * 12 + today.getMonth();
  const allEntries = clients.flatMap(c =>
    (c.serviceContract?.paymentSchedule || []).map(p => ({
      ...p, clientId: c.id, clientName: c.nm, _due: new Date(p.dueDate),
    }))
  );
  const worklist = allEntries.filter(e => {
    const dueMonth = e._due.getFullYear() * 12 + e._due.getMonth();
    if (dueMonth === todayMonth) return true;
    if (dueMonth < todayMonth && !e.paid) return true;
    return false;
  }).sort((a, b) => a._due - b._due);

  const lateEntries = worklist.filter(e => !e.paid && e._due < today && (e._due.getFullYear() * 12 + e._due.getMonth()) < todayMonth);
  const thisMonthEntries = worklist.filter(e => (e._due.getFullYear() * 12 + e._due.getMonth()) === todayMonth);
  const lateAmount = lateEntries.reduce((s, e) => s + (e.amount || 0), 0);
  const dueAmount = thisMonthEntries.filter(e => !e.paid).reduce((s, e) => s + (e.amount || 0), 0);

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
      <Card style={{ padding: 16, marginBottom: 16, borderLeft: `3px solid ${P.t}` }}>
        <Lbl>{monthLabel} invoices</Lbl>
        <div style={{ fontSize: 13, color: P.tx, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: lateEntries.length > 0 ? P.r : P.tm }}>
            {lateEntries.length} late ({fmtMoney(lateAmount)})
          </span>
          <span style={{ color: P.td }}> · </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: thisMonthEntries.length > 0 ? P.a : P.tm }}>
            {thisMonthEntries.length} due this month ({fmtMoney(dueAmount)})
          </span>
        </div>
      </Card>

      {lateEntries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Lbl style={{ color: P.r }}>! Late ({lateEntries.length})</Lbl>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{lateEntries.map(renderEntry)}</div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <Lbl>This month ({thisMonthEntries.length})</Lbl>
        {thisMonthEntries.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{thisMonthEntries.map(renderEntry)}</div>
        ) : (
          <div style={{ fontSize: 12, color: P.tm, fontStyle: "italic", padding: "8px 12px" }}>No invoices this month.</div>
        )}
      </div>
    </div>
  );
}

// === Renewal Watch banner (unchanged from E2b) ===
function RenewalWatch({ clients, today }) {
  const within60 = clients
    .filter(c => c.serviceContract?.endDate)
    .map(c => ({ client: c, days: daysUntil(new Date(c.serviceContract.endDate), today) }))
    .filter(x => x.days >= 0 && x.days <= 60)
    .sort((a, b) => a.days - b.days);

  return (
    <Card style={{ padding: 12, marginBottom: 12, borderLeft: `3px solid ${P.a}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Lbl>Renewal Watch ({within60.length} contract{within60.length === 1 ? "" : "s"} up in next 60 days)</Lbl>
      </div>
      {within60.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {within60.map(({ client, days }) => (
            <div key={client.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", background: P.c2, borderRadius: 4, fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: P.tx, fontWeight: 600 }}>{client.nm}</span>
              <span style={{ color: P.a, fontFamily: "'JetBrains Mono', monospace" }}>{days}d · {client.serviceContract.endDate}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// === Main ClientsTab ===
export default function ClientsTab({ d, save, profile, isAdmin, isViewer, isIntern }) {
  const today = useMemo(() => new Date(), []);
  const userKey = profile?.id || profile?.email || "anon";
  const viewPrefKey = `clients_view_pref:${userKey}`;
  const selectedKey = `clients_selected:${userKey}`;

  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "list";
    return localStorage.getItem(viewPrefKey) || "list";
  });
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(selectedKey);
  });
  const [drawerClientId, setDrawerClientId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Q7: stub Sara view pref on first load (no toggle UI surfaced)
  useEffect(() => {
    if (isIntern && typeof window !== "undefined" && !localStorage.getItem(viewPrefKey)) {
      localStorage.setItem(viewPrefKey, "sara");
    }
  }, [isIntern, viewPrefKey]);

  // Persist view pref
  useEffect(() => {
    if (typeof window !== "undefined" && view) localStorage.setItem(viewPrefKey, view);
  }, [view, viewPrefKey]);

  // Persist selected client (List view)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedId) localStorage.setItem(selectedKey, selectedId);
  }, [selectedId, selectedKey]);

  // Filter clients (shared by both views)
  const filteredClients = useMemo(() => {
    return d.cl.filter(c => matchesSearch(c, searchQuery) && matchesFilter(c, filterStatus));
  }, [d.cl, filterStatus, searchQuery]);

  // Auto-select first visible client in List view if nothing selected (or selected was filtered out)
  useEffect(() => {
    if (view !== "list" || filteredClients.length === 0) return;
    if (!selectedId || !filteredClients.find(c => c.id === selectedId)) {
      setSelectedId(filteredClients[0].id);
    }
  }, [view, filteredClients, selectedId]);

  // Bubble client edits up to App via save()
  const onClientChange = useCallback((newClient) => {
    if (!save) return;
    const stamped = { ...newClient, lastEditedAt: new Date().toISOString() };
    save({ ...d, cl: d.cl.map(c => c.id === stamped.id ? stamped : c) });
  }, [d, save]);

  // + New client (C1.5: sequential c-id)
  const onAddClient = useCallback(() => {
    if (!save) return;
    const newId = nextClientId(d.cl);
    const newClient = {
      id: newId, nm: "New Client", email: null, notes: "",
      serviceContract: null, zohoCommission: null,
      lastEditedAt: new Date().toISOString(), lastEditedBy: null,
    };
    save({ ...d, cl: [...d.cl, newClient] });
    setSelectedId(newId);
    if (view === "ranked") setDrawerClientId(newId);
  }, [d, save, view]);

  // Sara fallback — no toggle, her worklist view
  if (isIntern) return <SaraView clients={d.cl} today={today} />;

  const selectedClient = d.cl.find(c => c.id === selectedId) || filteredClients[0] || null;
  const drawerClient = drawerClientId ? d.cl.find(c => c.id === drawerClientId) : null;

  const toggleBtnSty = (active) => ({
    padding: "6px 14px", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
    background: active ? P.bg : "transparent", color: active ? P.tx : P.tm,
    border: "none", borderRadius: 5, cursor: "pointer",
  });
  const chipBtnSty = (active) => ({
    padding: "5px 12px", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
    background: active ? P.c2 : "transparent", color: active ? P.tx : P.tm,
    border: `1px solid ${active ? P.bd : "transparent"}`, borderRadius: 5, cursor: "pointer",
  });

  return (
    <div>
      {/* Top bar: view toggle | filter chips | search | + new */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, padding: 3, background: P.c2, borderRadius: 7, border: `1px solid ${P.bd}` }}>
          {[["list", "List"], ["ranked", "Ranked"]].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} style={toggleBtnSty(view === k)}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTER_PILLS.map(([k, l]) => (
            <button key={k} onClick={() => setFilterStatus(k)} style={chipBtnSty(filterStatus === k)}>{l}</button>
          ))}
        </div>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search clients…"
          style={{ background: P.c2, border: `1px solid ${P.bd}`, borderRadius: 6, padding: "6px 12px", color: P.tx, fontSize: 12, fontFamily: "'DM Sans', sans-serif", width: 220 }}
        />
        <div style={{ flex: 1 }} />
        {!isViewer && (
          <button
            onClick={onAddClient}
            style={{ background: P.b, color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >+ New client</button>
        )}
      </div>

      {/* Renewal watch (compact, above main body) */}
      <RenewalWatch clients={d.cl} today={today} />

      {/* Body */}
      {filteredClients.length === 0 ? (
        <Card style={{ padding: 32, textAlign: "center" }}>
          <div style={{ color: P.tm, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No clients match this filter.</div>
        </Card>
      ) : view === "list" ? (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <ClientList
            clients={filteredClients}
            today={today}
            selectedId={selectedClient?.id}
            onSelect={setSelectedId}
          />
          <div style={{ flex: 1, minWidth: 0, height: "calc(100vh - 200px)", overflow: "hidden" }}>
            {selectedClient ? (
              <ClientDetail
                client={selectedClient}
                today={today}
                onChange={onClientChange}
                isAdmin={isAdmin}
                isViewer={isViewer}
                narrow={false}
              />
            ) : (
              <Card style={{ padding: 60, textAlign: "center" }}>
                <div style={{ color: P.tm, fontSize: 13 }}>Select a client from the list</div>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <ClientTable
          clients={filteredClients}
          today={today}
          selectedClientId={drawerClientId}
          onSelectClient={setDrawerClientId}
        />
      )}

      {/* Drawer (Ranked view only, when row clicked) */}
      {drawerClient && (
        <ClientDrawer
          client={drawerClient}
          today={today}
          onChange={onClientChange}
          onClose={() => setDrawerClientId(null)}
          isAdmin={isAdmin}
          isViewer={isViewer}
        />
      )}
    </div>
  );
}
