import { MO } from "./data.js";

export function compute(d) {
  // Build ot from tier:"ot" clients' payments[] — all scheduled payments
  // count toward the forecast regardless of paid/unpaid status.
  const otBase = new Array(12).fill(0);
  (d.cl || []).filter(c => c.tier === "ot").forEach(c => {
    (c.payments || []).forEach(p => {
      const mo = p.month ?? -1;
      if (mo >= 0 && mo <= 11) otBase[mo] += (p.amount || 0);
    });
  });
  const rvWithOt = { ...d.rv, ot: otBase };
  const rv = MO.map((_, i) => Object.values(rvWithOt).reduce((s, a) => s + (a[i] || 0), 0));
  const sb = MO.map((_, i) => -d.sb.reduce((s, x) => {
    if (x.s && i < x.s) return s;
    if (x.e !== undefined && i > x.e) return s;
    return s + x.a;
  }, 0));
  const oc = MO.map((_, i) => d.oc.reduce((s, c) => s + (c.v[i] || 0), 0));
  const db = MO.map((_, i) => d.db.reduce((s, c) => s + (c.v[i] || 0), 0));
  const at = d.tm.filter(t => t.on);
  const us = MO.map((_, i) => {
    let t = (d.et[i] || 0) + (d.af[i] || 0);
    at.filter(p => p.ct === "US").forEach(p => {
      const sm = p.startMo ?? 0;
      const em = p.endMo ?? 11;
      if (i < sm || i > em) return;
      // Paul: Jan=0 (no pay), Feb=special, then normal rate
      if (p.nm === "Paul") { if (i === 0) return; if (i === 1) { t -= 3917; return; } t -= p.co; return; }
      // Sara: Jan=824, Feb=180, then normal rate until her endMo
      if (p.nm === "Sara") { t -= (i === 0 ? 824 : i === 1 ? 180 : p.co); return; }
      t -= p.co;
    });
    return t;
  });
  const ph = MO.map((_, i) => {
    let t = 0;
    at.filter(p => p.ct === "PH").forEach(p => {
      const sm = p.startMo ?? 0;
      const em = p.endMo ?? 11;
      if (i < sm || i > em) return;
      // Janna: Jan-Feb was $800 (temp increase), $550 from Mar onward
      if (p.nm === "Janna") { t -= (i < 2 ? 800 : p.co); return; }
      t -= p.co;
    });
    return t;
  });
  const ind = MO.map((_, i) => {
    let t = d.wf[i] || 0;
    at.filter(p => p.ct === "IN").forEach(p => {
      const sm = p.startMo ?? 0;
      const em = p.endMo ?? 11;
      if (i < sm || i > em) return;
      // Soorya: Jan was $2000 (one-time), then normal
      if (p.nm === "Soorya" && i === 0) { t -= 2000; return; }
      t -= p.co;
    });
    return t;
  });
  // sb excluded from cash flow — subs are on CC, cash impact is through CC Paydown in db[]
  // sb is still computed for display/tracking purposes
  const ex = MO.map((_, i) => us[i] + ph[i] + ind[i] + oc[i] + db[i]);

  // Scenario rows — fold active scenarios into revenue/expense
  const scRv = new Array(12).fill(0); // scenario revenue per month
  const scEx = new Array(12).fill(0); // scenario expenses per month
  const scenarios = d.scenarios || [];
  scenarios.filter(s => s.on).forEach(s => {
    const start = s.startMo || 0;
    const dur = s.duration || 0; // 0 = ongoing (through month 11)
    const end = dur > 0 ? Math.min(start + dur - 1, 11) : 11;
    for (let i = start; i <= end; i++) {
      if (s.type === "revenue") scRv[i] += s.amount;
      else scEx[i] -= s.amount; // expenses stored positive, applied negative
    }
  });

  const rvT = rv.map((v, i) => v + scRv[i]); // total revenue including scenarios
  const exT = ex.map((v, i) => v + scEx[i]); // total expenses including scenarios
  const nt = MO.map((_, i) => rvT[i] + exT[i]);
  const bl = [];
  nt.forEach((n, i) => bl.push(i === 0 ? d.openBal + n : bl[i - 1] + n));
  return { rv: rvT, rvBase: rv, sb, oc, db, us, ph, ind, ex: exT, exBase: ex, nt, bl, at, scRv, scEx, otMerged: otBase };
}

