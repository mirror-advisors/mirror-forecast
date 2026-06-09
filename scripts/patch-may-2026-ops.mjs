/**
 * patch-may-2026-ops.mjs — One-shot Supabase data patch for May 2026 operational updates.
 *
 * Patches the live forecast_data row (id=1) to reflect:
 *   1. Gomes Agency (c1): churned, inForecast:false, unpaid schedule → "C"
 *   2. VanBoxel (c4): churned, unpaid schedule → "C"
 *   3. Gowtham (p8): endMo:3 (last full month = April)
 *   4. Ravindar (p11): co:325, endMo:4 (May only at prorated rate)
 *   5. oc[]: add Gowtham May partial ($88) if not already present
 *
 * Idempotent — checks current state before each mutation, skips if already applied.
 *
 * Usage:
 *   node scripts/patch-may-2026-ops.mjs --backup     # Step 1: backup + print BEFORE
 *   node scripts/patch-may-2026-ops.mjs --apply      # Step 2: apply patches + print AFTER
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env (or .env.local).
 * Reads/writes via the relational tables + save_forecast_rows() RPC, not the blob.
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadForecast as fetchRow, saveForecast as writeRow } from './lib/forecastStore.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Helpers ─────────────────────────────────────────────────────────────────
// fetchRow() reads the relational tables; writeRow(d) writes via the
// save_forecast_rows() RPC. See scripts/lib/forecastStore.mjs.

function findClient(d, id) { return d.cl.find(c => c.id === id); }
function findTm(d, id) { return d.tm.find(t => t.id === id); }

function printClientStatus(label, c) {
  const sc = c?.serviceContract;
  console.log(`  ${label}: status="${sc?.status}", inForecast=${sc?.inForecast}`);
  const unpaid = (sc?.paymentSchedule || []).filter(p => !p.paid);
  const statuses = unpaid.map(p => p.status || '(none)');
  console.log(`    Unpaid schedule entries (${unpaid.length}): statuses = [${statuses.join(', ')}]`);
}

function printTm(label, t) {
  if (!t) { console.log(`  ${label}: NOT FOUND`); return; }
  console.log(`  ${label}: co=${t.co}, on=${t.on}, startMo=${t.startMo ?? '–'}, endMo=${t.endMo ?? '–'}`);
}

function printOcGowtham(d) {
  const match = (d.oc || []).find(o => o.n && o.n.includes('Gowtham') && (o.v[4] === -88));
  console.log(`  oc[] Gowtham May partial: ${match ? 'PRESENT' : 'ABSENT'}`);
}

// ─── Backup mode ─────────────────────────────────────────────────────────────

async function backup() {
  console.log('=== BACKUP + BEFORE STATE ===\n');
  const d = await fetchRow();

  // Save backup
  const backupPath = resolve(ROOT, 'supabase-backup-pre-may-2026-ops-update.json');
  writeFileSync(backupPath, JSON.stringify(d, null, 2));
  console.log(`Backup saved to: ${backupPath}\n`);

  // Print BEFORE state
  console.log('--- Client status ---');
  printClientStatus('c1 Gomes Agency', findClient(d, 'c1'));
  printClientStatus('c4 VanBoxel', findClient(d, 'c4'));

  console.log('\n--- Personnel ---');
  printTm('p8  Gowtham', findTm(d, 'p8'));
  printTm('p11 Ravindar', findTm(d, 'p11'));

  console.log('\n--- oc[] Gowtham May partial ---');
  printOcGowtham(d);

  console.log('\n--- Idempotency checks ---');
  const c1 = findClient(d, 'c1');
  const c4 = findClient(d, 'c4');
  const p8 = findTm(d, 'p8');
  const p11 = findTm(d, 'p11');
  const ocExists = (d.oc || []).some(o => o.n && o.n.includes('Gowtham') && (o.v[4] === -88));

  const skip = [];
  if (c1?.serviceContract?.status === 'churned') skip.push('c1 already churned');
  if (c4?.serviceContract?.status === 'churned') skip.push('c4 already churned');
  if (p8?.endMo === 3) skip.push('p8 Gowtham already endMo:3');
  if (p11?.endMo === 3 && p11?.co === 1136) skip.push('p11 Ravindar already patched');
  if (ocExists) skip.push('oc[] Gowtham May partial already present');
  const ocRavExists = (d.oc || []).some(o => o.n && o.n.includes('Ravindar') && (o.v[4] === -325));
  if (ocRavExists) skip.push('oc[] Ravindar May partial already present');

  if (skip.length) {
    console.log(`  Would skip: ${skip.join('; ')}`);
  } else {
    console.log('  All patches needed — none already applied.');
  }

  console.log('\n=== Ready for --apply. Awaiting approval. ===');
}

// ─── Apply mode ──────────────────────────────────────────────────────────────

async function apply() {
  console.log('=== APPLYING PATCHES ===\n');
  const d = await fetchRow();
  let changes = 0;

  // 1. Gomes (c1)
  const c1 = findClient(d, 'c1');
  if (c1?.serviceContract?.status !== 'churned') {
    c1.serviceContract.status = 'churned';
    c1.serviceContract.inForecast = false;
    c1.notes = 'Churned May 2026 — no further service revenue expected';
    c1.serviceContract.paymentSchedule = c1.serviceContract.paymentSchedule.map(p => {
      if (p.paid) return { ...p, status: 'P' };
      return { ...p, status: 'C', note: 'Written off — churned' };
    });
    console.log('  ✓ c1 Gomes: churned + schedule written off');
    changes++;
  } else {
    console.log('  – c1 Gomes: already churned, skipping');
  }

  // 2. VanBoxel (c4)
  const c4 = findClient(d, 'c4');
  if (c4?.serviceContract?.status !== 'churned') {
    c4.serviceContract.status = 'churned';
    c4.serviceContract.inForecast = false;
    c4.notes = 'Churned May 2026 — non-collectable invoices written off';
    c4.serviceContract.paymentSchedule = c4.serviceContract.paymentSchedule.map(p => {
      if (p.paid) return { ...p, status: 'P' };
      return { ...p, status: 'C', note: 'Written off — churned' };
    });
    console.log('  ✓ c4 VanBoxel: churned + schedule written off');
    changes++;
  } else {
    console.log('  – c4 VanBoxel: already churned, skipping');
  }

  // 3. Gowtham (p8) — endMo:3
  const p8 = findTm(d, 'p8');
  if (p8 && p8.endMo !== 3) {
    p8.endMo = 3;
    console.log('  ✓ p8 Gowtham: set endMo=3 (last full month Apr)');
    changes++;
  } else {
    console.log('  – p8 Gowtham: already endMo=3, skipping');
  }

  // 4. Ravindar (p11) — co:1136 (reference rate), startMo:4, endMo:3 (empty range → $0 via tm[])
  const p11 = findTm(d, 'p11');
  if (p11 && (p11.endMo !== 3 || p11.co !== 1136)) {
    p11.co = 1136;
    p11.startMo = 4;
    p11.endMo = 3;
    console.log('  ✓ p11 Ravindar: set co=1136, startMo=4, endMo=3 (empty range → $0 via tm)');
    changes++;
  } else {
    console.log('  – p11 Ravindar: already patched, skipping');
  }

  // 5. oc[] — Gowtham May partial $88
  const ocGowExists = (d.oc || []).some(o => o.n && o.n.includes('Gowtham') && (o.v[4] === -88));
  if (!ocGowExists) {
    d.oc.push({ n: "Gowtham (May partial)", v: [0,0,0,0,-88,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] });
    console.log('  ✓ oc[]: added Gowtham May partial ($88)');
    changes++;
  } else {
    console.log('  – oc[]: Gowtham May partial already present, skipping');
  }

  // 6. oc[] — Ravindar May partial $325
  const ocRavExists = (d.oc || []).some(o => o.n && o.n.includes('Ravindar') && (o.v[4] === -325));
  if (!ocRavExists) {
    d.oc.push({ n: "Ravindar (May partial)", v: [0,0,0,0,-325,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] });
    console.log('  ✓ oc[]: added Ravindar May partial ($325)');
    changes++;
  } else {
    console.log('  – oc[]: Ravindar May partial already present, skipping');
  }

  if (changes === 0) {
    console.log('\n  No changes needed — all patches already applied.');
    return;
  }

  // Write back
  console.log(`\n  Writing ${changes} patches to Supabase...`);
  await writeRow(d);
  console.log('  ✓ Written successfully.\n');

  // Verify by re-reading
  console.log('--- AFTER STATE (re-read from Supabase) ---');
  const d2 = await fetchRow();
  printClientStatus('c1 Gomes Agency', findClient(d2, 'c1'));
  printClientStatus('c4 VanBoxel', findClient(d2, 'c4'));
  printTm('p8  Gowtham', findTm(d2, 'p8'));
  printTm('p11 Ravindar', findTm(d2, 'p11'));
  printOcGowtham(d2);

  console.log('\n=== PATCH COMPLETE. Run verify-runway.mjs to confirm numbers. ===');
}

// ─── CLI dispatch ────────────────────────────────────────────────────────────

const mode = process.argv[2];
if (mode === '--backup') {
  await backup();
} else if (mode === '--apply') {
  await apply();
} else {
  console.log('Usage: node scripts/patch-may-2026-ops.mjs --backup|--apply');
  process.exit(1);
}
