export const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const P = {
  bg: "#111318", c1: "#1a1d24", c2: "#22262e", bd: "#2e3038",
  g: "#7ec89b", gB: "#1b2e24", gM: "#2a5a3f",
  r: "#e08888", rB: "#2e1c1c", rM: "#7a3535",
  a: "#e4b44e", aB: "#2e2714",
  b: "#60a5fa", bB: "#1a2d42",
  p: "#b8a9e8", t: "#6bbfb0",
  tx: "#d8d5ce", tm: "#9b9790", td: "#706c66",
};

export const DC = { Development: P.b, Marketing: P.p, Operations: P.a, Leadership: P.t };
export const FL = { US: "\ud83c\uddfa\ud83c\uddf8", PH: "\ud83c\uddf5\ud83c\udded", IN: "\ud83c\uddee\ud83c\uddf3" };

export const TIERS = {
  im: { l: "Infinity Mirror", c: P.g },
  zen: { l: "Zen Support", c: P.t },
  mktg: { l: "Marketing", c: P.p },
  zho: { l: "Zoho-Commission-Only", c: "#38bdf8" },
  ot: { l: "One-Time", c: P.a },
};

export const PIE_COLORS = { za:"#6bbfb0", zm:"#60a5fa", im:"#e4b44e", mk:"#b8a9e8", ot:"#e08888" };

