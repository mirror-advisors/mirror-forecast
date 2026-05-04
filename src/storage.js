import { supabase } from './supabase.js';
import { deriveSegment, generateSchedule } from './clientsHelpers.js';
const LOCAL_KEY = "mirror_forecast_v1";

// Post-E1: clients carry serviceContract / zohoCommission objects.
// Any other legacy field on the client is orphaned debris — strip it so we
// don't keep round-tripping it through Supabase on every load/save cycle.
const E1_LEGACY_FIELDS = [
  'tier', 'rt', 'tr', 'vi', 'zh', 'zha', 'zhType', 'seats',
  'contractType', 'monthlyAmount', 'totalContractValue', 'termMonths',
  'startDate', 'endDate', 'renewalDate', 'autoRenew', 'churnRisk',
  'status', 'payMethod',
  'signed', 'subStart', 'payDay', 'renewal', 'termMo', 'startMo', 'endMo',
  'licenseType', 'currentCommissionMonthly', 'currentCommissionAnnual',
  'commissionFrequency', 'zohoRenewalDate', 'commissionNote',
  'otAmt', 'otMonth',
];

function stripLegacy(c) {
  const out = { ...c };
  for (const k of E1_LEGACY_FIELDS) delete out[k];
  return out;
}

function migrateData(parsed, defaultData) {
  if (!parsed.scenarios) parsed.scenarios = [];
  if (!parsed.actuals) parsed.actuals = {};

  // E2a schema detection: has lastEditedAt field OR serviceContract.segment
  const isE2a = (parsed.cl || []).some(c =>
    c.lastEditedAt !== undefined || c.serviceContract?.segment !== undefined
  );
  if (isE2a) {
    console.log('[migrateData] E2a schema detected — passthrough + legacy strip');
    parsed.cl = (parsed.cl || []).map(stripLegacy);
    return parsed;
  }

  // E1 schema detection: has serviceContract or zohoCommission but no E2a fields
  const isE1Schema = (parsed.cl || []).some(c =>
    c.serviceContract !== undefined || c.zohoCommission !== undefined
  );

  if (isE1Schema) {
    // E1 → E2a migration: add segment, paymentSchedule, lastEditedAt fields then strip legacy.
    console.log('[migrateData] E1 schema detected — running E1 → E2a migration');
    parsed.cl = (parsed.cl || []).map(c => {
      const stripped = stripLegacy(c);
      const sc = stripped.serviceContract;
      return {
        ...stripped,
        lastEditedAt: stripped.lastEditedAt ?? null,
        lastEditedBy: stripped.lastEditedBy ?? null,
        serviceContract: sc ? {
          ...sc,
          segment: sc.segment ?? deriveSegment(sc.type, stripped.id),
          paymentSchedule: sc.paymentSchedule ?? generateSchedule(stripped),
        } : null,
      };
    });
    return parsed;
  }

  // Pre-E1 legacy compatibility path. Should not run after Phase E1 — log so
  // we notice if a stale row sneaks through.
  console.warn('[migrateData] pre-E1 legacy schema detected on load; running compat migration');
  const payMethods = ['Stripe', 'ACH', 'Check', 'Wire', 'CC'];
  parsed.cl = parsed.cl.map(c => {
    const merged = {
      tier: c.rt >= 2000 ? 'im' : c.rt === 500 ? 'zen' : c.rt > 0 ? 'mktg' : 'zho',
      seats: 0, zha: 0, signed: '', subStart: '', payDay: 1, renewal: '', termMo: 0, startMo: 0, endMo: 11, ...c
    };
    if (!merged.payMethod) {
      const matched = payMethods.find(m => m.toLowerCase() === String(merged.vi || '').toLowerCase().trim());
      merged.payMethod = matched || '';
    }
    if (merged.tier === 'ot') {
      if (!Array.isArray(merged.payments)) {
        if ((merged.otAmt || 0) > 0 && typeof merged.otMonth === 'number') {
          const status = (merged.st && merged.st[merged.otMonth]) || 'U';
          merged.payments = [{ id: 'p' + Date.now() + Math.random().toString(36).slice(2,6), amount: merged.otAmt, month: merged.otMonth, status }];
        } else {
          merged.payments = [];
        }
      }
      delete merged.otAmt;
      delete merged.otMonth;
    }
    return merged;
  });
  const hasZho = parsed.cl.some(c => c.nm === 'HV Health');
  if (!hasZho) {
    defaultData.cl.filter(c => c.tier === 'zho').forEach(c => {
      if (!parsed.cl.find(x => x.nm === c.nm)) parsed.cl.push({ ...c });
    });
  }
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