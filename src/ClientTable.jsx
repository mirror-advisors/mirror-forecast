// Phase E2c.1 — Ranked view: sortable table.
// Click row → opens ClientDrawer (orchestrated by ClientsTab).

import React, { useMemo, useState } from "react";
import { P } from "./data.js";
import { getSegment, clientValue, SEGMENT_LABELS } from "./clientsHelpers.js";
import { StatusPill, SegmentPill, Avatar, SEGMENT_COLORS } from "./ClientPills.jsx";

const fmtMoney = (n) => {
  if (!n || n === 0) return "—";
  const a = Math.abs(Math.round(n));
  return n < 0 ? `($${a.toLocaleString()})` : `$${a.toLocaleString()}`;
};

const FORWARD_VALUE_FORMULA =
  "Forward value = sum of unpaid future paymentSchedule entries + (Zoho monthly × 12) + Zoho annual";

function clientStatus(c) {
  return c.serviceContract?.status || c.zohoCommission?.status || "active";
}

export default function ClientTable({ clients, today, onSelectClient, selectedClientId }) {
  const [sortKey, setSortKey] = useState("forward");
  const [sortDir, setSortDir] = useState("desc");

  const rows = useMemo(() => {
    return clients.map(c => {
      const sc = c.serviceContract;
      const zc = c.zohoCommission;
      return {
        client: c,
        segment: getSegment(c),
        serviceMo: sc?.monthlyAmount || 0,
        zohoMo: zc?.frequency === "monthly" ? (zc.monthlyAmount || 0) : 0,
        zohoYr: zc?.frequency === "annual" ? (zc.annualAmount || 0) : 0,
        forward: clientValue(c, today),
        status: clientStatus(c),
      };
    });
  }, [clients, today]);

  const sorted = useMemo(() => {
    const dir = sortDir === "desc" ? -1 : 1;
    const get = {
      name:    r => r.client.nm.toLowerCase(),
      service: r => r.serviceMo,
      zoho:    r => r.zohoMo > 0 ? r.zohoMo * 12 : r.zohoYr,
      forward: r => r.forward,
    }[sortKey] || (r => r.forward);
    return [...rows].sort((a, b) => {
      const av = get(a); const bv = get(b);
      if (av < bv) return dir;
      if (av > bv) return -dir;
      return a.client.nm.localeCompare(b.client.nm);
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const sortIcon = (key) => sortKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  const thBase = { padding: "10px 12px", color: P.td, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${P.bd}`, whiteSpace: "nowrap" };
  const thSortable = { ...thBase, cursor: "pointer", userSelect: "none" };
  const tdBase = { padding: "10px 12px", borderBottom: `1px solid ${P.bd}30`, fontSize: 12, color: P.tx, fontFamily: "'DM Sans', sans-serif", verticalAlign: "middle" };
  const tdMono = { ...tdBase, fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div style={{ background: P.c1, border: `1px solid ${P.bd}`, borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: P.c2 }}>
            <th style={{ ...thBase, width: 40, textAlign: "right" }}>#</th>
            <th style={{ ...thSortable, textAlign: "left" }} onClick={() => toggleSort("name")}>Client{sortIcon("name")}</th>
            <th style={{ ...thBase, textAlign: "left", width: 180 }}>Segment</th>
            <th style={{ ...thSortable, textAlign: "right", width: 120 }} onClick={() => toggleSort("service")}>Service $/mo{sortIcon("service")}</th>
            <th style={{ ...thSortable, textAlign: "right", width: 130 }} onClick={() => toggleSort("zoho")}>Zoho{sortIcon("zoho")}</th>
            <th
              style={{ ...thSortable, textAlign: "right", width: 150 }}
              onClick={() => toggleSort("forward")}
              title={FORWARD_VALUE_FORMULA}
            >
              Forward value
              <span title={FORWARD_VALUE_FORMULA} style={{ marginLeft: 4, color: P.tm, cursor: "help", fontSize: 10 }}>ⓘ</span>
              {sortIcon("forward")}
            </th>
            <th style={{ ...thBase, width: 110, textAlign: "left" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const c = r.client;
            const accent = SEGMENT_COLORS[r.segment] || P.tm;
            const isSelected = selectedClientId === c.id;
            return (
              <tr
                key={c.id}
                onClick={() => onSelectClient(c.id)}
                style={{
                  cursor: "pointer",
                  background: isSelected ? `${P.b}15` : "transparent",
                  borderLeft: `3px solid ${isSelected ? P.b : "transparent"}`,
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = `${P.c2}50`; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <td style={{ ...tdMono, color: P.td, fontSize: 11, textAlign: "right" }}>{i + 1}</td>
                <td style={tdBase}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={c.nm} segment={r.segment} size={24} />
                    <span style={{ fontWeight: 600 }}>{c.nm}</span>
                    {c.serviceContract?.inForecast === false && <span style={{ fontSize: 9, color: P.r, fontWeight: 700 }}>OOF</span>}
                  </span>
                </td>
                <td style={tdBase}>{r.segment ? <SegmentPill segment={r.segment} /> : <span style={{ color: P.td }}>—</span>}</td>
                <td style={{ ...tdMono, textAlign: "right", color: r.serviceMo > 0 ? P.tx : P.td }}>{r.serviceMo > 0 ? fmtMoney(r.serviceMo) + "/mo" : "—"}</td>
                <td style={{ ...tdMono, textAlign: "right", color: (r.zohoMo > 0 || r.zohoYr > 0) ? P.t : P.td }}>
                  {r.zohoMo > 0 ? `${fmtMoney(r.zohoMo)}/mo`
                    : r.zohoYr > 0 ? `${fmtMoney(r.zohoYr)}/yr`
                    : "—"}
                </td>
                <td style={{ ...tdMono, textAlign: "right", fontWeight: 700, color: r.forward > 20000 ? P.g : r.forward > 5000 ? P.a : P.t }}>{fmtMoney(r.forward)}</td>
                <td style={tdBase}><StatusPill status={r.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
