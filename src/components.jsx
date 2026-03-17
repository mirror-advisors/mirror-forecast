import { useState } from "react";
import { P, MO, fmt, sm } from "./data.js";

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

export function XRow({ label, vals, details }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr style={{ cursor: details ? "pointer" : "default" }} onClick={() => details && setOpen(!open)}>
        <td style={{ padding: "5px 10px", color: P.r, borderBottom: `1px solid ${P.bd}20` }}>
          {details ? <span style={{ display: "inline-block", width: 14, fontSize: 9, color: P.td, transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "rotate(0)" }}>{"\u25b6"}</span> : null}{label}
        </td>
        {vals.map((v, i) => <td key={i} style={{ padding: "5px 6px", textAlign: "right", color: P.r, borderBottom: `1px solid ${P.bd}20`, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmt(v)}</td>)}
        <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700, color: P.r, borderBottom: `1px solid ${P.bd}20`, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmt(sm(vals))}</td>
      </tr>
      {open && details ? details.map((dd, di) => (
        <tr key={di} style={{ background: `${P.c2}80` }}>
          <td style={{ padding: "3px 10px 3px 30px", fontSize: 11, color: P.tm, borderBottom: `1px solid ${P.bd}15`, fontFamily: "'DM Sans', sans-serif" }}>{dd.n}</td>
          {dd.v.map((v, i) => <td key={i} style={{ padding: "3px 6px", textAlign: "right", fontSize: 11, color: v ? P.tm : P.td, borderBottom: `1px solid ${P.bd}15`, fontFamily: "'JetBrains Mono', monospace" }}>{v ? fmt(v) : "\u2014"}</td>)}
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