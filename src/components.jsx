import { useState, useEffect } from "react";
import { P, MO, fmt, sm } from "./data.js";

// Number input that holds its value in local state while the user is typing
// and only commits to the parent on blur / Enter. Prevents intermediate
// values (empty string, 0, NaN) from triggering parent re-renders that
// could filter the row out mid-edit.
export function EditableNumber({ value, onCommit, style, placeholder, min, max }) {
  const [local, setLocal] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setLocal(value == null ? "" : String(value)); }, [value, focused]);
  const commit = () => {
    const raw = local.trim();
    if (raw === "") { if (0 !== value) onCommit(0); return; }
    const n = +raw;
    if (isNaN(n)) { setLocal(value == null ? "" : String(value)); return; }
    if (n !== value) onCommit(n);
  };
  return (
    <input
      type="number"
      value={local}
      placeholder={placeholder}
      min={min}
      max={max}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      style={style}
    />
  );
}

export function Toast({ message, type }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 1100,
      padding: "10px 18px", borderRadius: 8,
      background: type === "ok" ? P.gB : P.rB,
      border: `1px solid ${type === "ok" ? P.gM : P.rM}`,
      color: type === "ok" ? P.g : P.r,
      fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
      display: "flex", alignItems: "center", gap: 8,
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    }}>
      <span>{type === "ok" ? "\u2713" : "\u2715"}</span>
      {message}
    </div>
  );
}

export function ClientProgressRow({ cl, onSegmentClick, expanded, onToggleExpand, children }) {
  const smo = cl.startMo ?? 0;
  const emo = cl.endMo ?? 11;
  const rate = cl.rt || 0;
  const termSegs = [];
  for (let i = smo; i <= emo; i++) termSegs.push({ i, s: cl.st[i] || "U" });
  const paid = termSegs.filter(x => x.s === "P").length;
  const late = termSegs.filter(x => x.s === "L").length;
  const total = termSegs.length;
  const collected = paid * rate;
  const maxT = total * rate;
  const segColor = s => s === "P" ? P.g : s === "L" ? P.r : s === "C" ? P.b : P.a;
  return (
    <div>
      <div onClick={onToggleExpand} style={{ padding: "14px 4px", cursor: onToggleExpand ? "pointer" : "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: P.tx, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
            {onToggleExpand && (
              <span style={{ fontSize: 9, color: P.td, display: "inline-block", transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "none" }}>{"\u25b6"}</span>
            )}
            {cl.nm}
          </div>
          <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
            <span style={{ color: late > 0 ? P.r : P.tx, fontWeight: 600 }}>{paid}/{total} paid</span>
            <span style={{ color: P.td }}>{" \u00b7 "}</span>
            <span style={{ color: P.g }}>{fmt(collected)}</span>
            <span style={{ color: P.td }}>{" / "}{fmt(maxT)}</span>
          </div>
        </div>
        <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: P.c2 }}>
          {termSegs.map((seg, i) => (
            <div key={i}
              onClick={(e) => { if (onSegmentClick) { e.stopPropagation(); onSegmentClick(seg.i); } }}
              title={`${MO[seg.i]}: ${seg.s}`}
              style={{ flex: 1, background: segColor(seg.s), cursor: onSegmentClick ? "pointer" : "default" }} />
          ))}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "12px 14px 16px", background: P.c2, borderRadius: 8, border: `1px solid ${P.bd}`, marginTop: 4, marginBottom: 8 }} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}

export function SaveBar({ dirty, saving, onSave }) {
  if (!dirty && !saving) return null;
  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: "#0a0b0f",
      borderTop: `2px solid ${P.a}`,
      padding: "14px 24px",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      boxShadow: "0 -8px 28px rgba(0,0,0,0.7)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: P.a, boxShadow: `0 0 8px ${P.a}` }} />
        <span style={{ fontSize: 14, color: P.tx, fontWeight: 700, letterSpacing: "0.01em" }}>Unsaved changes</span>
      </div>
      <button onClick={onSave} disabled={saving} style={{
        background: saving ? P.c2 : P.g,
        color: saving ? P.td : P.bg,
        border: "none",
        borderRadius: 8,
        padding: "10px 26px",
        fontSize: 14,
        fontWeight: 800,
        cursor: saving ? "default" : "pointer",
        fontFamily: "'DM Sans', sans-serif",
        letterSpacing: "0.02em",
      }}>{saving ? "Saving\u2026" : "Save (\u2318S)"}</button>
    </div>
  );
}

export const Card = ({ children, style: s }) => (
  <div style={{ background: P.c1, borderRadius: 10, padding: 20, border: `1px solid ${P.bd}`, ...s }}>{children}</div>
);

export const Lbl = ({ children }) => (
  <div style={{ fontSize: 10, color: P.td, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{children}</div>
);

export const Bdg = ({ children, c }) => (
  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: c === "g" ? P.gB : c === "r" ? P.rB : P.aB, color: c === "g" ? P.g : c === "r" ? P.r : P.a }}>{children}</span>
);

