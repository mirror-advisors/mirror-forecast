// E2c.2 chart verification — simulates each card's color state + annotations
// against the rebuilt data. Prints what the user SHOULD see in the browser
// so they can spot-check without a screenshot.
import { D0, MO, BUFFER_THIN_THRESHOLD } from '../src/data.js';
import { compute } from '../src/compute.js';
import { monthIdxFromDate } from '../src/clientsHelpers.js';

const c = compute(D0);
const cm = 4; // May 2026 (today is 2026-05-05)

function colorState(bal, net) {
  if (bal <= 0) return 'DEFICIT';
  if (bal <= BUFFER_THIN_THRESHOLD) return 'THIN   ';
  if (net < 0) return 'BURNING';
  return 'HEALTHY';
}

function fmtSigned(n) {
  if (n === 0) return '       —';
  const sign = n < 0 ? '−' : '+';
  const a = Math.abs(n);
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}k`.padStart(8);
  return `${sign}$${Math.round(a)}`.padStart(8);
}

function fK(n) {
  const a = Math.abs(n);
  if (a >= 1000) return (n < 0 ? '-' : '') + '$' + (a / 1000).toFixed(a % 1000 === 0 ? 0 : 1) + 'k';
  return n < 0 ? `(${a})` : `$${Math.round(a)}`;
}

function labelForIdx(i) {
  const year = 2026 + Math.floor(i / 12);
  return year > 2026 ? `${MO[i % 12]}'27` : MO[i % 12];
}

// Compute annotations per spec
const annotationsByIdx = new Map();
const push = (idx, label) => {
  if (!annotationsByIdx.has(idx)) annotationsByIdx.set(idx, []);
  annotationsByIdx.get(idx).push(label);
};

(D0.cl || []).forEach(cl => {
  const sc = cl.serviceContract;
  if (sc?.type === 'project' && sc?.endDate) {
    const idx = monthIdxFromDate(sc.endDate);
    if (idx != null && idx >= cm && idx < 24) {
      const first = (cl.nm || '').split(' ')[0];
      push(idx, `${first} ends`);
    }
  }
});
for (let i = cm; i < 24; i++) {
  if (c.nt[i] < 0) { push(i, 'Net flips negative'); break; }
}
for (let i = cm; i < 24; i++) {
  if (c.rvDerived.za[i] > 5000) push(i, 'Zoho renewals');
}
for (let i = cm; i < 24; i++) {
  if (c.bl[i] <= 0) { push(i, 'First deficit'); break; }
}

console.log('=== E2c.2 RUNWAY CHART VERIFICATION ===');
console.log(`Today: 2026-05-05  cm: ${cm}  BUFFER_THIN_THRESHOLD: $${BUFFER_THIN_THRESHOLD.toLocaleString()}`);
console.log("Title: \"Runway: 12.0 months · deficit Apr'27\"");
console.log('Legend: ● Healthy   ● Burning   ● Thin   ● Deficit');
console.log('');
console.log('Idx Month   Net      Balance    State    Current?  Annotations');
console.log('─── ───── ────────  ────────  ───────  ────────  ──────────────────');
for (let i = cm; i < 24; i++) {
  const bal = c.bl[i];
  const net = c.nt[i];
  const state = colorState(bal, net);
  const isCurrent = i === cm ? '   ★    ' : '        ';
  const anns = (annotationsByIdx.get(i) || []).join(' + ') || '';
  console.log(`${String(i).padStart(2)}  ${labelForIdx(i).padEnd(6)} ${fmtSigned(net)}  ${fK(bal).padStart(8)}  ${state}  ${isCurrent}  ${anns}`);
}
