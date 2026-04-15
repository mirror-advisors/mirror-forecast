import { useState, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import { MO, P, fmt, getRollingWindow } from './data.js';
import { Card, Lbl, ClientProgressRow, SaveBar, EditableNumber, StatusChip, KPI } from './components.jsx';

const QUOTES = [
  { q: "The secret of getting ahead is getting started.", a: "Mark Twain" },
  { q: "Small steps every day lead to giant leaps over time.", a: "Paul" },
  { q: "You don't have to be great to start, but you have to start to be great.", a: "Zig Ziglar" },
  { q: "Discipline is choosing between what you want now and what you want most.", a: "Abraham Lincoln" },
  { q: "The best way to predict the future is to create it.", a: "Peter Drucker" },
  { q: "Every expert was once a beginner.", a: "Helen Hayes" },
  { q: "Work hard in silence. Let success be your noise.", a: "Frank Ocean" },
  { q: "Opportunities don't happen. You create them.", a: "Chris Grosser" },
  { q: "Don't watch the clock — do what it does. Keep going.", a: "Sam Levenson" },
  { q: "It always seems impossible until it's done.", a: "Nelson Mandela" },
  { q: "You are capable of more than you know.", a: "E.O. Wilson" },
  { q: "A year from now you'll wish you had started today.", a: "Karen Lamb" },
  { q: "The harder you work for something, the greater you'll feel when you achieve it.", a: "Anonymous" },
  { q: "Dream big. Start small. Act now.", a: "Robin Sharma" },
  { q: "Success is not final, failure is not fatal — it is the courage to continue that counts.", a: "Winston Churchill" },
  { q: "Be so good they can't ignore you.", a: "Steve Martin" },
  { q: "Your only limit is you.", a: "Anonymous" },
  { q: "Push yourself, because no one else is going to do it for you.", a: "Anonymous" },
  { q: "Little things make big days.", a: "Anonymous" },
  { q: "It's going to be hard, but hard is not impossible.", a: "Anonymous" },
  { q: "Don't stop when you're tired. Stop when you're done.", a: "Anonymous" },
  { q: "Wake up with determination. Go to bed with satisfaction.", a: "Anonymous" },
  { q: "Do something today that your future self will thank you for.", a: "Sean Patrick Flanery" },
  { q: "Sometimes we're tested not to show our weaknesses, but to discover our strengths.", a: "Anonymous" },
  { q: "The key to success is to focus on goals, not obstacles.", a: "Anonymous" },
  { q: "Great things never come from comfort zones.", a: "Anonymous" },
  { q: "You've got what it takes — but it will take everything you've got.", a: "Anonymous" },
  { q: "Believe you can and you're halfway there.", a: "Theodore Roosevelt" },
  { q: "Start where you are. Use what you have. Do what you can.", a: "Arthur Ashe" },
  { q: "Consistency is the hallmark of the unimaginative.", a: "Oscar Wilde" },
  { q: "Strive for progress, not perfection.", a: "Anonymous" },
  { q: "Success usually comes to those who are too busy to be looking for it.", a: "Henry David Thoreau" },
  { q: "Don't be afraid to give up the good to go for the great.", a: "John D. Rockefeller" },
  { q: "Hustle in silence and let your success make the noise.", a: "Anonymous" },
  { q: "Your attitude determines your direction.", a: "Anonymous" },
  { q: "The only way to do great work is to love what you do.", a: "Steve Jobs" },
  { q: "Act as if what you do makes a difference. It does.", a: "William James" },
  { q: "Quality is not an act, it is a habit.", a: "Aristotle" },
  { q: "Talent is cheaper than table salt. What separates the talented individual from the successful one is hard work.", a: "Stephen King" },
  { q: "If you want to achieve greatness, stop asking for permission.", a: "Anonymous" },
  { q: "Things work out best for those who make the best of how things work out.", a: "John Wooden" },
  { q: "To live a creative life, we must lose our fear of being wrong.", a: "Joseph Chilton Pearce" },
  { q: "If you are not willing to risk the usual, you will have to settle for the ordinary.", a: "Jim Rohn" },
  { q: "All our dreams can come true, if we have the courage to pursue them.", a: "Walt Disney" },
  { q: "Good things come to people who wait, but better things come to those who go out and get them.", a: "Anonymous" },
  { q: "If you do what you always did, you will get what you always got.", a: "Anonymous" },
  { q: "Successful entrepreneurs are givers and not takers of positive energy.", a: "Anonymous" },
  { q: "Whenever you see a successful person you only see the public glories, never the private sacrifices.", a: "Vaibhav Shah" },
  { q: "Opportunities don't happen, you create them.", a: "Chris Grosser" },
  { q: "I find that the harder I work, the more luck I seem to have.", a: "Thomas Jefferson" },
  { q: "The starting point of all achievement is desire.", a: "Napoleon Hill" },
  { q: "Success is the sum of small efforts, repeated day in and day out.", a: "Robert Collier" },
  { q: "If you want to make dreams come true, the first thing you have to do is wake up.", a: "J.M. Power" },
  { q: "When you give joy to other people, you get more joy in return.", a: "Anonymous" },
  { q: "The most common way people give up their power is by thinking they don't have any.", a: "Alice Walker" },
  { q: "The mind is everything. What you think you become.", a: "Buddha" },
  { q: "The best time to plant a tree was 20 years ago. The second best time is now.", a: "Chinese Proverb" },
  { q: "An unexamined life is not worth living.", a: "Socrates" },
  { q: "Eighty percent of success is showing up.", a: "Woody Allen" },
  { q: "Your time is limited, so don't waste it living someone else's life.", a: "Steve Jobs" },
  { q: "Winning isn't everything, but wanting to win is.", a: "Vince Lombardi" },
  { q: "You become what you think about most of the time.", a: "Brian Tracy" },
  { q: "Twenty years from now you will be more disappointed by the things that you didn't do than by the ones you did do.", a: "Mark Twain" },
  { q: "Life is what happens to you while you're busy making other plans.", a: "John Lennon" },
  { q: "We become what we repeatedly do.", a: "Sean Covey" },
  { q: "Innovation distinguishes between a leader and a follower.", a: "Steve Jobs" },
  { q: "There are no traffic jams along the extra mile.", a: "Roger Staubach" },
  { q: "If you genuinely want something, don't wait for it — teach yourself to be impatient.", a: "Gurbaksh Chahal" },
  { q: "If you don't value your time, neither will others. Stop giving away your time and talents.", a: "Kim Garst" },
  { q: "When everything seems to be going against you, remember that the airplane takes off against the wind.", a: "Henry Ford" },
  { q: "The only place where success comes before work is in the dictionary.", a: "Vidal Sassoon" },
  { q: "If you are not willing to learn, no one can help you. If you are determined to learn, no one can stop you.", a: "Zig Ziglar" },
  { q: "The secret of success is to do the common thing uncommonly well.", a: "John D. Rockefeller Jr." },
  { q: "I'd rather attempt to do something great and fail than attempt nothing and succeed.", a: "Robert H. Schuller" },
  { q: "The only limit to our realization of tomorrow will be our doubts of today.", a: "Franklin D. Roosevelt" },
  { q: "What seems to us as bitter trials are often blessings in disguise.", a: "Oscar Wilde" },
  { q: "Don't let the fear of losing be greater than the excitement of winning.", a: "Robert Kiyosaki" },
];

function getDailyQuote() {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function InternView({ d, save, dirty, saving, persist }) {
  const { signOut, profile } = useAuth();
  const [expanded, setExpanded] = useState(null);
  const [stPicker, setStPicker] = useState(null);
  // Filter by tier, NOT rt — otherwise a client vanishes mid-edit when
  // rate briefly drops to 0. Service tiers only; exclude OT projects and
  // Zoho-commission-only clients.
  const payingClients = d.cl.filter(cl => cl.tier !== 'ot' && cl.tier !== 'zho');
  const currentMonth = new Date().getMonth();
  const win = useMemo(() => getRollingWindow(), []);
  const quote = useMemo(() => getDailyQuote(), []);

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

  const togglePicker = (ci, mi) => {
    setStPicker(stPicker && stPicker.ci === ci && stPicker.mi === mi ? null : { ci, mi });
  };
  const setSt = (ci, mi, val) => {
    const realIdx = d.cl.indexOf(payingClients[ci]);
    save({ ...d, cl: d.cl.map((x, i) => i !== realIdx ? x : { ...x, st: x.st.map((v, j) => j === mi ? val : v) }) });
    setStPicker(null);
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

  const sSty = (s, active) => ({ display:'inline-flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:6,cursor:active?'pointer':'default',userSelect:'none',fontWeight:700,fontSize:11,fontFamily:"'JetBrains Mono', monospace",background:!active?`${P.bd}10`:s==='P'?P.gB:s==='L'?P.rB:s==='U'?P.aB:`${P.bd}25`,color:!active?`${P.td}40`:s==='P'?P.g:s==='L'?P.r:s==='U'?P.a:P.td,opacity:active?1:0.3 });
  const th = { padding:'6px 8px',textAlign:'right',color:P.td,fontSize:10,borderBottom:`1px solid ${P.bd}`,fontFamily:"'DM Sans', sans-serif",fontWeight:500,textTransform:'uppercase',letterSpacing:'0.05em' };
  const inp = { background:P.c2,border:`1px solid ${P.bd}`,borderRadius:4,color:P.tx,fontSize:12,fontFamily:"'DM Sans', sans-serif",padding:'6px 8px',outline:'none',width:'100%',boxSizing:'border-box' };

  const firstName = (profile?.name || profile?.email || 'Sara').split(' ')[0].split('@')[0];
  const capitalFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <div style={{ background:P.bg,minHeight:'100vh',color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:13 }}>
      {/* Nav */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${P.bd}`,background:P.c1,padding:'12px 20px' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <img src="/mirror-logo.png" alt="Mirror Advisors" style={{ height:28 }} />
          <span style={{ fontWeight:700,fontSize:14,color:P.g,opacity:.7 }}>Forecast</span>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:12 }}>
          <span style={{ fontSize:11,color:P.tm }}>{profile?.name||profile?.email}</span>
          <button onClick={signOut} style={{ background:P.c2,color:P.tm,border:`1px solid ${P.bd}`,borderRadius:6,padding:'6px 12px',fontFamily:"'DM Sans', sans-serif",fontSize:11,cursor:'pointer' }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth:1200,margin:'0 auto',padding:'24px 16px' }}>

        {/* Daily Greeting */}
        <div style={{ marginBottom:24,padding:'18px 22px',background:P.c1,borderRadius:12,border:`1px solid ${P.bd}`,borderLeft:`3px solid ${P.g}` }}>
          <div style={{ fontSize:18,fontWeight:700,color:P.tx,marginBottom:6 }}>
            {getGreeting()}, {capitalFirst}. 👋
          </div>
          <div style={{ fontSize:13,color:P.tm,fontStyle:'italic',lineHeight:1.6 }}>
            "{quote.q}"
          </div>
          <div style={{ fontSize:10,color:P.td,marginTop:6,letterSpacing:'0.05em' }}>
            — {quote.a}
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16 }}>
          <KPI label="Late" value={late.length} color={late.length>0?P.r:P.tx} sub={late.length>0?late.map(o=>`${o.client.nm} (${MO[o.month]})`).join(', '):'None late'}/>
          <KPI label={`Due This Month (${MO[currentMonth]})`} value={dueThisMonth.length} color={dueThisMonth.length>0?P.a:P.tx} sub={dueThisMonth.length>0?dueThisMonth.map(cl=>cl.nm).join(', '):'All logged'}/>
          <KPI label="Collected YTD" value={fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==='P').length*x.rt,0))} color={P.g}/>
        </div>

        {/* Legend */}
        <div style={{ fontSize:11,color:P.tm,marginBottom:12,display:'flex',gap:16,alignItems:'center' }}>
          <span><span style={{ color:P.g }}>■</span> paid</span>
          <span><span style={{ color:P.a }}>■</span> unpaid</span>
          <span><span style={{ color:P.r }}>■</span> late</span>
          <span style={{ color:P.td }}>Click a segment to cycle U → P → L</span>
        </div>

        <Lbl>Payment Tracker</Lbl>
        <div>
          {payingClients.map((cl,ci)=>{
            const isExp = expanded === ci;
            const ytd = cl.st.filter(s=>s==='P').length*cl.rt;
            return(<ClientProgressRow key={cl.id} cl={cl} onSegmentClick={(mi)=>inTerm(cl,mi)&&cyc(ci,mi)} expanded={isExp} onToggleExpand={()=>setExpanded(isExp?null:ci)}>
              <div style={{ fontSize:10,color:P.td,textTransform:'uppercase',marginBottom:8,letterSpacing:'0.05em',fontWeight:600 }}>Monthly Status (click a cell for P/U/L/C picker)</div>
              <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:16 }}>
                {win.map((slot,wi)=>{
                  const mi = slot.idx;
                  const active = slot.inCurrentYear && inTerm(cl, mi);
                  const s = active ? (cl.st[mi]||'U') : '';
                  const isPicker = stPicker && stPicker.ci===ci && stPicker.mi===mi;
                  return(<div key={wi} style={{ position:'relative',textAlign:'center' }}>
                    <div style={{ fontSize:9,color:slot.isCurrent?P.b:P.td,marginBottom:3,fontWeight:slot.isCurrent?700:500 }}>{slot.label}</div>
                    {active && isPicker && (<div style={{ position:'absolute',top:32,left:'50%',transform:'translateX(-50%)',zIndex:20,display:'flex',gap:2,background:P.c1,border:`1px solid ${P.bd}`,borderRadius:6,padding:3,boxShadow:'0 4px 12px rgba(0,0,0,.5)' }}>{[['P',P.g,P.gB],['U',P.a,P.aB],['L',P.r,P.rB],['C',P.b,`${P.b}15`]].map(([v,co,bg])=><div key={v} onClick={(e)=>{e.stopPropagation();setSt(ci,mi,v);}} style={{ width:24,height:24,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono', monospace",background:s===v?bg:'transparent',color:co,cursor:'pointer',border:`1px solid ${s===v?co+'44':'transparent'}` }}>{v}</div>)}</div>)}
                    <div onClick={()=>active&&togglePicker(ci,mi)} style={sSty(s,active)}>{active?(s||'U'):''}</div>
                  </div>);
                })}
              </div>
              {(()=>{
                const fldLbl = { fontSize:10,color:P.td,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6,fontWeight:600 };
                return <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                  <div><div style={fldLbl}>Monthly Rate</div><EditableNumber value={cl.rt} onCommit={v=>updateClient(ci,'rt',v)} style={inp}/></div>
                  <div><div style={fldLbl}>Term (months)</div><EditableNumber value={cl.termMo||0} onCommit={v=>updateClient(ci,'termMo',v)} placeholder="12" style={inp}/></div>
                  <div><div style={fldLbl}>Signing Date</div><input type="date" value={cl.signed||''} onChange={e=>updateClient(ci,'signed',e.target.value)} style={inp}/></div>
                  <div><div style={fldLbl}>Subscription Start</div><input type="date" value={cl.subStart||''} onChange={e=>updateClient(ci,'subStart',e.target.value)} style={inp}/></div>
                  <div><div style={fldLbl}>Payment Due Day</div><EditableNumber value={cl.payDay||0} onCommit={v=>updateClient(ci,'payDay',v)} placeholder="1" min={1} max={28} style={inp}/></div>
                  <div><div style={fldLbl}>Renewal Date</div><input type="date" value={cl.renewal||''} onChange={e=>updateClient(ci,'renewal',e.target.value)} style={inp}/></div>
                  <div><div style={fldLbl}>Pay Method</div><select value={cl.payMethod||''} onChange={e=>updateClient(ci,'payMethod',e.target.value)} style={{...inp,color:cl.payMethod?P.tx:P.td}}><option value="">—</option>{['Stripe','ACH','Check','Wire','CC'].map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                  <div style={{ gridColumn:'1/-1',display:'flex',justifyContent:'space-between',fontSize:11,color:P.tm,marginTop:4,paddingTop:12,borderTop:`1px solid ${P.bd}` }}>
                    <span>Active: {MO[cl.startMo??0]} – {MO[cl.endMo??11]} · Due day: {cl.payDay||'1st'}</span>
                    <span>YTD: <b style={{ color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{ytd>0?fmt(ytd):'\u2014'}</b></span>
                  </div>
                </div>;
              })()}
            </ClientProgressRow>);
          })}
        </div>

        {/* Summary Cards */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginTop:20 }}>
          <Card style={{ padding:12 }}><Lbl>Collected YTD</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.filter(x=>x.tier!=='ot').reduce((s,x)=>s+x.st.filter(v=>v==='P').length*x.rt,0))}</div></Card>
          <Card style={{ padding:12 }}><Lbl>Unpaid</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.filter(x=>x.tier!=='ot').reduce((s,x)=>s+x.st.filter(v=>v==='U').length*x.rt,0))}</div></Card>
          <Card style={{ padding:12 }}><Lbl>Late</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.filter(x=>x.tier!=='ot').reduce((s,x)=>s+x.st.filter(v=>v==='L').length*x.rt,0))}</div></Card>
        </div>

        {/* ONE-TIME PROJECTS */}
        <div style={{ marginTop:24 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
            <Lbl>One-Time Projects</Lbl>
            <button onClick={()=>save({...d,cl:[...d.cl,{id:'ot'+Date.now(),nm:'New Project',rt:0,tr:'',vi:'Stripe',zh:0,zha:0,tier:'ot',seats:0,st:['','','','','','','','','','','',''],nt:{},payments:[]}]})} style={{ background:P.b,color:'#ffffff',border:'none',borderRadius:6,padding:'6px 12px',fontFamily:"'DM Sans', sans-serif",fontSize:11,fontWeight:700,cursor:'pointer' }}>+ Add Project</button>
          </div>
          {(()=>{
            const otClients = d.cl.map((cl,i)=>({...cl,origIdx:i})).filter(cl=>cl.tier==='ot');
            if(!otClients.length) return <div style={{ fontSize:12,color:P.td,padding:12 }}>No one-time projects yet.</div>;
            const updPay=(ci,pi,patch)=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,payments:x.payments.map((p,j)=>j!==pi?p:{...p,...patch})})});
            const addPay=(ci)=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,payments:[...(x.payments||[]),{id:'p'+Date.now(),amount:0,month:currentMonth,status:'U'}]})});
            const delPay=(ci,pi)=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,payments:x.payments.filter((_,j)=>j!==pi)})});
            const totalAll=otClients.reduce((s,x)=>s+(x.payments||[]).reduce((a,p)=>a+(p.amount||0),0),0);
            const collectedAll=otClients.reduce((s,x)=>s+(x.payments||[]).filter(p=>p.status==='P').reduce((a,p)=>a+(p.amount||0),0),0);
            const outstandingAll=totalAll-collectedAll;
            const rowGrid = { display:'grid', gridTemplateColumns:'130px 110px 110px 28px', gap:12, alignItems:'center' };
            const amtInp = { background:P.c1, border:`1px solid ${P.bd}`, borderRadius:4, color:P.a, fontSize:12, fontFamily:"'JetBrains Mono', monospace", padding:'6px 8px', width:'100%', boxSizing:'border-box', textAlign:'right' };
            const selInp = { background:P.c1, border:`1px solid ${P.bd}`, borderRadius:4, color:P.tx, fontSize:12, padding:'6px 8px', width:'100%', boxSizing:'border-box', fontFamily:"'DM Sans', sans-serif" };
            return <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
              {otClients.map(cl=>{
                const ci=cl.origIdx;
                const pays=cl.payments||[];
                const total=pays.reduce((a,p)=>a+(p.amount||0),0);
                const collected=pays.filter(p=>p.status==='P').reduce((a,p)=>a+(p.amount||0),0);
                return <Card key={cl.id} style={{ padding:16 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:14 }}>
                    <input value={cl.nm} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,nm:e.target.value})})} style={{ background:'transparent',border:'none',color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:14,fontWeight:700,flex:1,outline:'none' }}/>
                    <select value={cl.payMethod||''} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,payMethod:e.target.value})})} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:4,color:cl.payMethod?P.tx:P.td,fontSize:11,padding:'5px 8px',fontFamily:"'DM Sans', sans-serif" }}><option value="">Pay method</option>{['Stripe','ACH','Check','Wire','CC'].map(m=><option key={m} value={m}>{m}</option>)}</select>
                    <div style={{ fontSize:12,fontFamily:"'JetBrains Mono', monospace" }}>
                      <span style={{ color:P.g }}>{fmt(collected)}</span>
                      <span style={{ color:P.td }}>{' / '}</span>
                      <span style={{ color:P.tm }}>{fmt(total)}</span>
                    </div>
                    <button onClick={()=>save({...d,cl:d.cl.filter((_,i)=>i!==ci)})} title="Delete project" style={{ background:'transparent',color:P.td,border:'none',fontSize:16,cursor:'pointer',padding:'2px 6px',lineHeight:1 }}>×</button>
                  </div>
                  {pays.length>0 && (
                    <div style={{ ...rowGrid, padding:'4px 0 6px', borderBottom:`1px solid ${P.bd}` }}>
                      <div style={{ fontSize:10,color:P.td,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600 }}>Amount</div>
                      <div style={{ fontSize:10,color:P.td,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600 }}>Month</div>
                      <div style={{ fontSize:10,color:P.td,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600 }}>Status</div>
                      <div/>
                    </div>
                  )}
                  <div style={{ display:'flex',flexDirection:'column' }}>
                    {pays.map((p,pi)=>(
                      <div key={p.id||pi} style={{ ...rowGrid, padding:'8px 0', borderBottom:`1px solid ${P.bd}30` }}>
                        <EditableNumber value={p.amount} onCommit={v=>updPay(ci,pi,{amount:v})} style={amtInp}/>
                        <select value={p.month} onChange={e=>updPay(ci,pi,{month:+e.target.value})} style={selInp}>
                          {MO.map((m,i)=><option key={i} value={i}>{m}</option>)}
                        </select>
                        <div style={{ display:'flex',gap:4 }}>
                          {['P','U','L'].map(v=>(
                            <StatusChip key={v} value={v} selected={p.status===v} onClick={()=>updPay(ci,pi,{status:v})} size={24}/>
                          ))}
                        </div>
                        <button onClick={()=>delPay(ci,pi)} style={{ background:'transparent',color:P.td,border:'none',fontSize:14,cursor:'pointer',padding:0,lineHeight:1 }}>×</button>
                      </div>
                    ))}
                    <button onClick={()=>addPay(ci)} style={{ alignSelf:'flex-start',background:'transparent',color:P.b,border:'none',padding:'10px 0 0',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans', sans-serif",fontWeight:600 }}>+ Add payment</button>
                  </div>
                </Card>;
              })}
              <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12 }}>
                <KPI label="Total Value" value={fmt(totalAll)} color={P.tx}/>
                <KPI label="Collected" value={fmt(collectedAll)} color={P.g}/>
                <KPI label="Outstanding" value={fmt(outstandingAll)} color={P.a}/>
              </div>
            </div>;
          })()}
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={persist} />
    </div>
  );
}