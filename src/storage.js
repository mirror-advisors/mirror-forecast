import { supabase } from './supabase.js';
const LOCAL_KEY = "mirror_forecast_v1";

function migrateData(parsed, defaultData) {
  if (!parsed.pt) parsed.pt = defaultData.pt;
  if (!parsed.dh) parsed.dh = defaultData.dh;
  if (!parsed.scenarios) parsed.scenarios = [];
  parsed.cl = parsed.cl.map(c => ({
    tier: c.rt >= 2000 ? 'im' : c.rt === 500 ? 'zen' : c.rt > 0 ? 'mktg' : 'zho',
    seats: 0, zha: 0, signed: '', subStart: '', payDay: 1, renewal: '', termMo: 0, startMo: 0, endMo: 11, ...c
  }));
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