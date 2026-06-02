// Phase E2c.2 — dashboard runway chart.
// 20 months May'26 → Dec'27 (idx cm → 23 of compute output).
// Color rule (buffer wins, per C2.2 lockin):
//   1. bal ≤ 0           → DEFICIT      (dark red)
//   2. bal ≤ THRESHOLD   → BUFFER THIN  (red)
//   3. net < 0           → BURNING      (amber)
//   4. else              → HEALTHY      (green)
// Big number = monthly net (signed, fK-compact). Small = balance (muted).
// Annotations float above relevant cards. Legend always visible above.

import React, { useMemo } from "react";
import { MO, P, BUFFER_THIN_THRESHOLD, fK } from "./data.js";
import { Lbl } from "./components.jsx";
import { monthIdxFromDate } from "./clientsHelpers.js";

const N = 24;
const BASE_YEAR = 2026;

const STATE = {
  healthy: { bg: P.gB, fg: P.g, border: P.gM, label: "Healthy" },
  burning: { bg: P.aB, fg: P.a, border: P.a + "66", label: "Burning" },
  thin:    { bg: P.rB, fg: P.r, border: P.r + "66", label: "Thin" },
  deficit: { bg: P.dr, fg: P.drF, border: P.r, label: "Deficit" },
};

function colorState(bal, net) {
  if (bal <= 0) return "deficit";
  if (bal <= BUFFER_THIN_THRESHOLD) return "thin";
  if (net < 0) return "burning";
  return "healthy";
}

// Compact signed format: "+$18.4k" / "−$8.8k" / "—" (zero)
function fmtNetSigned(n) {
  if (n == null || n === 0) return "—";
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "+";
  if (a >= 1000) {
    const k = (a / 1000).toFixed(a % 1000 === 0 ? 0 : 1);
    return `${sign}$${k}k`;
  }
  return `${sign}$${Math.round(a)}`;
}

function labelForIdx(idx) {
  const year = BASE_YEAR + Math.floor(idx / 12);
  const m = MO[idx % 12];
  return year > BASE_YEAR ? `${m}'${String(year).slice(-2)}` : m;
}

// First word of client name + " ends" — keeps annotations readable in 60px cards
function projectEndLabel(client) {
  const first = (client.nm || "").split(" ")[0] || "Project";
  return `${first} ends`;
}

const LegendDot = ({ state }) => {
  const s = STATE[state];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: P.tm, fontFamily: "'DM Sans', sans-serif" }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: s.fg }} />
      {s.label}
    </span>
  );
};

