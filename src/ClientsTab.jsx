// Clients tab — Paul-only reference list.
// One row per client with active service contract OR active Zoho commission.
// Service-ended-but-Zoho-active rows (Gomes, VanBoxel) intentionally surface
// as "Zoho · svc ended" so a churned service never hides a live commission.
// Display only — no editing here. Forecast math is untouched.

import React, { useState, useMemo } from "react";

// Spec palette — scoped to this tab; intentionally not folded into P.
const T = {
  bg: "#111318",
  surface: "#1a1d24",
  surfaceAlt: "#22262e",
  hover: "#15181f",
  divider: "#ffffff0a",
  border: "#2a2e38",
  txt: "#ffffff",
  txtMuted: "#9b9790",
  txtChurned: "#c8c5be",
  green: "#7ec89b",
  blue: "#5a7fb0",
  greyEnded: "#6b6864",
  amber: "#e0a890",
  serviceChurned: "#a37272",
};

const MO_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const FONT_SANS = "'DM Sans', sans-serif";
const FONT_MONO = "'JetBrains Mono', monospace";

// ─── helpers ────────────────────────────────────────────────────────────────

function isScActive(sc) {
  return !!sc && sc.status !== "churned" && sc.inForecast !== false;
}
function isZcActive(zc) {
  return !!zc && zc.status !== "churned" && zc.inForecast !== false;
}

// kind: "service-zoho" | "zoho-only" | "svc-ended" | null (excluded from list)
function statusKind(c) {
  const scActive = isScActive(c.serviceContract);
  const zcActive = isZcActive(c.zohoCommission);
  if (scActive) return "service-zoho";
  if (zcActive && c.serviceContract) return "svc-ended";
  if (zcActive) return "zoho-only";
  return null;
}

// Total annual value.
// - Retainer / support-retainer: monthlyAmount * 12 (forward run rate)
// - Project / bank-of-hours / one-time: sum of unpaid future paymentSchedule
//   entries (Plastics monthlyAmount=12000 is legacy; the schedule is truth).
// - Zoho: monthlyAmount*12 + annualAmount (whichever applies per frequency).
function annualValue(c, today) {
  const sc = c.serviceContract;
  const zc = c.zohoCommission;
  let svc = 0;
  if (isScActive(sc)) {
    if (sc.type === "retainer" || sc.type === "support-retainer") {
      svc = (sc.monthlyAmount || 0) * 12;
    } else {
      svc = (sc.paymentSchedule || [])
        .filter(p => !p.paid && new Date(p.dueDate) >= today)
        .reduce((s, p) => s + (p.amount || 0), 0);
    }
  }
  let zoho = 0;
  if (isZcActive(zc)) {
    zoho = (zc.monthlyAmount || 0) * 12 + (zc.annualAmount || 0);
  }
  return svc + zoho;
}

function endsSoon(sc, today) {
  if (!sc?.endDate) return false;
  const d = new Date(sc.endDate);
  if (isNaN(d)) return false;
  const days = (d.getTime() - today.getTime()) / 86400000;
  return days >= 0 && days <= 90;
}

function fmtEndDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(n => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return `${MO_SHORT[m - 1]} ${d} '${String(y).slice(-2)}`;
}

function endDateInline(c) {
  const sc = c.serviceContract;
  if (!isScActive(sc)) return null;
  if (sc.endDate) return `service ends ${fmtEndDate(sc.endDate)}`;
  return "month-to-month";
}

function fmtAnnual(n) {
  if (!n || n <= 0) return "$0/yr";
  if (n < 1000) return `$${Math.round(n)}/yr`;
  return `$${(n / 1000).toFixed(1)}k/yr`;
}

function nextZohoRenewal(c, today) {
  const zc = c.zohoCommission;
  if (!isZcActive(zc)) return Number.POSITIVE_INFINITY;
  if (zc.frequency === "annual" && zc.renewalDate) {
    const t = new Date(zc.renewalDate).getTime();
    return isNaN(t) ? Number.POSITIVE_INFINITY : t;
  }
  if (zc.frequency === "monthly" && zc.renewalDay) {
    const next = new Date(today.getFullYear(), today.getMonth(), zc.renewalDay);
    if (next < today) next.setMonth(next.getMonth() + 1);
    return next.getTime();
  }
  return Number.POSITIVE_INFINITY;
}

const dotColorFor = (kind) =>
  kind === "service-zoho" ? T.green : kind === "zoho-only" ? T.blue : T.greyEnded;

const statusLabelFor = (kind) =>
  kind === "service-zoho" ? "Service + Zoho" : kind === "zoho-only" ? "Zoho only" : "Zoho · svc ended";

const SERVICE_TYPE_LABEL = {
  "retainer":          "Retainer",
  "support-retainer":  "Support retainer",
  "project":           "Project",
  "bank-of-hours":     "Bank of hours",
  "one-time":          "One-time",
};

