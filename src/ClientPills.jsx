// Phase E2c.1 — shared pills used in list rows, table rows, and detail header.
// Pure presentational, no edit logic.

import React from "react";
import { P } from "./data.js";
import { SEGMENT_LABELS, STATUS_LABELS } from "./clientsHelpers.js";

export const STATUS_COLORS = {
  active:    { bg: P.gB, fg: P.g },
  "at-risk": { bg: P.aB, fg: P.a },
  churned:   { bg: P.rB, fg: P.r },
  pipeline:  { bg: P.c2, fg: P.tm },
};

export const SEGMENT_COLORS = {
  infinityMirror:     P.g,
  supportRetainer:    P.t,
  bankOfHours:        P.a,
  fullProject:        P.b,
  zohoCommissionOnly: "#38bdf8",
  oneTime:            P.td,
};

export const Pill = ({ children, color = P.tm, bg = `${P.c2}80`, fontSize = 9 }) => (
  <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 9, background: bg, color, fontSize, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{children}</span>
);

export const StatusPill = ({ status }) => {
  const co = STATUS_COLORS[status] || STATUS_COLORS.pipeline;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 11, background: co.bg, color: co.fg, fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: co.fg }} />
      {STATUS_LABELS[status] || status || "—"}
    </span>
  );
};

export const SegmentPill = ({ segment }) => (
  <Pill color={SEGMENT_COLORS[segment] || P.tm} bg={`${SEGMENT_COLORS[segment] || P.tm}15`}>
    {SEGMENT_LABELS[segment] || "—"}
  </Pill>
);

export const StreamPills = ({ client }) => (
  <span style={{ display: "inline-flex", gap: 5 }}>
    {client.serviceContract && <Pill color={P.g} bg={`${P.g}18`}>Service</Pill>}
    {client.zohoCommission && <Pill color={P.t} bg={`${P.t}18`}>Zoho</Pill>}
  </span>
);

// Avatar circle with client initials.
export const Avatar = ({ name, segment, size = 36 }) => (
  <div style={{
    width: size, height: size, borderRadius: size / 2,
    background: SEGMENT_COLORS[segment] || P.tm, opacity: 0.6,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: P.bg, fontWeight: 700, fontSize: Math.round(size * 0.4),
    fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
  }}>
    {(name || "").split(" ").slice(0, 2).map(s => s[0] || "").join("").toUpperCase()}
  </div>
);
