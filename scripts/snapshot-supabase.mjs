// Snapshot the live forecast to a timestamped local JSON backup.
// Reads the RELATIONAL TABLES (reassembled into `d`) via the service_role key —
// the anon key can no longer read (RLS), and the tables are now authoritative.
import { loadForecast } from './lib/forecastStore.mjs';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = resolve(here, '..', `supabase-backup-${stamp}.json`);

const d = await loadForecast();
if (!d || !Array.isArray(d.cl)) { console.error('FAILED: forecast unreadable or malformed.'); process.exit(1); }
if (existsSync(out)) { console.error(`FAILED: backup file already exists: ${out}`); process.exit(1); }

writeFileSync(out, JSON.stringify(d, null, 2), 'utf8');
console.log(`✓ Backup written: ${out}`);
console.log(`  - cl[] length:    ${(d.cl || []).length}`);
console.log(`  - tm[] length:    ${(d.tm || []).length}`);
console.log(`  - scenarios:      ${(d.scenarios || []).length}`);
console.log(`  - actuals months: ${Object.keys(d.actuals || {}).join(',') || '(none)'}`);
console.log(`  - rvActuals:      ${Object.keys(d.rvActuals || {}).join(',') || '(none)'}`);
