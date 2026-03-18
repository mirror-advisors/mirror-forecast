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
  const nt = MO.map((_, i) => rv[i] + ex[i]);
  const bl = [];
  nt.forEach((n, i) => bl.push(i === 0 ? d.openBal + n : bl[i - 1] + n));
  return { rv, sb, oc, db, us, ph, ind, ex, nt, bl, at };
}

// Partnership model — simplified steady-state based on total active clients
// No quarterly ramp. Just: "if Mark has X Zoho + Y Odoo clients, here's the math."
export function computePartnership(pt) {
  const zmBase = 984;
  const cpc = pt.cpc || 2.5;
  const zMarkPct = pt.zLeadBonus ? (pt.zLeadMark || 40) : (pt.nzp || 10);
  const zCoPct = pt.zLeadBonus ? (pt.zLeadCo || 60) : (pt.nzcs || 90);

  const nZ = pt.nzq || 0; // total active Zoho clients (not per quarter)
  const oC = pt.ocq || 0; // total active Odoo clients

  // Dev costs
  const odooDevs = oC > 0 ? Math.ceil(oC / cpc) : 0;
  const zohoDevs = nZ > 0 ? Math.ceil(nZ / cpc) : 0;
  const totalDevs = odooDevs + zohoDevs;
  const totalDevCost = totalDevs * pt.dch;
  const odooDevPerClient = oC > 0 ? (odooDevs * pt.dch) / oC : 0;
  const zohoDevPerClient = nZ > 0 ? (zohoDevs * pt.dch) / nZ : 0;

  // Overhead: $100/client/mo
  const overhead = (oC + nZ) * 100;

  // Zoho license commission per client
  const zLicPerClient = Math.round((pt.zSeats || 15) * (pt.zSeatPrice || 40) * (pt.zCommPct || 18) / 100);

  // === PER-CLIENT ECONOMICS ===
  // Odoo: revenue - dev - overhead = profit, then split
  const odooProfit = Math.max(0, pt.oar - odooDevPerClient - 100);
  const odooMarkPer = Math.round(odooProfit * (pt.ops / 100));
  const odooPaulPer = Math.round(odooProfit * (pt.ips / 100));
  const odooCompPer = Math.round(odooProfit * (pt.ocs / 100));

  // Zoho: service + license - dev - overhead = profit, then split
  const zohoTotal = pt.azr + zLicPerClient;
  const zohoProfit = Math.max(0, zohoTotal - zohoDevPerClient - 100);
  const zohoMarkPer = Math.round(zohoProfit * (zMarkPct / 100));
  const zohoCompPer = Math.round(zohoProfit * (zCoPct / 100));

  // === MARK'S TOTAL MONTHLY COMP ===
  const base = pt.bs || 0;
  const ezC = Math.round(zmBase * (pt.ezp || 0) / 100);
  const markFromZoho = nZ * zohoMarkPer;
  const markFromOdoo = oC * odooMarkPer;
  const mComp = base + ezC + markFromZoho + markFromOdoo;

  // === PAUL'S MONTHLY FROM PARTNERSHIP ===
  const paulFromOdoo = oC * odooPaulPer;

  // === COMPANY KEEPS ===
  const compFromZoho = nZ * zohoCompPer;
  const compFromOdoo = oC * odooCompPer;
  const compTotal = compFromZoho + compFromOdoo;

  // === NET IMPACT (revenue to company - all partnership costs) ===
  const totalNewRev = oC * pt.oar + nZ * zohoTotal;
  const netMonthly = compTotal + paulFromOdoo - base - ezC - totalDevCost - overhead;

  // === MONTHLY RUNWAY PROJECTION (for the 3 runway cards) ===
  const months = [];
  let cumCash = 0;
  const sm = pt.sm || 0;
  const dl = pt.dl || 0;
  for (let i = 0; i < 12; i++) {
    const active = i >= sm;
    const monthsActive = active ? i - sm + 1 : 0;
    const revenueActive = active && monthsActive > dl;
    // During ramp: cost but no revenue. After ramp: steady state.
    const mCost = active ? base + ezC + totalDevCost + overhead + (monthsActive === 1 ? (pt.opc||0) : 0) : 0;
    const mRev = revenueActive ? (compTotal + paulFromOdoo) : 0;
    const net = mRev - mCost;
    cumCash += net;
    months.push({ net: Math.round(net), cum: Math.round(cumCash), inDelay: active && !revenueActive,
      oC: revenueActive ? oC : 0, nZ: revenueActive ? nZ : 0, dH: active ? totalDevs : 0,
      mComp: active ? Math.round(revenueActive ? mComp : base + ezC) : 0,
      oPR: revenueActive ? Math.round(paulFromOdoo) : 0,
      oCR: revenueActive ? Math.round(compTotal) : 0,
      totalDevCost: active ? Math.round(totalDevCost) : 0,
      totalRev: revenueActive ? Math.round(compTotal + paulFromOdoo) : 0,
      newRev: revenueActive ? Math.round(totalNewRev) : 0,
    });
  }

  const mFixed = base + ezC;
  const worst = Math.min(...months.map(m => m.cum));
  const breakeven = months.findIndex((m, i) => i > sm && m.cum > 0);

  return {
    months, breakeven, worst, ok: worst > -8000, tight: worst > -3000,
    mFixed, mComp, netMonthly: Math.round(netMonthly),
    // Per-client numbers for display
    odooMarkPer, odooPaulPer, odooCompPer, odooProfit: Math.round(odooProfit),
    zohoMarkPer, zohoCompPer, zohoProfit: Math.round(zohoProfit),
    zLicPerClient, totalDevs, totalDevCost: Math.round(totalDevCost), overhead,
    paulFromOdoo: Math.round(paulFromOdoo), compTotal: Math.round(compTotal),
    netPerOdoo: Math.round(odooCompPer + odooPaulPer),
    netPerZoho: Math.round(zohoCompPer),
    devPerClient: Math.round(pt.dch / cpc),
    nZ, oC, totalNewRev: Math.round(totalNewRev),
    markFromZoho, markFromOdoo,
  };
}

