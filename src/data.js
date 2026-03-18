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
  // openBal calibrated so Jan+Feb actuals cascade to Mar 1 opening of $23,231
  openBal: 1309, cashNow: 34571, savings: 0, sLoan: 0, ccOwe: -2800,
  // openBal = actual March 1, 2026 checking balance. Jan+Feb are history.
  // Revenue: Jan+Feb ACTUALS, Mar+ projections
  rv: {
    za: [4581, 17703, 747, 511, 0, 320, 1439, 0, 0, 3706, 0, 240],
    zm: [0, 0, 1057, 1224, 984, 984, 984, 984, 984, 984, 984, 984],
    im: [5453, 4886, 10500, 10500, 10500, 10500, 4500, 6500, 6500, 6500, 6500, 6500],
    mk: [0, 0, 0, 450, 0, 0, 0, 0, 0, 0, 0, 0],
    ot: [7000, 0, 6000, 0, 3000, 3000, 3000, 3000, 0, 0, 0, 0],
  },
  // Subscriptions are on the CREDIT CARD, not checking.
  // They affect cash only through CC Paydown. Listed here for tracking/visibility.
  // The CC Paydown in db[] is what actually hits checking.
  sb: [
    { n: "Canva", a: 15 },{ n: "Microsoft", a: 24 },{ n: "Wix", a: 26 },
    { n: "Regus", a: 114 },{ n: "Claude", a: 200, s: 2 },{ n: "Verizon (CC)", a: 0 },
    { n: "Google WS", a: 121, s: 2 },{ n: "Zoom", a: 53, e: 1 },{ n: "Proton", a: 18, e: 1 },
  ],
  // Other costs — CHECKING ACCOUNT ONLY
  oc: [
    { n: "Chase Fee", v: [-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15] },
    { n: "Wire Fees", v: [0,-15,-15,-15,0,-15,0,-15,0,-15,-15,-15] },
    { n: "Verizon (checking)", v: [-136,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141] },
    { n: "Old Acct Transfer", v: [-398,0,0,0,0,0,0,0,0,0,0,0] },
  ],
  // Debt / CC — these hit the CHECKING account
  db: [
    // CC Paydown = actual checking → CC payments. This is the cash impact of all CC charges.
    { n: "CC Paydown", v: [-77,-800,-2500,-600,-600,-600,-600,-600,-600,-600,-600,-600] },
    // Stripe loan is deducted from Stripe payouts before they hit checking — NOT a separate debit.
    // Revenue numbers already reflect net-of-loan Stripe deposits. So no separate line needed.
    // LearnAll: paying $2500 in Mar, then TBD
    { n: "LearnAll", v: [0,0,-2500,0,0,0,0,0,0,0,0,0] },
  ],
  // ADP employment taxes — hits checking directly
  et: [-523,-1188,-1177,-1177,-1177,-1177,-1177,-1000,-1000,-1000,-1000,-1000],
  // ADP processing fees — hits checking directly
  af: [-82,-192,-85,-170,-170,-170,-170,-170,-170,-170,-170,-170],
  // Wise wire FEES only (total Wise payments minus contractor salaries)
  // Jan: $4,847-$3,738=$1,109. Feb: $4,377-$3,037=$1,340. Mar+: ~$100 est.
  wf: [-1109,-1340,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100],
  tm: [
    { id:"p1",nm:"Paul",rl:"CEO",dp:"Leadership",ct:"US",co:8333,on:true },
    { id:"p2",nm:"Sara",rl:"Intern",dp:"Operations",ct:"US",co:792,on:true,endMo:5 },
    { id:"p3",nm:"Janna",rl:"Mktg Lead",dp:"Marketing",ct:"PH",co:550,on:true },
    { id:"p4",nm:"Mark",rl:"Marketing",dp:"Marketing",ct:"PH",co:273,on:true,startMo:1 },
    { id:"p5",nm:"Jeanna",rl:"Support",dp:"Marketing",ct:"PH",co:276,on:false,startMo:2,endMo:2 },
    { id:"p6",nm:"Soorya",rl:"Lead Dev",dp:"Development",ct:"IN",co:1000,on:true },
    { id:"p7",nm:"Yuva",rl:"Developer",dp:"Development",ct:"IN",co:650,on:true },
    { id:"p8",nm:"Gowtham",rl:"Developer",dp:"Development",ct:"IN",co:288,on:true },
    { id:"p9",nm:"New Dev",rl:"Developer",dp:"Development",ct:"IN",co:750,on:true,startMo:3 },
  ],
  cl: [
    { id:"c1",nm:"Gomes Agency",rt:2000,tr:"12mo",vi:"Stripe",zh:155,zha:0,tier:"im",seats:0,st:["P","P","P","","","","","","","","",""],nt:{} },
    { id:"c2",nm:"Supreme E-Com",rt:2000,tr:"12mo",vi:"ACH",zh:38,zha:0,tier:"im",seats:30,st:["P","P","P","","","","","","","","",""],nt:{} },
    { id:"c3",nm:"380 Guide",rt:2000,tr:"6mo",vi:"Check",zh:0,zha:0,tier:"im",seats:3,st:["","P","U","","","","","","","","",""],nt:{1:"2x $1k checks deposited 2/3"} },
    { id:"c4",nm:"Van Boxel",rt:2000,tr:"12mo",vi:"Stripe",zh:11,zha:0,tier:"im",seats:0,st:["","P","","","","","","","","","",""],nt:{} },
    { id:"c5",nm:"Calco CRM Zen",rt:500,tr:"M2M",vi:"Stripe",zh:0,zha:0,tier:"zen",seats:0,st:["P","P","","","","","","","","","",""],nt:{} },
    { id:"c6",nm:"Next Fab",rt:2000,tr:"6mo",vi:"Stripe",zh:65,zha:0,tier:"im",seats:0,st:["","U","U","","","","","","","","",""],nt:{1:"$1,148 first inv"} },
    // V2.2: Option One — Feb paid, Mar due 3/25, Apr due 4/25. No gaps.
    { id:"c7",nm:"Jose F / Option One",rt:450,tr:"3mo",vi:"Stripe",zh:0,zha:0,tier:"mktg",seats:0,st:["","P","","","","","","","","","",""],nt:{1:"Paid 2/11, 15-day credit. Next: 3/25, 4/25"} },
    // Zoho commission clients with renewal info
    { id:"c8",nm:"HV Health",rt:0,tr:"",vi:"",zh:582,zha:0,tier:"zho",seats:0,zhType:"monthly",st:["","","","","","","","","","","",""],nt:{} },
    { id:"c9",nm:"Michael Grusell",rt:0,tr:"",vi:"",zh:181,zha:0,tier:"zho",seats:0,zhType:"monthly",st:["","","","","","","","","","","",""],nt:{} },
    { id:"c10",nm:"Gomes (Zoho Only)",rt:0,tr:"",vi:"",zh:155,zha:0,tier:"zho",seats:0,zhType:"monthly",st:["","","","","","","","","","","",""],nt:{} },
    { id:"c11",nm:"CloverLeaf",rt:0,tr:"",vi:"",zh:40,zha:0,tier:"zho",seats:0,zhType:"monthly",st:["","","","","","","","","","","",""],nt:{} },
    { id:"c12",nm:"Jeanes",rt:0,tr:"",vi:"",zh:26,zha:0,tier:"zho",seats:0,zhType:"monthly",st:["","","","","","","","","","","",""],nt:{} },
    { id:"c13",nm:"Revele",rt:0,tr:"",vi:"",zh:0,zha:16826,tier:"zho",seats:0,zhType:"annual",st:["","","","","","","","","","","",""],nt:{} },
    { id:"c14",nm:"United Weld",rt:0,tr:"",vi:"",zh:0,zha:3370,tier:"zho",seats:0,zhType:"annual",st:["","","","","","","","","","","",""],nt:{} },
    { id:"c15",nm:"Regenics",rt:0,tr:"",vi:"",zh:0,zha:2078,tier:"zho",seats:0,zhType:"annual",st:["","","","","","","","","","","",""],nt:{} },
  ],
  sc: { nc:1,cs:5,or:3000,oc:1,oq:1,ol:6,op:0.3,oh:500 },
  pt: { nm:"Mark",rl:"VP Strategic Partnerships",bs:500,ezp:5,
    targetComp:100000, // Mark's target annual comp — app works backwards from this
    nzp:10, nzcs:90, // new Zoho: Mark 10%, Company 90% (service + license)
    ops:35, ocs:30, ips:35, // Odoo: Mark/Company/Paul (on PROFIT after dev cost)
    opc:1000,ocq:2,oar:3000,dch:750,cpc:2.5,
    sm:4,nzq:1,
    azr:2000, // avg Zoho service rate per client/mo
    zSeats:15, zSeatPrice:40, zCommPct:18, // license comm = seats × price × comm%
    svcCost:384, // avg dev cost to deliver a Zoho IM client/mo
    dl:3,
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

// Precise runway — extends beyond 12 months, caps at 36, applies 5%/quarter cost creep
export function preciseRunway(bl) {
  // Find first month that goes negative within the 12-month window
  let lastPos = -1;
  for (let i = 0; i < bl.length; i++) {
    if (bl[i] > 0) lastPos = i; else break;
  }
  if (lastPos === -1) return 0;
  // Deficit within 12 months — interpolate
  if (lastPos < bl.length - 1) {
    const posV = bl[lastPos];
    const negV = bl[lastPos + 1];
    const frac = posV / (posV - negV);
    return Math.round((lastPos + 1 + frac) * 4) / 4;
  }
  // All 12 months green — project forward from Dec balance
  // Use avg of last 3 months as base net, then apply 5% quarterly cost creep
  const n3 = bl.length >= 3 ? (bl[bl.length-1] - bl[bl.length-3]) / 2 : bl[bl.length-1] - bl[bl.length-2];
  let balance = bl[bl.length - 1];
  let monthlyNet = n3;
  for (let m = 13; m <= 36; m++) {
    // Every 3 months, expenses creep up 5% (net gets worse)
    if ((m - 12) % 3 === 0) monthlyNet = monthlyNet - Math.abs(monthlyNet) * 0.05;
    balance += monthlyNet;
    if (balance <= 0) {
      // Interpolate the fraction
      const prev = balance - monthlyNet;
      const frac = prev / (prev - balance);
      return Math.round((m - 1 + frac) * 4) / 4;
    }
  }
  return 36; // cap
}

// V2.2: 14-month rolling window — 2 months back + current + 11 ahead
export function getRollingWindow() {
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const startMonth = curMonth - 2; // 2 months back
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