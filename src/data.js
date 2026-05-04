export const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const P = {
  bg: "#111318", c1: "#171b24", c2: "#1e2230", bd: "#283040",
  g: "#6ab87f", gB: "#1a2820", gM: "#2f5a42",
  r: "#d06060", rB: "#281a1a", rM: "#6a3030",
  a: "#d4a94e", aB: "#28221a",
  b: "#60a5fa", bB: "#1a2538",
  p: "#b8a9e8", t: "#6bbfb0",
  tx: "#dee4f0", tm: "#8090a8", td: "#4a5478",
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
  openBal: 1309, cashNow: 24361.66, savings: 50, sLoan: 0, ccOwe: -9553.37,

  // Revenue: derived from cl[] (im/za/zm) + manual rv.mk/pCruzy/pPatson + rv.ot from cl[].payments
  // Q1 2026 actuals (idx 0-3) preserved in rvActuals; idx 4+ derived from clients
  rv: {
    mk: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ot: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    pCruzy:    [0, 0, 0, 0, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    pPatson:   [0, 0, 0, 0, 6667, 6667, 6667, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },

  // Q1 2026 actuals — overrides derived rv per-stream for idx 0-3 only
  rvActuals: {
    im: { 0: 5453, 1: 4886, 2: 6500, 3: 10500 },
    za: { 0: 4581, 1: 17703, 2: 7694, 3: 511 },
    zm: { 0: 0, 1: 0, 2: 0, 3: 1224 },
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
    { n: "Chase Fee",           v: [-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15] },
    { n: "Wire Fees",           v: [0,-15,-30,-15,0,-15,0,-15,0,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15,-15] },
    { n: "Verizon (checking)",  v: [-136,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141,-141] },
    { n: "Old Acct Transfer",   v: [-398,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    // Mark Alberto one-time COO payment via ADP April 15
    { n: "Mark Alberto (COO)",  v: [0,0,0,-5000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    // LearnAll contractor — not paid in Mar, forecasting $3k Apr
    { n: "LearnAll",            v: [0,0,0,-3000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    // RSK 2026 ($4,944) paid by CC on 2/4 — captured in ccOwe, not oc[]. Future RSK obligations should go here.
    { n: "RSK Advisors (Tax)",  v: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    { n: "CC Interest",         v: [0,0,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130,-130] },
  ],

  // Debt / CC — hits checking account
  db: [
    // CC Paydown: Jan $77, Feb $800, Mar $2,500, Apr $2,000 actuals; May+ $600/mo baseline
    { n: "CC Paydown", v: [-77,-800,-2500,-2000,-600,-600,-600,-600,-600,-600,-600,-600,-600,-600,-600,-600,-600,-600,-600,-600,-600,-600,-600,-600] },
    // Stripe loan repaid via 20% of payout transactions, netted from rv.za revenue. No separate cash outflow line needed.
    { n: "Stripe Loan", v: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  ],

  // ADP employment taxes — Mar actual: $1,723.57 gross - $223.62 refund = $1,499.95
  et: [-523,-1188,-1500,-1177,-1177,-1177,-1177,-1000,-1000,-1000,-1000,-1000,-1000,-1000,-1000,-1000,-1000,-1000,-1000,-1000,-1000,-1000,-1000,-1000],

  // ADP processing fees — Mar actual: $85.48 x2 = $170.96
  // Apr: extra run for Mark Alberto one-time ~$85 additional
  af: [-82,-192,-171,-255,-170,-170,-170,-170,-170,-170,-170,-170,-170,-170,-170,-170,-170,-170,-170,-170,-170,-170,-170,-170],

  // Wise wire FEES only (total Wise debits minus contractor salaries)
  // Mar actual: $3,294.73 total Wise - ~$2,272 salaries = ~$1,023 fees (FX + transfer fees)
  wf: [-1109,-1340,-1023,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100,-100],

  // Salaries reflect May 2026 rates; co is a flat monthly value applied from startMo onward
  // (see compute.js for hardcoded Q1 special cases on Paul, Sara, Janna, Soorya).
  tm: [
    { id:"p1", nm:"Paul",            rl:"CEO",          dp:"Leadership",  ct:"US", co:9167, on:true },
    // Sara: hourly variable, ~16hrs/wk @ $12 = $832/mo. May go FT — endMo removed for long-term retention.
    { id:"p2", nm:"Sara",            rl:"Intern",       dp:"Operations",  ct:"US", co:832,  on:true },
    { id:"p3", nm:"Janna",           rl:"Mktg Lead",    dp:"Marketing",   ct:"PH", co:556,  on:true },
    { id:"p4", nm:"Mark Atienza",    rl:"Marketing",    dp:"Marketing",   ct:"PH", co:276,  on:true, startMo:1 },
    { id:"p5", nm:"Jeanna",          rl:"Support",      dp:"Marketing",   ct:"PH", co:276,  on:false, startMo:2, endMo:2 },
    { id:"p6", nm:"Soorya",          rl:"Lead Dev",     dp:"Development", ct:"IN", co:1089, on:true },
    { id:"p7", nm:"Yuva",            rl:"Developer",    dp:"Development", ct:"IN", co:1089, on:true },
    { id:"p8", nm:"Gowtham",         rl:"Developer",    dp:"Development", ct:"IN", co:308,  on:true },
    { id:"p10",nm:"Aadrika",         rl:"Contractor",   dp:"Development", ct:"IN", co:1400, on:false, startMo:0, endMo:1 },
    // Ravindar — full-time India dev, ₹96K/mo. April was 3 days only; May = official start.
    { id:"p11",nm:"Ravindar Madastu",rl:"Developer",    dp:"Development", ct:"IN", co:1136, on:true, startMo:4 },
    // Shanee — full-time India, ₹40K/mo. Started May.
    { id:"p12",nm:"Shanee Patel",    rl:"Developer",    dp:"Development", ct:"IN", co:473,  on:true, startMo:4 },
    // Mark Alberto — variable comp, manage via scenarios. April $5K one-time tracked in oc[].
    { id:"p13",nm:"Mark Alberto",    rl:"COO (var)",    dp:"Leadership",  ct:"US", co:0,    on:true, startMo:3 },
  ],

  cl: [
    {
      id: "c1", nm: "Gomes Agency", notes: "",
      payments: [],
      st: ["P","P","P","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: {
        type: "retainer", segment: "infinityMirror", monthlyAmount: 2000, totalContractValue: null, termMonths: 12,
        startDate: null, endDate: null, renewalDate: null, autoRenew: false,
        payMethod: "Stripe", status: "active", churnRisk: "low", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-01-15", amount: 2000, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-02-15", amount: 2000, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-03-15", amount: 2000, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-05-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-10-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-11-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-12-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-01-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-02-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-03-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-04-15", amount: 2000, paid: false, paidDate: null, note: "" }
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c2", nm: "Supreme E-Com", notes: "",
      payments: [],
      st: ["P","P","P","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: {
        type: "retainer", segment: "infinityMirror", monthlyAmount: 2000, totalContractValue: null, termMonths: 12,
        startDate: null, endDate: null, renewalDate: null, autoRenew: false,
        payMethod: "ACH", status: "active", churnRisk: "low", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-01-15", amount: 2000, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-02-15", amount: 2000, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-03-15", amount: 2000, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-05-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-10-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-11-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-12-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-01-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-02-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-03-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-04-15", amount: 2000, paid: false, paidDate: null, note: "" }
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c3", nm: "380 Guide", notes: "29 days late on April invoice.",
      payments: [],
      st: ["","P","P","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: {
        type: "retainer", segment: "infinityMirror", monthlyAmount: 2000, totalContractValue: null, termMonths: 6,
        startDate: null, endDate: null, renewalDate: null, autoRenew: false,
        payMethod: "Check", status: "at-risk", churnRisk: "medium", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-02-15", amount: 2000, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-03-15", amount: 2000, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-05-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-10-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-11-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-12-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-01-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-02-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-03-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-04-15", amount: 2000, paid: false, paidDate: null, note: "" }
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },
    // AT RISK — 2 months late + service complaints. inForecast:false until resolved.
    {
      id: "c4", nm: "Van Boxel", notes: "2 months late + service complaints. Removed from rv.im[] forecast pending resolution.",
      payments: [],
      st: ["","P","L","L","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: {
        type: "retainer", segment: "infinityMirror", monthlyAmount: 2000, totalContractValue: null, termMonths: 12,
        startDate: null, endDate: null, renewalDate: null, autoRenew: false,
        payMethod: "Stripe", status: "at-risk", churnRisk: "high", inForecast: false,
        paymentSchedule: [
          { dueDate: "2026-02-15", amount: 2000, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-03-15", amount: 2000, paid: false, paidDate: null, note: "Late" },
          { dueDate: "2026-04-15", amount: 2000, paid: false, paidDate: null, note: "Late" },
          { dueDate: "2026-05-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-10-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-11-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-12-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-01-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-02-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-03-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-04-15", amount: 2000, paid: false, paidDate: null, note: "" }
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c5", nm: "Calco CRM Zen", notes: "",
      payments: [],
      st: ["P","P","P","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: {
        type: "retainer", segment: "infinityMirror", monthlyAmount: 500, totalContractValue: null, termMonths: null,
        startDate: null, endDate: null, renewalDate: null, autoRenew: false,
        payMethod: "Stripe", status: "active", churnRisk: "low", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-01-15", amount: 500, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-02-15", amount: 500, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-03-15", amount: 500, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-05-15", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-15", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-15", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-15", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-15", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-10-15", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-11-15", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-12-15", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-01-15", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-02-15", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-03-15", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-04-15", amount: 500, paid: false, paidDate: null, note: "" }
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c6", nm: "Next Fab", notes: "",
      payments: [],
      st: ["","P","P","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: {
        type: "retainer", segment: "infinityMirror", monthlyAmount: 2000, totalContractValue: null, termMonths: 6,
        startDate: null, endDate: null, renewalDate: null, autoRenew: false,
        payMethod: "Stripe", status: "active", churnRisk: "low", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-02-15", amount: 2000, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-03-15", amount: 2000, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-05-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-10-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-11-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-12-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-01-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-02-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-03-15", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-04-15", amount: 2000, paid: false, paidDate: null, note: "" }
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c7", nm: "Jose F / Option One", notes: "Refused photographer engagement. Treat as closed.",
      payments: [{ id: "c7p1", amount: 450, month: 1, status: "P", kind: "service" }],
      st: ["","P","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: {
        type: "one-time", segment: "scopeOnly", monthlyAmount: 0, totalContractValue: null, termMonths: null,
        startDate: null, endDate: null, renewalDate: null, autoRenew: false,
        payMethod: "Stripe", status: "churned", churnRisk: "low", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-02-15", amount: 450, paid: true, paidDate: null, note: "" }
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c18", nm: "Urban Operating", notes: "",
      payments: [{ id: "c18p1", amount: 7000, month: 0, status: "P", kind: "service" }],
      st: ["","","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: {
        type: "one-time", segment: "scopeOnly", monthlyAmount: 0, totalContractValue: null, termMonths: null,
        startDate: null, endDate: null, renewalDate: null, autoRenew: false,
        payMethod: "", status: "active", churnRisk: "low", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-01-15", amount: 7000, paid: true, paidDate: null, note: "" }
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c8", nm: "Patson Doors", notes: "",
      payments: [{ id: "c8p1", amount: 6000, month: 2, status: "P", kind: "service" }],
      st: ["","","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: {
        type: "one-time", segment: "scopeOnly", monthlyAmount: 0, totalContractValue: null, termMonths: null,
        startDate: null, endDate: null, renewalDate: null, autoRenew: false,
        payMethod: "Stripe", status: "active", churnRisk: "low", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-03-15", amount: 6000, paid: true, paidDate: null, note: "" }
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c17", nm: "CoverFour", notes: "",
      payments: [{ id: "c17p1", amount: 3125, month: 3, status: "P", kind: "service" }, { id: "c17p2", amount: 3125, month: 4, status: "U", kind: "service" }],
      st: ["","","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: {
        type: "one-time", segment: "scopeOnly", monthlyAmount: 0, totalContractValue: null, termMonths: null,
        startDate: null, endDate: null, renewalDate: null, autoRenew: false,
        payMethod: "Stripe", status: "active", churnRisk: "low", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-04-15", amount: 3125, paid: true, paidDate: null, note: "" },
          { dueDate: "2026-05-15", amount: 3125, paid: false, paidDate: null, note: "" }
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },
    // 5-month engagement at $12K/mo, May–Sep 2026.
    {
      id: "c19", nm: "Plastics Products Mfg", notes: "",
      payments: [],
      st: ["","","","","U","U","U","U","U","","","","","","","","","","","","","","",""],
      serviceContract: {
        type: "project", segment: "fullProject", monthlyAmount: 12000, totalContractValue: 60000, termMonths: 5,
        startDate: "2026-05-01", endDate: "2026-09-30", renewalDate: null, autoRenew: false,
        payMethod: "Wire", status: "active", churnRisk: "low", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-05-15", amount: 12000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-15", amount: 12000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-15", amount: 12000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-15", amount: 12000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-15", amount: 12000, paid: false, paidDate: null, note: "" }
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },
    // Zoho commission clients
    {
      id: "c9", nm: "HV Health", notes: "",
      payments: [],
      st: ["","","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: null,
      zohoCommission: {
        licenseType: null, monthlyAmount: 582, annualAmount: 0, frequency: "monthly",
        renewalDate: null, renewalMonth: null, seats: 0, note: "",
        status: "active", inForecast: true,
      },
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c10", nm: "Michael Grusell", notes: "",
      payments: [],
      st: ["","","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: null,
      zohoCommission: {
        licenseType: null, monthlyAmount: 181, annualAmount: 0, frequency: "monthly",
        renewalDate: null, renewalMonth: null, seats: 0, note: "",
        status: "active", inForecast: true,
      },
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c11", nm: "Gomes (Zoho Only)", notes: "",
      payments: [],
      st: ["","","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: null,
      zohoCommission: {
        licenseType: null, monthlyAmount: 155, annualAmount: 0, frequency: "monthly",
        renewalDate: null, renewalMonth: null, seats: 0, note: "",
        status: "active", inForecast: true,
      },
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c12", nm: "CloverLeaf", notes: "",
      payments: [],
      st: ["","","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: null,
      zohoCommission: {
        licenseType: null, monthlyAmount: 40, annualAmount: 0, frequency: "monthly",
        renewalDate: null, renewalMonth: null, seats: 0, note: "",
        status: "active", inForecast: true,
      },
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c13", nm: "Jeanes", notes: "",
      payments: [],
      st: ["","","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: null,
      zohoCommission: {
        licenseType: null, monthlyAmount: 26, annualAmount: 0, frequency: "monthly",
        renewalDate: null, renewalMonth: null, seats: 0, note: "",
        status: "active", inForecast: true,
      },
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c14", nm: "Revele", notes: "",
      payments: [],
      st: ["","","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: null,
      zohoCommission: {
        licenseType: null, monthlyAmount: 0, annualAmount: 16826, frequency: "annual",
        renewalDate: null, renewalMonth: null, seats: 0, note: "",
        status: "active", inForecast: true,
      },
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c15", nm: "United Weld", notes: "",
      payments: [],
      st: ["","","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: null,
      zohoCommission: {
        licenseType: null, monthlyAmount: 0, annualAmount: 3370, frequency: "annual",
        renewalDate: null, renewalMonth: null, seats: 0, note: "",
        status: "active", inForecast: true,
      },
      lastEditedAt: null, lastEditedBy: null,
    },
    {
      id: "c16", nm: "Regenics", notes: "",
      payments: [],
      st: ["","","","","","","","","","","","","","","","","","","","","","","",""],
      serviceContract: null,
      zohoCommission: {
        licenseType: null, monthlyAmount: 0, annualAmount: 2078, frequency: "annual",
        renewalDate: null, renewalMonth: null, seats: 0, note: "",
        status: "active", inForecast: true,
      },
      lastEditedAt: null, lastEditedBy: null,
    },
  ],

  // Scenario rows — speculative revenue/expense items for what-if modeling
  // Each: { id, name, type:"revenue"|"expense", amount (positive), startMo (0-23), duration (months, 0=ongoing through end), on:true }
  scenarios: [],

  // Month-end actuals — populated by reconciliation (bank statement upload)
  // Keyed by month index (0=Jan, 1=Feb, etc.)
  // Each: { closingBal, totalIn, totalOut, chaseIn, chaseOut, stripeIn, stripeLoan, wiseOut, ccSpend, reconDate }
  actuals: {},
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
