import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MO, P, DC, FL, TIERS, PIE_COLORS, D0, fmt, fK, sm, preciseRunway, getRollingWindow, getWinVal } from "./data.js";
/* v2.2 changes: 14-month window, outstanding+runway KPI, commission tab, Zoho splits, Option One fix, Jeanna endMo */
import { loadData, saveData } from "./storage.js";
import { compute, computePartnership, computeDevHire, computeWithOverlays } from "./compute.js";
import { Card, Lbl, Bdg, NumIn, Pie, XRow, Sld, KPI, Toggle, Toast, SaveBar, ClientProgressRow, EditableNumber } from "./components.jsx";
import { useAuth } from "./AuthContext.jsx";
import LoginPage from "./LoginPage.jsx";
import InternView from "./InternView.jsx";
import Reconcile from "./Reconcile.jsx";

export default function App() {
  const { user, profile, loading: authLoading, isAdmin, signOut } = useAuth();
  const [d, setD] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [nt, setNt] = useState("");
  const [arc, setArc] = useState(false);
  const [ptab, setPtab] = useState("packages");
  const [showPartnership, setShowPartnership] = useState(false);
  const [showDevHire, setShowDevHire] = useState(false);
  const [clExpanded, setClExpanded] = useState(null);
  const [clFilter, setClFilter] = useState("service"); // V2.1: default to service clients
  const [clSort, setClSort] = useState({ key: "totalValue", dir: "desc" });
  const [scForm, setScForm] = useState(null); // null = closed, object = editing
  const [showRecon, setShowRecon] = useState(false);
  const [stPicker, setStPicker] = useState(null); // { ci, mi } — which cell has the picker open

  const partnerEmail = "mark@mirroradvisors.com";
  const isPartner = (user?.email||"").toLowerCase().trim() === partnerEmail || (profile?.email||"").toLowerCase().trim() === partnerEmail;

  useEffect(() => { loadData(D0).then(x => { setD(x); setSaved(x); }); }, []);
  useEffect(() => { if (!isAdmin && isPartner) setTab("partnerships"); }, [isAdmin, isPartner]);

  // save() is now LOCAL ONLY — just buffers edits into state.
  // persist() pushes the draft to Supabase; triggered by the Save button or ⌘S.
  const save = useCallback((nd) => { setD(nd); }, []);
  const showToast = useCallback((msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);
  const dirty = !!(d && saved && d !== saved);
  const persist = useCallback(async () => {
    if (!d || !dirty || saving) return;
    setSaving(true);
    const result = await saveData(d);
    setSaving(false);
    if (result && result.ok === false) {
      showToast("Save failed — check your connection", "err");
    } else {
      setSaved(d);
      showToast("Saved \u2713", "ok");
    }
  }, [d, dirty, saving, showToast]);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        persist();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [persist]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const pt = d?.pt || D0.pt;
  const dh = d?.dh || D0.dh;
  const pm = useMemo(() => computePartnership(pt), [pt]);
  const dm = useMemo(() => computeDevHire(dh), [dh]);
  const win = useMemo(() => getRollingWindow(), []);

  const clientsByValue = useMemo(() => {
    if (!d) return [];
    return [...d.cl].map(cl => {
      const svcAnnual = cl.rt * 12;
      const zhAnnual = (cl.zh || 0) * 12 + (cl.zha || 0);
      return { ...cl, svcAnnual, zhAnnual, totalValue: svcAnnual + zhAnnual };
    }).sort((a, b) => b.totalValue - a.totalValue);
  }, [d]);

  const filteredClients = useMemo(() => {
    if (!d) return [];
    let cls = [...d.cl].map((cl, origIdx) => {
      const svcAnnual = cl.rt * 12;
      const zhAnnual = (cl.zh || 0) * 12 + (cl.zha || 0);
      return { ...cl, origIdx, svcAnnual, zhAnnual, totalValue: svcAnnual + zhAnnual };
    });
    // V2.1: "service" = non-commission clients, "commission" = zho only, null = all
    if (clFilter === "service") cls = cls.filter(cl => cl.tier !== "zho");
    else if (clFilter === "commission") cls = cls.filter(cl => cl.tier === "zho");
    else if (clFilter && clFilter !== "all") cls = cls.filter(cl => cl.tier === clFilter);
    const dir = clSort.dir === "desc" ? -1 : 1;
    const k = clSort.key;
    cls.sort((a, b) => {
      const av = k === "nm" ? a.nm.toLowerCase() : (a[k] || 0);
      const bv = k === "nm" ? b.nm.toLowerCase() : (b[k] || 0);
      if (av < bv) return dir;
      if (av > bv) return -dir;
      return 0;
    });
    return cls;
  }, [d, clFilter, clSort]);

  if (authLoading) return (<div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:P.tm,fontFamily:"'DM Sans', sans-serif",background:P.bg }}>Loading...</div>);
  if (!user) return <LoginPage />;
  if (!d) return (<div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:P.tm,fontFamily:"'DM Sans', sans-serif",background:P.bg }}>Loading data...</div>);
  if (!isAdmin && !isPartner) return (
    <>
      <InternView d={d} save={save} dirty={dirty} saving={saving} persist={persist} />
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </>
  );

  const c = compute(d);
  const cm = new Date().getMonth();
  const countGreen = (bal) => { let m=0; for(let i=cm;i<12;i++){if(bal[i]<=0)break;m++;} return m; };

  // Baseline runway (no scenarios)
  const blBase = []; const ntBase = MO.map((_,i) => c.rvBase[i] + c.exBase[i]);
  ntBase.forEach((n,i) => blBase.push(i===0 ? d.openBal+n : blBase[i-1]+n));
  const mgBase = countGreen(blBase);
  const fdBase = blBase.findIndex(b => b <= 0);

  // With-scenarios runway (c.bl already includes scenarios)
  const mg = countGreen(c.bl);
  const fd = c.bl.findIndex(b => b <= 0);
  const hasActiveScenarios = (d.scenarios||[]).some(s=>s.on);

  // If-late-collected runway: add outstanding as lump sum at current month
  const outstanding = d.cl.reduce((s, x) => s + x.st.filter(v => v === "L").length * x.rt, 0);
  const blCollected = blBase.map((b,i) => i >= cm ? b + outstanding : b);
  const mgCollected = countGreen(blCollected);

  const tRv = sm(c.rv);
  // V2.1: Distinct pie chart colors
  const pieD = [
    { label: "Zoho Annual", value: sm(d.rv.za), color: PIE_COLORS.za },
    { label: "Zoho Monthly", value: sm(d.rv.zm), color: PIE_COLORS.zm },
    { label: "Infinity Mirror", value: sm(d.rv.im), color: PIE_COLORS.im },
    { label: "Marketing", value: sm(d.rv.mk), color: PIE_COLORS.mk },
    { label: "One-Time", value: sm(c.otMerged), color: PIE_COLORS.ot },
  ];
  const devs = c.at.filter(t => t.dp === "Development");
  const aCl = d.cl.filter(x => x.rt > 0).length;

  const ov = computeWithOverlays(d, { partnership: showPartnership, devHire: showDevHire });

  // V2.1: Zoho commission totals for summary card
  const zhTotal = d.cl.reduce((s, x) => s + (x.zh || 0) * 12 + (x.zha || 0), 0);

  const cyc = (ci, mi) => { setStPicker(stPicker && stPicker.ci===ci && stPicker.mi===mi ? null : { ci, mi }); };
  const setSt = (ci, mi, val) => { if (val === "C") { setStPicker(null); setModal({ ci, mi }); setNt(""); return; } save({ ...d, cl: d.cl.map((x, i) => i !== ci ? x : { ...x, st: x.st.map((v, j) => j === mi ? val : v) }) }); setStPicker(null); };
  const saveCr = () => { if (!modal) return; save({ ...d, cl: d.cl.map((x, i) => i !== modal.ci ? x : { ...x, st: x.st.map((v, j) => j === modal.mi ? "C" : v), nt: { ...x.nt, [modal.mi]: nt || "Credit" } }) }); setModal(null); };

  const sSty = s => ({ display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:28,borderRadius:6,cursor:"pointer",userSelect:"none",fontWeight:700,fontSize:11,fontFamily:"'JetBrains Mono', monospace",background:s==="P"?P.gB:s==="U"?P.aB:s==="L"?P.rB:s==="C"?`${P.b}15`:`${P.bd}25`,color:s==="P"?P.g:s==="U"?P.a:s==="L"?P.r:s==="C"?P.b:P.td });
  const th = { padding:"5px 6px",textAlign:"right",color:P.td,fontSize:10,borderBottom:`1px solid ${P.bd}`,fontFamily:"'DM Sans', sans-serif",fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em" };
  const thCm = (slot) => ({ ...th, background:slot.isCurrent?P.bB:"transparent",color:slot.isCurrent?P.b:P.td,fontWeight:slot.isCurrent?700:500 });
  const tdCm = (slot) => slot.isCurrent?P.bB:"transparent";

  const tabs = isPartner ? ["partnerships"] : ["dashboard","forecast","clients","payroll","partnerships"];
  const setPt = (k, v) => save({ ...d, pt: { ...pt, [k]: v } });
  const setDh = (k, v) => save({ ...d, dh: { ...dh, [k]: v } });

  const toggleSort = (key) => setClSort(prev => prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" });
  const sortIcon = (key) => clSort.key === key ? (clSort.dir === "desc" ? " ↓" : " ↑") : "";

  const winVals = (arr) => win.map(s => getWinVal(arr, s, 0));

  return (
    <div style={{ background:P.bg,minHeight:"100vh",color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:13 }}>
      {/* Nav bar with logo — mix-blend-mode:lighten makes black bg invisible */}
      <div style={{ display:"flex",flexWrap:"wrap",alignItems:"center",borderBottom:`1px solid ${P.bd}`,background:P.c1,position:"sticky",top:0,zIndex:10 }}>
        <div style={{ padding:"10px 20px",display:"flex",alignItems:"center",gap:10 }}>
          <img src="/mirror-logo.png" alt="Mirror Advisors" style={{ height:28 }} />
          <span style={{ fontWeight:700,fontSize:14,color:P.g,opacity:.7 }}>Forecast</span>
        </div>
        {tabs.map(t=>(<button key={t} onClick={()=>setTab(t)} style={{ padding:"14px 10px",cursor:"pointer",border:"none",fontFamily:"'DM Sans', sans-serif",fontSize:10,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase",background:tab===t?P.bg:"transparent",color:tab===t?P.tx:P.tm,borderBottom:tab===t?`2px solid ${P.g}`:"2px solid transparent" }}>{t}</button>))}
        <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:10,paddingRight:16 }}>
          <span style={{ fontSize:10,color:P.tm }}>{profile?.email}</span>
          <button onClick={signOut} style={{ background:P.c2,color:P.tm,border:`1px solid ${P.bd}`,borderRadius:4,padding:"5px 10px",fontFamily:"'DM Sans', sans-serif",fontSize:10,cursor:"pointer" }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth:1300,margin:"0 auto",padding:"24px 16px" }}>

      {/* ===================== DASHBOARD ===================== */}
      {tab==="dashboard"&&(<>
        {/* Runway Cards */}
        <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:20 }}>
          <Card style={{ padding:20 }}>
            <Lbl>Baseline Runway</Lbl>
            <div style={{ display:"flex",alignItems:"baseline",gap:10 }}>
              <span style={{ fontSize:64,fontWeight:800,lineHeight:1,letterSpacing:"-0.04em",color:mgBase>=9?P.g:mgBase>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{mgBase}</span>
              <span style={{ fontSize:16,color:P.tm }}>months green</span>
            </div>
            <div style={{ marginTop:6,color:P.tm,fontSize:12 }}>{fdBase>=0?<>Deficit: <b style={{ color:P.r }}>{MO[fdBase]}</b></>:<span style={{ color:P.g }}>Green all year</span>}{" · Dec: "}<b style={{ color:blBase[11]>0?P.g:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(blBase[11])}</b></div>
          </Card>
          <div style={{ display:"grid",gridTemplateRows:"1fr 1fr",gap:16 }}>
            <Card style={{ padding:16,borderLeft:`3px solid ${hasActiveScenarios?P.p:P.bd}` }}>
              <Lbl>With Scenarios</Lbl>
              {hasActiveScenarios?<>
                <div style={{ fontSize:28,fontWeight:800,color:mg>=9?P.g:mg>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{mg}<span style={{ fontSize:12,fontWeight:500,color:P.tm }}> months</span></div>
                <div style={{ fontSize:10,color:P.p,marginTop:4 }}>{(d.scenarios||[]).filter(s=>s.on).length} active scenario{(d.scenarios||[]).filter(s=>s.on).length>1?"s":""}</div>
              </>:<div style={{ fontSize:14,color:P.td,marginTop:8 }}>No active scenarios</div>}
            </Card>
            <Card style={{ padding:16,borderLeft:`3px solid ${outstanding>0?P.a:P.bd}` }}>
              <Lbl>If Late Collected</Lbl>
              {outstanding>0?<>
                <div style={{ fontSize:28,fontWeight:800,color:mgCollected>=9?P.g:mgCollected>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{mgCollected}<span style={{ fontSize:12,fontWeight:500,color:P.tm }}> months</span></div>
                <div style={{ fontSize:10,color:P.a,marginTop:4 }}>{fmt(outstanding)} late</div>
              </>:<div style={{ fontSize:14,color:P.g,marginTop:8 }}>All current</div>}
            </Card>
          </div>
        </div>
        {/* Cash & Debt */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:20 }}>
          <Card style={{ padding:12 }}><Lbl>Cash</Lbl><div style={{ display:"flex",alignItems:"baseline",gap:6 }}><div style={{ fontSize:22,fontWeight:800,color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cashNow)}</div><button onClick={()=>{const v=prompt("Enter current bank balance:",d.cashNow);if(v!==null&&!isNaN(+v))save({...d,cashNow:Math.round(+v*100)/100});}} style={{ background:"transparent",border:`1px solid ${P.bd}`,borderRadius:4,padding:"2px 6px",color:P.td,fontSize:9,cursor:"pointer",fontFamily:"'DM Sans', sans-serif" }}>edit</button></div>{d.savings>0&&<div style={{ fontSize:11,color:P.tm,marginTop:4 }}>Savings: {fmt(d.savings)}</div>}{(()=>{const lastRecon=Object.entries(d.actuals||{}).sort((a,b)=>+b[0]-+a[0])[0];if(lastRecon)return<div style={{ fontSize:9,color:P.g,marginTop:4 }}>Verified: {MO[lastRecon[0]]} {new Date(lastRecon[1].reconDate).toLocaleDateString()}</div>;return null;})()}{(()=>{const delta=d.cashNow-(c.bl[cm]);return Math.abs(delta)>500?<div style={{ fontSize:10,color:P.a,marginTop:4 }}>Bank balance vs. {MO[cm]} forecast: {delta>0?"+":""}{fmt(delta)}</div>:null;})()}</Card>
          <Card style={{ padding:12 }}><Lbl>Debt</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(Math.abs(d.sLoan+d.ccOwe))}</div></Card>
          <Card style={{ padding:12 }}><Lbl>2026 Revenue</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.t,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(tRv)}</div></Card>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20 }}>
          <Card><Lbl>Revenue Breakdown</Lbl><Pie data={pieD}/></Card>
        </div>
        <Card style={{ padding:0,overflow:"hidden",marginBottom:20 }}>
          <div style={{ display:"grid",gridTemplateColumns:`repeat(${win.length},1fr)` }}>
            {win.map((s,i)=>{
              const bal = s.inCurrentYear ? c.bl[s.idx] : 0;
              const net = s.inCurrentYear ? c.nt[s.idx] : 0;
              const bg = s.isCurrent ? P.bB : bal > 5000 ? P.gB : bal > 0 ? P.aB : P.rB;
              const fg = s.isCurrent ? P.b : bal > 5000 ? P.g : bal > 0 ? P.a : P.r;
              return(<div key={i} style={{ padding:"12px 2px",textAlign:"center",background:bg,borderRight:i<win.length-1?`1px solid ${P.bg}`:undefined }}>
                <div style={{ fontSize:9,color:s.isCurrent?P.b:fg,opacity:s.isCurrent?1:.6,fontWeight:s.isCurrent?700:400,fontFamily:"'DM Sans', sans-serif" }}>{s.label}</div>
                <div style={{ fontSize:12,fontWeight:800,color:fg,fontFamily:"'JetBrains Mono', monospace" }}>{s.inCurrentYear?fK(bal):"\u2014"}</div>
                <div style={{ fontSize:9,color:fg,opacity:.4,fontFamily:"'JetBrains Mono', monospace" }}>{s.inCurrentYear?fK(net):""}</div>
              </div>);
            })}
          </div>
        </Card>
        <Lbl>Unit Economics</Lbl>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginTop:6,marginBottom:20 }}>
          {[["Rev/Client",fmt(Math.round(tRv/Math.max(aCl,1)/12)),P.t],["Rev/Head",fmt(Math.round(tRv/Math.max(c.at.length,1)/12)),P.t],["Clients/Dev",devs.length?(aCl/devs.length).toFixed(1):"\u2014",P.t],["Devs",devs.length,P.tx],["Clients",aCl,P.tx]].map(([l,v,co])=><Card key={l} style={{ padding:12 }}><Lbl>{l}</Lbl><div style={{ fontSize:22,fontWeight:800,color:co,fontFamily:"'JetBrains Mono', monospace" }}>{v}</div></Card>)}
        </div>

        {/* Reconciliation */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
            <Lbl>Month-End Reconciliation</Lbl>
            <button onClick={()=>setShowRecon(!showRecon)} style={{ background:showRecon?P.gB:"transparent",color:showRecon?P.g:P.tm,border:`1px solid ${showRecon?P.g+"44":P.bd}`,borderRadius:6,padding:"6px 14px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans', sans-serif" }}>
              {showRecon?"Hide":"Upload Statements"}
            </button>
          </div>
          {/* Show reconciled months summary even when collapsed */}
          {!showRecon && Object.keys(d.actuals||{}).length > 0 && (
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {Object.entries(d.actuals||{}).map(([mo,a])=>(
                <span key={mo} style={{ fontSize:10,padding:"4px 10px",borderRadius:4,background:P.gB,color:P.g }}>
                  {MO[mo]} ✓ {fmt(a.closingBal)}
                </span>
              ))}
            </div>
          )}
          {showRecon && <Reconcile d={d} save={save} compute={c} />}
        </div>
      </>)}

      {/* ===================== FORECAST ===================== */}
      {tab==="forecast"&&(<>
        <div style={{ display:"flex",gap:12,marginBottom:16,padding:"10px 14px",background:P.c1,borderRadius:8,border:`1px solid ${P.bd}`,alignItems:"center",flexWrap:"wrap" }}>
          <span style={{ fontSize:10,color:P.td,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600 }}>Overlays</span>
          <Toggle label="Partnership Impact" value={showPartnership} onChange={setShowPartnership} color={P.p} />
          <Toggle label="Dev Hire Impact" value={showDevHire} onChange={setShowDevHire} color={P.b} />
          <div style={{ marginLeft:"auto" }}>
            <button onClick={()=>setScForm({ name:"",type:"revenue",amount:2000,startMo:cm,duration:0 })} style={{ background:P.a,color:P.bg,border:"none",borderRadius:6,padding:"8px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:11,fontWeight:700,cursor:"pointer" }}>+ Add Scenario</button>
          </div>
        </div>

        {/* Scenario Add Form */}
        {scForm && (
          <Card style={{ padding:16,marginBottom:16,border:`1px solid ${P.a}44`,background:`${P.aB}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
              <span style={{ fontSize:12,fontWeight:700,color:P.a }}>New Scenario</span>
              <button onClick={()=>setScForm(null)} style={{ background:"transparent",border:"none",color:P.td,cursor:"pointer",fontSize:14 }}>✕</button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr auto auto auto auto",gap:10,alignItems:"end" }}>
              <div>
                <div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Name</div>
                <input value={scForm.name} onChange={e=>setScForm({...scForm,name:e.target.value})} placeholder="e.g. Acme Corp deal" style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,padding:"8px 10px",color:P.tx,fontSize:12,fontFamily:"'DM Sans', sans-serif",width:"100%",boxSizing:"border-box" }}/>
              </div>
              <div>
                <div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Type</div>
                <div style={{ display:"flex",gap:4 }}>
                  {["revenue","expense"].map(t=><button key={t} onClick={()=>setScForm({...scForm,type:t})} style={{ padding:"8px 12px",borderRadius:6,border:`1px solid ${scForm.type===t?(t==="revenue"?P.g:P.r):P.bd}`,background:scForm.type===t?(t==="revenue"?P.gB:P.rB):"transparent",color:scForm.type===t?(t==="revenue"?P.g:P.r):P.tm,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"'DM Sans', sans-serif" }}>{t==="revenue"?"Revenue":"Expense"}</button>)}
                </div>
              </div>
              <div>
                <div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>$/Month</div>
                <input type="number" value={scForm.amount} onChange={e=>setScForm({...scForm,amount:Math.max(0,+e.target.value)})} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,padding:"8px 10px",color:P.a,fontSize:12,fontFamily:"'JetBrains Mono', monospace",width:90,textAlign:"right" }}/>
              </div>
              <div>
                <div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Start</div>
                <select value={scForm.startMo} onChange={e=>setScForm({...scForm,startMo:+e.target.value})} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,padding:"8px 10px",color:P.tx,fontSize:12,fontFamily:"'DM Sans', sans-serif" }}>
                  {MO.map((m,i)=><option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Duration</div>
                <select value={scForm.duration} onChange={e=>setScForm({...scForm,duration:+e.target.value})} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,padding:"8px 10px",color:P.tx,fontSize:12,fontFamily:"'DM Sans', sans-serif" }}>
                  <option value={0}>Ongoing</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n} mo</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"flex",justifyContent:"flex-end",marginTop:12 }}>
              <button disabled={!scForm.name.trim()||!scForm.amount} onClick={()=>{
                const ns = { id:"sc"+Date.now(), name:scForm.name.trim(), type:scForm.type, amount:scForm.amount, startMo:scForm.startMo, duration:scForm.duration, on:true };
                save({...d, scenarios:[...(d.scenarios||[]), ns]});
                setScForm(null);
              }} style={{ background:(!scForm.name.trim()||!scForm.amount)?P.c2:P.a,color:(!scForm.name.trim()||!scForm.amount)?P.td:P.bg,border:"none",borderRadius:6,padding:"8px 18px",fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:700,cursor:(!scForm.name.trim()||!scForm.amount)?"default":"pointer" }}>Add Scenario</button>
            </div>
          </Card>
        )}

        {/* Active Scenarios List */}
        {(d.scenarios||[]).length > 0 && (
          <div style={{ marginBottom:16 }}>
            <Lbl>Active Scenarios</Lbl>
            <div style={{ display:"flex",flexDirection:"column",gap:6,marginTop:6 }}>
              {(d.scenarios||[]).map((sc,si)=>{
                const start = sc.startMo||0;
                const dur = sc.duration||0;
                const end = dur > 0 ? Math.min(start + dur - 1, 11) : 11;
                const totalImpact = sc.amount * (end - start + 1);
                const isRev = sc.type === "revenue";
                return (
                  <div key={sc.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:P.c1,borderRadius:8,border:`1px dashed ${isRev?P.g:P.r}44`,opacity:sc.on?1:0.4 }}>
                    <span style={{ fontSize:9,fontWeight:700,color:isRev?P.g:P.r,textTransform:"uppercase",padding:"2px 6px",borderRadius:4,background:isRev?P.gB:P.rB,whiteSpace:"nowrap" }}>{isRev?"REV":"EXP"}</span>
                    <span style={{ fontSize:12,fontWeight:600,color:P.tx,flex:1 }}>{sc.name}</span>
                    <span style={{ fontSize:12,fontWeight:700,color:isRev?P.g:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{isRev?"+":"−"}{fmt(sc.amount)}/mo</span>
                    <span style={{ fontSize:10,color:P.tm }}>{MO[start]}{dur>0?`–${MO[end]}`:"+"}  ·  {fmt(totalImpact)} total</span>
                    <button onClick={()=>save({...d,scenarios:d.scenarios.map((s,i)=>i===si?{...s,on:!s.on}:s)})} style={{ background:sc.on?P.gB:P.c2,color:sc.on?P.g:P.td,border:`1px solid ${sc.on?P.g+"44":P.bd}`,borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"'DM Sans', sans-serif",fontWeight:600 }}>{sc.on?"ON":"OFF"}</button>
                    <button onClick={()=>save({...d,scenarios:d.scenarios.filter((_,i)=>i!==si)})} style={{ background:P.rB,color:P.r,border:`1px solid ${P.rM}`,borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"'DM Sans', sans-serif" }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Lbl>Cash Flow (Rolling 13-Month)</Lbl>
        <div style={{ overflowX:"auto",marginBottom:20 }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
            <thead><tr><th style={{ ...th,textAlign:"left",width:160 }}></th>{win.map((s,i)=><th key={i} style={thCm(s)}>{s.label}</th>)}<th style={th}>Year</th></tr></thead>
            <tbody>
              {[
                {l:"Opening",v:win.map(s => s.inCurrentYear ? (s.idx===0?d.openBal:c.bl[s.idx-1]) : 0),co:P.tx},
                {l:"Revenue",v:winVals(c.rv),co:P.g},
                {l:"Expenses",v:winVals(c.ex),co:P.r},
              ].map(row=><tr key={row.l}><td style={{ padding:"5px 10px",color:row.co,borderBottom:`1px solid ${P.bd}10` }}>{row.l}</td>{row.v.map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",color:row.co,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",background:tdCm(win[i]) }}>{win[i].inCurrentYear?fmt(v):"\u2014"}</td>)}<td style={{ padding:"5px 6px",textAlign:"right",fontWeight:700,color:row.co,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(sm(row.l==="Opening"?[]:row.v))}</td></tr>)}

              {showPartnership && <>
                <tr><td style={{ padding:"5px 10px",color:P.p,borderBottom:`1px solid ${P.bd}10`,fontSize:11,fontStyle:"italic" }}>+ Partnership Rev</td>{winVals(ov.pRev).map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",color:v?P.p:P.td,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",fontSize:11,background:tdCm(win[i]) }}>{v?fmt(v):"\u2014"}</td>)}<td style={{ padding:"5px 6px",textAlign:"right",color:P.p,fontFamily:"'JetBrains Mono', monospace",fontSize:11 }}>{fmt(sm(ov.pRev))}</td></tr>
                <tr><td style={{ padding:"5px 10px",color:P.p,borderBottom:`1px solid ${P.bd}10`,fontSize:11,fontStyle:"italic" }}>− Partnership Cost</td>{winVals(ov.pCost).map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",color:v?P.r:P.td,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",fontSize:11,background:tdCm(win[i]) }}>{v?fmt(-v):"\u2014"}</td>)}<td style={{ padding:"5px 6px",textAlign:"right",color:P.r,fontFamily:"'JetBrains Mono', monospace",fontSize:11 }}>{fmt(-sm(ov.pCost))}</td></tr>
              </>}

              {showDevHire && <>
                <tr><td style={{ padding:"5px 10px",color:P.b,borderBottom:`1px solid ${P.bd}10`,fontSize:11,fontStyle:"italic" }}>+ Dev Hire Rev</td>{winVals(ov.dhRev).map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",color:v?P.b:P.td,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",fontSize:11,background:tdCm(win[i]) }}>{v?fmt(v):"\u2014"}</td>)}<td style={{ padding:"5px 6px",textAlign:"right",color:P.b,fontFamily:"'JetBrains Mono', monospace",fontSize:11 }}>{fmt(sm(ov.dhRev))}</td></tr>
                <tr><td style={{ padding:"5px 10px",color:P.b,borderBottom:`1px solid ${P.bd}10`,fontSize:11,fontStyle:"italic" }}>− Dev Hire Cost</td>{winVals(ov.dhCost).map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",color:v?P.r:P.td,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",fontSize:11,background:tdCm(win[i]) }}>{v?fmt(-v):"\u2014"}</td>)}<td style={{ padding:"5px 6px",textAlign:"right",color:P.r,fontFamily:"'JetBrains Mono', monospace",fontSize:11 }}>{fmt(-sm(ov.dhCost))}</td></tr>
              </>}

              <tr style={{ fontWeight:700 }}><td style={{ padding:"5px 10px",borderBottom:`1px solid ${P.bd}10` }}>Net Flow</td>{winVals((showPartnership||showDevHire)?ov.overlay.nt:c.nt).map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",color:v>=0?P.g:P.r,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",background:tdCm(win[i]) }}>{win[i].inCurrentYear?fmt(v):"\u2014"}</td>)}<td style={{ padding:"5px 6px",textAlign:"right",color:sm((showPartnership||showDevHire)?ov.overlay.nt:c.nt)>=0?P.g:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(sm((showPartnership||showDevHire)?ov.overlay.nt:c.nt))}</td></tr>

              <tr style={{ fontWeight:800 }}><td style={{ padding:"5px 10px" }}>{(showPartnership||showDevHire)?"BASELINE":"BALANCE"}</td>{winVals(c.bl).map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",background:win[i].isCurrent?P.bB:v>5000?P.gB:v>0?P.aB:P.rB,color:win[i].isCurrent?P.b:v>5000?P.g:v>0?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{win[i].inCurrentYear?fmt(v):"\u2014"}</td>)}<td></td></tr>

              {(showPartnership||showDevHire) && <tr style={{ fontWeight:800 }}><td style={{ padding:"5px 10px",color:P.p }}>W/ SCENARIOS</td>{winVals(ov.overlay.bl).map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",background:win[i].isCurrent?P.bB:v>5000?P.gB:v>0?P.aB:P.rB,color:win[i].isCurrent?P.b:v>5000?P.g:v>0?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{win[i].inCurrentYear?fmt(v):"\u2014"}</td>)}<td></td></tr>}
            </tbody>
          </table>
        </div>

        {/* V2.1: Revenue table — line items in muted white, TOTAL in green */}
        <Lbl>Revenue (Rolling 13-Month)</Lbl>
        <div style={{ overflowX:"auto",marginBottom:20 }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
            <thead><tr><th style={{ ...th,textAlign:"left",width:160 }}></th>{win.map((s,i)=><th key={i} style={thCm(s)}>{s.label}</th>)}<th style={th}>Year</th></tr></thead>
            <tbody>
              {[["Zoho Annual",d.rv.za],["Zoho Monthly",d.rv.zm],["Infinity Mirror",d.rv.im],["Marketing",d.rv.mk],["One-Time",c.otMerged]].map(([l,v])=><tr key={l}><td style={{ padding:"5px 10px",color:P.tm,borderBottom:`1px solid ${P.bd}10` }}>{l}</td>{win.map((s,i)=>{const x=getWinVal(v,s,0);return<td key={i} style={{ padding:"5px 6px",textAlign:"right",color:x>0?P.tm:P.td,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",background:tdCm(s) }}>{s.inCurrentYear?(x>0?fmt(x):"\u2014"):"\u2014"}</td>})}<td style={{ padding:"5px 6px",textAlign:"right",fontWeight:600,color:P.g,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(sm(v))}</td></tr>)}
              {/* Scenario revenue rows */}
              {(d.scenarios||[]).filter(s=>s.on&&s.type==="revenue").map(sc=>{const start=sc.startMo||0;const dur=sc.duration||0;const end=dur>0?Math.min(start+dur-1,11):11;const vals=MO.map((_,i)=>i>=start&&i<=end?sc.amount:0);return<tr key={sc.id}><td style={{ padding:"5px 10px",color:P.a,borderBottom:`1px solid ${P.bd}10`,fontStyle:"italic" }}><span style={{ fontSize:8,fontWeight:700,background:P.aB,color:P.a,padding:"1px 4px",borderRadius:3,marginRight:5 }}>SC</span>{sc.name}</td>{win.map((s,i)=>{const x=getWinVal(vals,s,0);return<td key={i} style={{ padding:"5px 6px",textAlign:"right",color:x>0?P.a:P.td,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",background:tdCm(s) }}>{s.inCurrentYear?(x>0?fmt(x):"\u2014"):"\u2014"}</td>})}<td style={{ padding:"5px 6px",textAlign:"right",fontWeight:600,color:P.a,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(sm(vals))}</td></tr>})}
              <tr style={{ fontWeight:700 }}><td style={{ padding:"5px 10px",color:P.g,borderTop:`2px solid ${P.gM}` }}>TOTAL</td>{win.map((s,i)=>{const v=getWinVal(c.rv,s,0);return<td key={i} style={{ padding:"5px 6px",textAlign:"right",color:P.g,borderTop:`2px solid ${P.gM}`,fontFamily:"'JetBrains Mono', monospace",background:tdCm(s) }}>{s.inCurrentYear?fmt(v):"\u2014"}</td>})}<td style={{ padding:"5px 6px",textAlign:"right",color:P.g,borderTop:`2px solid ${P.gM}`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(sm(c.rv))}</td></tr>
            </tbody>
          </table>
        </div>

        <Lbl>Expenses (click to expand)</Lbl>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
            <thead><tr><th style={{ ...th,textAlign:"left",width:160 }}></th>{win.map((s,i)=><th key={i} style={thCm(s)}>{s.label}</th>)}<th style={th}>Year</th></tr></thead>
            <tbody>
              <XRow label={`${FL.US} US Payroll`} vals={winVals(c.us)} win={win} details={[{n:"Paul (CEO)",v:winVals(MO.map((_,i)=>i===0?0:i===1?-3917:-(c.at.find(t=>t.nm==="Paul")?.co||0)))},{n:"Sara",v:winVals(MO.map((_,i)=>i>=6?0:i===0?-824:i===1?-180:-(c.at.find(t=>t.nm==="Sara")?.co||0)))},{n:"Emp Taxes",v:winVals(d.et)},{n:"ADP Fees",v:winVals(d.af)}]}/>
              <XRow label={`${FL.PH} Philippines`} vals={winVals(c.ph)} win={win} details={c.at.filter(t=>t.ct==="PH").map(t=>({n:`${t.nm} (${t.dp})`,v:winVals(MO.map(()=>-t.co))}))}/>
              <XRow label={`${FL.IN} India`} vals={winVals(c.ind)} win={win} details={[...c.at.filter(t=>t.ct==="IN").map(t=>({n:t.nm,v:winVals(MO.map(()=>-t.co))})),{n:"Wise Fees",v:winVals(d.wf)}]}/>
              <XRow label="Subscriptions" vals={winVals(c.sb)} win={win} details={d.sb.map(s=>({n:s.n,v:winVals(MO.map((_,i)=>{if(s.s&&i<s.s)return 0;if(s.e!==undefined&&i>s.e)return 0;return -s.a;}))}))}/>
              <XRow label="Other Costs" vals={winVals(c.oc)} win={win} details={d.oc.map(x=>({n:x.n,v:winVals(x.v)}))}/>
              <XRow label="Debt" vals={winVals(c.db)} win={win} details={d.db.map(x=>({n:x.n,v:winVals(x.v)}))}/>
              {/* Scenario expense rows */}
              {(d.scenarios||[]).filter(s=>s.on&&s.type==="expense").map(sc=>{const start=sc.startMo||0;const dur=sc.duration||0;const end=dur>0?Math.min(start+dur-1,11):11;const vals=MO.map((_,i)=>i>=start&&i<=end?-sc.amount:0);return<tr key={sc.id}><td style={{ padding:"5px 10px",color:P.a,borderBottom:`1px solid ${P.bd}20`,fontStyle:"italic" }}><span style={{ fontSize:8,fontWeight:700,background:P.aB,color:P.a,padding:"1px 4px",borderRadius:3,marginRight:5 }}>SC</span>{sc.name}</td>{win.map((s,i)=>{const x=getWinVal(vals,s,0);return<td key={i} style={{ padding:"5px 6px",textAlign:"right",color:x?P.a:P.td,borderBottom:`1px solid ${P.bd}20`,fontFamily:"'JetBrains Mono', monospace",background:tdCm(s) }}>{s.inCurrentYear?(x?fmt(x):"\u2014"):"\u2014"}</td>})}<td style={{ padding:"5px 6px",textAlign:"right",fontWeight:600,color:P.a,borderBottom:`1px solid ${P.bd}20`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(sm(vals))}</td></tr>})}              <tr style={{ fontWeight:700 }}><td style={{ padding:"5px 10px",color:P.r,borderTop:`2px solid ${P.rM}` }}>TOTAL</td>{winVals(c.ex).map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",color:P.r,borderTop:`2px solid ${P.rM}`,fontFamily:"'JetBrains Mono', monospace",background:tdCm(win[i]) }}>{win[i].inCurrentYear?fmt(v):"\u2014"}</td>)}<td style={{ padding:"5px 6px",textAlign:"right",color:P.r,borderTop:`2px solid ${P.rM}`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(sm(c.ex))}</td></tr>
            </tbody>
          </table>
        </div>
      </>)}

      {/* ===================== CLIENTS ===================== */}
      {tab==="clients"&&(<>
        {/* V2.1: Split view — Service Clients vs Zoho Commissions */}
        <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center" }}>
          {[["service","Service Clients"],["commission","Zoho Commissions"],["all","All"]].map(([k,l])=><button key={k} onClick={()=>setClFilter(k)} style={{ fontSize:11,color:clFilter===k?P.tx:P.tm,background:clFilter===k?P.c2:"transparent",padding:"6px 14px",borderRadius:6,fontWeight:600,border:`1px solid ${clFilter===k?P.bd:"transparent"}`,cursor:"pointer",fontFamily:"'DM Sans', sans-serif" }}>{l}</button>)}
          <div style={{ marginLeft:"auto" }}><button onClick={()=>save({...d,cl:[...d.cl,{id:"c"+Date.now(),nm:"New Client",rt:2000,tr:"",vi:"",zh:0,zha:0,tier:"im",seats:0,st:["","","","","","","","","","","",""],nt:{}}]})} style={{ background:P.g,color:P.bg,border:"none",borderRadius:6,padding:"8px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:11,fontWeight:700,cursor:"pointer" }}>+ Add Client</button></div>
        </div>

        {/* V2.1: Commission summary card when viewing service clients */}
        {clFilter === "service" && zhTotal > 0 && (
          <Card style={{ padding:14,marginBottom:16,borderLeft:`3px solid ${PIE_COLORS.za}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div>
                <Lbl>Zoho Commission Revenue (Passive)</Lbl>
                <div style={{ fontSize:22,fontWeight:800,color:PIE_COLORS.za,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(zhTotal)}<span style={{ fontSize:11,fontWeight:500,color:P.tm }}>/yr</span></div>
              </div>
              <button onClick={()=>setClFilter("commission")} style={{ background:"transparent",border:`1px solid ${P.bd}`,borderRadius:6,padding:"6px 12px",color:P.tm,fontSize:10,cursor:"pointer",fontFamily:"'DM Sans', sans-serif" }}>View Details →</button>
            </div>
          </Card>
        )}

        <div style={{ overflowX:"auto" }}>
          {/* SERVICE CLIENTS VIEW — Sara-style clean payment tracker */}
          {clFilter === "service" && <>
            <div style={{ fontSize:11,color:P.tm,marginBottom:12,display:"flex",gap:16,alignItems:"center" }}>
              <span><span style={{ color:P.g }}>■</span> paid</span>
              <span><span style={{ color:P.a }}>■</span> unpaid</span>
              <span><span style={{ color:P.r }}>■</span> late</span>
              <span style={{ color:P.td }}>Click a segment to cycle U → P → L</span>
            </div>
            {filteredClients.map((cl)=>{
              const ci = cl.origIdx;
              const isExp = clExpanded === ci;
              const ytd = cl.st.filter(s=>s==="P").length*cl.rt;
              const cycQuick = (mi)=>{const s=cl.st[mi]||"U";const nx=s==="U"?"P":s==="P"?"L":"U";save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,st:x.st.map((v,j)=>j===mi?nx:v)})});};
              return(<ClientProgressRow key={cl.id} cl={cl} onSegmentClick={cycQuick} expanded={isExp} onToggleExpand={()=>setClExpanded(isExp?null:ci)}>
                <div style={{ fontSize:10,color:P.td,textTransform:"uppercase",marginBottom:8,letterSpacing:"0.05em",fontWeight:600 }}>Monthly Status</div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:16 }}>
                  {win.map((s,wi)=>{const mi=s.idx;const active=s.inCurrentYear;const stVal=active?(cl.st[mi]||"U"):"";const isPicker=stPicker&&stPicker.ci===ci&&stPicker.mi===mi;return(<div key={wi} style={{ position:"relative",textAlign:"center" }}>
                    <div style={{ fontSize:9,color:s.isCurrent?P.b:P.td,marginBottom:3,fontWeight:s.isCurrent?700:500 }}>{s.label}</div>
                    {active&&isPicker&&(<div style={{ position:"absolute",top:32,left:"50%",transform:"translateX(-50%)",zIndex:20,display:"flex",gap:2,background:P.c1,border:`1px solid ${P.bd}`,borderRadius:6,padding:3,boxShadow:"0 4px 12px rgba(0,0,0,.5)" }}>{[["P",P.g,P.gB],["U",P.a,P.aB],["L",P.r,P.rB],["C",P.b,`${P.b}15`]].map(([v,co,bg])=><div key={v} onClick={(e)=>{e.stopPropagation();setSt(ci,mi,v);}} style={{ width:24,height:24,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono', monospace",background:stVal===v?bg:"transparent",color:co,cursor:"pointer",border:`1px solid ${stVal===v?co+"44":"transparent"}` }}>{v}</div>)}</div>)}
                    <div onClick={()=>active&&cyc(ci,mi)} style={sSty(stVal)}>{active?(stVal||"U"):""}</div>
                  </div>);})}
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
                  <div><div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Monthly Rate</div><EditableNumber value={cl.rt} onCommit={v=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,rt:v})})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.a,fontSize:12,fontFamily:"'JetBrains Mono', monospace",padding:"6px 8px",width:"100%",boxSizing:"border-box" }}/></div>
                  <div><div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Term</div><input value={cl.tr||""} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,tr:e.target.value})})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.tx,fontSize:12,padding:"6px 8px",width:"100%",boxSizing:"border-box",fontFamily:"'DM Sans', sans-serif" }}/></div>
                  <div><div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Pay Method</div><select value={cl.payMethod||""} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,payMethod:e.target.value})})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:cl.payMethod?P.tx:P.td,fontSize:12,padding:"6px 8px",width:"100%",boxSizing:"border-box",fontFamily:"'DM Sans', sans-serif" }}><option value="">—</option>{["Stripe","ACH","Check","Wire","CC"].map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                  <div><div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Tier</div><select value={cl.tier} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,tier:e.target.value})})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.tx,fontSize:12,padding:"6px 8px",width:"100%",boxSizing:"border-box",fontFamily:"'DM Sans', sans-serif" }}>{Object.entries(TIERS).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select></div>
                  <div><div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Zoho Monthly Comm</div><EditableNumber value={cl.zh||0} onCommit={v=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,zh:v})})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.t,fontSize:12,fontFamily:"'JetBrains Mono', monospace",padding:"6px 8px",width:"100%",boxSizing:"border-box" }}/></div>
                  <div><div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Zoho Annual Comm</div><EditableNumber value={cl.zha||0} onCommit={v=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,zha:v})})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.t,fontSize:12,fontFamily:"'JetBrains Mono', monospace",padding:"6px 8px",width:"100%",boxSizing:"border-box" }}/></div>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",marginTop:12,alignItems:"center" }}>
                  <div style={{ fontSize:10,color:P.td }}>YTD collected: <b style={{ color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{ytd>0?fmt(ytd):"\u2014"}</b></div>
                  <button onClick={()=>save({...d,cl:d.cl.filter((_,i)=>i!==ci)})} style={{ background:P.rB,color:P.r,border:`1px solid ${P.rM}`,borderRadius:4,padding:"4px 12px",fontSize:10,cursor:"pointer",fontFamily:"'DM Sans', sans-serif" }}>Delete Client</button>
                </div>
              </ClientProgressRow>);
            })}</>}

          {/* COMMISSION VIEW — all clients with Zoho commission details */}
          {clFilter === "commission" && <>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
              <thead><tr>
                <th style={{ ...th,textAlign:"left",width:200 }}>Client</th>
                <th style={{ ...th,textAlign:"center",width:80 }}>Type</th>
                <th style={{ ...th,textAlign:"right",width:120 }}>Monthly</th>
                <th style={{ ...th,textAlign:"right",width:120 }}>Annual</th>
                <th style={{ ...th,textAlign:"left",width:140 }}>Renewal/Payment</th>
              </tr></thead>
              <tbody>
                {d.cl.filter(cl=>(cl.zh||0)>0||(cl.zha||0)>0).map(cl=>{
                  const zhM = cl.zh||0; const zhA = cl.zha||0;
                  const isMonthly = zhM > 0;
                  const annualized = isMonthly ? zhM * 12 : zhA;
                  const monthlyEquiv = isMonthly ? zhM : Math.round(zhA / 12);
                  return <tr key={cl.id}><td style={{ padding:"6px 8px",fontWeight:600,borderBottom:`1px solid ${P.bd}10` }}>{cl.nm}</td><td style={{ padding:"6px 8px",textAlign:"center",borderBottom:`1px solid ${P.bd}10` }}><span style={{ fontSize:9,padding:"2px 8px",borderRadius:3,background:isMonthly?P.bB:`${P.t}15`,color:isMonthly?P.b:P.t,fontWeight:600 }}>{isMonthly?"Monthly":"Annual"}</span></td><td style={{ padding:"6px 8px",textAlign:"right",color:P.t,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>${monthlyEquiv.toLocaleString()}/mo</td><td style={{ padding:"6px 8px",textAlign:"right",color:P.t,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",fontWeight:isMonthly?400:700 }}>${annualized.toLocaleString()}/yr</td><td style={{ padding:"6px 8px",color:P.tm,fontSize:11,borderBottom:`1px solid ${P.bd}10` }}>{cl.renewal||cl.zhRenewal||(isMonthly?"Recurring":"—")}</td></tr>;
                })}
              </tbody>
            </table>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:16 }}>
              <Card style={{ padding:12 }}><Lbl>Monthly Commissions</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.t,fontFamily:"'JetBrains Mono', monospace" }}>${d.cl.reduce((s,x)=>s+(x.zh||0),0).toLocaleString()}<span style={{ fontSize:11,fontWeight:500,color:P.tm }}>/mo</span></div></Card>
              <Card style={{ padding:12 }}><Lbl>Annual Commissions</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.t,fontFamily:"'JetBrains Mono', monospace" }}>${d.cl.reduce((s,x)=>s+(x.zha||0),0).toLocaleString()}<span style={{ fontSize:11,fontWeight:500,color:P.tm }}>/yr</span></div></Card>
              <Card style={{ padding:12 }}><Lbl>Total Annual</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(zhTotal)}<span style={{ fontSize:11,fontWeight:500,color:P.tm }}>/yr</span></div></Card>
            </div>
          </>}

          {/* ALL VIEW — value ranking, no payment tracker */}
          {clFilter === "all" && <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
            <thead><tr>{["#","Client","Tier","Service","Zoho","Total Value"].map(h=><th key={h} style={{ ...th,textAlign:h==="#"||h==="Client"||h==="Tier"?"left":"right" }}>{h}</th>)}</tr></thead>
            <tbody>{clientsByValue.map((cl,i)=>{const tier=TIERS[cl.tier]||TIERS.ot;return <tr key={cl.id}><td style={{ padding:"5px 8px",color:P.td,fontSize:11,borderBottom:`1px solid ${P.bd}10` }}>{i+1}</td><td style={{ padding:"5px 8px",fontWeight:600,borderBottom:`1px solid ${P.bd}10` }}>{cl.nm}</td><td style={{ padding:"5px 8px",borderBottom:`1px solid ${P.bd}10` }}><span style={{ fontSize:9,padding:"2px 6px",borderRadius:3,background:`${tier.c}15`,color:tier.c,fontWeight:600 }}>{tier.l}</span></td><td style={{ padding:"5px 8px",textAlign:"right",color:cl.svcAnnual?P.g:P.td,fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10` }}>{cl.svcAnnual?fmt(cl.svcAnnual)+"/yr":"\u2014"}</td><td style={{ padding:"5px 8px",textAlign:"right",color:cl.zhAnnual?P.t:P.td,fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10` }}>{cl.zhAnnual?fmt(cl.zhAnnual)+"/yr":"\u2014"}</td><td style={{ padding:"5px 8px",textAlign:"right",fontWeight:700,fontFamily:"'JetBrains Mono', monospace",color:cl.totalValue>20000?P.g:cl.totalValue>5000?P.a:P.t,borderBottom:`1px solid ${P.bd}10` }}>{fmt(cl.totalValue)}</td></tr>})}</tbody>
          </table>}
        </div>

        {clFilter === "service" && <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:20 }}>
          <Card style={{ padding:12 }}><Lbl>Collected YTD</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.filter(x=>x.tier!=="ot").reduce((s,x)=>s+x.st.filter(v=>v==="P").length*x.rt,0))}</div></Card>
          <Card style={{ padding:12 }}><Lbl>Late</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.filter(x=>x.tier!=="ot").reduce((s,x)=>s+x.st.filter(v=>v==="L").length*x.rt,0))}</div></Card>
          <Card style={{ padding:12 }}><Lbl>Credits</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.filter(x=>x.tier!=="ot").reduce((s,x)=>s+x.st.filter(v=>v==="C").length*x.rt,0))}</div></Card>
        </div>}

        {/* ONE-TIME PROJECTS */}
        <div style={{ marginTop:24 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
            <Lbl>One-Time Projects</Lbl>
            <button onClick={()=>save({...d,cl:[...d.cl,{id:"ot"+Date.now(),nm:"New Project",rt:0,tr:"",vi:"Stripe",zh:0,zha:0,tier:"ot",seats:0,st:["","","","","","","","","","","",""],nt:{},payments:[]}]})} style={{ background:P.a,color:P.bg,border:"none",borderRadius:6,padding:"6px 12px",fontFamily:"'DM Sans', sans-serif",fontSize:11,fontWeight:700,cursor:"pointer" }}>+ Add Project</button>
          </div>
          {(()=>{
            const otClients = d.cl.map((cl,i)=>({...cl,origIdx:i})).filter(cl=>cl.tier==="ot");
            if(!otClients.length) return <div style={{ fontSize:12,color:P.td,padding:12 }}>No one-time projects yet.</div>;
            const updPay=(ci,pi,patch)=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,payments:x.payments.map((p,j)=>j!==pi?p:{...p,...patch})})});
            const addPay=(ci)=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,payments:[...(x.payments||[]),{id:"p"+Date.now(),amount:0,month:cm,status:"U"}]})});
            const delPay=(ci,pi)=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,payments:x.payments.filter((_,j)=>j!==pi)})});
            const totalAll=otClients.reduce((s,x)=>s+(x.payments||[]).reduce((a,p)=>a+(p.amount||0),0),0);
            const collectedAll=otClients.reduce((s,x)=>s+(x.payments||[]).filter(p=>p.status==="P").reduce((a,p)=>a+(p.amount||0),0),0);
            const outstandingAll=totalAll-collectedAll;
            return <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {otClients.map(cl=>{
                const ci=cl.origIdx;
                const pays=cl.payments||[];
                const total=pays.reduce((a,p)=>a+(p.amount||0),0);
                const collected=pays.filter(p=>p.status==="P").reduce((a,p)=>a+(p.amount||0),0);
                const allPaid=pays.length>0 && pays.every(p=>p.status==="P");
                const anyLate=pays.some(p=>p.status==="L");
                return <Card key={cl.id} style={{ padding:12,border:`1px solid ${allPaid?P.g+"33":anyLate?P.r+"33":P.a+"33"}`,background:allPaid?`${P.gB}40`:anyLate?`${P.rB}40`:"transparent" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                    <input value={cl.nm} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,nm:e.target.value})})} style={{ background:"transparent",border:"none",color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:13,fontWeight:600,flex:1 }}/>
                    <select value={cl.payMethod||""} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,payMethod:e.target.value})})} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:4,color:cl.payMethod?P.tx:P.td,fontSize:11,padding:"3px 6px",fontFamily:"'DM Sans', sans-serif" }}><option value="">Pay method</option>{["Stripe","ACH","Check","Wire","CC"].map(m=><option key={m} value={m}>{m}</option>)}</select>
                    <div style={{ fontSize:11,color:P.tm,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(collected)} / {fmt(total)}</div>
                    <button onClick={()=>save({...d,cl:d.cl.filter((_,i)=>i!==ci)})} style={{ background:P.rB,color:P.r,border:`1px solid ${P.rM}`,borderRadius:4,padding:"3px 8px",fontSize:10,cursor:"pointer",fontFamily:"'DM Sans', sans-serif" }}>✕</button>
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                    {pays.map((p,pi)=>(<div key={p.id||pi} style={{ display:"flex",alignItems:"center",gap:8,padding:"4px 6px",background:P.c2,borderRadius:6 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:3 }}>
                        <span style={{ fontSize:10,color:P.td }}>$</span>
                        <EditableNumber value={p.amount} onCommit={v=>updPay(ci,pi,{amount:v})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.a,fontSize:12,fontFamily:"'JetBrains Mono', monospace",padding:"3px 6px",width:80,textAlign:"right" }}/>
                      </div>
                      <select value={p.month} onChange={e=>updPay(ci,pi,{month:+e.target.value})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.tx,fontSize:11,padding:"3px 6px",fontFamily:"'DM Sans', sans-serif" }}>
                        {MO.map((m,i)=><option key={i} value={i}>{m}</option>)}
                      </select>
                      <div style={{ display:"flex",gap:2,marginLeft:"auto" }}>
                        {[["P",P.g,P.gB],["U",P.a,P.aB],["L",P.r,P.rB]].map(([v,co,bg])=>{
                          const active=p.status===v;
                          return <div key={v} onClick={()=>updPay(ci,pi,{status:v})} style={{ width:22,height:22,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono', monospace",background:active?bg:"transparent",color:co,cursor:"pointer",border:`1px solid ${active?co+"44":P.bd}` }}>{v}</div>;
                        })}
                      </div>
                      <button onClick={()=>delPay(ci,pi)} style={{ background:"transparent",color:P.td,border:"none",fontSize:12,cursor:"pointer",padding:"2px 6px" }}>×</button>
                    </div>))}
                    <button onClick={()=>addPay(ci)} style={{ alignSelf:"flex-start",background:"transparent",color:P.a,border:`1px dashed ${P.a}55`,borderRadius:4,padding:"4px 10px",fontSize:10,cursor:"pointer",fontFamily:"'DM Sans', sans-serif" }}>+ Add payment</button>
                  </div>
                </Card>;
              })}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:8 }}>
                <Card style={{ padding:10 }}><Lbl>Total Value</Lbl><div style={{ fontSize:18,fontWeight:800,color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(totalAll)}</div></Card>
                <Card style={{ padding:10 }}><Lbl>Collected</Lbl><div style={{ fontSize:18,fontWeight:800,color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(collectedAll)}</div></Card>
                <Card style={{ padding:10 }}><Lbl>Outstanding</Lbl><div style={{ fontSize:18,fontWeight:800,color:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(outstandingAll)}</div></Card>
              </div>
            </div>;
          })()}
        </div>
      </>)}

      {/* ===================== PAYROLL ===================== */}
      {tab==="payroll"&&(<>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:16 }}><div style={{ display:"flex",gap:8 }}>{Object.entries(DC).map(([dd,co])=><span key={dd} style={{ fontSize:10,color:co,fontWeight:600 }}>● {dd}</span>)}</div><div style={{ display:"flex",gap:8 }}><button onClick={()=>setArc(!arc)} style={{ background:P.c2,color:P.tm,border:`1px solid ${P.bd}`,borderRadius:6,padding:"6px 12px",fontFamily:"'DM Sans', sans-serif",fontSize:11,cursor:"pointer" }}>{arc?"Hide":"Show"} Archived</button><button onClick={()=>save({...d,tm:[...d.tm,{id:"p"+Date.now(),nm:"New Hire",rl:"",dp:"Development",ct:"IN",co:0,on:true}]})} style={{ background:P.b,color:"white",border:"none",borderRadius:6,padding:"6px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:11,fontWeight:700,cursor:"pointer" }}>+ Add</button></div></div>
        {["US","PH","IN"].map(ct=>{const pp=d.tm.filter(t=>t.ct===ct&&(t.on||arc));if(!pp.length)return null;const mo=pp.filter(p=>p.on).reduce((s,p)=>s+p.co,0);return(<div key={ct} style={{ marginBottom:20 }}><div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}><span style={{ fontSize:16 }}>{FL[ct]}</span><span style={{ fontSize:13,fontWeight:700 }}>{ct==="US"?"United States":ct==="PH"?"Philippines":"India"}</span><Bdg c="r">{fmt(-mo)}/mo</Bdg></div><div style={{ display:"grid",gap:6 }}>{pp.map(p=>{const pi=d.tm.indexOf(p);return(<div key={p.id} style={{ background:p.on?P.c1:`${P.c1}80`,borderRadius:8,padding:"10px 14px",border:`1px solid ${P.bd}`,display:"flex",alignItems:"center",gap:12,opacity:p.on?1:.4 }}><div style={{ flex:1 }}><div style={{ display:"flex",alignItems:"center",gap:6 }}><input value={p.nm} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,nm:e.target.value};save({...d,tm:nt2});}} style={{ background:"transparent",border:"none",color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:600,width:110 }}/><span style={{ fontSize:9,padding:"1px 6px",borderRadius:3,background:`${DC[p.dp]||P.td}20`,color:DC[p.dp]||P.td,fontWeight:600 }}>{p.dp}</span></div><input value={p.rl||""} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,rl:e.target.value};save({...d,tm:nt2});}} style={{ background:"transparent",border:"none",color:P.tm,fontFamily:"'DM Sans', sans-serif",fontSize:11,marginTop:1 }} placeholder="Role"/></div><select value={p.dp} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,dp:e.target.value};save({...d,tm:nt2});}} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:4,color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:11,padding:4 }}>{["Development","Marketing","Operations","Leadership"].map(dd=><option key={dd}>{dd}</option>)}</select><NumIn value={p.co} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,co:+e.target.value};save({...d,tm:nt2});}} w={70}/><button onClick={()=>{const nt2=[...d.tm];nt2[pi]={...p,on:!p.on};save({...d,tm:nt2});}} style={{ background:"transparent",border:"none",cursor:"pointer",fontSize:14 }} title={p.on?"Archive":"Reactivate"}>{p.on?"\ud83d\udce6":"\u267b\ufe0f"}</button><button onClick={()=>save({...d,tm:d.tm.filter((_,i)=>i!==pi)})} style={{ background:"transparent",border:"none",color:P.rM,cursor:"pointer",fontSize:13 }}>×</button></div>);})}</div></div>);})}
      </>)}

      {/* ===================== PARTNERSHIPS ===================== */}

      {/* ===================== PARTNERSHIPS ===================== */}
      {tab==="partnerships"&&(<>

        {/* === TABS === */}
        <div style={{ display:"flex",gap:0,borderBottom:`1px solid ${P.bd}`,marginBottom:20 }}>{["packages","runway","config"].map(t=><button key={t} onClick={()=>setPtab(t)} style={{ padding:"10px 14px",cursor:"pointer",border:"none",fontFamily:"'DM Sans', sans-serif",fontSize:10,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase",background:"transparent",color:ptab===t?P.g:P.tm,borderBottom:ptab===t?`2px solid ${P.g}`:"2px solid transparent" }}>{t}</button>)}</div>

        {/* ============ SPLITS TAB ============ */}

        {/* ============ PACKAGES TAB (combined packages + custom) ============ */}
        {ptab==="packages"&&(<div>
          {(()=>{
            const zLic = Math.round((pt.zSeats||15)*(pt.zSeatPrice||40)*(pt.zCommPct||18)/100);
            const devCPC = 300;
            const overhead = 100;
            const svcRate = 2000;
            const svcProfit = svcRate - devCPC - overhead;
            const orgC = pt.pkgOrg || 3;
            const resC = pt.pkgRes || 5;
            const totalEx = orgC + resC;

            const models = [
              { name:"Entrepreneur", desc:"Zero salary. Maximum upside. For partners who bet on themselves.", color:P.a,
                bs:0, orgSvc:30, orgLic:20, resSvc:30, resLic:45, equity:"Consideration after $450k/yr revenue" },
              { name:"Balanced", desc:"Moderate base with solid commissions. Best of both worlds.", color:P.p,
                bs:2000, orgSvc:15, orgLic:10, resSvc:15, resLic:30, equity:"Consideration after $650k/yr revenue" },
              { name:"Secure", desc:"Strong guaranteed salary. Limited commission. Predictable income.", color:P.b,
                bs:4000, orgSvc:5, orgLic:5, resSvc:5, resLic:15, equity:"No equity" },
            ];

            return <>
              <div style={{ fontSize:12,color:P.tm,marginBottom:12,lineHeight:1.6 }}>
                Three packages, same opportunity. Service commissions on profit after dev ($300) + overhead ($100) = <b style={{ color:P.tx }}>${svcProfit}/client profit</b>.
              </div>
              <div style={{ display:"flex",gap:12,marginBottom:16,alignItems:"center" }}>
                <span style={{ fontSize:11,color:P.td }}>Model with:</span>
                <div style={{ display:"flex",alignItems:"center",gap:4 }}><input type="number" value={orgC} onChange={e=>setPt("pkgOrg",Math.max(0,Math.min(20,parseInt(e.target.value)||0)))} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:4,padding:"4px 8px",color:P.t,fontSize:13,fontWeight:700,fontFamily:"'JetBrains Mono', monospace",width:50,textAlign:"center" }}/><span style={{ fontSize:11,color:P.t }}>organic</span></div>
                <span style={{ color:P.td }}>+</span>
                <div style={{ display:"flex",alignItems:"center",gap:4 }}><input type="number" value={resC} onChange={e=>setPt("pkgRes",Math.max(0,Math.min(20,parseInt(e.target.value)||0)))} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:4,padding:"4px 8px",color:P.a,fontSize:13,fontWeight:700,fontFamily:"'JetBrains Mono', monospace",width:50,textAlign:"center" }}/><span style={{ fontSize:11,color:P.a }}>restored Zoho</span></div>
                <span style={{ fontSize:11,color:P.td }}>= {totalEx} clients</span>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:20 }}>
                {models.map((m,mi)=>{
                  const orgSvcPer = Math.round(svcProfit * m.orgSvc / 100);
                  const orgLicPer = Math.round(zLic * m.orgLic / 100);
                  const orgMarkMo = orgC * (orgSvcPer + orgLicPer);
                  const resSvcPer = Math.round(svcProfit * m.resSvc / 100);
                  const resLicPer = Math.round(zLic * m.resLic / 100);
                  const resMarkMo = resC * (resSvcPer + resLicPer);
                  const markTotal = m.bs + orgMarkMo + resMarkMo;

                  return <Card key={mi} style={{ padding:0,overflow:"hidden",border:`1px solid ${m.color}33` }}>
                    <div style={{ padding:"12px 14px",background:`${m.color}10`,borderBottom:`1px solid ${m.color}22` }}>
                      <div style={{ fontSize:14,fontWeight:700,color:m.color }}>{m.name}</div>
                      <div style={{ fontSize:10,color:P.tm,marginTop:3 }}>{m.desc}</div>
                    </div>
                    <div style={{ padding:14 }}>
                      <div style={{ display:"grid",gap:5,fontSize:11 }}>
                        <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>Base salary</span><span style={{ color:P.tx,fontFamily:"'JetBrains Mono', monospace",fontWeight:700 }}>${m.bs.toLocaleString()}/mo</span></div>
                        <div style={{ borderTop:`1px solid ${P.bd}`,paddingTop:5,marginTop:2 }}>
                          <div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Organic ({orgC} clients)</div>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>Service</span><span style={{ color:P.t,fontFamily:"'JetBrains Mono', monospace" }}>{m.orgSvc}% (${orgSvcPer}/cl)</span></div>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>License</span><span style={{ color:P.t,fontFamily:"'JetBrains Mono', monospace" }}>{m.orgLic}% (${orgLicPer}/cl)</span></div>
                        </div>
                        <div style={{ borderTop:`1px solid ${P.bd}`,paddingTop:5,marginTop:2 }}>
                          <div style={{ fontSize:9,color:P.a,textTransform:"uppercase",marginBottom:3 }}>Restored Zoho ({resC} clients)</div>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>Service</span><span style={{ color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{m.resSvc}% (${resSvcPer}/cl)</span></div>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>License</span><span style={{ color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{m.resLic}% (${resLicPer}/cl)</span></div>
                        </div>
                        <div style={{ borderTop:`1px solid ${P.bd}`,paddingTop:6,marginTop:4 }}>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>Guaranteed</span><span style={{ color:P.a,fontFamily:"'JetBrains Mono', monospace",fontWeight:700 }}>${m.bs.toLocaleString()}/mo</span></div>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>{pt.nm} total ({totalEx} cl)</span><span style={{ color:P.g,fontFamily:"'JetBrains Mono', monospace",fontWeight:700 }}>${markTotal.toLocaleString()}/mo</span></div>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>Annual est.</span><span style={{ color:P.tx,fontFamily:"'JetBrains Mono', monospace",fontWeight:700 }}>${(markTotal*12).toLocaleString()}</span></div>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>Equity</span><span style={{ color:mi===2?P.r:P.p,fontSize:10 }}>{m.equity}</span></div>
                        </div>
                      </div>
                      {(()=>{
                        // Calculate runway for this package
                        const pkgFixedMo = m.bs + pt.dch;
                        const pkgSetup = pt.opc || 0;
                        // Zero deals runway
                        const zBl = [];
                        let zCum = 0;
                        for (let i = 0; i < 12; i++) {
                          const ma = i >= pt.sm ? i - pt.sm + 1 : 0;
                          if (ma > 0) zCum += pkgFixedMo + (ma === 1 ? pkgSetup : 0);
                          zBl.push(c.bl[i] - zCum);
                        }
                        const pkgRun = preciseRunway(zBl);
                        return <div style={{ marginTop:8,padding:"8px 0",borderTop:`1px solid ${P.bd}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                          <span style={{ fontSize:10,color:P.td }}>Runway (no deals)</span>
                          <span style={{ fontSize:18,fontWeight:800,color:pkgRun>=9?P.g:pkgRun>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{pkgRun} mo</span>
                        </div>;
                      })()}
                    </div>
                  </Card>;
                })}
              </div>

              {/* === CUSTOM PACKAGE BUILDER === */}
              <Card style={{ padding:16,border:`1px solid ${P.g}33` }}>
                <Lbl>Build Your Own Package</Lbl>
                <div style={{ fontSize:11,color:P.tm,marginBottom:12 }}>Set your ideal terms. Click "Apply" on any preset above to start from a template, then customize here.</div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
                  <div>
                    <Sld label={`${pt.nm}'s Base Salary`} value={pt.bs} onChange={v=>setPt("bs",v)} min={0} max={10000} step={250} pre="$" suf="/mo" color={P.a}/>
                    <div style={{ marginTop:12 }}>
                      <div style={{ fontSize:10,color:P.td,textTransform:"uppercase",marginBottom:6,fontWeight:600 }}>Organic Leads</div>
                      <Sld label="Service Commission" value={pt.orgSvc||15} onChange={v=>setPt("orgSvc",v)} min={0} max={40} suf={`% → $${Math.round(svcProfit*(pt.orgSvc||15)/100)}/client`} color={P.t}/>
                      <Sld label="License Commission" value={pt.orgLic||10} onChange={v=>setPt("orgLic",v)} min={0} max={30} suf={`% → $${Math.round(zLic*(pt.orgLic||10)/100)}/client`} color={P.t}/>
                    </div>
                    <div style={{ marginTop:12 }}>
                      <div style={{ fontSize:10,color:P.a,textTransform:"uppercase",marginBottom:6,fontWeight:600 }}>Restored Zoho Leads</div>
                      <Sld label="Service Commission" value={pt.resSvc||15} onChange={v=>setPt("resSvc",v)} min={0} max={40} suf={`% → $${Math.round(svcProfit*(pt.resSvc||15)/100)}/client`} color={P.a}/>
                      <Sld label="License Commission" value={pt.resLic||40} onChange={v=>setPt("resLic",v)} min={0} max={50} suf={`% → $${Math.round(zLic*(pt.resLic||40)/100)}/client`} color={P.a}/>
                    </div>
                    <div style={{ fontSize:10,color:P.tm,marginTop:8 }}>
                      Restored lead criteria: 2 retail/mo + 1 mid-market/mo from Zoho direct referrals. Falls below = reverts to organic rates.
                    </div>
                  </div>
                  <div>
                    <Card style={{ padding:14,background:P.c2 }}>
                      <Lbl>Your Custom Package ({orgC} org + {resC} restored)</Lbl>
                      {(()=>{
                        const orgS = Math.round(svcProfit*(pt.orgSvc||15)/100);
                        const orgL = Math.round(zLic*(pt.orgLic||10)/100);
                        const resS = Math.round(svcProfit*(pt.resSvc||15)/100);
                        const resL = Math.round(zLic*(pt.resLic||40)/100);
                        const markMo = (pt.bs||0) + orgC*(orgS+orgL) + resC*(resS+resL);
                        return <div style={{ display:"grid",gap:6,fontSize:11,marginTop:8 }}>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>Base</span><span style={{ color:P.tx,fontFamily:"'JetBrains Mono', monospace" }}>${(pt.bs||0).toLocaleString()}</span></div>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>{orgC} organic × ${orgS+orgL}</span><span style={{ color:P.t,fontFamily:"'JetBrains Mono', monospace" }}>${(orgC*(orgS+orgL)).toLocaleString()}</span></div>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>{resC} restored × ${resS+resL}</span><span style={{ color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>${(resC*(resS+resL)).toLocaleString()}</span></div>
                          <div style={{ borderTop:`1px solid ${P.bd}`,paddingTop:6,display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td,fontWeight:700 }}>Monthly</span><span style={{ color:P.g,fontFamily:"'JetBrains Mono', monospace",fontWeight:700,fontSize:14 }}>${markMo.toLocaleString()}</span></div>
                          <div style={{ display:"flex",justifyContent:"space-between" }}><span style={{ color:P.td }}>Annual</span><span style={{ color:P.tx,fontFamily:"'JetBrains Mono', monospace",fontWeight:700 }}>${(markMo*12).toLocaleString()}</span></div>
                        </div>;
                      })()}
                    </Card>
                    <button onClick={()=>{setPt("nzq",totalEx);setPt("ocq",0);setPtab("runway");}} style={{ width:"100%",marginTop:10,padding:"10px",background:`${P.g}20`,color:P.g,border:`1px solid ${P.g}44`,borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans', sans-serif" }}>Apply Custom → See Runway Impact</button>
                  </div>
                </div>
              </Card>
            </>;
          })()}
        </div>)}

        {/* ============ ASSUMPTIONS TAB ============ */}
        {ptab==="runway"&&(<>
          {/* Three runway cards */}
          {(()=>{
            const fixedMo = (pt.bs||0) + pt.dch;
            const setupCost = pt.opc || 0;
            const hasDeals = (pt.ocq || 0) + (pt.nzq || 0) > 0;

            // ZERO DEALS: salary + 1 dev, no revenue
            const zeroBl = [];
            let zeroCum = 0;
            for (let i = 0; i < 12; i++) {
              const ma = i >= pt.sm ? i - pt.sm + 1 : 0;
              if (ma > 0) zeroCum += fixedMo + (ma === 1 ? setupCost : 0);
              zeroBl.push(c.bl[i] - zeroCum);
            }
            const zeroRun = preciseRunway(zeroBl);

            // DEALS FLOWING: uses pm.months which has 3/mo client ramp
            const dealsBl = c.bl.map((b, i) => b + pm.months[i].cum);
            const dealsRun = preciseRunway(dealsBl);

            // Breakeven
            const zLic = Math.round((pt.zSeats||15)*(pt.zSeatPrice||40)*(pt.zCommPct||18)/100);
            const svcProfit = 2000 - 300 - 100;
            const markSvcPer = Math.round(svcProfit * (pt.orgSvc||15) / 100);
            const compSvcPer = svcProfit - markSvcPer;
            const compLicPer = Math.round(zLic * 40 / 100);
            const paulLicPer = Math.round(zLic * 50 / 100);
            let beClients = null;
            for (let n = 1; n <= 20; n++) {
              const devs = Math.ceil(n / (pt.cpc||2.5));
              const revToCompany = n * (compSvcPer + compLicPer + paulLicPer);
              const costs = (pt.bs||0) + devs * pt.dch + n * 100;
              if (revToCompany >= costs) { beClients = n; break; }
            }

            return <><div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:24 }}>
              <Card style={{ padding:16,borderLeft:`3px solid ${P.g}` }}>
                <Lbl>No Changes</Lbl>
                <div style={{ fontSize:42,fontWeight:800,color:mg>=9?P.g:mg>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{mg}</div>
                <div style={{ fontSize:11,color:P.tm }}>months runway</div>
              </Card>
              <Card style={{ padding:16,borderLeft:`3px solid ${P.r}` }}>
                <Lbl>{pt.nm} + Zero Deals</Lbl>
                <div style={{ fontSize:42,fontWeight:800,color:zeroRun>=9?P.g:zeroRun>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{zeroRun}</div>
                <div style={{ fontSize:11,color:P.tm }}>months · burns ${fixedMo.toLocaleString()}/mo extra</div>
                <div style={{ fontSize:10,color:P.r,marginTop:4 }}>Salary ${(pt.bs||0).toLocaleString()} + Dev ${pt.dch.toLocaleString()} + Setup ${setupCost.toLocaleString()}</div>
              </Card>
              <Card style={{ padding:16,borderLeft:`3px solid ${hasDeals?P.g:P.td}` }}>
                <Lbl>{pt.nm} + Deals Flowing</Lbl>
                {hasDeals ? <>
                  <div style={{ fontSize:42,fontWeight:800,color:dealsRun>=9?P.g:dealsRun>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{dealsRun>=24?"24+":dealsRun}</div>
                  <div style={{ fontSize:11,color:P.tm }}>months · {pt.nzq||0} Zoho + {pt.ocq||0} Odoo active</div>
                  <div style={{ fontSize:10,color:pm.netMonthly>=0?P.g:P.r,marginTop:4 }}>{pm.netMonthly>=0?"+":""}${pm.netMonthly.toLocaleString()}/mo net at steady state</div>
                </> : <>
                  <div style={{ fontSize:18,fontWeight:600,color:P.td,marginTop:12 }}>Set deal flow below</div>
                  <div style={{ fontSize:11,color:P.td,marginTop:4 }}>Slide Zoho or Odoo clients above 0</div>
                </>}
              </Card>
            </div>
            {beClients && <div style={{ padding:14,borderRadius:8,background:P.gB,border:`1px solid ${P.gM}`,marginBottom:20,display:"flex",alignItems:"center",gap:16 }}>
              <div style={{ fontSize:42,fontWeight:800,color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{beClients}</div>
              <div>
                <div style={{ fontSize:14,color:P.g,fontWeight:700 }}>clients to break even</div>
                <div style={{ fontSize:11,color:P.tm,marginTop:4 }}>At {beClients} active clients, {pt.nm}'s partnership pays for itself. Every client beyond {beClients} is pure profit.</div>
              </div>
            </div>}
            </>;
          })()}

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:24 }}>
            <div>
              <Lbl>Partnership Parameters</Lbl>
              <Sld label={`${pt.nm}'s Base Salary`} value={pt.bs} onChange={v=>setPt("bs",v)} min={0} max={10000} step={250} pre="$" suf="/mo" color={P.a}/>
              <Sld label="Start Month" value={pt.sm} onChange={v=>setPt("sm",v)} min={0} max={11} suf={` (${MO[pt.sm]})`} color={P.p}/>
              <Sld label="Ramp-Up Delay" value={pt.dl||0} onChange={v=>setPt("dl",v)} min={0} max={6} suf=" months before first revenue" color={P.a}/>
              <div style={{ height:12 }}/>
              <Lbl>Deal Flow (all clients $2,000/mo × 12mo retainer)</Lbl>
              <div style={{ fontSize:11,color:P.tm,marginBottom:8 }}>Total active clients Mark brings. Max 3 new/month. Dev: $750/mo per dev (2.5 clients each). Overhead: $100/client.</div>
              <Sld label="Zoho Clients (active)" value={pt.nzq} onChange={v=>setPt("nzq",v)} min={0} max={20} suf=" clients"/>
              <Sld label="Odoo Clients (active)" value={pt.ocq} onChange={v=>setPt("ocq",v)} min={0} max={20} suf=" clients"/>
            </div>
            <div>
              <Lbl>Cumulative Cash Impact</Lbl>
              <div style={{ display:"grid",gridTemplateColumns:`repeat(${win.length},1fr)`,gap:2,marginBottom:16 }}>{win.map((s,i)=>{const m=s.inCurrentYear?pm.months[s.idx]:{cum:0,inDelay:false};return<div key={i} style={{ height:34,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono', monospace",opacity:s.inCurrentYear&&s.idx>=pt.sm?1:.3,background:m.inDelay?P.aB:m.cum>0?P.gB:m.cum>-3000?P.aB:P.rB,color:m.inDelay?P.a:m.cum>0?P.g:m.cum>-3000?P.a:P.r }}>{s.inCurrentYear?fK(m.cum):"\u2014"}</div>})}</div>

              <Card style={{ padding:14,marginBottom:12 }}>
                <Lbl>Steady State ({pm.totalClients} clients)</Lbl>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:11,marginTop:8 }}>
                  <div><span style={{ color:P.td }}>Devs needed:</span> <span style={{ color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{pm.totalDevs} (${pm.totalDevCost.toLocaleString()}/mo)</span></div>
                  <div><span style={{ color:P.td }}>Overhead:</span> <span style={{ fontFamily:"'JetBrains Mono', monospace" }}>${pm.overhead.toLocaleString()}/mo</span></div>
                  <div><span style={{ color:P.td }}>{pt.nm} earns:</span> <span style={{ color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>${pm.mComp.toLocaleString()}/mo</span></div>
                  <div><span style={{ color:P.td }}>Paul earns:</span> <span style={{ color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>${pm.paulLicTotal.toLocaleString()}/mo</span></div>
                  <div><span style={{ color:P.td }}>Company keeps:</span> <span style={{ color:P.b,fontFamily:"'JetBrains Mono', monospace" }}>${pm.compTotal.toLocaleString()}/mo</span></div>
                  <div><span style={{ color:P.td }}>New MRR:</span> <span style={{ color:P.tx,fontFamily:"'JetBrains Mono', monospace" }}>${pm.totalNewRev.toLocaleString()}/mo</span></div>
                  <div style={{ gridColumn:"1/-1",borderTop:`1px solid ${P.bd}`,paddingTop:6,marginTop:4 }}>
                    <span style={{ color:P.td }}>Net monthly:</span> <span style={{ color:pm.netMonthly>=0?P.g:P.r,fontWeight:700,fontFamily:"'JetBrains Mono', monospace" }}>{pm.netMonthly>=0?"+":""}${pm.netMonthly.toLocaleString()}/mo</span>
                  </div>
                </div>
              </Card>

              {pm.totalClients > 0 && <Card style={{ padding:12,marginBottom:12 }}>
                <Lbl>Per Client Economics</Lbl>
                <div style={{ fontSize:11,marginTop:6,lineHeight:1.7 }}>
                  <div><b style={{ color:P.tx }}>Service:</b> $2,000 − ${pm.devPerClient} dev − $100 overhead = <b>${pm.svcProfit} profit</b> → {pt.nm} 15% (${pm.markSvcPer}) · Co 85% (${pm.companySvcPer})</div>
                  <div><b style={{ color:P.t }}>License:</b> ${pm.zLicPerClient}/mo → {pt.nm} {pm.licMarkPct}% (${pm.markLicPer}) · Co {pm.licCoPct}% (${pm.compLicPer}) · Paul {pm.licPaulPct}% (${pm.paulLicPer})</div>
                </div>
              </Card>}

              {(()=>{
                const perClient = pm.markSvcPer + pm.markLicPer;
                const rows = [];
                for (let t = 1; t <= 15; t++) {
                  const m = (pt.bs||0) + t * perClient;
                  rows.push({ n:t, m, ramp: Math.ceil(t/3) });
                }
                return <div style={{ marginBottom:12 }}>
                  <Lbl>{pt.nm}'s Earnings by Client Count</Lbl>
                  <div style={{ fontSize:10,color:P.tm,marginBottom:4 }}>15% service profit + {pm.licMarkPct}% license. Max 3 new/month.</div>
                  <div style={{ overflowX:"auto",marginTop:6 }}><table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                    <thead><tr>{["Clients","Ramp","Monthly","Annual"].map(h=><th key={h} style={{ padding:"4px 8px",textAlign:"right",color:P.td,fontSize:9,borderBottom:`1px solid ${P.bd}`,textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                    <tbody>{rows.map(r=><tr key={r.n}><td style={{ padding:"3px 8px",textAlign:"right",color:P.tx,fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10` }}>{r.n}</td><td style={{ padding:"3px 8px",textAlign:"right",color:P.td,fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10` }}>{r.ramp} mo</td><td style={{ padding:"3px 8px",textAlign:"right",color:P.a,fontWeight:600,fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10` }}>${r.m.toLocaleString()}</td><td style={{ padding:"3px 8px",textAlign:"right",color:r.m*12>=100000?P.g:P.tm,fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10` }}>${(r.m*12).toLocaleString()}</td></tr>)}</tbody>
                  </table></div>
                </div>;
              })()}

              <div style={{ padding:12,borderRadius:8,background:P.c2,border:`1px solid ${P.bd}`,fontSize:11,color:P.tm,lineHeight:1.7 }}>
                {(()=>{
                  const firstRevIdx = pt.sm + (pt.dl || 0);
                  const delayCost = (pt.bs||0) * (pt.dl || 0) + (pt.opc || 0) + pt.dch * (pt.dl || 0);
                  return <>Investment: <b style={{ color:P.r }}>${delayCost.toLocaleString()}</b> before first revenue in <b style={{ color:P.g }}>{firstRevIdx<12?MO[firstRevIdx]:"2027"}</b>. {pt.nm} costs <b style={{ color:P.r }}>${((pt.bs||0)+pt.dch).toLocaleString()}/mo</b> during ramp. Max 3 clients/mo after ramp.
                    {pt.equityTrigger && <><br/><span style={{ color:P.p }}>Equity at ${(pt.equityTrigger||500000).toLocaleString()}/yr revenue.</span></>}
                  </>;
                })()}
              </div>
            </div>
          </div>
        </>)}

        {/* ============ CONFIG TAB ============ */}
        {ptab==="config"&&(<div style={{ maxWidth:500 }}>
          <Lbl>Partner Profile</Lbl>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:8,marginBottom:16 }}>
            <div><div style={{ fontSize:10,color:P.td,marginBottom:3 }}>PARTNER NAME</div><input value={pt.nm} onChange={e=>setPt("nm",e.target.value)} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,padding:"8px 12px",color:P.tx,fontSize:12,fontFamily:"'DM Sans', sans-serif",width:"100%" }}/></div>
            <div><div style={{ fontSize:10,color:P.td,marginBottom:3 }}>ROLE</div><input value={pt.rl} onChange={e=>setPt("rl",e.target.value)} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,padding:"8px 12px",color:P.tx,fontSize:12,fontFamily:"'DM Sans', sans-serif",width:"100%" }}/></div>
          </div>
          <Lbl>Dev Economics</Lbl>
          <Sld label="Dev Cost Per Hire" value={pt.dch} onChange={v=>setPt("dch",v)} min={300} max={2000} step={50} pre="$" suf="/mo"/>
          <Sld label="Clients Per Dev" value={pt.cpc||2.5} onChange={v=>setPt("cpc",v)} min={1} max={5} step={0.5} suf={` → $${Math.round(pt.dch/(pt.cpc||2.5))}/client/mo`}/>
          <Sld label="Setup Cost" value={pt.opc||1000} onChange={v=>setPt("opc",v)} min={0} max={5000} step={500} pre="$" suf=" one-time"/>
          <div style={{ height:12 }}/>
          <Lbl>Zoho License Model</Lbl>
          <Sld label="Avg Seats Per Client" value={pt.zSeats||15} onChange={v=>setPt("zSeats",v)} min={5} max={50} suf=" seats"/>
          <Sld label="Seat Price" value={pt.zSeatPrice||40} onChange={v=>setPt("zSeatPrice",v)} min={20} max={80} step={5} pre="$" suf="/seat/mo"/>
          <Sld label="Commission Rate" value={pt.zCommPct||18} onChange={v=>setPt("zCommPct",v)} min={10} max={25} suf="%"/>
          <div style={{ fontSize:11,color:P.tm,marginTop:4 }}>License commission: {pt.zSeats||15} × ${pt.zSeatPrice||40} × {pt.zCommPct||18}% = <b style={{ color:P.t }}>${Math.round((pt.zSeats||15)*(pt.zSeatPrice||40)*(pt.zCommPct||18)/100)}/mo</b> per client</div>
          <div style={{ height:12 }}/>
          <Lbl>Equity</Lbl>
          <Sld label="Revenue Trigger" value={pt.equityTrigger||500000} onChange={v=>setPt("equityTrigger",v)} min={250000} max={1000000} step={50000} pre="$" suf="/yr" color={P.p}/>
        </div>)}
      </>)}



      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={persist} />
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {modal&&(<div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }} onClick={()=>setModal(null)}><div onClick={e=>e.stopPropagation()} style={{ background:P.c1,borderRadius:12,padding:24,width:380,border:`1px solid ${P.bd}` }}><div style={{ fontSize:14,fontWeight:700,marginBottom:14 }}>Credit — {d.cl[modal.ci]?.nm} ({MO[modal.mi]})</div><textarea value={nt} onChange={e=>setNt(e.target.value)} placeholder="Reason for credit..." rows={3} style={{ width:"100%",background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:12,padding:10,resize:"vertical",boxSizing:"border-box" }}/><div style={{ display:"flex",gap:8,marginTop:14,justifyContent:"flex-end" }}><button onClick={()=>setModal(null)} style={{ background:P.c2,color:P.tm,border:`1px solid ${P.bd}`,borderRadius:6,padding:"7px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:12,cursor:"pointer" }}>Cancel</button><button onClick={saveCr} style={{ background:P.a,color:P.bg,border:"none",borderRadius:6,padding:"7px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:700,cursor:"pointer" }}>Save</button></div></div></div>)}
    </div>
  );
}