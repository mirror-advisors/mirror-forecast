// Phase E2c.1 — left pane "master" list for List view.
// 240px wide, fixed. Search + filter chips live in ClientsTab top bar
// (shared across views), so this component is just the segment-grouped row list.

import React, { useMemo, useState } from "react";
import { P } from "./data.js";
import {
  getSegment, clientSubtitle,
  SEGMENT_LABELS, SEGMENT_ORDER, HISTORICAL_SEGMENT,
} from "./clientsHelpers.js";
import { StatusPill, SEGMENT_COLORS } from "./ClientPills.jsx";

function Row({ client, today, selected, onClick }) {
  const segment = getSegment(client);
  const subtitle = clientSubtitle(client, today);
  const status = client.serviceContract?.status || client.zohoCommission?.status || "active";
  const accent = SEGMENT_COLORS[segment] || P.tm;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 10px 9px 8px",
        background: selected ? `${P.b}15` : "transparent",
        borderLeft: `3px solid ${selected ? P.b : "transparent"}`,
        cursor: "pointer",
        borderBottom: `1px solid ${P.bd}25`,
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = `${P.c2}80`; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ width: 4, height: 28, borderRadius: 2, background: accent, flexShrink: 0, opacity: 0.6 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: P.tx, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.nm}</div>
        <div style={{ fontSize: 10, color: P.tm, marginTop: 1, fontFamily: "'DM Sans', sans-serif" }}>{subtitle}</div>
      </div>
      <StatusPill status={status} />
    </div>
  );
}

function SegmentGroup({ segment, clients, today, selectedId, onSelect, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (clients.length === 0) return null;
  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 10px", background: P.c1, borderBottom: `1px solid ${P.bd}40`,
          cursor: "pointer", userSelect: "none",
        }}
      >
        <span style={{ fontSize: 9, color: P.td, transition: "transform 0.15s", display: "inline-block", transform: open ? "rotate(90deg)" : "none" }}>▶</span>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: SEGMENT_COLORS[segment] || P.tm }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: P.tx, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.04em", textTransform: "uppercase", flex: 1 }}>
          {SEGMENT_LABELS[segment]}
        </span>
        <span style={{ fontSize: 10, color: P.td, fontFamily: "'JetBrains Mono', monospace" }}>{clients.length}</span>
      </div>
      {open && (
        <div>
          {clients.map(c => (
            <Row key={c.id} client={c} today={today} selected={selectedId === c.id} onClick={() => onSelect(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientList({ clients, today, selectedId, onSelect }) {
  const grouped = useMemo(() => {
    const out = { infinityMirror: [], supportRetainer: [], bankOfHours: [], fullProject: [], zohoCommissionOnly: [], oneTime: [] };
    clients.forEach(c => {
      const seg = getSegment(c);
      if (seg && out[seg]) out[seg].push(c);
    });
    return out;
  }, [clients]);

  return (
    <div style={{ width: 240, flexShrink: 0, height: "calc(100vh - 200px)", overflowY: "auto", background: P.c1, border: `1px solid ${P.bd}`, borderRadius: 8 }}>
      {SEGMENT_ORDER.map(seg => (
        <SegmentGroup
          key={seg}
          segment={seg}
          clients={grouped[seg] || []}
          today={today}
          selectedId={selectedId}
          onSelect={onSelect}
          defaultOpen={true}
        />
      ))}
      {/* Historical collapsed by default */}
      <SegmentGroup
        segment={HISTORICAL_SEGMENT}
        clients={grouped[HISTORICAL_SEGMENT] || []}
        today={today}
        selectedId={selectedId}
        onSelect={onSelect}
        defaultOpen={false}
      />
    </div>
  );
}
