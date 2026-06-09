// Phase 2 backfill: decompose the live forecast_data blob into the relational
// tables created by supabase/migrations/20260610000001_relational_schema.sql.
//
// Inserts via the service_role key (bypasses RLS). ADDITIVE — does NOT touch the
// forecast_data blob, so it's fully reversible (re-run with --reset to repopulate).
//
//   node scripts/migrate-blob-to-tables.mjs            # dry run: decompose + print row counts
//   node scripts/migrate-blob-to-tables.mjs --apply    # insert into tables (aborts if non-empty)
//   node scripts/migrate-blob-to-tables.mjs --apply --reset   # delete existing rows first, then insert
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { decompose, INSERT_ORDER } from '../src/forecastTables.js';

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(readFileSync(resolve(here, '..', '.env'), 'utf8')
  .split('\n').filter(Boolean).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset');

// Child-before-parent for deletes (reverse of the insert order).
const DELETE_ORDER = [...INSERT_ORDER].reverse();
// PK column used to match "all rows" for a full delete.
const PK = { forecast_meta: 'id', forecast_vectors: 'id', manual_revenue: 'stream', rv_actuals: 'stream', subscriptions: 'id', cost_lines: 'id', team_members: 'id', clients: 'id', service_contracts: 'client_id', payment_schedule: 'id', zoho_commissions: 'client_id', scenarios: 'id', actuals: 'month_idx' };

// ---- Load the live blob ----
const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/forecast_data?id=eq.1&select=data`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
const blob = (await res.json())[0]?.data;
if (!blob) { console.error('FAILED to load live blob'); process.exit(1); }

const rows = decompose(blob);
console.log('=== DECOMPOSE (row counts) ===');
INSERT_ORDER.forEach(t => console.log(`  ${t.padEnd(20)} ${rows[t].length}`));

if (!APPLY) { console.log('\nDry run. Re-run with --apply (add --reset to wipe existing rows first).'); process.exit(0); }

// Pre-check tables are empty unless --reset
if (RESET) {
  console.log('\n--- RESET: deleting existing rows ---');
  for (const t of DELETE_ORDER) {
    const col = PK[t];
    const { error } = await sb.from(t).delete().not(col, 'is', null);
    if (error) { console.error(`delete ${t} FAILED:`, error.message); process.exit(1); }
  }
} else {
  for (const t of INSERT_ORDER) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    if (error) { console.error(`table ${t} not reachable (did you run db push?):`, error.message); process.exit(1); }
    if (count > 0) { console.error(`ABORT: ${t} already has ${count} rows. Re-run with --reset to repopulate.`); process.exit(1); }
  }
}

console.log('\n--- INSERT ---');
for (const t of INSERT_ORDER) {
  if (!rows[t].length) { console.log(`  ${t.padEnd(20)} (0, skip)`); continue; }
  const { error } = await sb.from(t).insert(rows[t]);
  if (error) { console.error(`insert ${t} FAILED:`, error.message); process.exit(1); }
  console.log(`  ${t.padEnd(20)} +${rows[t].length}`);
}
console.log('\n✓ Backfill complete. Live blob untouched (forecast_data id=1 still authoritative).');
