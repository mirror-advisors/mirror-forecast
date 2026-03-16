import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { MO, P, fmt } from './data.js';
import { Card, Lbl } from './components.jsx';
export default function InternView({ d, save }) {
  const { signOut, profile } = useAuth();
  const [expanded, setExpanded] = useState(null);
  const payingClients = d.cl.filter(cl => cl.rt > 0);
  const currentMonth = new Date().getMonth();
  const inTerm = (cl, mi) => { const sm = cl.startMo ?? 0; const em = cl.endMo ?? 11; return mi >= sm && mi <= em; };
  const late = payingClients.flatMap(cl => cl.st.map((s, mi) => s === 'L' ? { client: cl, month: mi } : null).filter(Boolean));
  const dueThisMonth = payingClients.filter(cl => inTerm(cl, currentMonth) && cl.st[currentMonth] !== 'P');
  const cyc = (ci, mi) => {
    const realIdx = d.cl.indexOf(payingClients[ci]);
    const cl = d.cl[realIdx];
    if (!inTerm(cl, mi)) return;
    const nx = { 'U': 'P', 'P': 'L', 'L': 'U', '': 'P' };
    const s = cl.st[mi] || 'U';
    save({ ...d, cl: d.cl.map((x, i) => i !== realIdx ? x : { ...x, st: x.st.map((v, j) => j === mi ? (nx[s] || 'P') : v) }) });
  };
  const updateClient = (ci, field, value) => {
    const realIdx = d.cl.indexOf(payingClients[ci]);
    const updated = { ...d.cl[realIdx], [field]: value };
    if (field === 'subStart' && value) { updated.startMo = new Date(value + 'T00:00:00').getMonth(); }
    if (field === 'renewal' && value) { updated.endMo = new Date(value + 'T00:00:00').getMonth(); }
    if (field === 'termMo' && updated.subStart) {
      const start = new Date(updated.subStart + 'T00:00:00');
      const end = new Date(start); end.setMonth(end.getMonth() + parseInt(value));
      updated.renewal = end.toISOString().split('T')[0];
      updated.endMo = Math.min(end.getMonth(), 11);
    }
    if (['startMo','endMo','subStart','renewal','termMo'].includes(field)) {
      const sm = updated.startMo ?? 0; const em = updated.endMo ?? 11;
      updated.st = updated.st.map((s, mi) => { if (mi >= sm && mi <= em && (!s || s === '')) return 'U'; if (mi < sm || mi > em) return ''; return s; });
    }
    save({ ...d, cl: d.cl.map((x, i) => i !== realIdx ? x : updated) });
  };
  const sSty = (s, active) => ({ display:'inline-flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:6,cursor:active?'pointer':'default',userSelect:'none',fontWeight:700,fontSize:11,fontFamily:"'JetBrains Mono', monospace",background:!active?`${P.bd}20`:s==='P'?P.gB:s==='L'?P.rB:s==='U'?P.aB:`${P.bd}25`,color:!active?`${P.td}60`:s==='P'?P.g:s==='L'?P.r:s==='U'?P.a:P.td,opacity:active?1:0.3,border:`1px solid ${!active?'transparent':s==='P'?P.g+'30':s==='L'?P.r+'30':s==='U'?P.a+'30':P.bd}`,transition:'all 0.15s' });
  const th = { padding:'6px 8px',textAlign:'right',color:P.td,fontSize:10,borderBottom:`1px solid ${P.bd}`,fontFamily:"'DM Sans', sans-serif",fontWeight:500,textTransform:'uppercase',letterSpacing:'0.05em' };
  const inp = { background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,color:P.tx,fontSize:12,fontFamily:"'DM Sans', sans-serif",padding:'6px 8px',outline:'none',width:'100%',boxSizing:'border-box' };
  return (
    <div style={{ background:P.bg,minHeight:'100vh',color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:13 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${P.bd}`,background:P.c1,padding:'12px 20px',boxShadow:'0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:28,height:28,borderRadius:6,background:`linear-gradient(135deg, ${P.g}, ${P.t})`,display:'flex',alignItems:'center',justifyContent:'center' }}>
            <span style={{ color:'white',fontWeight:800,fontSize:14 }}>M</span>
          </div>
          <span style={{ fontWeight:700,fontSize:15,color:P.tx,letterSpacing:'-0.01em' }}>Mirror Forecast</span>
          <span style={{ fontSize:10,color:P.b,background:P.b+'15',padding:'2px 8px',borderRadius:4,fontWeight:600 }}>Intern View</span>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:12 }}>
          <span style={{ fontSize:11,color:P.tm }}>{profile?.name||profile?.email}</span>
          <button onClick={signOut} style={{ background:P.c2,color:P.tm,border:`1px solid ${P.bd}`,borderRadius:6,padding:'6px 12px',fontFamily:"'DM Sans', sans-serif",fontSize:11,cursor:'pointer' }}>Sign Out</button>
        </div>
      </div>
      <div style={{ maxWidth:1200,margin:'0 auto',padding:'24px 16px' }}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:24 }}>
          <Card style={{ padding:14,borderLeft:`3px solid ${P.r}` }}><Lbl>Late</Lbl><div style={{ fontSize:28,fontWeight:800,color:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{late.length}</div><div style={{ fontSize:10,color:P.tm,marginTop:4 }}>{late.length>0?late.map(o=>`${o.client.nm} (${MO[o.month]})`).join(', '):'None late'}</div></Card>
          <Card style={{ padding:14,borderLeft:`3px solid ${P.a}` }}><Lbl>Due This Month ({MO[currentMonth]})</Lbl><div style={{ fontSize:28,fontWeight:800,color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{dueThisMonth.length}</div><div style={{ fontSize:10,color:P.tm,marginTop:4 }}>{dueThisMonth.length>0?dueThisMonth.map(cl=>cl.nm).join(', '):'All logged!'}</div></Card>
          <Card style={{ padding:14,borderLeft:`3px solid ${P.g}` }}><Lbl>Collected YTD</Lbl><div style={{ fontSize:28,fontWeight:800,color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==='P').length*x.rt,0))}</div></Card>
        </div>
        <div style={{ fontSize:11,color:P.tm,marginBottom:12,padding:'10px 14px',background:P.c1,borderRadius:8,border:`1px solid ${P.bd}`,display:'flex',gap:16,alignItems:'center',boxShadow:'0 1px 2px rgba(0,0,0,0.03)' }}>
          <span>Click to cycle:</span>
          <span><span style={{ color:P.a,fontWeight:700 }}>U</span> unpaid</span>
          <span>→ <span style={{ color:P.g,fontWeight:700 }}>P</span> paid</span>
          <span>→ <span style={{ color:P.r,fontWeight:700 }}>L</span> late</span>
          <span>→ <span style={{ color:P.a,fontWeight:700 }}>U</span></span>
          <span style={{ marginLeft:'auto',color:P.td }}>▶ Click name to edit details</span>
        </div>
        <Lbl>Payment Tracker</Lbl>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
            <thead><tr><th style={{ ...th,textAlign:'left',width:180 }}>Client</th><th style={{ ...th,textAlign:'left',width:90 }}>Rate</th><th style={{ ...th,textAlign:'left',width:50 }}>Term</th>{MO.map(m=><th key={m} style={{ ...th,textAlign:'center',width:36 }}>{m}</th>)}<th style={th}>YTD</th></tr></thead>
            <tbody>{payingClients.map((cl,ci)=>{const ytd=cl.st.filter(s=>s==='P').length*cl.rt;const isExp=expanded===ci;const termLabel=cl.termMo?`${cl.termMo}mo`:(cl.tr||'\u2014');return(
              <tr key={cl.id} style={{ verticalAlign:'top' }}>
                <td style={{ padding:'6px 8px',borderBottom:`1px solid ${P.bd}20` }}>
                  <div onClick={()=>setExpanded(isExp?null:ci)} style={{ cursor:'pointer',fontWeight:600,display:'flex',alignItems:'center',gap:6 }}>
                    <span style={{ fontSize:9,color:P.td,transition:'transform 0.15s',transform:isExp?'rotate(90deg)':'rotate(0)',display:'inline-block' }}>▶</span>
                    {cl.nm}
                  </div>
                  {isExp&&(<div style={{ marginTop:10,padding:12,background:P.c2,borderRadius:8,border:`1px solid ${P.bd}`,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                    <div><div style={{ fontSize:9,color:P.td,textTransform:'uppercase',marginBottom:3,fontWeight:500,letterSpacing:'0.05em' }}>Monthly Rate</div><input type="number" value={cl.rt} onChange={e=>updateClient(ci,'rt',+e.target.value)} style={inp}/></div>
                    <div><div style={{ fontSize:9,color:P.td,textTransform:'uppercase',marginBottom:3,fontWeight:500,letterSpacing:'0.05em' }}>Term (months)</div><input type="number" value={cl.termMo||''} onChange={e=>updateClient(ci,'termMo',+e.target.value)} placeholder="12" style={inp}/></div>
                    <div><div style={{ fontSize:9,color:P.td,textTransform:'uppercase',marginBottom:3,fontWeight:500,letterSpacing:'0.05em' }}>Signing Date</div><input type="date" value={cl.signed||''} onChange={e=>updateClient(ci,'signed',e.target.value)} style={inp}/></div>
                    <div><div style={{ fontSize:9,color:P.td,textTransform:'uppercase',marginBottom:3,fontWeight:500,letterSpacing:'0.05em' }}>Subscription Start</div><input type="date" value={cl.subStart||''} onChange={e=>updateClient(ci,'subStart',e.target.value)} style={inp}/></div>
                    <div><div style={{ fontSize:9,color:P.td,textTransform:'uppercase',marginBottom:3,fontWeight:500,letterSpacing:'0.05em' }}>Payment Due Day</div><input type="number" value={cl.payDay||''} onChange={e=>updateClient(ci,'payDay',+e.target.value)} placeholder="1" min={1} max={28} style={inp}/></div>
                    <div><div style={{ fontSize:9,color:P.td,textTransform:'uppercase',marginBottom:3,fontWeight:500,letterSpacing:'0.05em' }}>Renewal Date</div><input type="date" value={cl.renewal||''} onChange={e=>updateClient(ci,'renewal',e.target.value)} style={inp}/></div>
                    <div style={{ gridColumn:'1/-1',fontSize:10,color:P.tm,marginTop:4,padding:'6px 0',borderTop:`1px solid ${P.bd}` }}>Active months: {MO[cl.startMo??0]} – {MO[cl.endMo??11]} · Due day: {cl.payDay||'1st'}</div>
                  </div>)}
                </td>
                <td style={{ padding:'6px 8px',color:P.g,borderBottom:`1px solid ${P.bd}20`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(cl.rt)}/mo</td>
                <td style={{ padding:'6px 8px',color:P.tm,fontSize:11,borderBottom:`1px solid ${P.bd}20` }}>{termLabel}</td>
                {MO.map((_,mi)=>{const active=inTerm(cl,mi);const s=active?(cl.st[mi]||'U'):'';return(<td key={mi} style={{ padding:'2px',textAlign:'center',borderBottom:`1px solid ${P.bd}20` }}><div onClick={()=>active&&cyc(ci,mi)} style={sSty(s,active)}>{active?(s||'U'):''}</div></td>);})}
                <td style={{ padding:'6px 8px',textAlign:'right',color:P.g,fontWeight:600,borderBottom:`1px solid ${P.bd}20`,fontFamily:"'JetBrains Mono', monospace" }}>{ytd>0?fmt(ytd):'\u2014'}</td>
              </tr>);})}</tbody>
          </table>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginTop:20 }}>
          <Card style={{ padding:12 }}><Lbl>Collected YTD</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==='P').length*x.rt,0))}</div></Card>
          <Card style={{ padding:12 }}><Lbl>Unpaid</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==='U').length*x.rt,0))}</div></Card>
          <Card style={{ padding:12 }}><Lbl>Late</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==='L').length*x.rt,0))}</div></Card>
        </div>
      </div>
    </div>
  );
}