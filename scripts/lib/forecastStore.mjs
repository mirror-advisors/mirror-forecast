// Shared store layer for ops scripts (snapshots, monthly patches).
// Reads the RELATIONAL TABLES (reassembled into `d`) and writes via the atomic
// save_forecast_rows() RPC — the app no longer reads the JSONB blob, so ops must
// go through the same path. Uses the service_role key (bypasses RLS; the RPC's
// gate accepts service_role). Keeps a blob backup on write for revert insurance.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { decompose, reassemble, INSERT_ORDER } from '../../src/forecastTables.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Merge .env then .env.local (.env.local wins if both present).
function loadEnv() {
  const env = {};
  for (const f of ['.env', '.env.local']) {
    let txt;
    try { txt = readFileSync(resolve(ROOT, f), 'utf8'); } catch { continue; }
    for (const line of txt.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}
const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || 'https://pkphesuvwzlowbssepxi.supabase.co';
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env / .env.local'); process.exit(1); }

export const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// Read all tables -> reassemble into `d`. Falls back to the blob if the tables
// aren't populated (so this keeps working pre-migration too).
export async function loadForecast() {
  const results = await Promise.all(INSERT_ORDER.map(t => supabase.from(t).select('*')));
  const tables = {};
  let ok = true;
  results.forEach((r, i) => { if (r.error) ok = false; tables[INSERT_ORDER[i]] = r.data || []; });
  if (ok && tables.forecast_meta.length) return reassemble(tables);
  const { data, error } = await supabase.from('forecast_data').select('data').eq('id', 1).single();
  if (error) { console.error('loadForecast: tables and blob both unreadable:', error.message); process.exit(1); }
  return data.data;
}

// Atomic write via the RPC (all tables, one transaction) + blob backup.
export async function saveForecast(d) {
  const { error } = await supabase.rpc('save_forecast_rows', { p: decompose(d) });
  if (error) { console.error('saveForecast: save_forecast_rows failed:', error.message); process.exit(1); }
  const { error: be } = await supabase.from('forecast_data').upsert({ id: 1, data: d, updated_at: new Date().toISOString() });
  if (be) console.warn('saveForecast: blob backup failed (tables are saved):', be.message);
}

// Snapshot the live forecast to a timestamped JSON backup. Returns { path, d }.
export async function snapshotForecast(label = 'snapshot') {
  const d = await loadForecast();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = resolve(ROOT, `supabase-backup-${label}-${stamp}.json`);
  writeFileSync(path, JSON.stringify(d, null, 2), 'utf8');
  return { path, d };
}
