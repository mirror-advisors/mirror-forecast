import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MO, P, DC, FL, TIERS, PIE_COLORS, D0, fmt, fK, sm, getRollingWindow, getWinVal } from "./data.js";
import { loadData, saveData } from "./storage.js";
import { compute } from "./compute.js";
import { Card, Lbl, Bdg, NumIn, Pie, XRow, Sld, KPI, Toggle, Toast, SaveBar, ClientProgressRow, EditableNumber, StatusChip } from "./components.jsx";
import { useAuth } from "./AuthContext.jsx";
import LoginPage from "./LoginPage.jsx";
import InternView from "./InternView.jsx";
import Reconcile from "./Reconcile.jsx";

export default function App() {
  const { user, profile, loading: authLoading, isAdmin, isViewer, signOut } = useAuth();
  const [d, setD] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [nt, setNt] = useState("");
  const [arc, setArc] = useState(false);
  const [clExpanded, setClExpanded] = useState(null);
  const [clFilter, setClFilter] = useState("service"); // V2.1: default to service clients
  const [clSort, setClSort] = useState({ key: "totalValue", dir: "desc" });
  const [scForm, setScForm] = useState(null); // null = closed, object = editing
  const [showRecon, setShowRecon] = useState(false);
  const [stPicker, setStPicker] = useState(null); // { ci, mi } — which cell has the picker open
  const [crmFilter, setCrmFilter] = useState("all");
  const [crmSort, setCrmSort] = useState("status");
  const [crmSelectedId, setCrmSelectedId] = useState(null);
  const [zohoExpanded, setZohoExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => { loadData(D0).then(x => { setD(x); setSaved(x); }); }, []);

  // save() is now LOCAL ONLY — just buffers edits into state.
  // persist() pushes the draft to Supabase; triggered by the Save button or ⌘S.
  // Viewers (read-only role) get a no-op save/persist so they can't accidentally write.
  const save = useCallback((nd) => { if (isViewer) return; setD(nd); }, [isViewer]);
  const showToast = useCallback((msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);
  const dirty = !!(d && saved && d !== saved);
  const persist = useCallback(async () => {
    if (isViewer) return;
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
  }, [d, dirty, saving, showToast, isViewer]);

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
  if (!isAdmin && !isViewer) return (
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

  // V2.1: Zoho commission totals for summary card
  const zhTotal = d.cl.reduce((s, x) => s + (x.zh || 0) * 12 + (x.zha || 0), 0);

  const cyc = (ci, mi) => { setStPicker(stPicker && stPicker.ci===ci && stPicker.mi===mi ? null : { ci, mi }); };
  const setSt = (ci, mi, val) => { if (val === "C") { setStPicker(null); setModal({ ci, mi }); setNt(""); return; } save({ ...d, cl: d.cl.map((x, i) => i !== ci ? x : { ...x, st: x.st.map((v, j) => j === mi ? val : v) }) }); setStPicker(null); };
  const saveCr = () => { if (!modal) return; save({ ...d, cl: d.cl.map((x, i) => i !== modal.ci ? x : { ...x, st: x.st.map((v, j) => j === modal.mi ? "C" : v), nt: { ...x.nt, [modal.mi]: nt || "Credit" } }) }); setModal(null); };

  const sSty = s => ({ display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:28,borderRadius:6,cursor:"pointer",userSelect:"none",fontWeight:700,fontSize:11,fontFamily:"'JetBrains Mono', monospace",background:s==="P"?P.gB:s==="U"?P.aB:s==="L"?P.rB:s==="C"?`${P.b}15`:`${P.bd}25`,color:s==="P"?P.g:s==="U"?P.a:s==="L"?P.r:s==="C"?P.b:P.td });
  const th = { padding:"5px 6px",textAlign:"right",color:P.td,fontSize:10,borderBottom:`1px solid ${P.bd}`,fontFamily:"'DM Sans', sans-serif",fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em" };
  const thCm = (slot) => ({ ...th, background:slot.isCurrent?P.bB:"transparent",color:slot.isCurrent?P.b:P.td,fontWeight:slot.isCurrent?700:500 });
  const tdCm = (slot) => slot.isCurrent?P.bB:"transparent";

  const tabs = ["dashboard","forecast","clients","crm","payroll"];

  // === CRM helpers (Phase B) ===
  const STATUS_COLORS = {
    active:    { bg: P.gB, fg: P.g },
    "at-risk": { bg: P.aB, fg: P.a },
    churned:   { bg: P.rB, fg: P.r },
    pipeline:  { bg: P.c2, fg: P.tm },
  };
  const statusPill = (s) => {
    const co = STATUS_COLORS[s] || STATUS_COLORS.pipeline;
    return <span style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"3px 9px",borderRadius:11,background:co.bg,color:co.fg,fontSize:10,fontWeight:700,fontFamily:"'DM Sans', sans-serif",textTransform:"capitalize",whiteSpace:"nowrap",letterSpacing:"0.02em" }}><span style={{ width:6,height:6,borderRadius:3,background:co.fg }} />{s || "unknown"}</span>;
  };
  const formatCrmAmount = (cl) => {
    if (cl.contractType === "retainer") return `$${(cl.monthlyAmount || 0).toLocaleString()}/mo`;
    if (cl.contractType === "project") {
      if (cl.termMonths) return `$${(cl.monthlyAmount || 0).toLocaleString()}/mo × ${cl.termMonths}`;
      if (cl.totalContractValue) return `$${cl.totalContractValue.toLocaleString()} total`;
      return "—";
    }
    if (cl.contractType === "one-time") {
      const paid = (cl.payments || []).filter(p => p.status === "P").reduce((s, p) => s + p.amount, 0);
      const total = (cl.payments || []).reduce((s, p) => s + p.amount, 0);
      if (total === 0) return "—";
      if (paid === total) return `$${total.toLocaleString()} (paid)`;
      if (paid === 0) return `$${total.toLocaleString()} (pending)`;
      return `$${total.toLocaleString()} ($${paid.toLocaleString()} paid)`;
    }
    if (cl.contractType === "zoho-only") {
      if (cl.commissionFrequency === "annual") return `$${(cl.currentCommissionAnnual || 0).toLocaleString()}/yr`;
      return `$${(cl.currentCommissionMonthly || 0).toLocaleString()}/mo`;
    }
    return "—";
  };
  const formatRenewal = (cl) => cl.renewalDate || cl.endDate || "—";
  const STATUS_PRIORITY = { "at-risk": 0, active: 1, pipeline: 2, churned: 3 };
  const isZohoCl = (cl) => cl.contractType === "zoho-only";
  const zohoMonthlySum = d.cl.filter(c => isZohoCl(c) && c.commissionFrequency !== "annual").reduce((s, c) => s + (c.currentCommissionMonthly || 0), 0);
  const zohoAnnualSum = d.cl.filter(c => isZohoCl(c) && c.commissionFrequency === "annual").reduce((s, c) => s + (c.currentCommissionAnnual || 0), 0);
  const zohoTotalCount = d.cl.filter(isZohoCl).length;
  const matchesCrmFilter = (cl, f) => f === "all" ? true : f === "one-time" ? cl.contractType === "one-time" : cl.status === f;
  const sortCrmRows = (rows) => {
    const arr = [...rows];
    if (crmSort === "status") arr.sort((a, b) => (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99) || a.nm.localeCompare(b.nm));
    else if (crmSort === "name") arr.sort((a, b) => a.nm.localeCompare(b.nm));
    else if (crmSort === "type") arr.sort((a, b) => (a.contractType || "").localeCompare(b.contractType || "") || a.nm.localeCompare(b.nm));
    else if (crmSort === "amount") {
      const v = (c) => c.monthlyAmount || (c.totalContractValue ? c.totalContractValue / 12 : 0) || (c.payments || []).reduce((s, p) => s + p.amount, 0) || (c.currentCommissionMonthly || 0) || (c.currentCommissionAnnual ? c.currentCommissionAnnual / 12 : 0);
      arr.sort((a, b) => v(b) - v(a));
    }
    return arr;
  };

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

      {isViewer && <div style={{ background:P.aB,borderBottom:`1px solid ${P.aM||P.bd}`,padding:"6px 20px",fontSize:11,color:P.a,textAlign:"center",fontFamily:"'DM Sans', sans-serif",fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase" }}>Read-only view</div>}

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
        <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:16 }}>
          <button onClick={()=>setScForm({ name:"",type:"revenue",amount:2000,startMo:cm,duration:0 })} style={{ background:P.a,color:P.bg,border:"none",borderRadius:6,padding:"8px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:11,fontWeight:700,cursor:"pointer" }}>+ Add Scenario</button>
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

              <tr style={{ fontWeight:700 }}><td style={{ padding:"5px 10px",borderBottom:`1px solid ${P.bd}10` }}>Net Flow</td>{winVals(c.nt).map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",color:v>=0?P.g:P.r,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",background:tdCm(win[i]) }}>{win[i].inCurrentYear?fmt(v):"\u2014"}</td>)}<td style={{ padding:"5px 6px",textAlign:"right",color:sm(c.nt)>=0?P.g:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(sm(c.nt))}</td></tr>

              <tr style={{ fontWeight:800 }}><td style={{ padding:"5px 10px" }}>BALANCE</td>{winVals(c.bl).map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",background:win[i].isCurrent?P.bB:v>5000?P.gB:v>0?P.aB:P.rB,color:win[i].isCurrent?P.b:v>5000?P.g:v>0?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{win[i].inCurrentYear?fmt(v):"\u2014"}</td>)}<td></td></tr>

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
          <div style={{ marginLeft:"auto" }}><button onClick={()=>save({...d,cl:[...d.cl,{id:"c"+Date.now(),nm:"New Client",rt:2000,tr:"",vi:"",zh:0,zha:0,tier:"im",seats:0,st:["","","","","","","","","","","",""],nt:{}}]})} style={{ background:P.b,color:"#ffffff",border:"none",borderRadius:6,padding:"8px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:11,fontWeight:700,cursor:"pointer" }}>+ Add Client</button></div>
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
                {(()=>{
                  const fldLbl = { fontSize:10,color:P.td,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6,fontWeight:600 };
                  const fldTx = { background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.tx,fontSize:12,padding:"7px 10px",width:"100%",boxSizing:"border-box",fontFamily:"'DM Sans', sans-serif" };
                  const fldNum = { ...fldTx,color:P.a,fontFamily:"'JetBrains Mono', monospace" };
                  return <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                    <div><div style={fldLbl}>Monthly Rate</div><EditableNumber value={cl.rt} onCommit={v=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,rt:v})})} style={fldNum}/></div>
                    <div><div style={fldLbl}>Term</div><input value={cl.tr||""} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,tr:e.target.value})})} style={fldTx}/></div>
                    <div><div style={fldLbl}>Pay Method</div><select value={cl.payMethod||""} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,payMethod:e.target.value})})} style={{...fldTx,color:cl.payMethod?P.tx:P.td}}><option value="">—</option>{["Stripe","ACH","Check","Wire","CC"].map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                    <div><div style={fldLbl}>Tier</div><select value={cl.tier} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,tier:e.target.value})})} style={fldTx}>{Object.entries(TIERS).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select></div>
                    <div><div style={fldLbl}>Zoho Monthly Comm</div><EditableNumber value={cl.zh||0} onCommit={v=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,zh:v})})} style={{...fldNum,color:P.t}}/></div>
                    <div><div style={fldLbl}>Zoho Annual Comm</div><EditableNumber value={cl.zha||0} onCommit={v=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,zha:v})})} style={{...fldNum,color:P.t}}/></div>
                  </div>;
                })()}
                <div style={{ display:"flex",justifyContent:"space-between",marginTop:16,alignItems:"center",paddingTop:14,borderTop:`1px solid ${P.bd}` }}>
                  <div style={{ fontSize:11,color:P.tm }}>YTD collected: <b style={{ color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{ytd>0?fmt(ytd):"\u2014"}</b></div>
                  <button onClick={()=>save({...d,cl:d.cl.filter((_,i)=>i!==ci)})} style={{ background:"transparent",color:P.r,border:`1px solid ${P.bd}`,borderRadius:4,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans', sans-serif",fontWeight:600 }}>Delete client</button>
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

        {clFilter === "service" && <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:16 }}>
          <KPI label="Collected YTD" value={fmt(d.cl.filter(x=>x.tier!=="ot").reduce((s,x)=>s+x.st.filter(v=>v==="P").length*x.rt,0))} color={P.g}/>
          <KPI label="Late" value={fmt(d.cl.filter(x=>x.tier!=="ot").reduce((s,x)=>s+x.st.filter(v=>v==="L").length*x.rt,0))} color={P.r}/>
          <KPI label="Credits" value={fmt(d.cl.filter(x=>x.tier!=="ot").reduce((s,x)=>s+x.st.filter(v=>v==="C").length*x.rt,0))} color={P.b}/>
        </div>}

        {/* ONE-TIME PROJECTS */}
        <div style={{ marginTop:24 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
            <Lbl>One-Time Projects</Lbl>
            <button onClick={()=>save({...d,cl:[...d.cl,{id:"ot"+Date.now(),nm:"New Project",rt:0,tr:"",vi:"Stripe",zh:0,zha:0,tier:"ot",seats:0,st:["","","","","","","","","","","",""],nt:{},payments:[]}]})} style={{ background:P.b,color:"#ffffff",border:"none",borderRadius:6,padding:"6px 12px",fontFamily:"'DM Sans', sans-serif",fontSize:11,fontWeight:700,cursor:"pointer" }}>+ Add Project</button>
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
            const rowGrid = { display:"grid", gridTemplateColumns:"130px 110px 110px 28px", gap:12, alignItems:"center" };
            const amtInp = { background:P.c1, border:`1px solid ${P.bd}`, borderRadius:4, color:P.a, fontSize:12, fontFamily:"'JetBrains Mono', monospace", padding:"6px 8px", width:"100%", boxSizing:"border-box", textAlign:"right" };
            const selInp = { background:P.c1, border:`1px solid ${P.bd}`, borderRadius:4, color:P.tx, fontSize:12, padding:"6px 8px", width:"100%", boxSizing:"border-box", fontFamily:"'DM Sans', sans-serif" };
            return <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
              {otClients.map(cl=>{
                const ci=cl.origIdx;
                const pays=cl.payments||[];
                const total=pays.reduce((a,p)=>a+(p.amount||0),0);
                const collected=pays.filter(p=>p.status==="P").reduce((a,p)=>a+(p.amount||0),0);
                return <Card key={cl.id} style={{ padding:16 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
                    <input value={cl.nm} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,nm:e.target.value})})} style={{ background:"transparent",border:"none",color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:14,fontWeight:700,flex:1,outline:"none" }}/>
                    <select value={cl.payMethod||""} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,payMethod:e.target.value})})} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:4,color:cl.payMethod?P.tx:P.td,fontSize:11,padding:"5px 8px",fontFamily:"'DM Sans', sans-serif" }}><option value="">Pay method</option>{["Stripe","ACH","Check","Wire","CC"].map(m=><option key={m} value={m}>{m}</option>)}</select>
                    <div style={{ fontSize:12,fontFamily:"'JetBrains Mono', monospace" }}>
                      <span style={{ color:P.g }}>{fmt(collected)}</span>
                      <span style={{ color:P.td }}>{" / "}</span>
                      <span style={{ color:P.tm }}>{fmt(total)}</span>
                    </div>
                    <button onClick={()=>save({...d,cl:d.cl.filter((_,i)=>i!==ci)})} title="Delete project" style={{ background:"transparent",color:P.td,border:"none",fontSize:16,cursor:"pointer",padding:"2px 6px",lineHeight:1 }}>×</button>
                  </div>
                  {pays.length>0 && (
                    <div style={{ ...rowGrid, padding:"4px 0 6px", borderBottom:`1px solid ${P.bd}` }}>
                      <div style={{ fontSize:10,color:P.td,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600 }}>Amount</div>
                      <div style={{ fontSize:10,color:P.td,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600 }}>Month</div>
                      <div style={{ fontSize:10,color:P.td,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600 }}>Status</div>
                      <div/>
                    </div>
                  )}
                  <div style={{ display:"flex",flexDirection:"column" }}>
                    {pays.map((p,pi)=>(
                      <div key={p.id||pi} style={{ ...rowGrid, padding:"8px 0", borderBottom:`1px solid ${P.bd}30` }}>
                        <EditableNumber value={p.amount} onCommit={v=>updPay(ci,pi,{amount:v})} style={amtInp}/>
                        <select value={p.month} onChange={e=>updPay(ci,pi,{month:+e.target.value})} style={selInp}>
                          {MO.map((m,i)=><option key={i} value={i}>{m}</option>)}
                        </select>
                        <div style={{ display:"flex",gap:4 }}>
                          {["P","U","L"].map(v=>(
                            <StatusChip key={v} value={v} selected={p.status===v} onClick={()=>updPay(ci,pi,{status:v})} size={24}/>
                          ))}
                        </div>
                        <button onClick={()=>delPay(ci,pi)} style={{ background:"transparent",color:P.td,border:"none",fontSize:14,cursor:"pointer",padding:0,lineHeight:1 }}>×</button>
                      </div>
                    ))}
                    <button onClick={()=>addPay(ci)} style={{ alignSelf:"flex-start",background:"transparent",color:P.b,border:"none",padding:"10px 0 0",fontSize:12,cursor:"pointer",fontFamily:"'DM Sans', sans-serif",fontWeight:600 }}>+ Add payment</button>
                  </div>
                </Card>;
              })}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12 }}>
                <KPI label="Total Value" value={fmt(totalAll)} color={P.tx}/>
                <KPI label="Collected" value={fmt(collectedAll)} color={P.g}/>
                <KPI label="Outstanding" value={fmt(outstandingAll)} color={P.a}/>
              </div>
            </div>;
          })()}
        </div>
      </>)}

      {/* ===================== CRM ===================== */}
      {tab==="crm"&&(()=>{
        // === Phase C1: Profile view (read-only) ===
        if (crmSelectedId) {
          const cl = d.cl.find(c => c.id === crmSelectedId);
          if (!cl) { setCrmSelectedId(null); return null; }

          const formatDate = (s) => { if (!s) return "—"; const dt = new Date(s); return isNaN(dt) ? s : dt.toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" }); };
          const formatTerm = () => cl.termMonths ? `${cl.termMonths} months` : (cl.tr === "M2M" ? "M2M" : "—");
          const RISK_COLORS = { low: P.g, medium: P.a, high: P.r };
          const PMT_LABEL = { P:"Paid", U:"Unpaid", L:"Late", C:"Credited" };
          const PMT_COLOR = { P: P.g, U: P.a, L: P.r, C: P.b };
          const baseYear = cl.startDate ? new Date(cl.startDate).getFullYear() : new Date().getFullYear();

          let subtitle = "—";
          if (cl.contractType === "retainer") subtitle = `$${(cl.monthlyAmount||0).toLocaleString()}/mo retainer`;
          else if (cl.contractType === "project") {
            const parts = [];
            if (cl.termMonths) parts.push(`${cl.termMonths}-month engagement`);
            if (cl.monthlyAmount) parts.push(`$${cl.monthlyAmount.toLocaleString()}/mo`);
            if (cl.totalContractValue) parts.push(`$${cl.totalContractValue.toLocaleString()} total`);
            subtitle = parts.join(" · ") || "—";
          }
          else if (cl.contractType === "one-time") subtitle = formatCrmAmount(cl);
          else if (cl.contractType === "zoho-only") {
            if (cl.commissionFrequency === "annual") subtitle = `$${(cl.currentCommissionAnnual||0).toLocaleString()}/yr Zoho commission`;
            else subtitle = `$${(cl.currentCommissionMonthly||0).toLocaleString()}/mo Zoho commission`;
          }

          let pmtRows = [];
          if ((cl.payments || []).length > 0) pmtRows = cl.payments.map(p => ({ month:p.month, amount:p.amount, status:p.status }));
          else if (cl.st && cl.st.some(s => s !== "")) pmtRows = cl.st.map((s, i) => s ? { month:i, amount: cl.monthlyAmount || cl.rt || 0, status:s } : null).filter(Boolean);

          const monthNotes = Object.entries(cl.nt || {}).map(([k,v]) => ({ idx:parseInt(k,10), text:v })).filter(e => !isNaN(e.idx)).sort((a,b) => a.idx - b.idx);

          const sectLbl = { fontSize:10,color:P.td,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600,fontFamily:"'DM Sans', sans-serif",marginBottom:14 };
          const fRow = { display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"7px 0",borderBottom:`1px solid ${P.bd}30` };
          const fRowLast = { ...fRow, borderBottom:"none" };
          const fLbl = { color:P.tm,fontSize:12,fontFamily:"'DM Sans', sans-serif" };
          const fVal = { color:P.tx,fontSize:12,fontFamily:"'DM Sans', sans-serif",fontWeight:500 };
          const fValMono = { ...fVal, fontFamily:"'JetBrains Mono', monospace" };
          const cardSty = { padding:18 };

          const headerPill = (s) => {
            const co = STATUS_COLORS[s] || STATUS_COLORS.pipeline;
            return <span style={{ display:"inline-flex",alignItems:"center",gap:7,padding:"5px 12px",borderRadius:13,background:co.bg,color:co.fg,fontSize:12,fontWeight:700,fontFamily:"'DM Sans', sans-serif",textTransform:"capitalize",whiteSpace:"nowrap",letterSpacing:"0.02em" }}><span style={{ width:7,height:7,borderRadius:4,background:co.fg }} />{s || "unknown"}</span>;
          };

          const monthlyDisplay = (cl.contractType === "retainer" || cl.contractType === "project") && cl.monthlyAmount
            ? `$${cl.monthlyAmount.toLocaleString()}` : "—";
          const totalDisplay = cl.totalContractValue ? `$${cl.totalContractValue.toLocaleString()}` : "—";
          const freqDisplay = cl.commissionFrequency ? cl.commissionFrequency.charAt(0).toUpperCase() + cl.commissionFrequency.slice(1) : "—";
          const monthlyCommDisplay = cl.currentCommissionMonthly ? `$${cl.currentCommissionMonthly.toLocaleString()}` : "—";
          const annualCommDisplay = cl.currentCommissionAnnual ? `$${cl.currentCommissionAnnual.toLocaleString()}` : "—";

          return (<>
            {/* Breadcrumb */}
            <button onClick={()=>setCrmSelectedId(null)} style={{ background:"transparent",border:"none",color:P.tm,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans', sans-serif",padding:"6px 0",marginBottom:14 }} onMouseEnter={e=>e.currentTarget.style.color=P.tx} onMouseLeave={e=>e.currentTarget.style.color=P.tm}>← Back to all clients</button>

            {/* Header */}
            <div style={{ marginBottom:22 }}>
              <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap" }}>
                {headerPill(cl.status)}
                <span style={{ fontSize:10,color:P.td,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600,fontFamily:"'DM Sans', sans-serif" }}>{cl.contractType || "—"}</span>
              </div>
              <div style={{ fontSize:24,fontWeight:500,color:P.tx,fontFamily:"'DM Sans', sans-serif",marginBottom:6,letterSpacing:"-0.01em",lineHeight:1.15 }}>{cl.nm}</div>
              <div style={{ fontSize:13,color:P.tm,fontFamily:"'DM Sans', sans-serif" }}>{subtitle}</div>
            </div>

            {/* Contract + Payment grid */}
            <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14 }}>
              <Card style={cardSty}>
                <div style={sectLbl}>Contract</div>
                <div style={fRow}><span style={fLbl}>Type</span><span style={fVal}>{cl.contractType || "—"}</span></div>
                <div style={fRow}><span style={fLbl}>Monthly</span><span style={fValMono}>{monthlyDisplay}</span></div>
                <div style={fRow}><span style={fLbl}>Total</span><span style={fValMono}>{totalDisplay}</span></div>
                <div style={fRow}><span style={fLbl}>Term</span><span style={fVal}>{formatTerm()}</span></div>
                <div style={fRow}><span style={fLbl}>Start</span><span style={fVal}>{formatDate(cl.startDate)}</span></div>
                <div style={fRow}><span style={fLbl}>End</span><span style={fVal}>{formatDate(cl.endDate)}</span></div>
                <div style={fRowLast}><span style={fLbl}>Renewal</span><span style={fVal}>{formatDate(cl.renewalDate)}</span></div>
              </Card>

              <Card style={cardSty}>
                <div style={sectLbl}>Payment</div>
                <div style={fRow}><span style={fLbl}>Method</span><span style={fVal}>{cl.payMethod || "—"}</span></div>
                <div style={fRow}><span style={fLbl}>Terms</span><span style={fVal}>—</span></div>
                <div style={fRow}><span style={fLbl}>Auto-renew</span><span style={fVal}>{cl.autoRenew ? "Yes" : "No"}</span></div>
                <div style={fRowLast}>
                  <span style={fLbl}>Risk</span>
                  <span style={{ ...fVal,color:RISK_COLORS[cl.churnRisk] || P.tm,textTransform:"capitalize",display:"inline-flex",alignItems:"center",gap:6 }}>
                    <span style={{ width:6,height:6,borderRadius:3,background:RISK_COLORS[cl.churnRisk] || P.tm }} />
                    {cl.churnRisk || "—"}
                  </span>
                </div>
              </Card>
            </div>

            {/* Zoho License (zoho-only clients) */}
            {cl.contractType === "zoho-only" && (
              <Card style={{ ...cardSty,marginBottom:14 }}>
                <div style={sectLbl}>Zoho License</div>
                <div style={fRow}><span style={fLbl}>License Type</span><span style={{ ...fVal,color:cl.licenseType?P.tx:P.td,fontStyle:cl.licenseType?"normal":"italic" }}>{cl.licenseType || "Not set"}</span></div>
                <div style={fRow}><span style={fLbl}>Monthly Commission</span><span style={fValMono}>{monthlyCommDisplay}</span></div>
                <div style={fRow}><span style={fLbl}>Annual Commission</span><span style={fValMono}>{annualCommDisplay}</span></div>
                <div style={fRow}><span style={fLbl}>Frequency</span><span style={fVal}>{freqDisplay}</span></div>
                <div style={fRow}><span style={fLbl}>Renewal Date</span><span style={fVal}>{formatDate(cl.zohoRenewalDate)}</span></div>
                <div style={fRowLast}><span style={fLbl}>Commission Note</span><span style={{ ...fVal,color:cl.commissionNote?P.tx:P.td,fontStyle:cl.commissionNote?"normal":"italic" }}>{cl.commissionNote || "—"}</span></div>
              </Card>
            )}

            {/* Payments */}
            <Card style={{ ...cardSty,marginBottom:14 }}>
              <div style={sectLbl}>Payments</div>
              {pmtRows.length === 0 ? (
                <div style={{ color:P.td,fontSize:12,fontFamily:"'DM Sans', sans-serif",fontStyle:"italic",padding:"4px 0" }}>No payments recorded yet.</div>
              ) : (
                <table style={{ width:"100%",borderCollapse:"collapse",fontFamily:"'DM Sans', sans-serif" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign:"left",fontSize:9,color:P.td,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",padding:"6px 0",borderBottom:`1px solid ${P.bd}` }}>Month</th>
                      <th style={{ textAlign:"right",fontSize:9,color:P.td,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",padding:"6px 0",borderBottom:`1px solid ${P.bd}` }}>Amount</th>
                      <th style={{ textAlign:"right",fontSize:9,color:P.td,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",padding:"6px 0",borderBottom:`1px solid ${P.bd}` }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pmtRows.map((p,i) => (
                      <tr key={i}>
                        <td style={{ padding:"8px 0",fontSize:12,color:P.tx,borderBottom:`1px solid ${P.bd}30`,fontFamily:"'DM Sans', sans-serif" }}>{MO[p.month]} {baseYear}</td>
                        <td style={{ padding:"8px 0",fontSize:12,color:P.tx,textAlign:"right",fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}30` }}>{p.amount ? `$${p.amount.toLocaleString()}` : "—"}</td>
                        <td style={{ padding:"8px 0",fontSize:12,textAlign:"right",borderBottom:`1px solid ${P.bd}30` }}>
                          <span style={{ display:"inline-flex",alignItems:"center",gap:6,color:PMT_COLOR[p.status] || P.tm }}>
                            <span style={{ width:6,height:6,borderRadius:3,background:PMT_COLOR[p.status] || P.tm }} />
                            {PMT_LABEL[p.status] || p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Notes */}
            <Card style={cardSty}>
              <div style={sectLbl}>Notes</div>
              <div style={{ color:cl.notes?P.tx:P.td,fontSize:13,fontFamily:"'DM Sans', sans-serif",fontStyle:cl.notes?"normal":"italic",lineHeight:1.5 }}>
                {cl.notes || "No notes."}
              </div>
              {monthNotes.length > 0 && (
                <div style={{ marginTop:14,paddingTop:14,borderTop:`1px solid ${P.bd}` }}>
                  <div style={{ ...sectLbl,marginBottom:10,fontSize:9 }}>Per-month notes</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                    {monthNotes.map(n => (
                      <div key={n.idx} style={{ display:"flex",gap:14,fontSize:12,alignItems:"baseline" }}>
                        <span style={{ color:P.tm,fontFamily:"'JetBrains Mono', monospace",fontSize:11,width:84,flexShrink:0 }}>{MO[n.idx]} {baseYear}</span>
                        <span style={{ color:P.tx,fontFamily:"'DM Sans', sans-serif",lineHeight:1.5 }}>{n.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </>);
        }

        // === Phase B: list view ===
        const filtersList = [["all","All"],["active","Active"],["at-risk","At-Risk"],["churned","Churned"],["one-time","One-Time"],["pipeline","Pipeline"]];
        const showZohoAggregate = (crmFilter === "all" || crmFilter === "active") && zohoTotalCount > 0;
        const filteredNonZoho = d.cl.filter(c => !isZohoCl(c) && matchesCrmFilter(c, crmFilter));
        const zohoAggregate = showZohoAggregate ? { id:"_zoho_agg", _isAggregate:true, nm:"Zoho Commissions", status:"active", contractType:"zoho-only", monthlyAmount: zohoMonthlySum, _count: zohoTotalCount } : null;
        const rowsBeforeSort = zohoAggregate ? [...filteredNonZoho, zohoAggregate] : filteredNonZoho;
        const rows = sortCrmRows(rowsBeforeSort);
        const zohoSorted = sortCrmRows(d.cl.filter(isZohoCl));
        const zohoAmountLabel = (() => {
          const parts = [];
          if (zohoMonthlySum > 0) parts.push(`~$${zohoMonthlySum.toLocaleString()}/mo`);
          if (zohoAnnualSum > 0) parts.push(`~$${zohoAnnualSum.toLocaleString()}/yr`);
          return parts.length ? parts.join(" + ") : "—";
        })();
        const viewBtnSty = { background:"transparent",border:`1px solid ${P.bd}`,borderRadius:6,padding:"4px 10px",color:P.tm,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans', sans-serif",letterSpacing:"0.02em" };
        const thS = { padding:"10px 14px",textAlign:"left",color:P.td,fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"'DM Sans', sans-serif",borderBottom:`1px solid ${P.bd}` };
        const tdS = { padding:"12px 14px",borderBottom:`1px solid ${P.bd}50`,color:P.tx,fontSize:12,fontFamily:"'DM Sans', sans-serif",verticalAlign:"middle" };
        const tdMono = { ...tdS, fontFamily:"'JetBrains Mono', monospace",fontSize:11,color:P.tm };
        return (<>
          {/* Filter pills + sort dropdown */}
          <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center" }}>
            {filtersList.map(([k,l])=>(
              <button key={k} onClick={()=>setCrmFilter(k)} style={{ fontSize:11,color:crmFilter===k?P.tx:P.tm,background:crmFilter===k?P.c2:"transparent",padding:"6px 14px",borderRadius:6,fontWeight:600,border:`1px solid ${crmFilter===k?P.bd:"transparent"}`,cursor:"pointer",fontFamily:"'DM Sans', sans-serif" }}>{l}</button>
            ))}
            <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ fontSize:9,color:P.td,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600 }}>Sort</span>
              <select value={crmSort} onChange={e=>setCrmSort(e.target.value)} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,padding:"6px 12px",color:P.tx,fontSize:11,fontFamily:"'DM Sans', sans-serif",cursor:"pointer" }}>
                <option value="status">Status</option>
                <option value="name">Name</option>
                <option value="type">Type</option>
                <option value="amount">Amount</option>
              </select>
            </div>
          </div>

          {rows.length === 0 ? (
            <Card style={{ padding:36,textAlign:"center" }}>
              <div style={{ color:P.tm,fontSize:13,fontFamily:"'DM Sans', sans-serif",fontWeight:500 }}>No clients match this filter.</div>
              <div style={{ color:P.td,fontSize:11,marginTop:6 }}>Try a different status or contract type.</div>
            </Card>
          ) : isMobile ? (
            /* MOBILE: stacked cards */
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {rows.map(cl => cl._isAggregate ? (
                <Card key={cl.id} style={{ padding:14 }}>
                  <div onClick={()=>setZohoExpanded(!zohoExpanded)} style={{ cursor:"pointer",display:"flex",flexDirection:"column",gap:6 }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                      {statusPill("active")}
                      <span style={{ fontSize:11,color:P.td }}>{zohoExpanded ? "▼" : "▶"} expand</span>
                    </div>
                    <div style={{ fontSize:14,fontWeight:700,color:P.tx,fontFamily:"'DM Sans', sans-serif" }}>Zoho Commissions <span style={{ color:P.td,fontWeight:400,fontSize:11 }}>({cl._count})</span></div>
                    <div style={{ fontSize:10,color:P.td,textTransform:"uppercase",letterSpacing:"0.06em" }}>zoho-only · renewal —</div>
                    <div style={{ fontSize:13,color:P.t,fontFamily:"'JetBrains Mono', monospace",fontWeight:600 }}>{zohoAmountLabel}</div>
                  </div>
                  {zohoExpanded && (
                    <div style={{ marginTop:12,paddingTop:10,borderTop:`1px solid ${P.bd}`,display:"flex",flexDirection:"column",gap:8 }}>
                      {zohoSorted.map(zc => (
                        <div key={zc.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12 }}>
                          <div>
                            <div style={{ color:P.tx,fontWeight:600 }}>{zc.nm}</div>
                            <div style={{ color:P.td,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:2 }}>{zc.commissionFrequency || "monthly"}</div>
                          </div>
                          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                            <span style={{ fontFamily:"'JetBrains Mono', monospace",color:P.tm,fontSize:11 }}>{formatCrmAmount(zc)}</span>
                            <button onClick={()=>setCrmSelectedId(zc.id)} style={viewBtnSty}>View →</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ) : (
                <Card key={cl.id} style={{ padding:14 }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
                    {statusPill(cl.status)}
                    <button onClick={()=>setCrmSelectedId(cl.id)} style={viewBtnSty}>View →</button>
                  </div>
                  <div style={{ fontSize:14,fontWeight:700,color:P.tx,marginBottom:4 }}>{cl.nm}</div>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",fontSize:11,color:P.td,textTransform:"uppercase",letterSpacing:"0.06em" }}>
                    <span>{cl.contractType || "—"}</span>
                    <span>renewal {formatRenewal(cl)}</span>
                  </div>
                  <div style={{ marginTop:6,fontSize:13,color:P.t,fontFamily:"'JetBrains Mono', monospace",fontWeight:600 }}>{formatCrmAmount(cl)}</div>
                </Card>
              ))}
            </div>
          ) : (
            /* DESKTOP: table */
            <Card style={{ padding:0,overflow:"hidden" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontFamily:"'DM Sans', sans-serif" }}>
                <thead>
                  <tr style={{ background:P.c2 }}>
                    <th style={{ ...thS,width:110 }}>Status</th>
                    <th style={thS}>Client</th>
                    <th style={{ ...thS,width:120 }}>Type</th>
                    <th style={{ ...thS,width:230,textAlign:"right" }}>Amount</th>
                    <th style={{ ...thS,width:120 }}>Renewal</th>
                    <th style={{ ...thS,width:90 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(cl => cl._isAggregate ? (
                    <React.Fragment key={cl.id}>
                      <tr onClick={()=>setZohoExpanded(!zohoExpanded)} style={{ cursor:"pointer",background:zohoExpanded?`${P.c2}80`:"transparent" }}>
                        <td style={tdS}>{statusPill("active")}</td>
                        <td style={tdS}><span style={{ display:"inline-flex",alignItems:"center",gap:8 }}><span style={{ color:P.td,fontSize:11,width:12,display:"inline-block" }}>{zohoExpanded?"▼":"▶"}</span><span style={{ fontWeight:700 }}>Zoho Commissions</span><span style={{ color:P.td,fontSize:10,marginLeft:4 }}>({cl._count})</span></span></td>
                        <td style={{ ...tdS,color:P.td,fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em" }}>zoho-only</td>
                        <td style={{ ...tdMono,textAlign:"right",color:P.t,fontWeight:600 }}>{zohoAmountLabel}</td>
                        <td style={tdMono}>—</td>
                        <td style={tdS}></td>
                      </tr>
                      {zohoExpanded && zohoSorted.map(zc => (
                        <tr key={zc.id} style={{ background:`${P.c2}40` }}>
                          <td style={tdS}></td>
                          <td style={{ ...tdS,paddingLeft:42,color:P.tm }}><span style={{ color:P.td,marginRight:8 }}>•</span>{zc.nm}</td>
                          <td style={{ ...tdS,color:P.td,fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em" }}>{zc.commissionFrequency || "monthly"}</td>
                          <td style={{ ...tdMono,textAlign:"right" }}>{formatCrmAmount(zc)}</td>
                          <td style={tdMono}>—</td>
                          <td style={tdS}><button onClick={()=>setCrmSelectedId(zc.id)} style={viewBtnSty}>View →</button></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ) : (
                    <tr key={cl.id} style={{ transition:"background 120ms" }} onMouseEnter={e=>e.currentTarget.style.background=`${P.c2}40`} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={tdS}>{statusPill(cl.status)}</td>
                      <td style={{ ...tdS,fontWeight:600 }}>{cl.nm}</td>
                      <td style={{ ...tdS,color:P.td,fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em" }}>{cl.contractType || "—"}</td>
                      <td style={{ ...tdMono,textAlign:"right" }}>{formatCrmAmount(cl)}</td>
                      <td style={tdMono}>{formatRenewal(cl)}</td>
                      <td style={tdS}><button onClick={()=>setCrmSelectedId(cl.id)} style={viewBtnSty}>View →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>);
      })()}

      {/* ===================== PAYROLL ===================== */}
      {tab==="payroll"&&(<>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:16 }}><div style={{ display:"flex",gap:8 }}>{Object.entries(DC).map(([dd,co])=><span key={dd} style={{ fontSize:10,color:co,fontWeight:600 }}>● {dd}</span>)}</div><div style={{ display:"flex",gap:8 }}><button onClick={()=>setArc(!arc)} style={{ background:P.c2,color:P.tm,border:`1px solid ${P.bd}`,borderRadius:6,padding:"6px 12px",fontFamily:"'DM Sans', sans-serif",fontSize:11,cursor:"pointer" }}>{arc?"Hide":"Show"} Archived</button><button onClick={()=>save({...d,tm:[...d.tm,{id:"p"+Date.now(),nm:"New Hire",rl:"",dp:"Development",ct:"IN",co:0,on:true}]})} style={{ background:P.b,color:"white",border:"none",borderRadius:6,padding:"6px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:11,fontWeight:700,cursor:"pointer" }}>+ Add</button></div></div>
        {["US","PH","IN"].map(ct=>{const pp=d.tm.filter(t=>t.ct===ct&&(t.on||arc));if(!pp.length)return null;const mo=pp.filter(p=>p.on).reduce((s,p)=>s+p.co,0);return(<div key={ct} style={{ marginBottom:20 }}><div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}><span style={{ fontSize:16 }}>{FL[ct]}</span><span style={{ fontSize:13,fontWeight:700 }}>{ct==="US"?"United States":ct==="PH"?"Philippines":"India"}</span><Bdg c="r">{fmt(-mo)}/mo</Bdg></div><div style={{ display:"grid",gap:6 }}>{pp.map(p=>{const pi=d.tm.indexOf(p);return(<div key={p.id} style={{ background:p.on?P.c1:`${P.c1}80`,borderRadius:8,padding:"10px 14px",border:`1px solid ${P.bd}`,display:"flex",alignItems:"center",gap:12,opacity:p.on?1:.4 }}><div style={{ flex:1 }}><div style={{ display:"flex",alignItems:"center",gap:6 }}><input value={p.nm} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,nm:e.target.value};save({...d,tm:nt2});}} style={{ background:"transparent",border:"none",color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:600,width:110 }}/><span style={{ fontSize:9,padding:"1px 6px",borderRadius:3,background:`${DC[p.dp]||P.td}20`,color:DC[p.dp]||P.td,fontWeight:600 }}>{p.dp}</span></div><input value={p.rl||""} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,rl:e.target.value};save({...d,tm:nt2});}} style={{ background:"transparent",border:"none",color:P.tm,fontFamily:"'DM Sans', sans-serif",fontSize:11,marginTop:1 }} placeholder="Role"/></div><select value={p.dp} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,dp:e.target.value};save({...d,tm:nt2});}} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:4,color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:11,padding:4 }}>{["Development","Marketing","Operations","Leadership"].map(dd=><option key={dd}>{dd}</option>)}</select><NumIn value={p.co} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,co:+e.target.value};save({...d,tm:nt2});}} w={70}/><button onClick={()=>{const nt2=[...d.tm];nt2[pi]={...p,on:!p.on};save({...d,tm:nt2});}} style={{ background:"transparent",border:"none",cursor:"pointer",fontSize:14 }} title={p.on?"Archive":"Reactivate"}>{p.on?"\ud83d\udce6":"\u267b\ufe0f"}</button><button onClick={()=>save({...d,tm:d.tm.filter((_,i)=>i!==pi)})} style={{ background:"transparent",border:"none",color:P.rM,cursor:"pointer",fontSize:13 }}>×</button></div>);})}</div></div>);})}
      </>)}




      </div>

      {!isViewer && <SaveBar dirty={dirty} saving={saving} onSave={persist} />}
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {modal&&(<div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }} onClick={()=>setModal(null)}><div onClick={e=>e.stopPropagation()} style={{ background:P.c1,borderRadius:12,padding:24,width:380,border:`1px solid ${P.bd}` }}><div style={{ fontSize:14,fontWeight:700,marginBottom:14 }}>Credit — {d.cl[modal.ci]?.nm} ({MO[modal.mi]})</div><textarea value={nt} onChange={e=>setNt(e.target.value)} placeholder="Reason for credit..." rows={3} style={{ width:"100%",background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:12,padding:10,resize:"vertical",boxSizing:"border-box" }}/><div style={{ display:"flex",gap:8,marginTop:14,justifyContent:"flex-end" }}><button onClick={()=>setModal(null)} style={{ background:P.c2,color:P.tm,border:`1px solid ${P.bd}`,borderRadius:6,padding:"7px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:12,cursor:"pointer" }}>Cancel</button><button onClick={saveCr} style={{ background:P.a,color:P.bg,border:"none",borderRadius:6,padding:"7px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:700,cursor:"pointer" }}>Save</button></div></div></div>)}
    </div>
  );
}