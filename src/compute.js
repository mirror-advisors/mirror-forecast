import { MO } from "./data.js";

export function compute(d) {
  const rv = MO.map((_, i) => Object.values(d.rv).reduce((s, a) => s + (a[i] || 0), 0));
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
      if (p.nm === "Paul") { if (i === 0) return; if (i === 1) { t -= 3917; return; } t -= p.co; }
      else if (p.nm === "Sara") { if (i >= 6) return; t -= (i === 0 ? 824 : i === 1 ? 180 : p.co); }
      else t -= p.co;
    });
    return t;
  });

  const ph = MO.map((_, i) => {
    let t = 0;
    at.filter(p => p.ct === "PH").forEach(p => {
      if (p.nm === "Mark" && (i < 1 || i > 4)) return;
      if (p.nm === "Jeanna" && (i < 2 || i > 4)) return;
      t -= (p.nm === "Janna" && i < 2 ? 800 : p.co);
    });
    return t;
  });

  const ind = MO.map((_, i) => {
    let t = d.wf[i] || 0;
    at.filter(p => p.ct === "IN").forEach(p => {
      if (p.nm === "Soorya" && i === 0) { t -= 2000; return; }
      if (p.nm.includes("New") && i < 3) return;
      t -= p.co;
    });
    return t;
  });

  const ex = MO.map((_, i) => us[i] + ph[i] + ind[i] + sb[i] + oc[i] + db[i]);
  const nt = MO.map((_, i) => rv[i] + ex[i]);
  const bl = [];
  nt.forEach((n, i) => bl.push(i === 0 ? d.openBal + n : bl[i - 1] + n));

  return { rv, sb, oc, db, us, ph, ind, ex, nt, bl, at };
}

export function computePartnership(pt) {
  const months = [];
  let cumCash = 0, breakeven = -1, prevDH = 0;
  const zmBase = 984;

  for (let i = 0; i < 12; i++) {
    const active = i >= pt.sm;
    const monthsActive = active ? i - pt.sm + 1 : 0;
    const qIn = active ? Math.floor(monthsActive / 3) + 1 : 0;
    const oC = active ? qIn * pt.ocq : 0;
    const nZ = active ? qIn * pt.nzq : 0;
    const dN = Math.floor(oC / pt.den);
    prevDH = dN;

    const oGross = oC * pt.oar;
    const oCR = oGross * (pt.ocs / 100);
    const oPR = oGross * (pt.ips / 100);
    const oMR = oGross * (pt.ops / 100);
    const nZR = nZ * pt.azr;

    const base = active ? pt.bs : 0;
    const ezC = active ? zmBase * (pt.ezp / 100) : 0;
    const nzC = active ? nZR * (pt.nzp / 100) : 0;
    const mComp = base + ezC + nzC + oMR;

    const devCo = dN * pt.dch;
    const pCost = (active && monthsActive === 1) ? pt.opc : 0;
    const net = active ? (oCR + oPR + (nZR - nzC) - base - ezC - devCo - pCost) : 0;

    cumCash += net;
    if (breakeven === -1 && cumCash > 0 && active && i > pt.sm) breakeven = i;

    months.push({
      oC, nZ, mComp: Math.round(mComp), dH: dN,
      newRev: Math.round(oCR + oPR + nZR), net: Math.round(net), cum: Math.round(cumCash),
      oCR: Math.round(oCR), oPR: Math.round(oPR), oMR: Math.round(oMR),
      base, ezC: Math.round(ezC), nzC: Math.round(nzC), devCo, pCost,
    });
  }

  const mFixed = pt.bs + zmBase * (pt.ezp / 100);
  const netPerO = pt.oar * ((pt.ocs + pt.ips) / 100) - (pt.dch / pt.den);
  const beC = netPerO > 0 ? Math.ceil(mFixed / netPerO) : Infinity;
  const worst = Math.min(...months.map(m => m.cum));

  return { months, breakeven, beC, worst, ok: worst > -8000, tight: worst > -3000 };
}

export function computeDevHire(dh) {
  const months = [];
  let cumCash = 0, breakeven = -1;
  const totalCost = dh.cnt * dh.avg;
  const capacity = dh.cnt * dh.cpc;
  const addedRev = capacity * dh.rpc;

  for (let i = 0; i < 12; i++) {
    const active = i >= dh.sm;
    const monthsIn = active ? i - dh.sm + 1 : 0;
    const ramp = monthsIn <= 0 ? 0 : monthsIn === 1 ? 0 : monthsIn === 2 ? 0.5 : 1;
    const rev = active ? Math.round(addedRev * ramp) : 0;
    const cost = active ? totalCost : 0;
    const net = rev - cost;
    cumCash += net;
    if (breakeven === -1 && cumCash > 0 && active && i > dh.sm) breakeven = i;
    months.push({ rev, cost, net, cum: cumCash, ramp, capacity: active ? capacity : 0 });
  }

  return { months, breakeven, totalCost, capacity, addedRev, worst: Math.min(...months.map(m => m.cum)) };
}
