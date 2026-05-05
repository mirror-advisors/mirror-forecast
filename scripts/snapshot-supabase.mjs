// One-shot snapshot of forecast_data row id=1 → local JSON backup.
// Run before any destructive migration (E2a → E2b).
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const supabase = createClient(
  'https://pkphesuvwzlowbssepxi.supabase.co',
  'sb_publishable_CF_Xb2Ydv7rY55oRvrwU7w_pFHkBbY5'
);

const here = dirname(fileURLToPath(import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = resolve(here, '..', `supabase-backup-e2a-pre-e2b-${stamp}.json`);

const { data, error } = await supabase
  .from('forecast_data')
  .select('*')
  .eq('id', 1)
  .single();

if (error) {
  console.error('FAILED to fetch row:', error);
  process.exit(1);
}

if (!data || !data.data) {
  console.error('FAILED: row exists but data field is empty.');
  process.exit(1);
}

if (existsSync(out)) {
  console.error(`FAILED: backup file already exists: ${out}`);
  process.exit(1);
}

writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');

const cl = data.data.cl || [];
console.log(`✓ Backup written: ${out}`);
console.log(`  - cl[] length: ${cl.length}`);
console.log(`  - scenarios:   ${(data.data.scenarios || []).length}`);
console.log(`  - actuals keys: ${Object.keys(data.data.actuals || {}).join(',') || '(none)'}`);
console.log(`  - rvActuals streams: ${Object.keys(data.data.rvActuals || {}).join(',') || '(none)'}`);
console.log(`  - tm[] length: ${(data.data.tm || []).length}`);
console.log(`  - updated_at:  ${data.updated_at}`);
