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
  return { rv: rvT, rvBase: rv, sb, oc, db, us, ph, ind, ex: exT, exBase: ex, nt, bl, at, scRv, scEx };
}

// Partnership model v3 — service commission (15% of profit) + license commission
// Client cap: max 3 new clients per month. Revenue ramps linearly.
// License: organic = Mark 10%, Co 40%, Paul 50%. Restored = Mark 40%, Co 40%, Paul 20%.
export function computePartnership(pt) {
  const cpc = pt.cpc || 2.5;
  const clientCap = 3; // max new clients per month
  const svcRate = pt.azr || 2000; // service contract per client/mo
  const oRate = pt.oar || 2000; // Odoo service rate (same for now)

  // License commission per client
  const zLicPerClient = Math.round((pt.zSeats || 15) * (pt.zSeatPrice || 40) * (pt.zCommPct || 18) / 100);

  // License split depends on Zoho lead toggle
  const licMarkPct = pt.zLeadBonus ? 40 : 10;
  const licCoPct = 40; // always 40% minimum
  const licPaulPct = pt.zLeadBonus ? 20 : 50;

  const targetZ = pt.nzq || 0; // target total Zoho clients
  const targetO = pt.ocq || 0; // target total Odoo clients
  const targetTotal = targetZ + targetO;
  const base = pt.bs || 0;
  const sm = pt.sm || 0;
  const dl = pt.dl || 0;

  // === PER-CLIENT ECONOMICS (at steady state with all clients active) ===
  const totalClients = targetZ + targetO;
  const devsNeeded = totalClients > 0 ? Math.ceil(totalClients / cpc) : 0;
  const devCostPerClient = totalClients > 0 ? (devsNeeded * pt.dch) / totalClients : 0;
  const overhead = 100; // per client per month

  // Service profit per client (after dev + overhead)
  const svcProfit = Math.max(0, svcRate - devCostPerClient - overhead);
  const markSvcPer = Math.round(svcProfit * 0.15); // 15% of service profit
  const companySvcPer = svcProfit - markSvcPer; // company keeps the rest

  // License per client
  const markLicPer = Math.round(zLicPerClient * licMarkPct / 100);
  const compLicPer = Math.round(zLicPerClient * licCoPct / 100);
  const paulLicPer = Math.round(zLicPerClient * licPaulPct / 100);

  // === STEADY STATE (all clients active) ===
  const markSvcTotal = totalClients * markSvcPer;
  const markLicTotal = totalClients * markLicPer;
  const mComp = base + markSvcTotal + markLicTotal;

  const compSvcTotal = totalClients * companySvcPer;
  const compLicTotal = totalClients * compLicPer;
  const paulLicTotal = totalClients * paulLicPer;

  const totalDevCost = devsNeeded * pt.dch;
  const totalOverhead = totalClients * overhead;
  const totalNewRev = totalClients * (svcRate + zLicPerClient);

  // Net monthly = all revenue to company - Mark's salary - devs - overhead
  // (company svc + company lic + paul lic) is what stays after Mark's cuts
  // But devs and overhead are already deducted from svcProfit, so:
  // netMonthly = company keeps from service + company keeps from license + paul keeps from license - base salary
  // Actually let me think more carefully:
  // Gross revenue per client = svcRate + zLicPerClient
  // Costs per client = devCostPerClient + overhead = $400
  // Profit per client = gross - costs
  // Service profit split: Mark 15%, Company 85%
  // License split: Mark X%, Company 40%, Paul Y%
  // Total to company per client = companySvcPer + compLicPer
  // Total to paul per client = paulLicPer
  // Total outflows = base salary (Mark) + dev costs + overhead (already in per-client calc)
  // Since companySvcPer already has dev+overhead deducted, net = compSvcTotal + compLicTotal + paulLicTotal - base
  const netMonthly = compSvcTotal + compLicTotal + paulLicTotal - base;

  // === MONTHLY PROJECTION (for runway cards) with 3/mo client ramp ===
  const months = [];
  let cumCash = 0;
  for (let i = 0; i < 12; i++) {
    const active = i >= sm;
    const monthsActive = active ? i - sm + 1 : 0;
    const inDelay = active && monthsActive <= dl;
    const revenueMonths = active && monthsActive > dl ? monthsActive - dl : 0;

    // Clients ramping at 3/month after delay
    const clientsSoFar = Math.min(targetTotal, revenueMonths * clientCap);
    const zohoActive = targetZ > 0 ? Math.min(targetZ, Math.round(clientsSoFar * targetZ / targetTotal)) : 0;
    const odooActive = clientsSoFar - zohoActive;

    // Devs needed for current active clients
    const curDevs = clientsSoFar > 0 ? Math.ceil(clientsSoFar / cpc) : 0;
    const curDevCost = active ? Math.max(curDevs, inDelay ? 1 : 0) * pt.dch : 0; // min 1 dev during delay
    const curDevPerClient = clientsSoFar > 0 ? (curDevs * pt.dch) / clientsSoFar : 0;
    const curOverhead = clientsSoFar * overhead;

    // Per-client profit at current dev spread
    const curSvcProfit = clientsSoFar > 0 ? Math.max(0, svcRate - curDevPerClient - overhead) : 0;
    const curMarkSvc = Math.round(curSvcProfit * 0.15);
    const curCompSvc = curSvcProfit - curMarkSvc;

    // Monthly totals
    const mMarkSvc = clientsSoFar * curMarkSvc;
    const mMarkLic = clientsSoFar * markLicPer;
    const mMarkTotal = (active ? base : 0) + (clientsSoFar > 0 ? mMarkSvc + mMarkLic : 0);
    const mCompSvc = clientsSoFar * curCompSvc;
    const mCompLic = clientsSoFar * compLicPer;
    const mPaulLic = clientsSoFar * paulLicPer;
    const mRevToCompany = mCompSvc + mCompLic + mPaulLic;

    const setup = (active && monthsActive === 1) ? (pt.opc || 0) : 0;
    const mCost = (active ? base : 0) + curDevCost + curOverhead + setup;
    const mNet = mRevToCompany - (active ? base : 0) - (inDelay ? (1 * pt.dch) : 0) - (inDelay ? 0 : 0) - setup;
    // Simpler: net = revenue that stays in company - mark's salary - dev costs - overhead - setup
    const mGrossRev = clientsSoFar * (svcRate + zLicPerClient);
    const mAllCosts = (active ? base : 0) + curDevCost + curOverhead + setup + mMarkSvc + mMarkLic;
    const net = mGrossRev - mAllCosts;

    cumCash += active ? net : 0;

    months.push({
      net: Math.round(net), cum: Math.round(cumCash), inDelay,
      oC: odooActive, nZ: zohoActive, clients: clientsSoFar, dH: curDevs + (inDelay && curDevs === 0 ? 1 : 0),
      mComp: Math.round(mMarkTotal),
      oPR: Math.round(mPaulLic), oCR: Math.round(mCompSvc + mCompLic),
      totalDevCost: Math.round(curDevCost), overhead: Math.round(curOverhead),
      totalRev: Math.round(mRevToCompany),
      newRev: Math.round(mGrossRev),
    });
  }

  const worst = Math.min(...months.map(m => m.cum));
  const breakeven = months.findIndex((m, i) => i > sm && m.cum > 0);

  return {
    months, breakeven, worst,
    mComp, netMonthly: Math.round(netMonthly), base,
    // Per-client for display
    markSvcPer, companySvcPer, markLicPer, compLicPer, paulLicPer,
    svcProfit: Math.round(svcProfit), zLicPerClient,
    totalDevs: devsNeeded, totalDevCost: Math.round(totalDevCost),
    overhead: totalOverhead, devPerClient: Math.round(devCostPerClient),
    paulLicTotal: Math.round(paulLicTotal), compTotal: Math.round(compSvcTotal + compLicTotal),
    totalNewRev: Math.round(totalNewRev),
    nZ: targetZ, oC: targetO, totalClients,
    markSvcTotal, markLicTotal, compSvcTotal, compLicTotal,
    licMarkPct, licCoPct, licPaulPct,
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