export default function RunwayChart({ c, d, today, runwayMonths }) {
  // cm = horizon idx of current month (Date-driven so it survives year rollover)
  const cm = useMemo(() => {
    const t = today instanceof Date ? today : new Date();
    return Math.max(0, (t.getFullYear() - BASE_YEAR) * 12 + t.getMonth());
  }, [today]);

  // Forward-looking first deficit (after cm) — computed from BASELINE balance
  // (no scenarios), so the subtitle matches the "Baseline Runway" card in App.jsx.
  // Per-card coloring below still uses c.bl (with scenarios) for the lived view.
  const blBase = useMemo(() => {
    const out = [];
    for (let i = 0; i < c.rvBase.length; i++) {
      const n = c.rvBase[i] + c.exBase[i];
      out.push(i === 0 ? d.openBal + n : out[i - 1] + n);
    }
    return out;
  }, [c.rvBase, c.exBase, d.openBal]);

  const forwardDeficitIdx = useMemo(() => {
    for (let i = cm; i < blBase.length; i++) if (blBase[i] <= 0) return i;
    return -1;
  }, [blBase, cm]);

  // Annotations: per-idx list, computed from c + d
  const annotationsByIdx = useMemo(() => {
    const map = new Map();
    const push = (idx, ann) => {
      if (!map.has(idx)) map.set(idx, []);
      map.get(idx).push(ann);
    };

    // Project ends
    (d.cl || []).forEach(cl => {
      const sc = cl.serviceContract;
      if (sc?.type === "project" && sc?.endDate) {
        const idx = monthIdxFromDate(sc.endDate);
        if (idx != null && idx >= cm && idx < N) {
          push(idx, { label: projectEndLabel(cl), title: `${cl.nm} contract ends ${sc.endDate}`, color: P.tm });
        }
      }
    });

    // Net flips negative (first idx after cm where nt < 0)
    for (let i = cm; i < N; i++) {
      if (c.nt[i] < 0) {
        push(i, { label: "Net flips negative", title: `First month where revenue < expenses (net ${fK(c.nt[i])})`, color: P.a });
        break;
      }
    }

    // Zoho renewals (months with rv.za > $5K)
    for (let i = cm; i < N; i++) {
      if (c.rvDerived.za[i] > 5000) {
        push(i, { label: "Zoho renewals", title: `Annual Zoho renewals fire this month (${fK(c.rvDerived.za[i])})`, color: P.t });
      }
    }

    // First forward deficit (baseline)
    if (forwardDeficitIdx >= 0) {
      push(forwardDeficitIdx, { label: "First deficit", title: `Cumulative balance crosses zero (${fK(blBase[forwardDeficitIdx])})`, color: P.r });
    }

    return map;
  }, [d, c, cm, forwardDeficitIdx, blBase]);

  const months = useMemo(() => {
    const out = [];
    for (let i = cm; i < N; i++) out.push(i);
    return out;
  }, [cm]);

  const deficitLabel = forwardDeficitIdx >= 0 ? labelForIdx(forwardDeficitIdx) : null;
  const runwayColor = runwayMonths >= 9 ? P.g : runwayMonths >= 6 ? P.a : P.r;

  // Dimensions: each card minWidth 60px so 20 cards fit in ~1200px container without scroll
  const cardMinWidth = 60;
  const annotZoneHeight = 36; // reserve space so all month labels align

  return (
    <div style={{
      background: P.c1, border: `1px solid ${P.bd}`, borderRadius: 10,
      padding: 16, marginBottom: 20, fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Title row: runway summary on left, legend on right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <Lbl>Runway</Lbl>
          <span style={{ fontSize: 22, fontWeight: 800, color: runwayColor, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em" }}>
            {runwayMonths.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 500, color: P.tm }}> months</span>
          </span>
          {deficitLabel && (
            <span style={{ fontSize: 11, color: P.tm }}>· deficit <b style={{ color: P.r }}>{deficitLabel}</b></span>
          )}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <LegendDot state="healthy" />
          <LegendDot state="burning" />
          <LegendDot state="thin" />
          <LegendDot state="deficit" />
        </div>
      </div>

      {/* 20-card grid, horizontal scroll fallback below 1200px container */}
      <div style={{ overflowX: "auto", margin: "0 -4px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${months.length}, minmax(${cardMinWidth}px, 1fr))`,
          gap: 4,
          padding: "0 4px",
        }}>
          {months.map((idx) => {
            const bal = c.bl[idx] ?? 0;
            const net = c.nt[idx] ?? 0;
            const state = colorState(bal, net);
            const s = STATE[state];
            const isCurrent = idx === cm;
            const anns = annotationsByIdx.get(idx) || [];

            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column" }}>
                {/* Annotation zone — fixed height to align all month labels */}
                <div style={{
                  height: annotZoneHeight,
                  display: "flex", flexDirection: "column", justifyContent: "flex-end",
                  alignItems: "center", gap: 2,
                  paddingBottom: 4,
                }}>
                  {anns.map((a, k) => (
                    <div key={k} title={a.title} style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: 9, fontWeight: 600,
                      color: a.color,
                      whiteSpace: "nowrap",
                      maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      <span style={{ width: 4, height: 4, borderRadius: 2, background: a.color, flexShrink: 0 }} />
                      {a.label}
                    </div>
                  ))}
                </div>

                {/* Card */}
                <div style={{
                  background: s.bg,
                  border: `${isCurrent ? 2 : 1}px solid ${isCurrent ? P.b : s.border}`,
                  borderRadius: 6,
                  padding: "8px 4px 10px",
                  textAlign: "center",
                  minHeight: 84,
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? P.b : P.tm,
                    fontFamily: "'DM Sans', sans-serif",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                    marginBottom: 4,
                  }}>{labelForIdx(idx)}</div>
                  <div style={{
                    fontSize: 14, fontWeight: 800,
                    color: s.fg,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}>{fmtNetSigned(net)}</div>
                  <div style={{
                    fontSize: 10,
                    color: P.tm,
                    fontFamily: "'JetBrains Mono', monospace",
                    marginTop: 4,
                    opacity: 0.85,
                  }}>bal {fK(bal)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
