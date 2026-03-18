import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MO, P, DC, FL, TIERS, PIE_COLORS, D0, fmt, fK, sm, preciseRunway, getRollingWindow, getWinVal } from "./data.js";
/* v2.2 changes: 14-month window, outstanding+runway KPI, commission tab, Zoho splits, Option One fix, Jeanna endMo */
import { loadData, saveData } from "./storage.js";
import { compute, computePartnership, computeDevHire, computeWithOverlays } from "./compute.js";
import { Card, Lbl, Bdg, NumIn, Pie, XRow, Sld, KPI, Toggle } from "./components.jsx";
import { useAuth } from "./AuthContext.jsx";
import LoginPage from "./LoginPage.jsx";
import InternView from "./InternView.jsx";

export default function App() {
  const { user, profile, loading: authLoading, isAdmin, signOut } = useAuth();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [nt, setNt] = useState("");
  const [arc, setArc] = useState(false);
  const [ptab, setPtab] = useState("model");
  const [showPartnership, setShowPartnership] = useState(false);
  const [showDevHire, setShowDevHire] = useState(false);
  const [clExpanded, setClExpanded] = useState(null);
  const [clFilter, setClFilter] = useState("service"); // V2.1: default to service clients
  const [clSort, setClSort] = useState({ key: "totalValue", dir: "desc" });

  useEffect(() => { loadData(D0).then(setD); }, []);
  const save = useCallback((nd) => { setD(nd); saveData(nd); }, []);

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
  if (!isAdmin) return <InternView d={d} save={save} />;

  const c = compute(d);
  const cm = new Date().getMonth();
  // V2.1: Precise decimal runway
  const mg = preciseRunway(c.bl);
  const fd = c.bl.findIndex(b => b <= 0);
  const tRv = sm(c.rv);
  // V2.1: Distinct pie chart colors
  const pieD = [
    { label: "Zoho Annual", value: sm(d.rv.za), color: PIE_COLORS.za },
    { label: "Zoho Monthly", value: sm(d.rv.zm), color: PIE_COLORS.zm },
    { label: "Infinity Mirror", value: sm(d.rv.im), color: PIE_COLORS.im },
    { label: "Marketing", value: sm(d.rv.mk), color: PIE_COLORS.mk },
    { label: "One-Time", value: sm(d.rv.ot), color: PIE_COLORS.ot },
  ];
  const devs = c.at.filter(t => t.dp === "Development");
  const aCl = d.cl.filter(x => x.rt > 0).length;

  const outstanding = d.cl.reduce((s, x) => s + x.st.filter(v => v === "U").length * x.rt, 0);
  const monthlyBurn = Math.abs(sm(c.ex) / 12);
  const extraRunway = monthlyBurn > 0 ? Math.round(outstanding / monthlyBurn * 4) / 4 : 0;
  const runwayIfCollected = Math.round((mg + extraRunway) * 4) / 4;

  const ov = computeWithOverlays(d, { partnership: showPartnership, devHire: showDevHire });

  // V2.1: Zoho commission totals for summary card
  const zhTotal = d.cl.reduce((s, x) => s + (x.zh || 0) * 12 + (x.zha || 0), 0);

  const cyc = (ci, mi) => { const nx = { "": "P", P: "U", U: "C", C: "" }; const s = d.cl[ci].st[mi] || ""; if (nx[s] === "C") { setModal({ ci, mi }); setNt(""); return; } save({ ...d, cl: d.cl.map((x, i) => i !== ci ? x : { ...x, st: x.st.map((v, j) => j === mi ? nx[s] : v) }) }); };
  const saveCr = () => { if (!modal) return; save({ ...d, cl: d.cl.map((x, i) => i !== modal.ci ? x : { ...x, st: x.st.map((v, j) => j === modal.mi ? "C" : v), nt: { ...x.nt, [modal.mi]: nt || "Credit" } }) }); setModal(null); };

  const sSty = s => ({ display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:28,borderRadius:6,cursor:"pointer",userSelect:"none",fontWeight:700,fontSize:11,fontFamily:"'JetBrains Mono', monospace",background:s==="P"?P.gB:s==="U"?P.rB:s==="C"?P.aB:`${P.bd}25`,color:s==="P"?P.g:s==="U"?P.r:s==="C"?P.a:P.td });
  const th = { padding:"5px 6px",textAlign:"right",color:P.td,fontSize:10,borderBottom:`1px solid ${P.bd}`,fontFamily:"'DM Sans', sans-serif",fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em" };
  const thCm = (slot) => ({ ...th, background:slot.isCurrent?P.bB:"transparent",color:slot.isCurrent?P.b:P.td,fontWeight:slot.isCurrent?700:500 });
  const tdCm = (slot) => slot.isCurrent?P.bB:"transparent";

  const tabs = ["dashboard","forecast","clients","payroll","partnerships","dev hire"];
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
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20 }}>
          <div>
            <Lbl>Cash Runway</Lbl>
            <div style={{ display:"flex",alignItems:"baseline",gap:10 }}>
              <span style={{ fontSize:64,fontWeight:800,lineHeight:1,letterSpacing:"-0.04em",color:mg>=9?P.g:mg>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{mg}</span>
              <span style={{ fontSize:16,color:P.tm }}>months green</span>
            </div>
            <div style={{ marginTop:6,color:P.tm,fontSize:12 }}>{fd>=0?<>Deficit: <b style={{ color:P.r }}>{MO[fd]}</b></>:<span style={{ color:P.g }}>Green all year</span>}{" · Dec: "}<b style={{ color:c.bl[11]>0?P.g:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(c.bl[11])}</b></div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:16 }}>
              <Card style={{ padding:12 }}><Lbl>Cash</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cashNow+d.savings)}</div></Card>
              <Card style={{ padding:12 }}><Lbl>Debt</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(Math.abs(d.sLoan+d.ccOwe))}</div></Card>
            </div>
            <Card style={{ padding:12,marginTop:10 }}>
              <Lbl>Outstanding Invoices</Lbl>
              <div style={{ display:"flex",alignItems:"baseline",gap:10 }}>
                <span style={{ fontSize:22,fontWeight:800,color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(outstanding)}</span>
                {outstanding > 0 && <span style={{ fontSize:11,color:P.tm }}>If collected: <b style={{ color:P.g }}>+{extraRunway} ({runwayIfCollected} months)</b></span>}
              </div>
            </Card>
          </div>
          <Card><Lbl>2026 Revenue ({fmt(tRv)})</Lbl><Pie data={pieD}/></Card>
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
      </>)}

      {/* ===================== FORECAST ===================== */}
      {tab==="forecast"&&(<>
        <div style={{ display:"flex",gap:20,marginBottom:16,padding:"10px 14px",background:P.c1,borderRadius:8,border:`1px solid ${P.bd}`,alignItems:"center" }}>
          <span style={{ fontSize:10,color:P.td,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600 }}>Scenario Overlays</span>
          <Toggle label="Partnership Impact" value={showPartnership} onChange={setShowPartnership} color={P.p} />
          <Toggle label="Dev Hire Impact" value={showDevHire} onChange={setShowDevHire} color={P.b} />
        </div>

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
              {[["Zoho Annual",d.rv.za],["Zoho Monthly",d.rv.zm],["Infinity Mirror",d.rv.im],["Marketing",d.rv.mk],["One-Time",d.rv.ot]].map(([l,v])=><tr key={l}><td style={{ padding:"5px 10px",color:P.tm,borderBottom:`1px solid ${P.bd}10` }}>{l}</td>{win.map((s,i)=>{const x=getWinVal(v,s,0);return<td key={i} style={{ padding:"5px 6px",textAlign:"right",color:x>0?P.tm:P.td,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",background:tdCm(s) }}>{s.inCurrentYear?(x>0?fmt(x):"\u2014"):"\u2014"}</td>})}<td style={{ padding:"5px 6px",textAlign:"right",fontWeight:600,color:P.g,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(sm(v))}</td></tr>)}
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
              <tr style={{ fontWeight:700 }}><td style={{ padding:"5px 10px",color:P.r,borderTop:`2px solid ${P.rM}` }}>TOTAL</td>{winVals(c.ex).map((v,i)=><td key={i} style={{ padding:"5px 6px",textAlign:"right",color:P.r,borderTop:`2px solid ${P.rM}`,fontFamily:"'JetBrains Mono', monospace",background:tdCm(win[i]) }}>{win[i].inCurrentYear?fmt(v):"\u2014"}</td>)}<td style={{ padding:"5px 6px",textAlign:"right",color:P.r,borderTop:`2px solid ${P.rM}`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(sm(c.ex))}</td></tr>
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
          {/* SERVICE CLIENTS VIEW — payment tracker */}
          {clFilter === "service" && <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
            <thead><tr>
              <th style={{ ...th,textAlign:"left",width:200,cursor:"pointer" }} onClick={()=>toggleSort("nm")}>Client{sortIcon("nm")}</th>
              <th style={{ ...th,textAlign:"left",width:70 }}>Tier</th>
              <th style={{ ...th,textAlign:"right",width:90,cursor:"pointer" }} onClick={()=>toggleSort("rt")}>Rate{sortIcon("rt")}</th>
              <th style={{ ...th,textAlign:"right",width:100 }}>Zoho</th>
              {win.map((s,i)=><th key={i} style={{ ...th,textAlign:"center",width:34,background:s.isCurrent?P.bB:"transparent",color:s.isCurrent?P.b:P.td,fontWeight:s.isCurrent?700:500 }}>{s.label}</th>)}
              <th style={th}>YTD</th>
              <th style={{ width:24 }}></th>
            </tr></thead>
            <tbody>{filteredClients.map((cl)=>{
              const ci = cl.origIdx;
              const isExp = clExpanded === ci;
              const tier = TIERS[cl.tier]||TIERS.ot;
              const ytd = cl.st.filter(s=>s==="P").length*cl.rt;
              const zhM = cl.zh||0; const zhA = cl.zha||0;
              let zhD = zhM > 0 ? `$${zhM}/mo` : zhA > 0 ? `$${zhA.toLocaleString()}/yr` : null;
              return(<React.Fragment key={cl.id}>
                <tr style={{ cursor:"pointer" }} onClick={()=>setClExpanded(isExp?null:ci)}>
                  <td style={{ padding:"6px 8px",borderBottom:`1px solid ${P.bd}10` }}><div style={{ display:"flex",alignItems:"center",gap:6 }}><span style={{ fontSize:9,color:P.td,transition:"transform 0.15s",transform:isExp?"rotate(90deg)":"rotate(0)",display:"inline-block" }}>▶</span><span style={{ fontWeight:600 }}>{cl.nm}</span></div></td>
                  <td style={{ padding:"6px 8px",borderBottom:`1px solid ${P.bd}10` }}><span style={{ fontSize:9,padding:"2px 6px",borderRadius:3,background:`${tier.c}15`,color:tier.c,fontWeight:600 }}>{tier.l}</span></td>
                  <td style={{ padding:"6px 8px",textAlign:"right",color:cl.rt?P.g:P.td,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{cl.rt?`${fmt(cl.rt)}/mo`:"\u2014"}</td>
                  <td style={{ padding:"6px 8px",textAlign:"right",color:zhD?P.t:P.td,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace",fontSize:11 }}>{zhD||"\u2014"}</td>
                  {win.map((s,wi)=>{const mi=s.idx;const stVal=s.inCurrentYear?(cl.st[mi]||""):"";return<td key={wi} style={{ padding:"2px 1px",textAlign:"center",borderBottom:`1px solid ${P.bd}10`,background:s.isCurrent?P.bB:"transparent" }} onClick={e=>{e.stopPropagation();if(s.inCurrentYear&&cl.rt>0)cyc(ci,mi);}}><div style={sSty(stVal)}>{stVal||"·"}</div></td>})}
                  <td style={{ padding:"6px 8px",textAlign:"right",color:P.g,fontWeight:600,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{ytd>0?fmt(ytd):"\u2014"}</td>
                  <td style={{ borderBottom:`1px solid ${P.bd}10` }} onClick={e=>e.stopPropagation()}><button onClick={()=>save({...d,cl:d.cl.filter((_,i)=>i!==ci)})} style={{ background:"transparent",border:"none",color:P.rM,cursor:"pointer",fontSize:13 }}>×</button></td>
                </tr>
                {isExp && <tr><td colSpan={99} style={{ padding:"0 8px 12px 28px",borderBottom:`1px solid ${P.bd}20` }}>
                  <div style={{ marginTop:8,padding:14,background:P.c2,borderRadius:8,border:`1px solid ${P.bd}`,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10 }}>
                    <div><div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Monthly Rate</div><input type="number" value={cl.rt} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,rt:+e.target.value})})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.a,fontSize:12,fontFamily:"'JetBrains Mono', monospace",padding:"6px 8px",width:"100%",boxSizing:"border-box" }}/></div>
                    <div><div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Term</div><input value={cl.tr||""} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,tr:e.target.value})})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.tx,fontSize:12,padding:"6px 8px",width:"100%",boxSizing:"border-box",fontFamily:"'DM Sans', sans-serif" }}/></div>
                    <div><div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Via</div><input value={cl.vi||""} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,vi:e.target.value})})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.tx,fontSize:12,padding:"6px 8px",width:"100%",boxSizing:"border-box",fontFamily:"'DM Sans', sans-serif" }}/></div>
                    <div><div style={{ fontSize:9,color:P.td,textTransform:"uppercase",marginBottom:3 }}>Tier</div><select value={cl.tier} onChange={e=>save({...d,cl:d.cl.map((x,i)=>i!==ci?x:{...x,tier:e.target.value})})} style={{ background:P.c1,border:`1px solid ${P.bd}`,borderRadius:4,color:P.tx,fontSize:12,padding:"6px 8px",width:"100%",boxSizing:"border-box",fontFamily:"'DM Sans', sans-serif" }}>{Object.entries(TIERS).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select></div>
                  </div>
                </td></tr>}
              </React.Fragment>);
            })}</tbody>
          </table>}

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
          <Card style={{ padding:12 }}><Lbl>Collected YTD</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==="P").length*x.rt,0))}</div></Card>
          <Card style={{ padding:12 }}><Lbl>Overdue</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==="U").length*x.rt,0))}</div></Card>
          <Card style={{ padding:12 }}><Lbl>Credits</Lbl><div style={{ fontSize:22,fontWeight:800,color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(d.cl.reduce((s,x)=>s+x.st.filter(v=>v==="C").length*x.rt,0))}</div></Card>
        </div>}
      </>)}

      {/* ===================== PAYROLL ===================== */}
      {tab==="payroll"&&(<>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:16 }}><div style={{ display:"flex",gap:8 }}>{Object.entries(DC).map(([dd,co])=><span key={dd} style={{ fontSize:10,color:co,fontWeight:600 }}>● {dd}</span>)}</div><div style={{ display:"flex",gap:8 }}><button onClick={()=>setArc(!arc)} style={{ background:P.c2,color:P.tm,border:`1px solid ${P.bd}`,borderRadius:6,padding:"6px 12px",fontFamily:"'DM Sans', sans-serif",fontSize:11,cursor:"pointer" }}>{arc?"Hide":"Show"} Archived</button><button onClick={()=>save({...d,tm:[...d.tm,{id:"p"+Date.now(),nm:"New Hire",rl:"",dp:"Development",ct:"IN",co:0,on:true}]})} style={{ background:P.b,color:"white",border:"none",borderRadius:6,padding:"6px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:11,fontWeight:700,cursor:"pointer" }}>+ Add</button></div></div>
        {["US","PH","IN"].map(ct=>{const pp=d.tm.filter(t=>t.ct===ct&&(t.on||arc));if(!pp.length)return null;const mo=pp.filter(p=>p.on).reduce((s,p)=>s+p.co,0);return(<div key={ct} style={{ marginBottom:20 }}><div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}><span style={{ fontSize:16 }}>{FL[ct]}</span><span style={{ fontSize:13,fontWeight:700 }}>{ct==="US"?"United States":ct==="PH"?"Philippines":"India"}</span><Bdg c="r">{fmt(-mo)}/mo</Bdg></div><div style={{ display:"grid",gap:6 }}>{pp.map(p=>{const pi=d.tm.indexOf(p);return(<div key={p.id} style={{ background:p.on?P.c1:`${P.c1}80`,borderRadius:8,padding:"10px 14px",border:`1px solid ${P.bd}`,display:"flex",alignItems:"center",gap:12,opacity:p.on?1:.4 }}><div style={{ flex:1 }}><div style={{ display:"flex",alignItems:"center",gap:6 }}><input value={p.nm} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,nm:e.target.value};save({...d,tm:nt2});}} style={{ background:"transparent",border:"none",color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:600,width:110 }}/><span style={{ fontSize:9,padding:"1px 6px",borderRadius:3,background:`${DC[p.dp]||P.td}20`,color:DC[p.dp]||P.td,fontWeight:600 }}>{p.dp}</span></div><input value={p.rl||""} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,rl:e.target.value};save({...d,tm:nt2});}} style={{ background:"transparent",border:"none",color:P.tm,fontFamily:"'DM Sans', sans-serif",fontSize:11,marginTop:1 }} placeholder="Role"/></div><select value={p.dp} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,dp:e.target.value};save({...d,tm:nt2});}} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:4,color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:11,padding:4 }}>{["Development","Marketing","Operations","Leadership"].map(dd=><option key={dd}>{dd}</option>)}</select><NumIn value={p.co} onChange={e=>{const nt2=[...d.tm];nt2[pi]={...p,co:+e.target.value};save({...d,tm:nt2});}} w={70}/><button onClick={()=>{const nt2=[...d.tm];nt2[pi]={...p,on:!p.on};save({...d,tm:nt2});}} style={{ background:"transparent",border:"none",cursor:"pointer",fontSize:14 }} title={p.on?"Archive":"Reactivate"}>{p.on?"\ud83d\udce6":"\u267b\ufe0f"}</button><button onClick={()=>save({...d,tm:d.tm.filter((_,i)=>i!==pi)})} style={{ background:"transparent",border:"none",color:P.rM,cursor:"pointer",fontSize:13 }}>×</button></div>);})}</div></div>);})}
      </>)}

      {/* ===================== PARTNERSHIPS ===================== */}
      {tab==="partnerships"&&(<>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20 }}>
          <Card style={{ padding:16,borderLeft:`3px solid ${P.g}` }}>
            <Lbl>Current Runway</Lbl>
            <div style={{ fontSize:36,fontWeight:800,color:mg>=9?P.g:mg>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{mg} <span style={{ fontSize:14,fontWeight:500,color:P.tm }}>months</span></div>
          </Card>
          <Card style={{ padding:16,borderLeft:`3px solid ${P.p}` }}>
            <Lbl>With Partnership</Lbl>
            {(()=>{
              const oBl = c.bl.map((b,i) => b + pm.months[i].cum);
              const oMg = preciseRunway(oBl);
              return <div style={{ fontSize:36,fontWeight:800,color:oMg>=9?P.g:oMg>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{oMg} <span style={{ fontSize:14,fontWeight:500,color:P.tm }}>months</span></div>;
            })()}
          </Card>
        </div>
        <Card style={{ padding:14,marginBottom:20 }}>
          <Lbl>Monthly Impact (Partnership Delta)</Lbl>
          <div style={{ display:"grid",gridTemplateColumns:`repeat(${win.length},1fr)`,gap:3,marginTop:8 }}>
            {win.map((s,i)=>{
              const m = s.inCurrentYear ? pm.months[s.idx] : null;
              const net = m ? m.net : 0;
              return <div key={i} style={{ textAlign:"center",padding:"6px 2px",borderRadius:4,background:net>0?P.gB:net<0?P.rB:m?.inDelay?`${P.a}15`:`${P.bd}20`,fontSize:10 }}>
                <div style={{ color:s.isCurrent?P.b:P.td,fontWeight:s.isCurrent?700:400,fontSize:9 }}>{s.label}</div>
                <div style={{ fontWeight:700,color:m?.inDelay?P.a:net>0?P.g:net<0?P.r:P.td,fontFamily:"'JetBrains Mono', monospace" }}>{m?.inDelay?"ramp":net>0?"+"+fK(net):net<0?fK(net):"\u2014"}</div>
              </div>;
            })}
          </div>
        </Card>

        <div style={{ display:"flex",gap:0,borderBottom:`1px solid ${P.bd}`,marginBottom:16 }}>{["model","scenarios","monthly","splits","config"].map(t=><button key={t} onClick={()=>setPtab(t)} style={{ padding:"10px 14px",cursor:"pointer",border:"none",fontFamily:"'DM Sans', sans-serif",fontSize:10,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase",background:"transparent",color:ptab===t?P.g:P.tm,borderBottom:ptab===t?`2px solid ${P.g}`:"2px solid transparent" }}>{t}</button>)}</div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:16 }}>
          <KPI label={`${pt.nm}'s Target`} value={`$${((pt.targetComp||100000)/1000).toFixed(0)}k/yr`} color={P.g} sub={`$${Math.round((pt.targetComp||100000)/12).toLocaleString()}/mo`}/>
          <KPI label={`${pt.nm}'s Steady Comp`} value={`$${pm.months[11].mComp.toLocaleString()}/mo`} color={pm.months[11].mComp >= (pt.targetComp||100000)/12 ? P.g : P.a} sub={`${Math.round(pm.months[11].mComp*12/1000)}k/yr — ${pm.months[11].mComp >= (pt.targetComp||100000)/12 ? "✓ on target" : `${Math.round((1-pm.months[11].mComp/((pt.targetComp||100000)/12))*100)}% short`}`}/>
          <KPI label="Can I Afford This?" value={pm.ok?(pm.tight?"YES":"TIGHT"):"NO"} color={pm.ok?(pm.tight?P.g:P.a):P.r} sub={`Worst: ${pm.worst>=0?"+":""}$${pm.worst.toLocaleString()}`} warn={!pm.tight}/>
          <KPI label="Breakeven Clients" value={pm.beC===Infinity?"N/A":`${pm.beC} Odoo`} color={P.b} sub="to cover fixed costs"/>
          <KPI label="Breakeven Month" value={pm.breakeven>=0?MO[pm.breakeven]:"Not in 2026"} color={pm.breakeven>=0?P.g:P.r}/>
          <KPI label="Dec Net Impact" value={`${pm.months[11].cum>=0?"+":""}$${pm.months[11].cum.toLocaleString()}`} color={pm.months[11].cum>=0?P.g:P.r}/>
        </div>
        {ptab==="model"&&(<div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20 }}><div><Lbl>Compensation Levers</Lbl><Sld label="Base Salary" value={pt.bs} onChange={v=>setPt("bs",v)} min={0} max={3000} step={50} pre="$" suf="/mo"/><Sld label="Existing Zoho Comm %" value={pt.ezp} onChange={v=>setPt("ezp",v)} min={0} max={25} suf={`% = $${Math.round(984*pt.ezp/100)}/mo`} color={P.a}/><Sld label="New Zoho Service Rev %" value={pt.nzp} onChange={v=>setPt("nzp",v)} min={0} max={30} suf="%" color={P.b}/><Sld label="Start Month" value={pt.sm} onChange={v=>setPt("sm",v)} min={0} max={11} suf={` (${MO[pt.sm]})`} color={P.p}/>{/* V2.1: Revenue delay slider */}<Sld label="Revenue Delay (Ramp-Up)" value={pt.dl||0} onChange={v=>setPt("dl",v)} min={0} max={6} suf={` months (cost starts, revenue waits)`} color={P.a}/><div style={{ height:12 }}/><Lbl>Growth Assumptions</Lbl><Sld label="Odoo Clients / Quarter" value={pt.ocq} onChange={v=>setPt("ocq",v)} min={0} max={8} suf=" clients"/><Sld label="Avg Odoo Client Rev" value={pt.oar} onChange={v=>setPt("oar",v)} min={1000} max={6000} step={250} pre="$" suf="/mo"/><Sld label="New Zoho Clients / Qtr" value={pt.nzq} onChange={v=>setPt("nzq",v)} min={0} max={4} suf=" clients"/><Sld label="Avg Zoho Service Rev" value={pt.azr} onChange={v=>setPt("azr",v)} min={500} max={4000} step={250} pre="$" suf="/mo"/><Sld label="Avg Seats Per Client" value={pt.zSeats||15} onChange={v=>setPt("zSeats",v)} min={5} max={50} suf={` seats × $${pt.zSeatPrice||40} × ${pt.zCommPct||18}% = $${Math.round((pt.zSeats||15)*(pt.zSeatPrice||40)*(pt.zCommPct||18)/100)}/mo comm`} color={P.t}/><Sld label="Service Delivery Cost" value={pt.svcCost||384} onChange={v=>setPt("svcCost",v)} min={200} max={1000} step={50} pre="$" suf="/mo per client" color={P.r}/></div><div><Lbl>Cumulative Cash Impact</Lbl><div style={{ display:"grid",gridTemplateColumns:`repeat(${win.length},1fr)`,gap:2,marginBottom:16 }}>{win.map((s,i)=>{const m=s.inCurrentYear?pm.months[s.idx]:{cum:0,inDelay:false};return<div key={i} style={{ height:34,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono', monospace",opacity:s.inCurrentYear&&s.idx>=pt.sm?1:.3,background:m.inDelay?P.aB:m.cum>0?P.gB:m.cum>-3000?P.aB:P.rB,color:m.inDelay?P.a:m.cum>0?P.g:m.cum>-3000?P.a:P.r }}>{s.inCurrentYear?fK(m.cum):"\u2014"}</div>})}</div><Card style={{ padding:14,marginBottom:12 }}><Lbl>At Full Ramp (December)</Lbl><div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:11,marginTop:8 }}><div><span style={{ color:P.td }}>Odoo clients:</span> <span style={{ fontFamily:"'JetBrains Mono', monospace" }}>{pm.months[11].oC}</span></div><div><span style={{ color:P.td }}>New Zoho:</span> <span style={{ fontFamily:"'JetBrains Mono', monospace" }}>{pm.months[11].nZ}</span></div><div><span style={{ color:P.td }}>Devs needed:</span> <span style={{ color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{pm.months[11].dH} (${pm.months[11].totalDevCost.toLocaleString()}/mo)</span></div><div><span style={{ color:P.td }}>Dev cost/client:</span> <span style={{ fontFamily:"'JetBrains Mono', monospace" }}>${pm.months[11].devCostPerClient.toLocaleString()}/mo</span></div><div><span style={{ color:P.td }}>{pt.nm} gets:</span> <span style={{ color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>${pm.months[11].mComp.toLocaleString()}/mo</span></div><div><span style={{ color:P.td }}>Paul gets:</span> <span style={{ color:P.g,fontFamily:"'JetBrains Mono', monospace" }}>${pm.months[11].oPR.toLocaleString()}/mo</span></div><div><span style={{ color:P.td }}>Company keeps:</span> <span style={{ color:P.b,fontFamily:"'JetBrains Mono', monospace" }}>${pm.months[11].oCR.toLocaleString()}/mo</span></div><div style={{ gridColumn:"1/-1" }}><span style={{ color:P.td }}>Net monthly:</span> <span style={{ color:pm.months[11].net>=0?P.g:P.r,fontWeight:700,fontFamily:"'JetBrains Mono', monospace" }}>{pm.months[11].net>=0?"+":""}${pm.months[11].net.toLocaleString()}/mo</span></div></div></Card><div style={{ padding:14,borderRadius:8,background:P.c1,border:`1px solid ${P.bd}` }}><div style={{ fontSize:10,color:P.td,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8 }}>Partnership Brief</div>{(()=>{
              const zmBase = 984;
              const fixedCost = pt.bs + Math.round(zmBase * pt.ezp / 100);
              const delayCost = fixedCost * (pt.dl || 0) + (pt.opc || 0);
              const cpc = pt.cpc || 2.5;
              const devPerClient = Math.round(pt.dch / cpc);
              const odooProfit = pt.oar - devPerClient;
              const netPerOdooClient = Math.round(odooProfit * ((pt.ocs + pt.ips) / 100));
              const zLicPC = Math.round((pt.zSeats||15)*(pt.zSeatPrice||40)*(pt.zCommPct||18)/100);
              const zohoTotal = pt.azr + zLicPC;
              const zohoProfit = pt.azr - (pt.svcCost || 384) + zLicPC;
              const netPerZohoClient = Math.round(zohoProfit * ((pt.nzcs || 90) / 100));
              const zohoNeeded = Math.ceil(fixedCost / Math.max(netPerZohoClient, 1));
              const odooNeeded = Math.ceil(fixedCost / Math.max(netPerOdooClient, 1));
              const firstRevIdx = pt.sm + (pt.dl || 0);
              const firstRevMonth = firstRevIdx < 12 ? MO[firstRevIdx] : "2027";
              const deadlineIdx = pm.months.findIndex((m, i) => i >= pt.sm && m.cum < -8000);
              const deadline = deadlineIdx >= 0 ? MO[deadlineIdx] : null;
              return <div style={{ fontSize:12,color:P.tm,lineHeight:1.8 }}>
                For <b style={{ color:P.a }}>{pt.nm}</b> to earn <b style={{ color:P.a }}>${pm.months[11].mComp.toLocaleString()}/mo</b> at full ramp, he needs to generate enough new business to cover his fixed cost of <b style={{ color:P.r }}>${fixedCost.toLocaleString()}/mo</b> (base + existing Zoho comm).
                <br/><br/>
                <b style={{ color:P.tx }}>Path 1 — New Zoho clients:</b> Each new client @ ${pt.azr.toLocaleString()}/mo service + ${zLicPC}/mo license comm ({pt.zSeats||15} seats × ${pt.zSeatPrice||40} × {pt.zCommPct||18}%). After ${pt.svcCost||384}/mo delivery cost, profit = ${zohoProfit.toLocaleString()}/mo. Company keeps {pt.nzcs||90}% = <b style={{ color:P.g }}>${netPerZohoClient.toLocaleString()}/mo</b>. Need <b>{zohoNeeded} client{zohoNeeded>1?"s":""}</b> to cover {pt.nm}'s fixed cost.
                <br/>
                <b style={{ color:P.tx }}>Path 2 — Odoo clients:</b> Each Odoo client @ ${pt.oar.toLocaleString()}/mo gross, minus ${devPerClient}/mo dev cost = ${odooProfit.toLocaleString()}/mo profit. Company+Paul keep {pt.ocs+pt.ips}% = <b style={{ color:P.g }}>${netPerOdooClient.toLocaleString()}/mo</b>. Need <b>{odooNeeded} client{odooNeeded>1?"s":""}</b> to break even.
                <br/><br/>
                The first {pt.dl||0} months ({MO[pt.sm]}–{firstRevIdx-1<12?MO[firstRevIdx-1]:"Dec"}) are ramp-up at <b style={{ color:P.r }}>${fixedCost.toLocaleString()}/mo</b> with no revenue. Total investment: <b style={{ color:P.r }}>${delayCost.toLocaleString()}</b>. First revenue expected <b style={{ color:P.g }}>{firstRevMonth}</b>.
                {deadline && <><br/><br/><span style={{ color:P.r,fontWeight:600 }}>If {pt.nm} can't close his first deal by {deadline}, the partnership becomes unsustainable.</span></>}
                {!deadline && <><br/><br/><span style={{ color:P.g }}>At current projections, the partnership stays within budget through December.</span></>}
                {pt.equityTrigger && <><br/><span style={{ color:P.p,fontSize:11 }}>Equity trigger: if annual revenue reaches ${(pt.equityTrigger||500000).toLocaleString()}, ownership discussion opens.</span></>}
              </div>;
            })()}</div></div></div>)}
        {ptab==="scenarios"&&(<div>
          <Sld label={`${pt.nm}'s Target Annual Comp`} value={pt.targetComp||100000} onChange={v=>setPt("targetComp",v)} min={40000} max={200000} step={5000} pre="$" suf={`/yr ($${Math.round((pt.targetComp||100000)/12).toLocaleString()}/mo)`} color={P.a}/>
          <div style={{ marginTop:16 }}>
          {(()=>{
            const targetMo = Math.round((pt.targetComp||100000)/12);
            const baseMo = pt.bs + Math.round(984 * pt.ezp / 100);
            const needed = targetMo - baseMo;
            const zLic = Math.round((pt.zSeats||15)*(pt.zSeatPrice||40)*(pt.zCommPct||18)/100);
            const zohoPerClient = pt.azr + zLic; // total Zoho revenue per client
            const markPerZoho = Math.round(zohoPerClient * (pt.nzp||10) / 100);
            const markPerOdoo = Math.round((pt.oar - pt.dch/(pt.cpc||2.5)) * (pt.ops||35) / 100);
            // Generate scenarios
            const scenarios = [];
            for (let z = 0; z <= 10; z++) {
              for (let o = 0; o <= 8; o++) {
                const markIncome = baseMo + z * markPerZoho + o * markPerOdoo;
                if (markIncome >= targetMo * 0.9 && markIncome <= targetMo * 1.2) {
                  const totalRev = z * zohoPerClient + o * pt.oar;
                  const totalDevs = Math.ceil(o / (pt.cpc||2.5));
                  scenarios.push({ z, o, markIncome, totalRev, totalDevs });
                }
              }
            }
            // Also add pure-zoho and pure-odoo paths
            const pureZoho = Math.ceil(needed / Math.max(markPerZoho, 1));
            const pureOdoo = Math.ceil(needed / Math.max(markPerOdoo, 1));

            return <div>
              <Card style={{ padding:16,marginBottom:16 }}>
                <Lbl>How {pt.nm} Reaches ${(pt.targetComp||100000).toLocaleString()}/yr</Lbl>
                <div style={{ fontSize:12,color:P.tm,lineHeight:1.7,marginTop:8 }}>
                  Base + existing Zoho comm = <b style={{ color:P.tx }}>${baseMo.toLocaleString()}/mo</b> guaranteed. Needs <b style={{ color:P.a }}>${needed.toLocaleString()}/mo</b> more from deals.
                  <br/><br/>
                  Each new Zoho client earns {pt.nm} <b style={{ color:P.t }}>${markPerZoho.toLocaleString()}/mo</b> (10% of ${zohoPerClient.toLocaleString()} service + license).
                  <br/>
                  Each Odoo client earns {pt.nm} <b style={{ color:P.b }}>${markPerOdoo.toLocaleString()}/mo</b> (35% of profit after dev cost).
                </div>
              </Card>
              <Lbl>Paths to Target</Lbl>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:8,marginBottom:16 }}>
                <Card style={{ padding:14,borderLeft:`3px solid ${P.t}` }}>
                  <div style={{ fontSize:10,color:P.td,textTransform:"uppercase",marginBottom:6 }}>Pure Zoho</div>
                  <div style={{ fontSize:28,fontWeight:800,color:P.t,fontFamily:"'JetBrains Mono', monospace" }}>{pureZoho}</div>
                  <div style={{ fontSize:11,color:P.tm }}>Zoho clients needed</div>
                  <div style={{ fontSize:10,color:P.td,marginTop:4 }}>${(pureZoho*zohoPerClient).toLocaleString()}/mo new MRR</div>
                </Card>
                <Card style={{ padding:14,borderLeft:`3px solid ${P.b}` }}>
                  <div style={{ fontSize:10,color:P.td,textTransform:"uppercase",marginBottom:6 }}>Pure Odoo</div>
                  <div style={{ fontSize:28,fontWeight:800,color:P.b,fontFamily:"'JetBrains Mono', monospace" }}>{pureOdoo}</div>
                  <div style={{ fontSize:11,color:P.tm }}>Odoo clients needed</div>
                  <div style={{ fontSize:10,color:P.td,marginTop:4 }}>{Math.ceil(pureOdoo/(pt.cpc||2.5))} dev{Math.ceil(pureOdoo/(pt.cpc||2.5))>1?"s":""} required</div>
                </Card>
                <Card style={{ padding:14,borderLeft:`3px solid ${P.a}` }}>
                  <div style={{ fontSize:10,color:P.td,textTransform:"uppercase",marginBottom:6 }}>Blended (fastest)</div>
                  <div style={{ fontSize:28,fontWeight:800,color:P.a,fontFamily:"'JetBrains Mono', monospace" }}>{scenarios.length > 0 ? scenarios[0].z + "+" + scenarios[0].o : pureZoho}</div>
                  <div style={{ fontSize:11,color:P.tm }}>{scenarios.length>0?`${scenarios[0].z} Zoho + ${scenarios[0].o} Odoo`:`${pureZoho} Zoho`}</div>
                  <div style={{ fontSize:10,color:P.td,marginTop:4 }}>{scenarios.length>0?`${scenarios[0].totalDevs} dev${scenarios[0].totalDevs>1?"s":""} · $${scenarios[0].totalRev.toLocaleString()}/mo`:""}</div>
                </Card>
              </div>

              {scenarios.length > 0 && <>
                <Lbl>All Viable Combos (within 90-120% of target)</Lbl>
                <div style={{ overflowX:"auto",marginTop:8 }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                    <thead><tr>{["Zoho Clients","Odoo Clients","Devs Needed",`${pt.nm}'s Monthly`,"Annual","vs Target"].map(h=><th key={h} style={{ padding:"5px 8px",textAlign:"right",color:P.td,fontSize:9,borderBottom:`1px solid ${P.bd}`,fontFamily:"'DM Sans', sans-serif",fontWeight:500,textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
                    <tbody>{scenarios.slice(0,12).map((s,i)=>{const ann=s.markIncome*12;const pct=Math.round(ann/(pt.targetComp||100000)*100);return<tr key={i}><td style={{ padding:"4px 8px",textAlign:"right",color:P.t,fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10` }}>{s.z}</td><td style={{ padding:"4px 8px",textAlign:"right",color:P.b,fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10` }}>{s.o}</td><td style={{ padding:"4px 8px",textAlign:"right",color:P.a,fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10` }}>{s.totalDevs}</td><td style={{ padding:"4px 8px",textAlign:"right",color:P.tx,fontWeight:600,fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10` }}>${s.markIncome.toLocaleString()}</td><td style={{ padding:"4px 8px",textAlign:"right",fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10`,color:P.tm }}>${ann.toLocaleString()}</td><td style={{ padding:"4px 8px",textAlign:"right",fontWeight:600,fontFamily:"'JetBrains Mono', monospace",borderBottom:`1px solid ${P.bd}10`,color:pct>=100?P.g:P.a }}>{pct}%</td></tr>})}</tbody>
                  </table>
                </div>
              </>}
            </div>;
          })()}
          </div>
        </div>)}
        {ptab==="monthly"&&(<div style={{ overflowX:"auto" }}><table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}><thead><tr>{["Month","","Odoo","Zoho","Comp","Devs","New Rev","Net","Cumul."].map(h=><th key={h} style={{ ...th,fontSize:9 }}>{h}</th>)}</tr></thead><tbody>{pm.months.map((m,i)=>(<tr key={i} style={{ opacity:i>=pt.sm?1:.3 }}><td style={{ padding:"4px 8px",textAlign:"right",borderBottom:`1px solid ${P.bd}10` }}>{MO[i]}</td><td style={{ padding:"4px 8px",textAlign:"center",borderBottom:`1px solid ${P.bd}10`,fontSize:9,color:P.a }}>{m.inDelay?"⏳":""}</td><td style={{ padding:"4px 8px",textAlign:"right",borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{m.oC}</td><td style={{ padding:"4px 8px",textAlign:"right",borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{m.nZ}</td><td style={{ padding:"4px 8px",textAlign:"right",color:P.r,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(m.mComp)}</td><td style={{ padding:"4px 8px",textAlign:"right",color:m.dH?P.a:P.td,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{m.dH}</td><td style={{ padding:"4px 8px",textAlign:"right",color:P.g,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(m.newRev)}</td><td style={{ padding:"4px 8px",textAlign:"right",fontWeight:600,color:m.net>=0?P.g:P.r,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{m.net>=0?"+":""}{fmt(m.net)}</td><td style={{ padding:"4px 8px",textAlign:"right",fontWeight:600,color:m.cum>=0?P.g:P.r,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(m.cum)}</td></tr>))}</tbody></table></div>)}
        {ptab==="splits"&&(<div style={{ maxWidth:600 }}>
          <Lbl>Odoo Revenue Split (must total 100%)</Lbl>
          <Sld label={`${pt.nm}'s Cut`} value={pt.ops} onChange={v=>{const r=100-v;const oR=Math.round(r*pt.ocs/(pt.ocs+pt.ips||1));setPt("ops",v);setTimeout(()=>{setPt("ocs",oR);setPt("ips",r-oR);},0);}} min={0} max={80} suf="%" color={P.a}/>
          <Sld label="Company Cut" value={pt.ocs} onChange={v=>{const r=100-v;const oR=Math.round(r*pt.ops/(pt.ops+pt.ips||1));setPt("ocs",v);setTimeout(()=>{setPt("ops",oR);setPt("ips",r-oR);},0);}} min={0} max={80} suf="%" color={P.b}/>
          <Sld label="Paul's Cut" value={pt.ips} onChange={v=>{const r=100-v;const oR=Math.round(r*pt.ops/(pt.ops+pt.ocs||1));setPt("ips",v);setTimeout(()=>{setPt("ops",oR);setPt("ocs",r-oR);},0);}} min={0} max={80} suf="%" color={P.g}/>
          <div style={{ fontSize:10,color:(pt.ops+pt.ocs+pt.ips)===100?P.g:P.r,marginBottom:12,fontFamily:"'JetBrains Mono', monospace" }}>Total: {pt.ops+pt.ocs+pt.ips}%</div>
          <div style={{ display:"flex",borderRadius:6,overflow:"hidden",height:28,marginBottom:8 }}>{[[pt.ops,P.a,pt.nm],[pt.ocs,P.b,"Company"],[pt.ips,P.g,"Paul"]].map(([v,co,n],i)=><div key={i} style={{ width:`${v}%`,background:co,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#000",transition:"width 0.3s" }}>{v>8?`${v}%`:""}</div>)}</div>
          <div style={{ display:"flex",gap:12,fontSize:10,color:P.tm,marginBottom:20 }}><span><span style={{ display:"inline-block",width:8,height:8,borderRadius:2,background:P.a,marginRight:4 }}/>{pt.nm}</span><span><span style={{ display:"inline-block",width:8,height:8,borderRadius:2,background:P.b,marginRight:4 }}/>Company</span><span><span style={{ display:"inline-block",width:8,height:8,borderRadius:2,background:P.g,marginRight:4 }}/>Paul</span></div>

          {/* V2.2: New Zoho Service Split — separate from Odoo */}
          <div style={{ borderTop:`1px solid ${P.bd}`,paddingTop:16,marginTop:8 }}>
            <Lbl>New Zoho Service Split</Lbl>
            <div style={{ fontSize:11,color:P.tm,marginBottom:12 }}>Internet leads, website, referrals — recurring monthly commissions</div>
            <Sld label={`${pt.nm}'s Commission`} value={pt.nzp||10} onChange={v=>{setPt("nzp",v);setPt("nzcs",100-v);}} min={0} max={50} suf="%" color={P.a}/>
            <Sld label="Company Keeps" value={pt.nzcs||90} onChange={v=>{setPt("nzcs",v);setPt("nzp",100-v);}} min={50} max={100} suf="%" color={P.b}/>
            <div style={{ display:"flex",borderRadius:6,overflow:"hidden",height:20,marginBottom:12 }}><div style={{ width:`${pt.nzp||10}%`,background:P.a,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#000" }}>{(pt.nzp||10)>8?`${pt.nzp||10}%`:""}</div><div style={{ width:`${pt.nzcs||90}%`,background:P.b,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#000" }}>{(pt.nzcs||90)>8?`${pt.nzcs||90}%`:""}</div></div>

            {/* V2.2: Lead bonus toggle */}
            <div style={{ padding:12,borderRadius:8,background:`${P.a}08`,border:`1px solid ${P.a}22`,marginTop:12 }}>
              <Toggle label={`If ${pt.nm} re-establishes Zoho lead flow → ${pt.zLeadMark||40}/${pt.zLeadCo||60} split`} value={pt.zLeadBonus||false} onChange={v=>setPt("zLeadBonus",v)} color={P.a}/>
              {pt.zLeadBonus && <div style={{ marginTop:8 }}><Sld label={`${pt.nm}'s Lead Bonus %`} value={pt.zLeadMark||40} onChange={v=>{setPt("zLeadMark",v);setPt("zLeadCo",100-v);}} min={10} max={60} suf="%" color={P.a}/></div>}
            </div>
          </div>

          <div style={{ borderTop:`1px solid ${P.bd}`,paddingTop:16,marginTop:16 }}>
            <Card style={{ padding:14 }}><Lbl>Per Odoo Client @ ${pt.oar.toLocaleString()}/mo</Lbl><div style={{ fontSize:11,display:"grid",gap:5,marginTop:6 }}><div style={{ color:P.td }}>Gross: ${pt.oar.toLocaleString()}/mo − Dev: ${Math.round(pt.dch/(pt.cpc||2.5)).toLocaleString()}/mo = <b style={{ color:P.tx }}>Profit: ${(pt.oar - Math.round(pt.dch/(pt.cpc||2.5))).toLocaleString()}/mo</b></div><div><span style={{ color:P.a }}>{pt.nm}:</span> <span style={{ fontFamily:"'JetBrains Mono', monospace" }}>${Math.round((pt.oar-pt.dch/(pt.cpc||2.5))*pt.ops/100).toLocaleString()}/mo</span> <span style={{ color:P.td }}>(35% of profit)</span></div><div><span style={{ color:P.g }}>Paul:</span> <span style={{ fontFamily:"'JetBrains Mono', monospace" }}>${Math.round((pt.oar-pt.dch/(pt.cpc||2.5))*pt.ips/100).toLocaleString()}/mo</span> <span style={{ color:P.td }}>(35% of profit)</span></div><div><span style={{ color:P.b }}>Company:</span> <span style={{ fontFamily:"'JetBrains Mono', monospace" }}>${Math.round((pt.oar-pt.dch/(pt.cpc||2.5))*pt.ocs/100).toLocaleString()}/mo</span> <span style={{ color:P.td }}>(30% of profit)</span></div></div></Card>
            <div style={{ marginTop:16 }}><Lbl>Partnership Setup Cost</Lbl><div style={{ display:"flex",gap:8 }}>{[1000,4000].map(v=><button key={v} onClick={()=>setPt("opc",v)} style={{ padding:"8px 20px",borderRadius:6,border:`1px solid ${pt.opc===v?P.g:P.bd}`,background:pt.opc===v?`${P.g}15`:"transparent",color:pt.opc===v?P.g:P.tm,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'JetBrains Mono', monospace" }}>${v.toLocaleString()}</button>)}</div></div>
          </div>
        </div>)}
        {ptab==="config"&&(<div style={{ maxWidth:400 }}><Lbl>Partner Profile</Lbl><div style={{ marginBottom:10,marginTop:8 }}><div style={{ fontSize:10,color:P.td,marginBottom:3 }}>PARTNER NAME</div><input value={pt.nm} onChange={e=>setPt("nm",e.target.value)} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,padding:"8px 12px",color:P.tx,fontSize:12,fontFamily:"'DM Sans', sans-serif",width:"100%" }}/></div><div style={{ marginBottom:12 }}><div style={{ fontSize:10,color:P.td,marginBottom:3 }}>ROLE</div><input value={pt.rl} onChange={e=>setPt("rl",e.target.value)} style={{ background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,padding:"8px 12px",color:P.tx,fontSize:12,fontFamily:"'DM Sans', sans-serif",width:"100%" }}/></div><Sld label="Dev Cost Per Hire" value={pt.dch} onChange={v=>setPt("dch",v)} min={300} max={2000} step={50} pre="$" suf="/mo"/><Sld label="Dev Hire Every N Odoo Clients" value={pt.den} onChange={v=>setPt("den",v)} min={1} max={6} suf=" clients"/><div style={{ marginTop:16,padding:14,borderRadius:8,background:`${P.p}08`,border:`1px solid ${P.p}22` }}><div style={{ fontSize:11,color:P.p,fontWeight:600,marginBottom:4 }}>MENA Partner?</div><div style={{ fontSize:11,color:P.tm }}>Change the name and role above, adjust sliders — same model, different terms.</div></div></div>)}
      </>)}

      {/* ===================== DEV HIRE ===================== */}
      {tab==="dev hire"&&(<>
        {/* V2.1: Mode toggle — Capacity vs Growth */}
        <div style={{ display:"flex",gap:8,marginBottom:20,padding:"10px 14px",background:P.c1,borderRadius:8,border:`1px solid ${P.bd}`,alignItems:"center" }}>
          <span style={{ fontSize:10,color:P.td,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600 }}>Hire Purpose</span>
          {["capacity","growth"].map(m=><button key={m} onClick={()=>setDh("mode",m)} style={{ padding:"6px 14px",borderRadius:6,border:`1px solid ${dh.mode===m?P.b:P.bd}`,background:dh.mode===m?P.bB:"transparent",color:dh.mode===m?P.b:P.tm,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"'DM Sans', sans-serif" }}>{m==="capacity"?"Capacity (keep up)":"Growth (new clients)"}</button>)}
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:20 }}>
          <Card style={{ padding:16,borderLeft:`3px solid ${P.g}` }}>
            <Lbl>Current Runway</Lbl>
            <div style={{ fontSize:36,fontWeight:800,color:mg>=9?P.g:mg>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{mg} <span style={{ fontSize:14,fontWeight:500,color:P.tm }}>months</span></div>
          </Card>
          <Card style={{ padding:16,borderLeft:`3px solid ${P.b}` }}>
            <Lbl>With Hire</Lbl>
            {(()=>{
              const oBl = c.bl.map((b,i) => b + dm.months[i].cum);
              const oMg = preciseRunway(oBl);
              return <div style={{ fontSize:36,fontWeight:800,color:oMg>=9?P.g:oMg>=6?P.a:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{oMg} <span style={{ fontSize:14,fontWeight:500,color:P.tm }}>months</span></div>;
            })()}
          </Card>
          <Card style={{ padding:16,borderLeft:`3px solid ${P.r}` }}>
            <Lbl>Monthly Burn Increase</Lbl>
            <div style={{ fontSize:28,fontWeight:800,color:P.r,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(-dm.totalCost)}<span style={{ fontSize:12,fontWeight:500,color:P.tm }}>/mo</span></div>
          </Card>
        </div>

        {/* V2.1: Context callout for capacity mode */}
        {dh.mode === "capacity" && <div style={{ padding:14,borderRadius:8,background:P.aB,border:`1px solid ${P.a}33`,marginBottom:20 }}>
          <div style={{ fontSize:11,color:P.a,fontWeight:600 }}>Capacity Hire — No New Revenue Assumed</div>
          <div style={{ fontSize:11,color:P.tm,marginTop:4 }}>This hire keeps up with current clients. Pure cost, no revenue offset. Switch to "Growth" to model new client revenue.</div>
        </div>}

        <Card style={{ padding:14,marginBottom:20 }}>
          <Lbl>Monthly Impact (Dev Hire Delta)</Lbl>
          <div style={{ display:"grid",gridTemplateColumns:`repeat(${win.length},1fr)`,gap:3,marginTop:8 }}>
            {win.map((s,i)=>{
              const net = s.inCurrentYear ? dm.months[s.idx].net : 0;
              return <div key={i} style={{ textAlign:"center",padding:"6px 2px",borderRadius:4,background:net>0?P.gB:net<0?P.rB:`${P.bd}20`,fontSize:10 }}>
                <div style={{ color:s.isCurrent?P.b:P.td,fontWeight:s.isCurrent?700:400,fontSize:9 }}>{s.label}</div>
                <div style={{ fontWeight:700,color:net>0?P.g:net<0?P.r:P.td,fontFamily:"'JetBrains Mono', monospace" }}>{net>0?"+":""}{net?fK(net):"\u2014"}</div>
              </div>;
            })}
          </div>
        </Card>

        <div style={{ display:"grid",gridTemplateColumns:"280px 1fr",gap:20 }}><div><Lbl>Hiring Parameters</Lbl><Sld label="Developers to Hire" value={dh.cnt} onChange={v=>setDh("cnt",v)} min={1} max={5} suf=" devs"/><Sld label="Avg Cost / Dev" value={dh.avg} onChange={v=>setDh("avg",v)} min={300} max={2000} step={50} pre="$" suf="/mo"/><Sld label="Start Month" value={dh.sm} onChange={v=>setDh("sm",v)} min={0} max={11} suf={` (${MO[dh.sm]})`} color={P.p}/>{dh.mode==="growth"&&<><Sld label="Clients Per Dev Capacity" value={dh.cpc} onChange={v=>setDh("cpc",v)} min={0.5} max={4} step={0.5} suf=" clients"/><Sld label="Revenue Per New Client" value={dh.rpc} onChange={v=>setDh("rpc",v)} min={500} max={5000} step={250} pre="$" suf="/mo"/></>}</div><div><div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:16 }}><KPI label="Monthly Cost" value={`$${dm.totalCost.toLocaleString()}`} color={P.r}/><KPI label="Capacity Added" value={`${dm.capacity} clients`} color={P.b}/>{dm.isGrowth&&<KPI label="Revenue @ Full Ramp" value={`$${dm.addedRev.toLocaleString()}/mo`} color={P.g}/>}{dm.isGrowth&&<KPI label="Breakeven" value={dm.breakeven>=0?MO[dm.breakeven]:"Not in 2026"} color={dm.breakeven>=0?P.g:P.r}/>}<KPI label="Cost/Client Capacity" value={`$${Math.round(dm.totalCost/Math.max(dm.capacity,0.1)).toLocaleString()}/mo`} color={P.t}/></div><Lbl>Cumulative Cash Impact {dh.mode==="capacity"?"(Pure Cost)":"(3-month ramp)"}</Lbl><div style={{ display:"grid",gridTemplateColumns:`repeat(${win.length},1fr)`,gap:2,marginBottom:16 }}>{win.map((s,i)=>{const m=s.inCurrentYear?dm.months[s.idx]:{cum:0};return<div key={i} style={{ height:34,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono', monospace",opacity:s.inCurrentYear&&s.idx>=dh.sm?1:.3,background:m.cum>0?P.gB:m.cum>-3000?P.aB:P.rB,color:m.cum>0?P.g:m.cum>-3000?P.a:P.r }}>{s.inCurrentYear?fK(m.cum):"\u2014"}</div>})}</div><div style={{ overflowX:"auto" }}><table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}><thead><tr>{["Month",dh.mode==="growth"?"Ramp":"","Rev","Cost","Net","Cumul."].filter(Boolean).map(h=><th key={h} style={{ ...th,fontSize:9 }}>{h}</th>)}</tr></thead><tbody>{dm.months.map((m,i)=>(<tr key={i} style={{ opacity:i>=dh.sm?1:.3 }}><td style={{ padding:"4px 8px",textAlign:"right",borderBottom:`1px solid ${P.bd}10` }}>{MO[i]}</td>{dh.mode==="growth"&&<td style={{ padding:"4px 8px",textAlign:"right",color:P.tm,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{m.ramp?`${Math.round(m.ramp*100)}%`:"\u2014"}</td>}<td style={{ padding:"4px 8px",textAlign:"right",color:P.g,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(m.rev)}</td><td style={{ padding:"4px 8px",textAlign:"right",color:P.r,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{m.cost?fmt(-m.cost):"\u2014"}</td><td style={{ padding:"4px 8px",textAlign:"right",fontWeight:600,color:m.net>=0?P.g:P.r,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{m.net>=0?"+":""}{fmt(m.net)}</td><td style={{ padding:"4px 8px",textAlign:"right",fontWeight:600,color:m.cum>=0?P.g:P.r,borderBottom:`1px solid ${P.bd}10`,fontFamily:"'JetBrains Mono', monospace" }}>{fmt(m.cum)}</td></tr>))}</tbody></table></div><Card style={{ padding:12,marginTop:16 }}><Lbl>Impact on Unit Economics</Lbl><div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:11,marginTop:6 }}><div><span style={{ color:P.td }}>Current devs:</span> <span style={{ fontFamily:"'JetBrains Mono', monospace" }}>{devs.length}</span></div><div><span style={{ color:P.td }}>After hire:</span> <span style={{ color:P.b,fontFamily:"'JetBrains Mono', monospace" }}>{devs.length+dh.cnt}</span></div><div><span style={{ color:P.td }}>Clients/dev:</span> <span style={{ color:P.t,fontFamily:"'JetBrains Mono', monospace" }}>{((aCl+(dm.isGrowth?dm.capacity:0))/(devs.length+dh.cnt)).toFixed(1)}</span></div></div></Card></div></div>
      </>)}

      </div>

      {modal&&(<div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }} onClick={()=>setModal(null)}><div onClick={e=>e.stopPropagation()} style={{ background:P.c1,borderRadius:12,padding:24,width:380,border:`1px solid ${P.bd}` }}><div style={{ fontSize:14,fontWeight:700,marginBottom:14 }}>Credit — {d.cl[modal.ci]?.nm} ({MO[modal.mi]})</div><textarea value={nt} onChange={e=>setNt(e.target.value)} placeholder="Reason for credit..." rows={3} style={{ width:"100%",background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,color:P.tx,fontFamily:"'DM Sans', sans-serif",fontSize:12,padding:10,resize:"vertical",boxSizing:"border-box" }}/><div style={{ display:"flex",gap:8,marginTop:14,justifyContent:"flex-end" }}><button onClick={()=>setModal(null)} style={{ background:P.c2,color:P.tm,border:`1px solid ${P.bd}`,borderRadius:6,padding:"7px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:12,cursor:"pointer" }}>Cancel</button><button onClick={saveCr} style={{ background:P.a,color:P.bg,border:"none",borderRadius:6,padding:"7px 14px",fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:700,cursor:"pointer" }}>Save</button></div></div></div>)}
    </div>
  );
}