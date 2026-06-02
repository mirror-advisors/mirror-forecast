// E2b runway verification — runs compute() against rebuilt D0 and prints the
// precise runway number. Same countGreen logic as App.jsx.
import { D0, MO } from '../src/data.js';
import { compute } from '../src/compute.js';

// Force "today" for repeatability — the live app uses real Date(). For our
// purposes (May 4, 2026) cm=4. Comment out the override to use real wall clock.
const CM_OVERRIDE = 5; // June 2026

const c = compute(D0);
const cm = CM_OVERRIDE !== null ? CM_OVERRIDE : new Date().getMonth();

// === countGreen — copied verbatim from App.jsx (decimal-month runway) ===
function countGreen(bal, openBal) {
  let count = 0;
  let i = cm;
  while (i < bal.length && bal[i] > 0) { count++; i++; }
  if (i < bal.length) {
    const lastPos = bal[i - 1];
    const burn = lastPos - bal[i];
    if (burn > 0) count += Math.min(lastPos / burn, 1);
  } else {
    const buffer = bal[bal.length - 1];
    const ntDerived = bal.map((v, idx) => idx === 0 ? v - openBal : v - bal[idx - 1]);
    const last3 = ntDerived.slice(-3);
    const avgNet = last3.reduce((s, v) => s + v, 0) / last3.length;
    const projectedBurn = -avgNet;
    if (projectedBurn > 0 && buffer > 0) count += buffer / projectedBurn;
  }
  return Math.round(count * 4) / 4;
}

// Baseline runway uses rvBase + exBase (no scenarios) — matches App.jsx blBase.
const blBase = [];
const ntBase = c.rvBase.map((v, i) => v + c.exBase[i]);
ntBase.forEach((n, i) => blBase.push(i === 0 ? D0.openBal + n : blBase[i - 1] + n));
const mgBase = countGreen(blBase, D0.openBal);
// Forward-looking deficit only: ignore historical negatives before cm.
const fdBase = (() => { for (let i = cm; i < blBase.length; i++) if (blBase[i] <= 0) return i; return -1; })();

const sm = a => a.reduce((s, v) => s + v, 0);
const fmt = n => {
  if (!n || n === 0) return '—';
  const a = Math.abs(Math.round(n));
  return n < 0 ? `($${a.toLocaleString()})` : `$${a.toLocaleString()}`;
};

const labelFor = (i) => i < 12 ? MO[i] : `${MO[i - 12]}'27`;

console.log('=== E2b RUNWAY VERIFICATION ===');
console.log(`Computed at cm=${cm} (${labelFor(cm)} 2026)`);
console.log(`openBal: ${fmt(D0.openBal)}`);
console.log(`cashNow: ${fmt(D0.cashNow)}`);
console.log('');

console.log('--- Per-stream revenue sums (24-month horizon) ---');
console.log(`rv.im (Infinity Mirror + project + support-retainer): ${fmt(sm(c.rvDerived.im))}`);
console.log(`rv.zm (Zoho monthly):                                 ${fmt(sm(c.rvDerived.zm))}`);
console.log(`rv.za (Zoho annual lumps):                            ${fmt(sm(c.rvDerived.za))}`);
console.log(`rv.ot (one-time / bank-of-hours unpaid future):       ${fmt(sm(c.rvDerived.ot))}`);
console.log(`Total rv (incl. mk + pCruzy + pPatson):               ${fmt(sm(c.rvBase))}`);
console.log('');

console.log('--- Per-month forecast (idx, label, rv, ex, net, balance) ---');
for (let i = 0; i < 24; i++) {
  const label = labelFor(i).padEnd(7);
  const rv = c.rvBase[i].toFixed(0).padStart(8);
  const ex = c.exBase[i].toFixed(0).padStart(8);
  const net = ntBase[i].toFixed(0).padStart(8);
  const bal = blBase[i].toFixed(0).padStart(10);
  const flag = i === cm ? ' ← cm' : (i === fdBase && fdBase >= 0 ? ' ← deficit' : '');
  console.log(`  ${String(i).padStart(2)} ${label}  rv=${rv}  ex=${ex}  net=${net}  bal=${bal}${flag}`);
}
console.log('');

console.log('--- rv.im breakdown by client ---');
c.rvBreakdown.im.forEach(b => {
  const total = sm(b.monthly);
  console.log(`  ${b.clientId.padEnd(4)} ${b.clientName.padEnd(28)} 24mo total: ${fmt(total)}`);
});
console.log('');

console.log('--- rv.za annual lumps by client ---');
c.rvBreakdown.za.forEach(b => {
  const total = sm(b.monthly);
  const renewIdx = b.monthly.findIndex(v => v > 0);
  const month = renewIdx >= 0 ? labelFor(renewIdx) : 'none-in-horizon';
  console.log(`  ${b.clientId.padEnd(4)} ${b.clientName.padEnd(28)} ${fmt(total).padStart(10)} @ ${month}`);
});
console.log('');

console.log('--- rv.ot (paymentSchedule unpaid-future) by client ---');
c.rvBreakdown.ot.forEach(b => {
  const total = sm(b.monthly);
  const idxs = b.monthly.map((v, i) => v > 0 ? `${labelFor(i)}=${fmt(v)}` : null).filter(Boolean);
  console.log(`  ${b.clientId.padEnd(4)} ${b.clientName.padEnd(28)} 24mo total: ${fmt(total)}  [${idxs.join(', ')}]`);
});
console.log('');

console.log('===============================================');
console.log(`  Runway: ${mgBase.toFixed(2)} months green`);
console.log(`  Deficit month (first bal<=0): ${fdBase >= 0 ? labelFor(fdBase) : 'never within horizon'}`);
console.log(`  Dec 2026 balance: ${fmt(blBase[11])}`);
console.log(`  End-of-horizon (Dec 2027) balance: ${fmt(blBase[23])}`);
console.log('===============================================');
