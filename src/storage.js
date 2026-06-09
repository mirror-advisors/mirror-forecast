import { supabase } from './supabase.js';
import { decompose, reassemble, INSERT_ORDER } from './forecastTables.js';
const LOCAL_KEY = "mirror_forecast_v1";

// === Relational-migration flags (Phase 4: dual-write + shadow-read) ===
// The JSONB blob (forecast_data id=1) is still AUTHORITATIVE: loadData reads it,
// saveData writes it. In parallel we mirror writes to the relational tables and,
// on load, reassemble `d` from the tables and log any divergence — a safe dress
// rehearsal for the eventual read-cutover. Both are best-effort: a failure here
// never breaks the blob read/write path. Flip either flag off to disable.
const TABLES_DUAL_WRITE = true;
const TABLES_SHADOW_READ = true;

// PK column used to match "all rows" for a full delete during dual-write.
const PK = { forecast_meta: 'id', forecast_vectors: 'id', manual_revenue: 'stream', rv_actuals: 'stream', subscriptions: 'id', cost_lines: 'id', team_members: 'id', clients: 'id', service_contracts: 'client_id', payment_schedule: 'id', zoho_commissions: 'client_id', scenarios: 'id', actuals: 'month_idx' };

// E2b marker: top-level `email` field on any client. Pre-E2b schemas (E1, E2a)
// don't carry email at the client level — it lived on contract metadata if at all.
function isE2b(parsed) {
  return (parsed.cl || []).some(c => Object.prototype.hasOwnProperty.call(c, 'email'));
}

// Legacy field debris stripped on every load to keep payloads clean.
// E2b drops payments[] and st[] entirely (paymentSchedule is the source of truth).
const LEGACY_FIELDS = [
  'tier', 'rt', 'tr', 'vi', 'zh', 'zha', 'zhType', 'seats',
  'contractType', 'monthlyAmount', 'totalContractValue', 'termMonths',
  'startDate', 'endDate', 'renewalDate', 'autoRenew', 'churnRisk',
  'status', 'payMethod',
  'signed', 'subStart', 'payDay', 'renewal', 'termMo', 'startMo', 'endMo',
  'licenseType', 'currentCommissionMonthly', 'currentCommissionAnnual',
  'commissionFrequency', 'zohoRenewalDate', 'commissionNote',
  'otAmt', 'otMonth',
  // E2b: payments[] and st[] gone — paymentSchedule is canonical.
  'payments', 'st', 'nt',
];

function stripLegacy(c) {
  const out = { ...c };
  for (const k of LEGACY_FIELDS) delete out[k];
  return out;
}

// E2c.4 — backfill `status` field on paymentSchedule entries that lack it.
// Idempotent. Maps from legacy paid+note+dueDate semantics. Doesn't touch `paid`.
function backfillScheduleStatus(client) {
  const sc = client.serviceContract;
  if (!sc || !Array.isArray(sc.paymentSchedule)) return client;
  const today = new Date();
  let mutated = false;
  const sched = sc.paymentSchedule.map(p => {
    if (p.status) return p;
    let status;
    if (p.paid === true)              status = "P";
    else if (p.note === "Late")       status = "L";
    else if (new Date(p.dueDate) < today) status = "L"; // overdue → Late
    else                              status = "U";
    mutated = true;
    return { ...p, status };
  });
  if (!mutated) return client;
  return { ...client, serviceContract: { ...sc, paymentSchedule: sched } };
}

function migrateData(parsed, defaultData) {
  if (!parsed.scenarios) parsed.scenarios = [];
  if (!parsed.actuals) parsed.actuals = {};

  if (isE2b(parsed)) {
    console.log('[migrateData] E2b schema detected — passthrough + legacy strip + status backfill');
    parsed.cl = (parsed.cl || []).map(stripLegacy).map(backfillScheduleStatus);
    return parsed;
  }

  // Pre-E2b (E1 or E2a) detected. Per E2b migration spec: REPLACE cl[] entirely
  // with the rebuilt 22-client default. Preserve scenarios/actuals/rvActuals/tm.
  console.warn('[migrateData] Pre-E2b schema detected — replacing cl[] with E2b rebuild');
  parsed.cl = defaultData.cl.map(stripLegacy).map(backfillScheduleStatus);
  return parsed;
}

