// Phase E2c.1 — unified Clients tab with master/detail (List) + sortable
// table (Ranked) views. View pref + selection persisted per user in
// localStorage.
// E2d: SaraView removed; Sara now reaches client editing through this same
// tab (full Paul-equivalent surface). Cross-tab navigation from PaymentsTab
// arrives via the pendingClientId prop.

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { P } from "./data.js";
import { Card, Lbl } from "./components.jsx";
import ClientList from "./ClientList.jsx";
import ClientDetail from "./ClientDetail.jsx";
import ClientTable from "./ClientTable.jsx";
import ClientDrawer from "./ClientDrawer.jsx";
import { daysUntil, nextClientId } from "./clientsHelpers.js";

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
export default function ClientsTab({ d, save, profile, isAdmin, isViewer, pendingClientId, onConsumePending }) {
  const today = useMemo(() => new Date(), []);
  const userKey = profile?.id || profile?.email || "anon";
  const viewPrefKey = `clients_view_pref:${userKey}`;
  const selectedKey = `clients_selected:${userKey}`;

  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "list";
    const stored = localStorage.getItem(viewPrefKey);
    // E2d: scrub legacy "sara" pref left over from the removed SaraView routing.
    return (stored === "list" || stored === "ranked") ? stored : "list";
  });
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(selectedKey);
  });
  const [drawerClientId, setDrawerClientId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // E2d: cross-tab nav from PaymentsTab. When pendingClientId arrives, force
  // List view + select that client, then signal App to clear the pending flag
  // so re-clicking the same row later still re-fires.
  useEffect(() => {
    if (!pendingClientId) return;
    setView("list");
    setSelectedId(pendingClientId);
    if (onConsumePending) onConsumePending();
  }, [pendingClientId, onConsumePending]);

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
