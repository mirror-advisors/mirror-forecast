import { supabase } from './supabase.js';
import { decompose, reassemble, INSERT_ORDER } from './forecastTables.js';
const LOCAL_KEY = "mirror_forecast_v1";

// === Relational-migration flags (Phase 5: tables authoritative) ===
// Reads come from the relational tables (reassembled into `d`); writes go through
// the atomic save_forecast_rows() RPC. The JSONB blob (forecast_data id=1) is kept
// as a hot backup on every save, so flipping READ_FROM_TABLES off instantly reverts
// to blob-based reads with current data. All paths fall back to localStorage.
const READ_FROM_TABLES = true;   // tables are the source of truth for reads (blob = fallback)
const WRITE_VIA_RPC    = true;   // atomic multi-table write via save_forecast_rows()
const KEEP_BLOB_BACKUP = true;   // also upsert the blob each save (revert insurance)

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
    parsed.cl = (parsed.cl || []).map(stripLegacy).map(backfillScheduleStatus);
    return parsed;
  }

  // Pre-E2b (E1 or E2a) detected. Per E2b migration spec: REPLACE cl[] entirely
  // with the rebuilt 22-client default. Preserve scenarios/actuals/rvActuals/tm.
  console.warn('[migrateData] Pre-E2b schema detected — replacing cl[] with E2b rebuild');
  parsed.cl = defaultData.cl.map(stripLegacy).map(backfillScheduleStatus);
  return parsed;
}

// Read all tables and reassemble into `d`. Returns null if the tables haven't been
// populated yet (so the caller falls back to the blob).
async function readFromTables() {
  const results = await Promise.all(INSERT_ORDER.map(t => supabase.from(t).select('*')));
  const tables = {};
  results.forEach((r, i) => {
    if (r.error) throw new Error(`${INSERT_ORDER[i]}: ${r.error.message}`);
    tables[INSERT_ORDER[i]] = r.data || [];
  });
  if (!tables.forecast_meta.length) return null; // not migrated yet
  return reassemble(tables);
}

export async function loadData(defaultData) {
  // 1. Relational tables — source of truth.
  if (READ_FROM_TABLES) {
    try {
      const d = await readFromTables();
      if (d) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(d));
        return migrateData(d, defaultData);
      }
      console.warn('[loadData] tables empty — falling back to blob');
    } catch (e) {
      console.warn('[loadData] tables read failed, falling back to blob:', e?.message || e);
    }
  }

  // 2. JSONB blob — fallback (or primary when READ_FROM_TABLES is off).
  try {
    const { data, error } = await supabase.from('forecast_data').select('data').eq('id', 1).single();
    if (!error && data?.data && Object.keys(data.data).length > 0) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data.data));
      return migrateData(data.data, defaultData);
    }
  } catch (e) {
    console.error('Supabase load error:', e);
  }

  // 3. localStorage mirror, then seed default.
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return migrateData(JSON.parse(raw), defaultData);
  } catch (e) {
    console.error('LocalStorage load error:', e);
  }
  return migrateData({ ...defaultData }, defaultData);
}

export async function saveData(data) {
  // Safety: never let an empty/partial object wipe the authoritative store.
  // (Guards the new delete-all-then-insert write path against a malformed `d`.)
  if (!data || typeof data !== 'object' || !Array.isArray(data.cl) || data.cl.length === 0 || !Array.isArray(data.tm) || data.tm.length === 0) {
    console.error('[saveData] refusing to write — payload missing cl/tm');
    return { ok: false, error: 'refusing to write incomplete data' };
  }
  let rpcOk = true;
  // 1. Authoritative write — atomic, all tables in one transaction.
  if (WRITE_VIA_RPC) {
    try {
      const { error } = await supabase.rpc('save_forecast_rows', { p: decompose(data) });
      if (error) { rpcOk = false; console.error('[saveData] save_forecast_rows failed:', error.message); }
    } catch (e) { rpcOk = false; console.error('[saveData] save_forecast_rows threw:', e?.message || e); }
  }

  // 2. Blob backup (also the primary store when WRITE_VIA_RPC is off).
  let blobOk = true;
  if (KEEP_BLOB_BACKUP || !WRITE_VIA_RPC) {
    try {
      const { error } = await supabase.from('forecast_data').upsert({ id: 1, data, updated_at: new Date().toISOString() });
      if (error) { blobOk = false; console.error('Supabase save error:', error); }
    } catch (e) { blobOk = false; console.error('Save error:', e); }
  }

  // 3. localStorage mirror for offline fallback.
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));

  // Success is gated on the AUTHORITATIVE store (tables when RPC on, else blob).
  const ok = WRITE_VIA_RPC ? rpcOk : blobOk;
  return ok ? { ok: true } : { ok: false, error: 'save failed — see console' };
}