export async function loadData(defaultData) {
  // Supabase is the source of truth — always try it first
  try {
    const { data, error } = await supabase.from('forecast_data').select('data').eq('id', 1).single();
    if (!error && data?.data && Object.keys(data.data).length > 0) {
      // Keep localStorage in sync with what's in Supabase
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data.data));
      const migrated = migrateData(data.data, defaultData);
      if (TABLES_SHADOW_READ) shadowCompare(migrated); // fire-and-forget, never awaited
      return migrated;
    }
  } catch (e) {
    console.error('Supabase load error:', e);
  }

  // Supabase unavailable — fall back to localStorage
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return migrateData(JSON.parse(raw), defaultData);
  } catch (e) {
    console.error('LocalStorage load error:', e);
  }

  return migrateData({ ...defaultData }, defaultData);
}

export async function saveData(data) {
  // Write to Supabase first — this is the authoritative store
  try {
    const { error } = await supabase
      .from('forecast_data')
      .upsert({ id: 1, data: data, updated_at: new Date().toISOString() });
    if (error) {
      console.error('Supabase save error:', error);
      // Fall back: at least keep localStorage up to date
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
      return { ok: false, error };
    }
    // Mirror to localStorage so offline fallback stays fresh
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    if (TABLES_DUAL_WRITE) dualWriteTables(data); // fire-and-forget; blob already saved, never throws
    return { ok: true };
  } catch (e) {
    console.error('Save error:', e);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    return { ok: false, error: e };
  }
}

// === Phase 4 helpers (relational mirror) ===

// Mirror the whole `d` into the relational tables (full replace). Best-effort:
// any failure is logged and swallowed so the authoritative blob save still wins.
// NOTE: not atomic across tables (client-side) — acceptable while the blob is the
// source of truth and shadowCompare flags any drift. The hard cutover replaces
// this with a single transactional RPC.
async function dualWriteTables(d) {
  try {
    const rows = decompose(d);
    // Delete child→parent so FKs never block a wipe.
    for (const t of [...INSERT_ORDER].reverse()) {
      const { error } = await supabase.from(t).delete().not(PK[t], 'is', null);
      if (error) { console.warn(`[dualWrite] delete ${t}:`, error.message); return; }
    }
    // Insert parent→child.
    for (const t of INSERT_ORDER) {
      if (!rows[t]?.length) continue;
      const { error } = await supabase.from(t).insert(rows[t]);
      if (error) { console.warn(`[dualWrite] insert ${t}:`, error.message); return; }
    }
  } catch (e) {
    console.warn('[dualWrite] skipped:', e?.message || e);
  }
}

// Reassemble `d` from the tables and compare to the authoritative (migrated) blob.
// Logs the first divergence path; payment-schedule status is ignored (it's frozen
// at migration and re-derived from today's date on the blob side, so it drifts).
async function shadowCompare(authoritative) {
  try {
    const tables = {};
    const results = await Promise.all(INSERT_ORDER.map(t => supabase.from(t).select('*')));
    INSERT_ORDER.forEach((t, i) => {
      if (results[i].error) throw new Error(`select ${t}: ${results[i].error.message}`);
      tables[t] = results[i].data || [];
    });
    if (!tables.forecast_meta.length) { console.warn('[shadow] tables empty — skipping (run the backfill?)'); return; }
    const fromTables = reassemble(tables);
    const path = shadowDiff(stripStatus(authoritative), stripStatus(fromTables));
    if (path) console.warn('[shadow] divergence at', path);
    else console.log('[shadow] ✓ tables reassemble identically to the blob');
  } catch (e) {
    console.warn('[shadow] skipped:', e?.message || e);
  }
}

function stripStatus(d) {
  const c = JSON.parse(JSON.stringify(d));
  (c.cl || []).forEach(cl => (cl.serviceContract?.paymentSchedule || []).forEach(p => { delete p.status; }));
  return c;
}

// First differing path between two values (order-insensitive), or null if equal.
function shadowDiff(a, b, path = '') {
  if (a === b) return null;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9 ? null : `${path}: ${a} vs ${b}`;
  if (typeof a !== typeof b || a == null || b == null) return `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return `${path}: array mismatch (${a?.length} vs ${b?.length})`;
    for (let i = 0; i < a.length; i++) { const r = shadowDiff(a[i], b[i], `${path}[${i}]`); if (r) return r; }
    return null;
  }
  if (typeof a === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a) || !(k in b)) return `${path}.${k}: present on one side only`;
      const r = shadowDiff(a[k], b[k], `${path}.${k}`); if (r) return r;
    }
    return null;
  }
  return `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}