const hasMonthlyAmount = (type) => type === "retainer" || type === "support-retainer";

// ─── inline SVG flag (lieu of @tabler/icons-react ti-flag) ──────────────────

function FlagIcon({ color = T.amber, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
      <path d="M4 22V4a2 2 0 0 1 2-2h11l-2 5h7v8H8" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

// ─── row ────────────────────────────────────────────────────────────────────

function ClientRow({ client, today, selected, onClick }) {
  const kind = statusKind(client);
  const sc = client.serviceContract;
  const dot = dotColorFor(kind);
  const flag = endsSoon(sc, today);
  const endStr = endDateInline(client);
  const annual = annualValue(client, today);
  const churnedRow = kind === "svc-ended";
  const [hover, setHover] = useState(false);
  const isLit = hover || selected;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 16px",
        background: isLit ? T.hover : "transparent",
        borderBottom: `1px solid ${T.divider}`,
        borderRadius: isLit ? 6 : 0,
        cursor: "pointer",
        transition: "background 0.08s",
        opacity: churnedRow ? 0.92 : 1,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <span style={{ fontSize: 14, fontWeight: 500, color: churnedRow ? T.txtChurned : T.txt, fontFamily: FONT_SANS, whiteSpace: "nowrap" }}>
        {client.nm}
      </span>
      {endStr && (
        <span style={{ fontSize: 12, color: flag ? T.amber : T.txtMuted, fontFamily: FONT_SANS, whiteSpace: "nowrap" }}>
          {endStr}
        </span>
      )}
      {flag && <FlagIcon color={T.amber} />}
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            fontSize: 10, fontWeight: 600,
            padding: "3px 10px", borderRadius: 11,
            background: `${dot}1f`, color: dot,
            fontFamily: FONT_SANS, whiteSpace: "nowrap",
            letterSpacing: "0.01em",
          }}
        >
          {statusLabelFor(kind)}
        </span>
        <span style={{ fontSize: 12, color: T.txtMuted, fontFamily: FONT_MONO, minWidth: 72, textAlign: "right" }}>
          {fmtAnnual(annual)}
        </span>
      </span>
    </div>
  );
}

// ─── detail panel (below the list) ──────────────────────────────────────────

function DetailRow({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.txtMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 6, fontFamily: FONT_SANS }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: T.txt, fontFamily: FONT_SANS }}>{children}</div>
    </div>
  );
}

function DetailPanel({ client, today, onClose }) {
  const kind = statusKind(client);
  const dot = dotColorFor(kind);
  const sc = client.serviceContract;
  const zc = client.zohoCommission;
  const annual = annualValue(client, today);
  const scActive = isScActive(sc);

  return (
    <div
      style={{
        background: T.surface,
        borderLeft: `3px solid ${dot}`,
        borderRadius: 6,
        padding: "20px 24px",
        marginTop: 18,
        fontFamily: FONT_SANS,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.txt }}>{client.nm}</span>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ background: "transparent", border: "none", color: T.txtMuted, fontSize: 22, lineHeight: 1, cursor: "pointer", padding: "0 6px" }}
        >×</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 18 }}>
        <DetailRow label="Service">
          {sc ? (
            scActive ? (
              hasMonthlyAmount(sc.type) ? (
                <span>
                  <span style={{ fontFamily: FONT_MONO }}>${(sc.monthlyAmount || 0).toLocaleString()}</span>
                  <span style={{ color: T.txtMuted }}>/mo · </span>
                  <span style={{ color: T.txtMuted }}>
                    {sc.endDate ? `ends ${fmtEndDate(sc.endDate)}` : "month-to-month"}
                  </span>
                </span>
              ) : (
                <span>
                  <span>{SERVICE_TYPE_LABEL[sc.type] || sc.type}</span>
                  <span style={{ color: T.txtMuted }}>
                    {sc.endDate ? ` · ends ${fmtEndDate(sc.endDate)}` : ""}
                  </span>
                </span>
              )
            ) : (
              <span style={{ color: T.serviceChurned, fontStyle: "italic" }}>churned</span>
            )
          ) : (
            <span style={{ color: T.txtMuted }}>—</span>
          )}
        </DetailRow>

        <DetailRow label="Zoho Commission">
          {isZcActive(zc) ? (
            zc.frequency === "monthly" ? (
              <span>
                <span style={{ fontFamily: FONT_MONO }}>${(zc.monthlyAmount || 0).toLocaleString()}</span>
                <span style={{ color: T.txtMuted }}>/mo · monthly</span>
                {zc.renewalDay ? (
                  <span style={{ color: T.txtMuted }}> · renews day {zc.renewalDay}</span>
                ) : null}
              </span>
            ) : (
              <span>
                <span style={{ fontFamily: FONT_MONO }}>${(zc.annualAmount || 0).toLocaleString()}</span>
                <span style={{ color: T.txtMuted }}>/yr · annual</span>
                {zc.renewalDate ? (
                  <span style={{ color: T.txtMuted }}> · renews <span style={{ fontFamily: FONT_MONO }}>{fmtEndDate(zc.renewalDate)}</span></span>
                ) : null}
              </span>
            )
          ) : (
            <span style={{ color: T.txtMuted }}>—</span>
          )}
        </DetailRow>
      </div>

      <div style={{ borderTop: `1px solid ${T.divider}`, paddingTop: 14 }}>
        <div style={{ fontSize: 10, color: T.txtMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 6 }}>
          Total Annual Value
        </div>
        <div style={{ fontSize: 20, color: T.green, fontFamily: FONT_MONO, fontWeight: 600 }}>
          {fmtAnnual(annual)}
        </div>
      </div>
    </div>
  );
}

