import { supabase } from './supabase.js';
const LOCAL_KEY = "mirror_forecast_v1";

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

function migrateData(parsed, defaultData) {
  if (!parsed.scenarios) parsed.scenarios = [];
  if (!parsed.actuals) parsed.actuals = {};

  if (isE2b(parsed)) {
    console.log('[migrateData] E2b schema detected — passthrough + legacy strip');
    parsed.cl = (parsed.cl || []).map(stripLegacy);
    return parsed;
  }

  // Pre-E2b (E1 or E2a) detected. Per E2b migration spec: REPLACE cl[] entirely
  // with the rebuilt 22-client default. Preserve scenarios/actuals/rvActuals/tm.
  console.warn('[migrateData] Pre-E2b schema detected — replacing cl[] with E2b rebuild');
  parsed.cl = defaultData.cl.map(stripLegacy);
  return parsed;
}

export async function loadData(defaultData) {
  // Supabase is the source of truth — always try it first
  try {
    const { data, error } = await supabase.from('forecast_data').select('data').eq('id', 1).single();
    if (!error && data?.data && Object.keys(data.data).length > 0) {
      // Keep localStorage in sync with what's in Supabase
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data.data));
      return migrateData(data.data, defaultData);
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
    return { ok: true };
  } catch (e) {
    console.error('Save error:', e);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    return { ok: false, error: e };
  }
}