export function computeDevHire(dh) {
  const months = [];
  let cumCash = 0, breakeven = -1;
  const totalCost = dh.cnt * dh.avg;
  const capacity = dh.cnt * dh.cpc;
  const isGrowth = dh.mode === "growth";
  const addedRev = isGrowth ? capacity * dh.rpc : 0;

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
  return { months, breakeven, totalCost, capacity, addedRev, isGrowth, worst: Math.min(...months.map(m => m.cum)) };
}

export function computeWithOverlays(d, options = { partnership: false, devHire: false }) {
  const base = compute(d);
  const oRv = [...base.rv], oEx = [...base.ex];
  const pCostArr = new Array(12).fill(0), pRevArr = new Array(12).fill(0);
  const dhCostArr = new Array(12).fill(0), dhRevArr = new Array(12).fill(0);

  if (options.partnership) {
    const pm = computePartnership(d.pt || {});
    for (let i = 0; i < 12; i++) { pCostArr[i] = pm.months[i].totalCost; pRevArr[i] = pm.months[i].totalRev; oRv[i] += pRevArr[i]; oEx[i] -= pCostArr[i]; }
  }
  if (options.devHire) {
    const dm = computeDevHire(d.dh || {});
    for (let i = 0; i < 12; i++) { dhCostArr[i] = dm.months[i].cost; dhRevArr[i] = dm.months[i].rev; oRv[i] += dhRevArr[i]; oEx[i] -= dhCostArr[i]; }
  }
  const oNt = oRv.map((r, i) => r + oEx[i]);
  const oBl = []; oNt.forEach((n, i) => oBl.push(i === 0 ? d.openBal + n : oBl[i - 1] + n));
  return { base, overlay: { rv: oRv, ex: oEx, nt: oNt, bl: oBl }, pCost: pCostArr, pRev: pRevArr, dhCost: dhCostArr, dhRev: dhRevArr };
}