export const D0 = {
  // Mar 31 ending balance per Chase6692 statement
  openBal: 1309, cashNow: 27776, savings: 0, sLoan: 0, ccOwe: -901,

  // Revenue: Jan+Feb+Mar ACTUALS, Apr+ projections
  // Mar actuals: IM $6,500 | Zoho commissions $7,693.85 (both wires) | Patson Doors OT $6,000
  rv: {
    za: [4581, 17703, 7694, 511, 0, 320, 1439, 0, 0, 3706, 0, 240],
    zm: [0, 0, 0, 1224, 984, 984, 984, 984, 984, 984, 984, 984],
    im: [5453, 4886, 6500, 10500, 10500, 10500, 4500, 6500, 6500, 6500, 6500, 6500],
    mk: [0, 0, 0, 450, 0, 0, 0, 0, 0, 0, 0, 0],
    ot: [7000, 0, 6000, 6250, 0, 0, 0, 0, 0, 0, 0, 0],
    pCruzy:    [0, 0, 0, 0, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000],
    pPatson:   [0, 0, 0, 0, 6667, 6667, 6667, 0, 0, 0, 0, 0],
    pPlastics: [0, 0, 0, 0, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500],
  },

  // Subscriptions on CC — tracked for visibility, cash impact is CC Paydown in db[]
  sb: [
    { n: "Canva", a: 15 },
    { n: "Microsoft", a: 24 },
    { n: "Wix", a: 26 },
    { n: "Regus", a: 114 },
    { n: "Claude (Team)", a: 224, s: 2 },
    { n: "Verizon (CC)", a: 0 },
    { n: "Google WS", a: 121, s: 2 },
    { n: "Zoho Corp", a: 49, s: 2 },
  ],

  // Other costs — checking account only
  oc: [
    { n: "Chase Fee",           v: [-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15] },
    { n: "Wire Fees",           v: [0,-15,-30,-15,0,-15,0,-15,0,-15,-15,-15] },
    { n: "Verizon (checking)",  v: [-136,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141] },
    { n: "Old Acct Transfer",   v: [-398,0,0,0,0,0,0,0,0,0,0,0] },
    // Mark Alberto one-time COO payment via ADP April 15
    { n: "Mark Alberto (COO)",  v: [0,0,0,-5000,0,0,0,0,0,0,0,0] },
    // LearnAll contractor — not paid in Mar, forecasting $3k Apr
    { n: "LearnAll",            v: [0,0,0,-3000,0,0,0,0,0,0,0,0] },
    { n: "RSK Advisors (Tax)",  v: [0,-4944,0,0,0,0,0,0,0,0,0,0] },
    { n: "CC Interest",         v: [0,0,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130] },
  ],

  // Debt / CC — hits checking account
  db: [
    // CC Paydown: Jan $77 actual, Feb $800 actual, Mar $2,500 actual, Apr+ $600 projected
    { n: "CC Paydown", v: [-77,-800,-2500,-600,-600,-600,-600,-600,-600,-600,-600,-600] },
    { n: "Stripe Loan", v: [0,0,0,-400,-400,0,0,0,0,0,0,0] },
  ],

  // ADP employment taxes — Mar actual: $1,723.57 gross - $223.62 refund = $1,499.95
  et: [-523,-1188,-1500,-1177,-1177,-1177,-1177,-1000,-1000,-1000,-1000,-1000],

  // ADP processing fees — Mar actual: $85.48 x2 = $170.96
  // Apr: extra run for Mark Alberto one-time ~$85 additional
  af: [-82,-192,-171,-255,-170,-170,-170,-170,-170,-170,-170,-170],

  // Wise wire FEES only (total Wise debits minus contractor salaries)
  // Mar actual: $3,294.73 total Wise - ~$2,272 salaries = ~$1,023 fees (FX + transfer fees)
  wf: [-1109,-1340,-1023,-100,-100,-100,-100,-100,-100,-100,-100,-100],

  tm: [
    { id:"p1", nm:"Paul",         rl:"CEO",              dp:"Leadership",  ct:"US", co:8333, on:true },
    { id:"p2", nm:"Sara",         rl:"Intern",           dp:"Operations",  ct:"US", co:792,  on:true, endMo:5 },
    { id:"p3", nm:"Janna",        rl:"Mktg Lead",        dp:"Marketing",   ct:"PH", co:550,  on:true },
    { id:"p4", nm:"Mark Atienza", rl:"Marketing",        dp:"Marketing",   ct:"PH", co:273,  on:true, startMo:1 },
    { id:"p5", nm:"Jeanna",       rl:"Support",          dp:"Marketing",   ct:"PH", co:276,  on:false, startMo:2, endMo:2 },
    { id:"p6", nm:"Soorya",       rl:"Lead Dev",         dp:"Development", ct:"IN", co:1000, on:true },
    { id:"p7", nm:"Yuva",         rl:"Developer",        dp:"Development", ct:"IN", co:650,  on:true },
    { id:"p8", nm:"Gowtham",      rl:"Developer",        dp:"Development", ct:"IN", co:288,  on:true },
    { id:"p9", nm:"New Dev",      rl:"Developer",        dp:"Development", ct:"IN", co:750,  on:true, startMo:3 },
    { id:"p10",nm:"Aadrika",      rl:"Contractor",       dp:"Development", ct:"IN", co:1400, on:false, startMo:0, endMo:1 },
  ],

  cl: [
    { id:"c1",  nm:"Gomes Agency",       rt:2000, tr:"12mo", vi:"Stripe", zh:155, zha:0,   tier:"im",  seats:0,  st:["P","P","P","","","","","","","","",""], nt:{} },
    { id:"c2",  nm:"Supreme E-Com",      rt:2000, tr:"12mo", vi:"ACH",    zh:38,  zha:0,   tier:"im",  seats:30, st:["P","P","P","","","","","","","","",""], nt:{} },
    { id:"c3",  nm:"380 Guide",          rt:2000, tr:"6mo",  vi:"Check",  zh:0,   zha:0,   tier:"im",  seats:3,  st:["","P","P","","","","","","","","",""], nt:{1:"2x $1k checks deposited 2/3", 2:"ACH $2,000 Mar 17 — credit applied Feb2-Mar2, paid Mar2-Apr2"} },
    { id:"c4",  nm:"Van Boxel",          rt:2000, tr:"12mo", vi:"Stripe", zh:11,  zha:0,   tier:"im",  seats:0,  st:["","P","","","","","","","","","",""], nt:{} },
    { id:"c5",  nm:"Calco CRM Zen",      rt:500,  tr:"M2M",  vi:"Stripe", zh:0,   zha:0,   tier:"zen", seats:0,  st:["P","P","P","","","","","","","","",""], nt:{} },
    { id:"c6",  nm:"Next Fab",           rt:2000, tr:"6mo",  vi:"Stripe", zh:65,  zha:0,   tier:"im",  seats:0,  st:["","U","U","","","","","","","","",""], nt:{1:"$1,148 first inv"} },
    { id:"c7",  nm:"Jose F / Option One",rt:450,  tr:"3mo",  vi:"Stripe", zh:0,   zha:0,   tier:"mktg",seats:0,  st:["","P","","","","","","","","","",""], nt:{1:"Paid 2/11. Next: 3/25, 4/25"} },
    { id:"c8",  nm:"Patson Doors",       rt:0,    tr:"",     vi:"Stripe", zh:0,   zha:0,   tier:"ot",  seats:0,  st:["","","","","","","","","","","",""], nt:{2:"$6,000 one-time Mar 3"} },
    // Zoho commission clients
    { id:"c9",  nm:"HV Health",          rt:0, tr:"", vi:"", zh:582, zha:0,    tier:"zho", seats:0, zhType:"monthly", st:["","","","","","","","","","","",""], nt:{} },
    { id:"c10", nm:"Michael Grusell",    rt:0, tr:"", vi:"", zh:181, zha:0,    tier:"zho", seats:0, zhType:"monthly", st:["","","","","","","","","","","",""], nt:{} },
    { id:"c11", nm:"Gomes (Zoho Only)",  rt:0, tr:"", vi:"", zh:155, zha:0,    tier:"zho", seats:0, zhType:"monthly", st:["","","","","","","","","","","",""], nt:{} },
    { id:"c12", nm:"CloverLeaf",         rt:0, tr:"", vi:"", zh:40,  zha:0,    tier:"zho", seats:0, zhType:"monthly", st:["","","","","","","","","","","",""], nt:{} },
    { id:"c13", nm:"Jeanes",             rt:0, tr:"", vi:"", zh:26,  zha:0,    tier:"zho", seats:0, zhType:"monthly", st:["","","","","","","","","","","",""], nt:{} },
    { id:"c14", nm:"Revele",             rt:0, tr:"", vi:"", zh:0,   zha:16826,tier:"zho", seats:0, zhType:"annual",  st:["","","","","","","","","","","",""], nt:{} },
    { id:"c15", nm:"United Weld",        rt:0, tr:"", vi:"", zh:0,   zha:3370, tier:"zho", seats:0, zhType:"annual",  st:["","","","","","","","","","","",""], nt:{} },
    { id:"c16", nm:"Regenics",           rt:0, tr:"", vi:"", zh:0,   zha:2078, tier:"zho", seats:0, zhType:"annual",  st:["","","","","","","","","","","",""], nt:{} },
  ],

  sc: { nc:1,cs:5,or:3000,oc:1,oq:1,ol:6,op:0.3,oh:500 },

  pt: { nm:"Mark",rl:"VP Strategic Partnerships",bs:500,ezp:0,
    targetComp:100000,
    orgSvc:15, orgLic:10,
    resSvc:15, resLic:40,
    pkgOrg:3, pkgRes:5,
    nzp:10, nzcs:90, ops:35, ocs:30, ips:35,
    opc:1000,ocq:0,oar:2000,dch:750,cpc:2.5,
    sm:4,nzq:0, azr:2000,
    zSeats:15, zSeatPrice:40, zCommPct:18,
    svcCost:384, dl:3,
    zLeadBonus:false, zLeadMark:40, zLeadCo:60,
    equityTrigger:500000 },

  dh: { cnt:1,avg:750,sm:3,cpc:1.5,rpc:2000,mode:"capacity" },
};

