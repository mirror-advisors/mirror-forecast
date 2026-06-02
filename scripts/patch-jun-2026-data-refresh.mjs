/**
 * patch-jun-2026-data-refresh.mjs — One-shot Supabase data patch for June 1, 2026 data refresh.
 *
 * Patches the live forecast_data row (id=1). Applies in groups; each group is idempotent.
 *
 * GROUPS (driven by --group flag, or --apply runs all approved groups in order):
 *   1  Cash + Stripe loan removal
 *   2  Personnel (tm[]) + et[] zero-out from idx 5+
 *   3  oc[] / af[] / wf[] expense rebuild
 *   4  sb[] SaaS list rebuild
 *   5  Client churn (c1 zoho, c4 zoho)
 *   6  Service retainer status (c3 380 Guide)
 *   7  Plastics c7 (May $10K paid + zoho commission add)
 *   8  Zoho commission renewal updates (Surface Solutions, New Hope)
 *
 * Usage:
 *   node scripts/patch-jun-2026-data-refresh.mjs --backup            # snapshot + diff preview
 *   node scripts/patch-jun-2026-data-refresh.mjs --apply --group 1   # apply one group
 *   node scripts/patch-jun-2026-data-refresh.mjs --apply             # apply all enabled groups
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const envPath = resolve(ROOT, '.env.local');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
const env = {};
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const SUPABASE_URL = env.SUPABASE_URL || 'https://pkphesuvwzlowbssepxi.supabase.co';
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchRow() {
  const { data, error } = await supabase.from('forecast_data').select('data').eq('id', 1).single();
  if (error) { console.error('Fetch error:', error); process.exit(1); }
  return data.data;
}

async function writeRow(payload) {
  const { error } = await supabase
    .from('forecast_data')
    .upsert({ id: 1, data: payload, updated_at: new Date().toISOString() });
  if (error) { console.error('Write error:', error); process.exit(1); }
}

// ─── Group 1: Cash + Stripe loan removal ────────────────────────────────────
function applyGroup1(d) {
  let changes = 0;
  const TARGET_CASH = 24338.66;
  if (d.cashNow !== TARGET_CASH) {
    console.log(`  ✓ cashNow: ${d.cashNow} → ${TARGET_CASH}`);
    d.cashNow = TARGET_CASH;
    changes++;
  } else {
    console.log('  – cashNow already 24338.66');
  }
  const before = (d.db || []).length;
  d.db = (d.db || []).filter(x => x.n !== 'Stripe Loan');
  if (d.db.length < before) {
    console.log('  ✓ db[]: removed "Stripe Loan" line');
    changes++;
  } else {
    console.log('  – db[]: no "Stripe Loan" line found, skipping');
  }
  return changes;
}

// ─── Group 2: Personnel (tm[]) + et[] zero-out from idx 5+ ──────────────────
function applyGroup2(d) {
  let changes = 0;

  // tm[] updates: id → desired fields
  const TM_TARGETS = {
    p1:  { co: 9868 },
    p2:  { co: 741 },
    p3:  { co: 608 },
    p6:  { co: 1070 },
    p7:  { co: 1070 },
    p8:  { on: false },                 // bench Gowtham from Jun
    p11: { on: false },                 // bench Ravindar from Jun
    p12: { co: 465 },
  };
  for (const [id, patch] of Object.entries(TM_TARGETS)) {
    const t = (d.tm || []).find(x => x.id === id);
    if (!t) { console.log(`  ! tm[] ${id} NOT FOUND, skipping`); continue; }
    const diffs = [];
    for (const [k, v] of Object.entries(patch)) {
      if (t[k] !== v) { diffs.push(`${k}:${t[k]}→${v}`); t[k] = v; }
    }
    if (diffs.length) { console.log(`  ✓ tm[${id}] ${t.nm}: ${diffs.join(', ')}`); changes++; }
    else { console.log(`  – tm[${id}] ${t.nm}: already ok`); }
  }

  // Add Tryon Scott if missing
  const hasTryon = (d.tm || []).some(x => x.id === 'p14' || x.nm === 'Tryon Scott');
  if (!hasTryon) {
    d.tm.push({ id:'p14', nm:'Tryon Scott', rl:'Support', dp:'Marketing', ct:'PH', co:276, on:true, startMo:5 });
    console.log('  ✓ tm[]: ADDED Tryon Scott (p14, PH, $276, startMo:5)');
    changes++;
  } else {
    console.log('  – tm[]: Tryon Scott already present');
  }

  // et[] zero-out from idx 5+
  const targetEt = [-523,-1188,-1500,-1177,-1177,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  const etDiff = (d.et || []).some((v, i) => v !== targetEt[i]);
  if (etDiff) {
    d.et = targetEt;
    console.log('  ✓ et[]: zeroed idx 5+ (Jun 2026 forward), Q1+May preserved');
    changes++;
  } else {
    console.log('  – et[]: already correct');
  }

  return changes;
}

// ─── Group 3: oc[] rebuild ──────────────────────────────────────────────────
function applyGroup3(d) {
  let changes = 0;

  // Target oc[] structure (does not include Gowtham/Ravindar May partials — those are
  // preserved separately as historical lines added by the prior May 2026 ops patch).
  const targetCore = [
    { n: "Cell Phone",          v: [-136,-141,-141,-141,-141,-174,-174,-174,-174,-174,-174,-174,-174,-174,-174,-174,-174,-174,-174,-174,-174,-174,-174,-174] },
    { n: "Bank Fees",           v: [0,0,0,0,0,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30] },
    { n: "Old Acct Transfer",   v: [-398,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    { n: "Mark Alberto (COO)",  v: [0,0,0,-5000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    { n: "LearnAll",            v: [0,0,0,-3000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    { n: "RSK Advisors (Tax)",  v: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    { n: "CC Interest",         v: [0,0,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130] },
  ];

  // Preserve any historical-partial lines from the May 2026 ops patch.
  const preserved = (d.oc || []).filter(o =>
    o.n && (o.n.includes('Gowtham (May partial)') || o.n.includes('Ravindar (May partial)'))
  );

  const newOc = [...targetCore, ...preserved];

  const sameLen = (d.oc || []).length === newOc.length;
  const sameContent = sameLen && (d.oc || []).every((o, i) =>
    o.n === newOc[i].n && Array.isArray(o.v) && o.v.length === newOc[i].v.length &&
    o.v.every((v, j) => v === newOc[i].v[j])
  );

  if (sameContent) {
    console.log('  – oc[]: already matches target');
  } else {
    const removed = (d.oc || []).filter(o => !newOc.some(n => n.n === o.n)).map(o => o.n);
    const added = newOc.filter(n => !(d.oc || []).some(o => o.n === n.n)).map(o => o.n);
    if (removed.length) console.log(`  ✓ oc[]: removed [${removed.join(', ')}]`);
    if (added.length) console.log(`  ✓ oc[]: added [${added.join(', ')}]`);
    console.log(`  ✓ oc[]: rebuilt (${newOc.length} lines, preserved ${preserved.length} historical partials)`);
    d.oc = newOc;
    changes++;
  }

  return changes;
}

// ─── Group 4: sb[] SaaS list rebuild ────────────────────────────────────────
function applyGroup4(d) {
  const target = [
    { n: "Anthropic/Claude", a: 219 },
    { n: "Regus",            a: 121 },
    { n: "Google Workspace", a: 61 },
    { n: "Canva",            a: 48 },
    { n: "Wix",              a: 26 },
    { n: "Microsoft",        a: 24 },
    { n: "Webflow",          a: 20 },
    { n: "Zoom",             a: 18 },
    { n: "Supabase",         a: 14 },
    { n: "Proton",           a: 7 },
    { n: "Vercel",           a: 4 },
  ];
  const cur = d.sb || [];
  const same = cur.length === target.length && cur.every((x, i) =>
    x.n === target[i].n && x.a === target[i].a &&
    x.s === undefined && x.e === undefined
  );
  if (same) {
    console.log('  – sb[]: already matches target');
    return 0;
  }
  const removed = cur.filter(o => !target.some(t => t.n === o.n)).map(o => o.n);
  const added = target.filter(t => !cur.some(o => o.n === t.n)).map(o => o.n);
  if (removed.length) console.log(`  ✓ sb[]: removed [${removed.join(', ')}]`);
  if (added.length) console.log(`  ✓ sb[]: added [${added.join(', ')}]`);
  const total = target.reduce((s, x) => s + x.a, 0);
  console.log(`  ✓ sb[]: rebuilt (${target.length} lines, total $${total}/mo)`);
  d.sb = target;
  return 1;
}

// ─── Group 5: Churn c1 zoho + c4 zoho ───────────────────────────────────────
function applyGroup5(d) {
  let changes = 0;
  for (const id of ['c1', 'c4']) {
    const c = (d.cl || []).find(x => x.id === id);
    if (!c || !c.zohoCommission) { console.log(`  ! ${id}: no zohoCommission, skipping`); continue; }
    const zc = c.zohoCommission;
    if (zc.status === 'churned' && zc.inForecast === false) {
      console.log(`  – ${id} ${c.nm} zoho: already churned`);
      continue;
    }
    zc.status = 'churned';
    zc.inForecast = false;
    if (!zc.note || !zc.note.includes('Churned')) zc.note = 'Churned with service contract Jun 2026';
    console.log(`  ✓ ${id} ${c.nm} zoho: → churned, inForecast:false`);
    changes++;
  }
  return changes;
}

// ─── Group 6: c3 380 Guide status active ────────────────────────────────────
function applyGroup6(d) {
  const c = (d.cl || []).find(x => x.id === 'c3');
  if (!c?.serviceContract) { console.log('  ! c3 not found, skipping'); return 0; }
  if (c.serviceContract.status === 'active') {
    console.log('  – c3 380 Guide: already active');
    return 0;
  }
  c.serviceContract.status = 'active';
  c.notes = 'Overdue invoices INV-0160, INV-0164 — timing/collection only, contract intact';
  console.log('  ✓ c3 380 Guide: status at-risk → active');
  return 1;
}

// ─── Group 7: Plastics c7 (May $10K paid + zoho add) ────────────────────────
function applyGroup7(d) {
  let changes = 0;
  const c = (d.cl || []).find(x => x.id === 'c7');
  if (!c) { console.log('  ! c7 not found'); return 0; }

  // 7a: mark 2026-05-15 $10K paid
  const may = c.serviceContract?.paymentSchedule?.find(p => p.dueDate === '2026-05-15');
  if (may && !may.paid) {
    may.paid = true;
    may.status = 'P';
    console.log('  ✓ c7 2026-05-15 $10K: paid:false → true (status P)');
    changes++;
  } else {
    console.log('  – c7 2026-05-15 $10K: already paid');
  }

  // 7b: add zoho commission if missing
  if (!c.zohoCommission) {
    c.zohoCommission = {
      zohoProduct: "One", licenses: 20,
      frequency: "annual", monthlyAmount: 0, annualAmount: 1944,
      renewalDate: "2027-05-12", renewalDay: null,
      status: "active", inForecast: true, note: "Renewal passed May 2026, next May 2027",
    };
    console.log('  ✓ c7 zoho: ADDED annual $1,944 renewing 2027-05-12');
    changes++;
  } else {
    console.log('  – c7 zoho: already present');
  }
  return changes;
}

// ─── Group 8: Zoho renewal date fixes ───────────────────────────────────────
function applyGroup8(d) {
  let changes = 0;

  // c20 Surface Solutions: amount + renewalDate
  const c20 = (d.cl || []).find(x => x.id === 'c20');
  if (c20?.zohoCommission) {
    const zc = c20.zohoCommission;
    if (zc.annualAmount !== 300 || zc.renewalDate !== '2027-04-23') {
      zc.annualAmount = 300;
      zc.renewalDate = '2027-04-23';
      console.log('  ✓ c20 Surface Solutions zoho: annualAmount→300, renewalDate→2027-04-23');
      changes++;
    } else {
      console.log('  – c20 Surface Solutions zoho: already correct');
    }
  } else { console.log('  ! c20 not found'); }

  // c19 New Hope: renewal date bump
  const c19 = (d.cl || []).find(x => x.id === 'c19');
  if (c19?.zohoCommission) {
    const zc = c19.zohoCommission;
    if (zc.renewalDate !== '2027-05-28') {
      const old = zc.renewalDate;
      zc.renewalDate = '2027-05-28';
      if (!zc.note) zc.note = '2026 renewal received; next May 2027';
      console.log(`  ✓ c19 New Hope zoho: renewalDate ${old} → 2027-05-28`);
      changes++;
    } else {
      console.log('  – c19 New Hope zoho: already 2027-05-28');
    }
  } else { console.log('  ! c19 not found'); }

  return changes;
}

// ─── Group 9: Clear scenarios[] ─────────────────────────────────────────────
// Stale scenarios (Tyron PT double-counted with new p14 tm[]; project manager
// silently inflated burn; one-time revenue scenarios were speculative). Cleared
// so the Baseline Runway card and the chart subtitle show the same view.
function applyGroup9(d) {
  const n = (d.scenarios || []).length;
  if (n === 0) { console.log('  – scenarios[]: already empty'); return 0; }
  console.log(`  ✓ scenarios[]: cleared ${n} entries (${(d.scenarios || []).map(s => `"${s.name}"`).join(', ')})`);
  d.scenarios = [];
  return 1;
}

// ─── Group 11: Labels + c1/c4 zoho restore + c18 exclude ────────────────────
// Mirror Advisors earns both service retainers AND Zoho licensing commissions;
// they are independent. c1 Gomes & c4 VanBoxel ended SERVICE but kept Zoho.
function applyGroup11(d) {
  let changes = 0;

  // 11.1 Personnel rl labels (Yuva = Lead Dev, Soorya = Developer)
  const LBL = { p6: 'Developer', p7: 'Lead Dev' };
  for (const [id, rl] of Object.entries(LBL)) {
    const t = (d.tm || []).find(x => x.id === id);
    if (!t) { console.log(`  ! tm[${id}] missing`); continue; }
    if (t.rl !== rl) {
      console.log(`  ✓ tm[${id}] ${t.nm}: rl "${t.rl}" → "${rl}"`);
      t.rl = rl;
      changes++;
    } else { console.log(`  – tm[${id}] ${t.nm}: rl already "${rl}"`); }
  }

  // 11.2 c1 Gomes zoho — active, $129.60/mo (NOT 810). Service stays churned.
  const c1 = (d.cl || []).find(x => x.id === 'c1');
  if (c1?.zohoCommission) {
    const zc = c1.zohoCommission;
    const targets = { status: 'active', inForecast: true, monthlyAmount: 129.60 };
    const diffs = [];
    for (const [k, v] of Object.entries(targets)) {
      if (zc[k] !== v) { diffs.push(`${k}:${zc[k]}→${v}`); zc[k] = v; }
    }
    if (diffs.length) {
      zc.note = 'Service churned; Zoho licenses retained — $129.60/mo recurring';
      console.log(`  ✓ c1 Gomes zoho: ${diffs.join(', ')}`);
      changes++;
    } else { console.log('  – c1 Gomes zoho: already active @ $129.60'); }
  }

  // 11.3 c4 VanBoxel zoho — active, $399 annual, renewal Nov 13 2026.
  const c4 = (d.cl || []).find(x => x.id === 'c4');
  if (c4?.zohoCommission) {
    const zc = c4.zohoCommission;
    const targets = { status: 'active', inForecast: true, annualAmount: 399, renewalDate: '2026-11-13' };
    const diffs = [];
    for (const [k, v] of Object.entries(targets)) {
      if (zc[k] !== v) { diffs.push(`${k}:${zc[k]}→${v}`); zc[k] = v; }
    }
    if (diffs.length) {
      zc.note = 'Service churned; Zoho licenses retained — annual $399 renews Nov 13';
      console.log(`  ✓ c4 VanBoxel zoho: ${diffs.join(', ')}`);
      changes++;
    } else { console.log('  – c4 VanBoxel zoho: already active @ Nov 13'); }
  }

  // 11.4 c18 Modern Practice zoho — quit Zoho, exclude entirely.
  const c18 = (d.cl || []).find(x => x.id === 'c18');
  if (c18?.zohoCommission) {
    const zc = c18.zohoCommission;
    if (zc.status === 'churned' && zc.inForecast === false) {
      console.log('  – c18 Modern Practice zoho: already churned/excluded');
    } else {
      zc.status = 'churned';
      zc.inForecast = false;
      zc.note = 'Quit Zoho';
      console.log('  ✓ c18 Modern Practice zoho: → churned, inForecast:false');
      changes++;
    }
  }

  return changes;
}

// ─── Dispatch ───────────────────────────────────────────────────────────────
const GROUPS = {
  1:  { name: 'Cash + Stripe loan removal', fn: applyGroup1 },
  2:  { name: 'Personnel (tm[]) + et[] zero-out', fn: applyGroup2 },
  3:  { name: 'oc[] rebuild', fn: applyGroup3 },
  4:  { name: 'sb[] SaaS rebuild', fn: applyGroup4 },
  5:  { name: 'Churn c1 + c4 zoho', fn: applyGroup5 },
  6:  { name: 'c3 380 Guide status active', fn: applyGroup6 },
  7:  { name: 'Plastics c7 May paid + zoho add', fn: applyGroup7 },
  8:  { name: 'Zoho renewal date fixes (c19, c20)', fn: applyGroup8 },
  9:  { name: 'Clear scenarios[]', fn: applyGroup9 },
  11: { name: 'Cleanup (labels, c1/c4 restore, c18 exclude)', fn: applyGroup11 },
};

async function backup() {
  console.log('=== BACKUP + BEFORE STATE ===\n');
  const d = await fetchRow();
  const backupPath = resolve(ROOT, 'supabase-backup-pre-jun-2026-refresh.json');
  writeFileSync(backupPath, JSON.stringify(d, null, 2));
  console.log(`Backup saved to: ${backupPath}\n`);
  console.log(`  cashNow: ${d.cashNow}`);
  const stripe = (d.db || []).find(x => x.n === 'Stripe Loan');
  console.log(`  db[] Stripe Loan: ${stripe ? 'PRESENT' : 'ABSENT'}`);
  console.log('\n=== Ready for --apply. ===');
}

async function apply(groupArg) {
  const targets = groupArg ? [parseInt(groupArg, 10)] : Object.keys(GROUPS).map(Number);
  console.log(`=== APPLYING GROUPS: [${targets.join(', ')}] ===\n`);
  const d = await fetchRow();
  let total = 0;
  for (const g of targets) {
    const grp = GROUPS[g];
    if (!grp) { console.log(`  Group ${g} not implemented yet, skipping.`); continue; }
    console.log(`-- Group ${g}: ${grp.name} --`);
    total += grp.fn(d);
    console.log('');
  }
  if (total === 0) {
    console.log('No changes needed — already applied.');
    return;
  }
  console.log(`Writing ${total} changes to Supabase...`);
  await writeRow(d);
  console.log('✓ Written.\n');

  const d2 = await fetchRow();
  console.log('--- AFTER STATE ---');
  console.log(`  cashNow: ${d2.cashNow}`);
  const stripe = (d2.db || []).find(x => x.n === 'Stripe Loan');
  console.log(`  db[] Stripe Loan: ${stripe ? 'PRESENT' : 'ABSENT'}`);
  const summary = ['p1','p2','p3','p6','p7','p8','p11','p12','p14'];
  for (const id of summary) {
    const t = (d2.tm || []).find(x => x.id === id);
    if (t) console.log(`  tm[${id}] ${t.nm}: co=${t.co}, on=${t.on}, startMo=${t.startMo ?? '–'}, endMo=${t.endMo ?? '–'}`);
    else console.log(`  tm[${id}]: NOT FOUND`);
  }
  console.log(`  et[5..7]: [${(d2.et || []).slice(5, 8).join(', ')}]  (expect 0,0,0)`);
  console.log(`  oc[] lines (${(d2.oc || []).length}): ${(d2.oc || []).map(o => `${o.n}:${o.v[5] ?? '–'}`).join(' | ')}`);
  const sbTotal = (d2.sb || []).reduce((s, x) => s + (x.a || 0), 0);
  console.log(`  sb[] lines (${(d2.sb || []).length}), total $${sbTotal}/mo`);
  for (const id of ['c1', 'c4']) {
    const c = (d2.cl || []).find(x => x.id === id);
    if (c?.zohoCommission) console.log(`  ${id} ${c.nm} zoho: status=${c.zohoCommission.status}, inForecast=${c.zohoCommission.inForecast}`);
  }
}

const mode = process.argv[2];
const groupFlagIdx = process.argv.indexOf('--group');
const groupArg = groupFlagIdx > -1 ? process.argv[groupFlagIdx + 1] : null;

if (mode === '--backup') {
  await backup();
} else if (mode === '--apply') {
  await apply(groupArg);
} else {
  console.log('Usage: node scripts/patch-jun-2026-data-refresh.mjs --backup | --apply [--group N]');
  process.exit(1);
}