// ─── legend ─────────────────────────────────────────────────────────────────

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
      <span>{label}</span>
    </span>
  );
}

// ─── main ───────────────────────────────────────────────────────────────────

export default function ClientsTab({ d }) {
  const today = useMemo(() => new Date(), []);
  const [filter, setFilter] = useState("all");      // all | service | zoho
  const [sortBy, setSortBy] = useState("value");    // value | zoho
  const [selectedId, setSelectedId] = useState(null);

  // One pass: enrich each cl[] entry with derived fields, drop excluded clients.
  const enriched = useMemo(() => {
    return (d.cl || [])
      .map(c => ({
        c,
        kind: statusKind(c),
        annual: annualValue(c, today),
        nextRenew: nextZohoRenewal(c, today),
      }))
      .filter(x => x.kind !== null);
  }, [d.cl, today]);

  const filtered = useMemo(() => {
    if (filter === "service") return enriched.filter(x => x.kind === "service-zoho");
    if (filter === "zoho") return enriched.filter(x => x.kind === "zoho-only" || x.kind === "svc-ended");
    return enriched;
  }, [enriched, filter]);

  const sorted = useMemo(() => {
    const a = [...filtered];
    if (sortBy === "value") a.sort((x, y) => y.annual - x.annual);
    else if (sortBy === "zoho") a.sort((x, y) => x.nextRenew - y.nextRenew);
    return a;
  }, [filtered, sortBy]);

  const selected = enriched.find(x => x.c.id === selectedId) || null;

  const pillBtn = (active) => ({
    padding: "6px 14px",
    fontSize: 11,
    fontWeight: 600,
    fontFamily: FONT_SANS,
    background: active ? T.surfaceAlt : "transparent",
    color: active ? T.txt : T.txtMuted,
    border: `1px solid ${active ? T.border : "transparent"}`,
    borderRadius: 6,
    cursor: "pointer",
  });

  return (
    <div style={{ color: T.txt, fontFamily: FONT_SANS }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", color: T.txt }}>
          Clients
        </div>
        <div style={{ fontSize: 12, color: T.txtMuted, marginTop: 4 }}>
          {enriched.length} active · service + Zoho licensing
        </div>
      </div>

      {/* Filter + sort */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[["all", "All"], ["service", "Service"], ["zoho", "Zoho only"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={pillBtn(filter === k)}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            background: T.surface,
            color: T.txtMuted,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 11,
            fontFamily: FONT_SANS,
            cursor: "pointer",
          }}
        >
          <option value="value">Sort: total annual value</option>
          <option value="zoho">Sort: Zoho renewal date</option>
        </select>
      </div>

      {/* List */}
      <div style={{ background: T.surface, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}` }}>
        {sorted.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: T.txtMuted, fontSize: 12 }}>
            No clients match this filter.
          </div>
        ) : (
          sorted.map(({ c }) => (
            <ClientRow
              key={c.id}
              client={c}
              today={today}
              selected={selectedId === c.id}
              onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
            />
          ))
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel client={selected.c} today={today} onClose={() => setSelectedId(null)} />
      )}

      {/* Legend */}
      <div
        style={{
          marginTop: 28,
          paddingTop: 14,
          borderTop: `1px solid ${T.divider}`,
          display: "flex",
          gap: 24,
          fontSize: 11,
          color: T.txtMuted,
          flexWrap: "wrap",
          fontFamily: FONT_SANS,
        }}
      >
        <LegendDot color={T.green} label="Service + Zoho" />
        <LegendDot color={T.blue} label="Zoho only" />
        <LegendDot color={T.greyEnded} label="Service ended · Zoho continues" />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <FlagIcon color={T.amber} />
          <span>Ending within 90 days</span>
        </span>
      </div>
    </div>
  );
}