export const fmt = n => {
  if (!n || n === 0) return "\u2014";
  const a = Math.abs(Math.round(n));
  return n < 0 ? `($${a.toLocaleString()})` : `$${a.toLocaleString()}`;
};

export const fK = n => {
  const a = Math.abs(n);
  return a >= 1000 ? (n < 0 ? "-" : "") + "$" + (a / 1000).toFixed(a % 1000 === 0 ? 0 : 1) + "k" : fmt(n);
};

export const sm = a => a.reduce((s, v) => s + v, 0);

// Precise runway — finds when balance goes permanently negative
export function preciseRunway(bl) {
  let lastPermanentPos = -1;
  for (let i = bl.length - 1; i >= 0; i--) {
    if (bl[i] > 0) { lastPermanentPos = i; break; }
  }
  if (lastPermanentPos === -1) {
    for (let i = 0; i < bl.length; i++) {
      if (bl[i] <= 0) {
        if (i === 0) return 0;
        const posV = bl[i-1];
        const negV = bl[i];
        const frac = posV / (posV - negV);
        return Math.round((i - 1 + 1 + frac - 1) * 4) / 4 || 0.25;
      }
    }
    return 0;
  }
  if (lastPermanentPos === bl.length - 1) {
    const n3 = bl.length >= 3 ? (bl[bl.length-1] - bl[bl.length-3]) / 2 : bl[bl.length-1] - bl[bl.length-2];
    let balance = bl[bl.length - 1];
    let monthlyNet = n3;
    for (let m = 13; m <= 24; m++) {
      if ((m - 12) % 3 === 0) monthlyNet = monthlyNet - Math.abs(monthlyNet) * 0.05;
      balance += monthlyNet;
      if (balance <= 0) {
        const prev = balance - monthlyNet;
        const frac = prev / (prev - balance);
        return Math.round((m - 1 + frac) * 4) / 4;
      }
    }
    return 24;
  }
  const posV = bl[lastPermanentPos];
  const negV = bl[lastPermanentPos + 1];
  const frac = posV / (posV - negV);
  return Math.round((lastPermanentPos + 1 + frac) * 4) / 4;
}

// V2.2: 14-month rolling window — 2 months back + current + 11 ahead
export function getRollingWindow() {
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const startMonth = curMonth - 2;
  const win = [];
  for (let i = 0; i < 14; i++) {
    const totalMonth = startMonth + i;
    const month = ((totalMonth % 12) + 12) % 12;
    const yearOffset = totalMonth < 0 ? -1 : Math.floor(totalMonth / 12);
    const year = curYear + yearOffset;
    const isNextYear = year > curYear;
    const label = isNextYear ? `${MO[month]}'${String(year).slice(-2)}` : MO[month];
    const inCurrentYear = year === curYear;
    win.push({ idx:month, month, year, label, isCurrent: month === curMonth && year === curYear, inCurrentYear });
  }
  return win;
}

export function getWinVal(arr, slot, fallback = 0) {
  if (!arr) return fallback;
  if (slot.inCurrentYear) return arr[slot.idx] || 0;
  return fallback;
}
