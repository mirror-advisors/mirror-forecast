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

// Partnership model:
// Mark's comp = base + 5% existing Zoho comm + 10% new Zoho (service+license) + 35% Odoo PROFIT
// Odoo profit = gross revenue - dev cost spread across clients, then split 35/35/30
// Restored Zoho leads: up to 40% commission profits (toggle)
// Dev economics: 1 dev per 2.5 clients ($750/mo), cost spread across clients on that dev
export function computePartnership(pt) {
  const months = [];
  let cumCash = 0, breakeven = -1;
  const zmBase = 984;
  const dl = pt.dl || 0;
  const cpc = pt.cpc || 2.5; // clients per dev capacity

  // Zoho new business split (organic leads: website, partner, referrals)
  const zMarkPct = pt.nzp || 10;
  const zCoPct = pt.nzcs || 90;
  // Restored Zoho lead bonus (if toggle is on)
  const zLeadMarkPct = pt.zLeadBonus ? (pt.zLeadMark || 40) : 0;
  const zLeadCoPct = pt.zLeadBonus ? (pt.zLeadCo || 60) : 0;

  for (let i = 0; i < 12; i++) {
    const active = i >= pt.sm;
    const monthsActive = active ? i - pt.sm + 1 : 0;
    const revenueActive = active && monthsActive > dl;
    const revenueMonths = revenueActive ? monthsActive - dl : 0;
    const qIn = revenueActive ? Math.floor(revenueMonths / 3) + 1 : 0;
    const oC = revenueActive ? qIn * pt.ocq : 0; // Odoo clients
    const nZ = revenueActive ? qIn * pt.nzq : 0; // new Zoho clients

    // Dev allocation: number of devs needed, cost spread per client
    const devsNeeded = oC > 0 ? Math.ceil(oC / cpc) : 0;
    const totalDevCost = devsNeeded * pt.dch;
    const devCostPerClient = oC > 0 ? totalDevCost / oC : 0;

    // === ODOO: split on PROFIT after dev cost ===
    const oGross = oC * pt.oar;
    const oProfit = oC * (pt.oar - devCostPerClient); // profit after dev cost spread
    const oMR = oProfit * (pt.ops / 100);  // Mark's cut of profit
    const oPR = oProfit * (pt.ips / 100);  // Paul's cut of profit
    const oCR = oProfit * (pt.ocs / 100);  // Company's cut of profit

    // === NEW ZOHO: 10/90 on service revenue + license commission ===
    const nzServiceRev = nZ * pt.azr;       // e.g. 1 client × $2000/mo service
    const zLicPerClient = Math.round((pt.zSeats || 15) * (pt.zSeatPrice || 40) * (pt.zCommPct || 18) / 100);
    const nzLicenseRev = nZ * zLicPerClient; // e.g. 1 client × 15 seats × $40 × 18% = $108/mo
    const nzTotalRev = nzServiceRev + nzLicenseRev;
    const nzMarkCut = nzTotalRev * (zMarkPct / 100);
    const nzCoCut = nzTotalRev * (zCoPct / 100);

    // === MARK'S TOTAL COMP ===
    const base = active ? pt.bs : 0;
    const ezC = active ? zmBase * (pt.ezp / 100) : 0;
    const mComp = base + ezC + (revenueActive ? nzMarkCut + oMR : 0);

    // === NET TO COMPANY (cash impact of partnership) ===
    // Company gets: Odoo company share + Paul share + Zoho company share
    // Company pays: Mark's base + existing Zoho comm + dev costs + setup
    const pCost = (active && monthsActive === 1) ? pt.opc : 0;
    const net = active ? (oCR + oPR + nzCoCut - base - ezC - totalDevCost - pCost) : 0;

    cumCash += net;
    if (breakeven === -1 && cumCash > 0 && active && i > pt.sm) breakeven = i;

    months.push({
      oC, nZ, mComp: Math.round(mComp), dH: devsNeeded,
      newRev: Math.round(oGross + nzTotalRev),
      oProfit: Math.round(oProfit),
      net: Math.round(net), cum: Math.round(cumCash),
      oCR: Math.round(oCR), oPR: Math.round(oPR), oMR: Math.round(oMR),
      nzMarkCut: Math.round(nzMarkCut), nzCoCut: Math.round(nzCoCut),
      base, ezC: Math.round(ezC), totalDevCost: Math.round(totalDevCost), pCost,
      totalCost: Math.round(mComp + totalDevCost + pCost),
      totalRev: Math.round(oCR + oPR + nzCoCut),
      inDelay: active && !revenueActive,
      devCostPerClient: Math.round(devCostPerClient),
    });
  }

  const mFixed = pt.bs + zmBase * (pt.ezp / 100);
  const devPerClient = pt.dch / cpc;
  const profitPerOdoo = pt.oar - devPerClient;
  const netPerOdoo = profitPerOdoo * ((pt.ocs + pt.ips) / 100);
  const zLicPC = Math.round((pt.zSeats || 15) * (pt.zSeatPrice || 40) * (pt.zCommPct || 18) / 100);
  const zohoTotalPerClient = pt.azr + zLicPC;
  const zohoProfit = pt.azr - (pt.svcCost || 384) + zLicPC; // service margin + license comm
  const netPerZoho = zohoProfit * ((pt.nzcs || 90) / 100);
  const beC = netPerOdoo > 0 ? Math.ceil(mFixed / netPerOdoo) : Infinity;
  const worst = Math.min(...months.map(m => m.cum));
  return { months, breakeven, beC, worst, ok: worst > -8000, tight: worst > -3000, mFixed, netPerOdoo: Math.round(netPerOdoo), netPerZoho: Math.round(netPerZoho), devPerClient: Math.round(devPerClient), zLicPerClient: zLicPC, zohoTotalPerClient, zohoProfit: Math.round(zohoProfit) };
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