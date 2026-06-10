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

// PK column used to match "all rows" for a full-table replace in granular writes.
const PK = { forecast_meta: 'id', forecast_vectors: 'id', manual_revenue: 'stream', rv_actuals: 'stream', subscriptions: 'id', cost_lines: 'id', team_members: 'id', clients: 'id', service_contracts: 'client_id', payment_schedule: 'id', zoho_commissions: 'client_id', scenarios: 'id', actuals: 'month_idx' };
// Client edits can touch any of these FK-linked tables → persisted atomically via the RPC.
const CLIENT_TABLES = ['clients', 'service_contracts', 'payment_schedule', 'zoho_commissions'];

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

// === Granular writes (Phase 2): persist only the tables that actually changed ===

// Diff two `d` snapshots by entity slice → the list of tables that need writing.
export function changedTables(d, saved) {
  if (!saved) return INSERT_ORDER.slice();
  const J = (x) => JSON.stringify(x);
  const t = [];
  const metaKeys = ['openBal', 'cashNow', 'savings', 'sLoan', 'ccOwe'];
  if (metaKeys.some(k => d[k] !== saved[k]) || (d.et?.length || 0) !== (saved.et?.length || 0)) t.push('forecast_meta');
  if (J(d.et) !== J(saved.et) || J(d.af) !== J(saved.af) || J(d.wf) !== J(saved.wf)) t.push('forecast_vectors');
  if (J(d.rv) !== J(saved.rv)) t.push('manual_revenue');
  if (J(d.rvActuals) !== J(saved.rvActuals)) t.push('rv_actuals');
  if (J(d.sb) !== J(saved.sb)) t.push('subscriptions');
  if (J(d.oc) !== J(saved.oc) || J(d.db) !== J(saved.db)) t.push('cost_lines');
  if (J(d.tm) !== J(saved.tm)) t.push('team_members');
  if (J(d.scenarios) !== J(saved.scenarios)) t.push('scenarios');
  if (J(d.actuals) !== J(saved.actuals)) t.push('actuals');
  if (J(d.cl) !== J(saved.cl)) t.push(...CLIENT_TABLES);
  return t;
}

// Persist `d` to only `tableNames`. Independent tables get a granular full-table
// replace; any client-table (FK-linked) change is routed through the atomic RPC so
// the client/contract/schedule/zoho bundle stays all-or-nothing. Blob backup kept
// current as revert insurance. Returns { ok }.
export async function saveGranular(d, tableNames) {
  if (!d || !Array.isArray(d.cl) || d.cl.length === 0 || !Array.isArray(d.tm) || d.tm.length === 0) {
    return { ok: false, error: 'refusing to write incomplete data' };
  }
  try {
    const rows = decompose(d);
    const touchesClients = tableNames.some(t => CLIENT_TABLES.includes(t));
    if (touchesClients) {
      const { error } = await supabase.rpc('save_forecast_rows', { p: rows });
      if (error) return { ok: false, error };
    } else {
      // delete child→parent, insert parent→child within the changed subset
      const subset = INSERT_ORDER.filter(t => tableNames.includes(t));
      for (const t of [...subset].reverse()) {
        const { error } = await supabase.from(t).delete().not(PK[t], 'is', null);
        if (error) return { ok: false, error };
      }
      for (const t of subset) {
        if (rows[t]?.length) {
          const { error } = await supabase.from(t).insert(rows[t]);
          if (error) return { ok: false, error };
        }
      }
    }
    if (KEEP_BLOB_BACKUP) {
      const { error } = await supabase.from('forecast_data').upsert({ id: 1, data: d, updated_at: new Date().toISOString() });
      if (error) console.warn('[saveGranular] blob backup failed (tables saved):', error.message);
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(d));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}