export const NumIn = ({ value, onChange, w }) => (
  <input type="number" value={value} onChange={onChange} style={{ background: P.c2, border: `1px solid ${P.bd}`, color: P.a, borderRadius: 4, padding: "5px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, width: w || 70, textAlign: "right" }} />
);

export function Pie({ data: dd, size }) {
  const sz = size || 170;
  const total = dd.reduce((s, x) => s + x.value, 0);
  if (!total) return null;
  let cum = 0;
  const sl = dd.filter(x => x.value > 0).map(x => {
    const st = cum, pc = x.value / total; cum += pc;
    const r = sz / 2 - 3, cx = sz / 2, cy = sz / 2;
    const a1 = Math.PI * 2 * st - Math.PI / 2, a2 = Math.PI * 2 * (st + pc) - Math.PI / 2;
    return { ...x, pc, path: `M${cx},${cy} L${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} A${r},${r} 0 ${pc > .5 ? 1 : 0} 1 ${cx + r * Math.cos(a2)},${cy + r * Math.sin(a2)} Z` };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={sz} height={sz}>{sl.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke={P.bg} strokeWidth={2} />)}</svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{sl.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
          <span style={{ color: P.tm }}>{s.label}</span>
          <span style={{ color: P.tx, fontWeight: 700, marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace" }}>{(s.pc * 100).toFixed(0)}%</span>
        </div>
      ))}</div>
    </div>
  );
}

// V2.1: XRow — line item numbers in muted white (P.tm), only TOTAL row stays red
export function XRow({ label, vals, details, win }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr style={{ cursor: details ? "pointer" : "default" }} onClick={() => details && setOpen(!open)}>
        <td style={{ padding: "5px 10px", color: P.tm, borderBottom: `1px solid ${P.bd}20` }}>
          {details ? <span style={{ display: "inline-block", width: 14, fontSize: 9, color: P.td, transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "rotate(0)" }}>{"\u25b6"}</span> : null}{label}
        </td>
        {vals.map((v, i) => <td key={i} style={{ padding: "5px 6px", textAlign: "right", color: P.tm, borderBottom: `1px solid ${P.bd}20`, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, background: win ? (win[i]?.isCurrent ? P.bB : "transparent") : "transparent" }}>{fmt(v)}</td>)}
        <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700, color: P.r, borderBottom: `1px solid ${P.bd}20`, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmt(sm(vals))}</td>
      </tr>
      {open && details ? details.map((dd, di) => (
        <tr key={di} style={{ background: `${P.c2}80` }}>
          <td style={{ padding: "3px 10px 3px 30px", fontSize: 11, color: P.td, borderBottom: `1px solid ${P.bd}15`, fontFamily: "'DM Sans', sans-serif" }}>{dd.n}</td>
          {dd.v.map((v, i) => <td key={i} style={{ padding: "3px 6px", textAlign: "right", fontSize: 11, color: v ? P.td : `${P.td}60`, borderBottom: `1px solid ${P.bd}15`, fontFamily: "'JetBrains Mono', monospace" }}>{v ? fmt(v) : "\u2014"}</td>)}
          <td style={{ padding: "3px 6px", textAlign: "right", fontSize: 11, fontWeight: 600, color: P.tm, borderBottom: `1px solid ${P.bd}15`, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(sm(dd.v))}</td>
        </tr>
      )) : null}
    </>
  );
}

export function Sld({ label, value, onChange, min, max, step = 1, pre = "", suf = "", color = P.g }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: P.td, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{pre}{typeof value === "number" ? value.toLocaleString() : value}{suf}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", height: 5, appearance: "none", borderRadius: 3, cursor: "pointer", background: `linear-gradient(to right,${color} 0%,${color} ${pct}%,${P.c2} ${pct}%,${P.c2} 100%)`, outline: "none" }} />
    </div>
  );
}

export function KPI({ label, value, sub, color = P.g, warn }) {
  return (
    <div style={{ background: warn ? P.aB : P.c1, border: `1px solid ${warn ? P.a + "33" : P.bd}`, borderRadius: 8, padding: "10px 12px", minWidth: 120 }}>
      <div style={{ fontSize: 9, color: P.td, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: P.td, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{sub}</div>}
    </div>
  );
}

export function Toggle({ label, value, onChange, color = P.g }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
      <div onClick={() => onChange(!value)} style={{
        width: 36, height: 20, borderRadius: 10, position: "relative",
        background: value ? `${color}40` : P.c2, border: `1px solid ${value ? color : P.bd}`,
        transition: "all 0.2s"
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: 7, position: "absolute", top: 2,
          left: value ? 19 : 2, background: value ? color : P.td,
          transition: "left 0.2s"
        }} />
      </div>
      <span style={{ fontSize: 11, color: value ? P.tx : P.tm, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{label}</span>
    </label>
  );
}