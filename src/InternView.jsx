import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { MO, P, fmt } from './data.js';
import { Card, Lbl } from './components.jsx';
export default function InternView({ d, save }) {
  const { signOut, profile } = useAuth();
  const [modal, setModal] = useState(null);
  const [nt, setNt] = useState('');
  const payingClients = d.cl.filter(cl => cl.rt > 0);
  const currentMonth = new Date().getMonth();
  const dueThisMonth = payingClients.filter(cl => !cl.st[currentMonth]);
  const overdue = payingClients.flatMap(cl => cl.st.map((s, mi) => s === 'U' ? { client: cl, month: mi } : null).filter(Boolean));
  const cyc = (ci, mi) => {
    const nx = { '': 'P', P: 'U', U: 'C', C: '' };
    const realIdx = d.cl.indexOf(payingClients[ci]);
    const s = d.cl[realIdx].st[mi] || '';
    if (nx[s] === 'C') { setModal({ ci: realIdx, mi }); setNt(''); return; }
    save({ ...d, cl: d.cl.map((x, i) => i !== realIdx ? x : { ...x, st: x.st.map((v, j) => j === mi ? nx[s] : v) }) });
  };
  const saveCr = () => {
    if (!modal) return;
    save({ ...d, cl: d.cl.map((x, i) => i !== modal.ci ? x : { ...x, st: x.st.map((v, j) => j === modal.mi ? 'C' : v), nt: { ...x.nt, [modal.mi]: nt || 'Credit' } }) });
    setModal(null);
  };
  const sSty = s => ({ display:'inline-flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:6,cursor:'pointer',userSelect:'none',fontWeight:700,fontSize:12,background:s==='P'?P.gB:s==='U'?P.rB:s==='C'?P.aB:`${P.bd}25`,color:s==='P'?P.g:s==='U'?P.r:s==='C'?P.a:P.td });
  const th = { padding:'6px 8px',textAlign:'right',color:P.td,fontSize:10,borderBottom:`1px solid ${P.bd}` };
  return (
    <div style={{ background:P.bg,minHeight:'100vh',color:P.tx,fontFamily:"'IBM Plex Mono','SF Mono',monospace",fontSize:13 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${P.bd}`,background:P.c1,padding:'12px 20px' }}>
        <div style={{ fontWeight:800,fontSize:14,color:P.g }}>MIRROR FORECAST</div>
        <div style={{ display:'flex',alignItems:'center',gap:12 }}>
          <span style={{ fontSize:11,color:P.tm }}>{profile?.name||profile?.email}</span>
          <button onClick={signOut} style={{ background:P.c2,color:P.tm,border:`1px solid ${P.bd}`,borderRadius:6,padding:'6px 12px',fontFamily:'inherit',fontSize:11,cursor:'pointer' }}>Sign Out</button>
        </div>
      </div>
      <div style={{ maxWidth:1200,margin:'0 auto',padding:'24px 16px' }}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:24 }}>
          <Card style={{ padding:14,borderLeft:`3px solid ${P.r}` }}><Lbl>Overdue</Lbl><div style={{ fontSize:28,fontWeight:800,color:P.r }}>{overdue.length}</div><div style={{ fontSize:10,color:P.tm,marginTop:4 }}>{overdue.length>0?overdue.map(o=>`${o.client.nm} (${MO[o.month]})`).join(', '):'All caught up!'}</div></Card>
          <Card style={{ padding:14,borderLeft:`3px solid ${P.a}` }}><Lbl>Due This Month ({MO[currentMonth]})</Lbl><div style={{ fontSize:28,fontWeight:800,color:P.a }}>{dueThisMonth.length}</div><div style={{ fontSize:10,color:P.tm,marginTop:4 }}>{dueThisMonth.length>0?dueThisMonth.map(cl=>cl.nm).join(', '):'All logged!'}</div></Card>
          <Card style={{ padding:14,borderLeft:`3px solid ${P.g}` }}><Lbl>Collected YTD</Lbl><div style={{ fontSize:28,fontWeight:800,color:P.g }}>{fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==='P').length*x.rt,0))}</div></Card>
        </div>
        <div style={{ fontSize:11,color:P.tm,marginBottom:12,padding:'10px 14px',background:P.c1,borderRadius:8,border:`1px solid ${P.bd}` }}>
          Click a cell to update: <span style={{ color:P.td }}>·</span> → <span style={{ color:P.g,fontWeight:700 }}>P</span> (paid) → <span style={{ color:P.r,fontWeight:700 }}>U</span> (unpaid) → <span style={{ color:P.a,fontWeight:700 }}>C</span> (credit) → <span style={{ color:P.td }}>·</span>
        </div>
        <Lbl>Payment Tracker</Lbl>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
            <thead><tr><th style={{ ...th,textAlign:'left',width:160 }}>Client</th><th style={{ ...th,textAlign:'left' }}>Rate</th><th style={{ ...th,textAlign:'left' }}>Via</th>{MO.map(m=><th key={m} style={{ ...th,textAlign:'center',width:36 }}>{m}</th>)}<th style={th}>YTD</th></tr></thead>
            <tbody>{payingClients.map((cl,ci)=>{const ytd=cl.st.filter(s=>s==='P').length*cl.rt;return(
              <tr key={cl.id}><td style={{ padding:'6px 8px',fontWeight:600,borderBottom:`1px solid ${P.bd}10` }}>{cl.nm}</td><td style={{ padding:'6px 8px',color:P.g,borderBottom:`1px solid ${P.bd}10` }}>{fmt(cl.rt)}/mo</td><td style={{ padding:'6px 8px',color:P.td,fontSize:11,borderBottom:`1px solid ${P.bd}10` }}>{cl.vi}</td>
              {MO.map((_,mi)=><td key={mi} style={{ padding:'2px',textAlign:'center',borderBottom:`1px solid ${P.bd}10` }}><div onClick={()=>cyc(ci,mi)} style={sSty(cl.st[mi])} title={cl.nt?.[mi]||''}>{cl.st[mi]||'·'}</div></td>)}
              <td style={{ padding:'6px 8px',textAlign:'right',color:P.g,fontWeight:600,borderBottom:`1px solid ${P.bd}10` }}>{ytd>0?fmt(ytd):'\u2014'}</td></tr>);})}</tbody>
          </table>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginTop:20 }}>
          <Card style={{ padding:12 }}><Lbl>Collected YTD</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.g }}>{fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==='P').length*x.rt,0))}</div></Card>
          <Card style={{ padding:12 }}><Lbl>Overdue</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.r }}>{fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==='U').length*x.rt,0))}</div></Card>
          <Card style={{ padding:12 }}><Lbl>Credits</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.a }}>{fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==='C').length*x.rt,0))}</div></Card>
        </div>
      </div>
      {modal&&(<div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100 }} onClick={()=>setModal(null)}><div onClick={e=>e.stopPropagation()} style={{ background:P.c1,borderRadius:12,padding:24,width:380,border:`1px solid ${P.bd}` }}>
        <div style={{ fontSize:14,fontWeight:700,marginBottom:14 }}>Credit — {d.cl[modal.ci]?.nm} ({MO[modal.mi]})</div>
        <textarea value={nt} onChange={e=>setNt(e.target.value)} placeholder="Reason for credit..." rows={3} style={{ width:'100%',background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,color:P.tx,fontFamily:'inherit',fontSize:12,padding:10,resize:'vertical',boxSizing:'border-box' }}/>
        <div style={{ display:'flex',gap:8,marginTop:14,justifyContent:'flex-end' }}>
          <button onClick={()=>setModal(null)} style={{ background:P.c2,color:P.tm,border:`1px solid ${P.bd}`,borderRadius:6,padding:'7px 14px',fontFamily:'inherit',fontSize:12,cursor:'pointer' }}>Cancel</button>
          <button onClick={saveCr} style={{ background:P.a,color:P.bg,border:'none',borderRadius:6,padding:'7px 14px',fontFamily:'inherit',fontSize:12,fontWeight:700,cursor:'pointer' }}>Save</button>
        </div></div></div>)}
    </div>
  );
}
