// Contract test for the entity layer: persisting `d` to tables (decompose) and
// reading it back (reassemble) must not change what compute() produces. Runs in
// Node, no browser. This is the safety net for the granular-write rewrite.
import { decompose, reassemble } from '../src/forecastTables.js';
import { compute } from '../src/compute.js';
import { changedTables } from '../src/storage.js';
import { D0 } from '../src/data.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log(`${cond ? '✓' : '✗ FAIL'} ${name}${cond ? '' : `  ${extra ?? ''}`}`); };

function arrEq(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((v, i) => (typeof v === 'number' ? Math.abs(v - b[i]) < 1e-9 : v === b[i]));
}

// 1. decompose -> reassemble -> compute parity (the core contract)
const d2 = reassemble(decompose(D0));
const c1 = compute(D0), c2 = compute(d2);
for (const k of ['rvBase', 'exBase', 'nt', 'bl', 'rv', 'ex']) {
  ok(`compute parity: ${k}`, arrEq(c1[k], c2[k]), `${k} differs`);
}

// 2. numeric-string coercion (PostgREST returns numeric as a string)
const tabs = decompose(D0);
// Simulate PostgREST string output on a numeric + numeric[] field.
tabs.forecast_meta[0].open_bal = String(tabs.forecast_meta[0].open_bal);
tabs.forecast_vectors[0].et = tabs.forecast_vectors[0].et.map(String);
const sc7 = tabs.service_contracts.find(s => s.client_id === 'c7');
const dCoerced = reassemble(tabs);
ok('coerces numeric string -> number (openBal)', typeof dCoerced.openBal === 'number' && dCoerced.openBal === D0.openBal);
ok('coerces numeric[] string -> numbers (et)', dCoerced.et.every(x => typeof x === 'number') && arrEq(dCoerced.et, D0.et));
ok('compute still 5.5-parity after coercion', arrEq(compute(dCoerced).bl, c1.bl));

// 3. pos ordering survives a non-contiguous gap (delete-without-pos-rewrite)
const tabs2 = decompose(D0);
tabs2.clients = tabs2.clients.filter(c => c.id !== 'c5'); // remove a middle client, leave a pos gap
const dGap = reassemble(tabs2);
const ids = dGap.cl.map(c => c.id);
const sortedByOriginalPos = decompose(D0).clients.filter(c => c.id !== 'c5').sort((a, b) => a.pos - b.pos).map(c => c.id);
ok('reassemble orders by pos with a gap', JSON.stringify(ids) === JSON.stringify(sortedByOriginalPos), `${ids.join(',')}`);
ok('removed client absent', !ids.includes('c5'));

// 4. changedTables routing (granular-write diff)
const clone = (x) => JSON.parse(JSON.stringify(x));
ok('no change -> []', changedTables(D0, D0).length === 0);
const dCash = { ...D0, cashNow: D0.cashNow + 1 };
ok('cashNow edit -> [forecast_meta]', JSON.stringify(changedTables(dCash, D0)) === JSON.stringify(['forecast_meta']));
const dClient = clone(D0); dClient.cl[1].nm = 'Renamed';
const ct = changedTables(dClient, D0);
ok('client edit -> client-table bundle', ['clients', 'service_contracts', 'payment_schedule', 'zoho_commissions'].every(t => ct.includes(t)) && !ct.includes('forecast_meta'), ct.join(','));
const dScen = { ...D0, scenarios: [{ id: 's1', name: 'x', type: 'revenue', amount: 1, startMo: 0, duration: 0, on: true }] };
ok('scenario edit -> [scenarios]', JSON.stringify(changedTables(dScen, D0)) === JSON.stringify(['scenarios']));

console.log(`\n${fail === 0 ? 'ALL PASS' : fail + ' FAILED'} (${pass} passed)`);
process.exit(fail === 0 ? 0 : 1);
