import { supabase } from './supabase.js';
const LOCAL_KEY = "mirror_forecast_v1";
function migrateData(parsed, defaultData) {
  if (!parsed.pt) parsed.pt = defaultData.pt;
  if (!parsed.dh) parsed.dh = defaultData.dh;
  parsed.cl = parsed.cl.map(c => ({ tier: c.rt >= 2000 ? 'im' : c.rt === 500 ? 'zen' : c.rt > 0 ? 'mktg' : 'zho', seats: 0, zha: 0, ...c }));
  const hasZho = parsed.cl.some(c => c.nm === 'HV Health');
  if (!hasZho) { defaultData.cl.filter(c => c.tier === 'zho').forEach(c => { if (!parsed.cl.find(x => x.nm === c.nm)) parsed.cl.push({ ...c }); }); }
  return parsed;
}
export async function loadData(defaultData) {
  try {
    const { data } = await supabase.from('forecast_data').select('data').eq('id', 1).single();
    if (data?.data) { localStorage.setItem(LOCAL_KEY, JSON.stringify(data.data)); return migrateData(data.data, defaultData); }
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return migrateData(JSON.parse(raw), defaultData);
  } catch (e) {
    try { const raw = localStorage.getItem(LOCAL_KEY); if (raw) return migrateData(JSON.parse(raw), defaultData); } catch {}
  }
  return defaultData;
}
export async function saveData(data, isAdmin) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  if (isAdmin) {
    const { error } = await supabase.from('forecast_data').upsert({ id: 1, data, updated_at: new Date().toISOString() });
    if (error) console.error('Save error:', error);
  }
}
