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
export const FL = { US: "🇺🇸", PH: "🇵🇭", IN: "🇮🇳" };

// Phase E2b: TIERS retained as stub for any stray imports during E2b cleanup.
// The dead block in App.jsx that consumed it is removed in this commit.
export const TIERS = {};

export const PIE_COLORS = { za:"#6bbfb0", zm:"#60a5fa", im:"#e4b44e", mk:"#b8a9e8", ot:"#e08888" };

export const D0 = {
  // Mar 31 ending balance per Chase6692 statement
  openBal: 1309, cashNow: 24361.66, savings: 50, sLoan: 0, ccOwe: -9553.37,

  // Revenue: derived from cl[] (im/za/zm/ot) + manual rv.mk/pCruzy/pPatson
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

  // Phase E2b — full rebuild from authoritative spreadsheet (2026-05-04).
  // 22 clients, clean IDs c1..c22. Schema:
  //   id, nm, email, notes
  //   serviceContract: null | { type, segment, monthlyAmount, monthlyRenewalDay, startDate, endDate, status, inForecast, paymentSchedule }
  //   zohoCommission: null | { zohoProduct, licenses, frequency, monthlyAmount, annualAmount, renewalDate, renewalDay, status, inForecast, note }
  //   lastEditedAt, lastEditedBy (null on rebuild)
  // Service types: retainer | support-retainer | bank-of-hours | project | one-time
  // Segments:      infinityMirror | supportRetainer | bankOfHours | fullProject | zohoCommissionOnly | oneTime
  cl: [
    // c1 Gomes Agency — Infinity Mirror, end Dec 19. Late Apr.
    {
      id: "c1", nm: "Gomes Agency", email: "jake@gomesagency.com",
      notes: "Late on April payment, no update despite contact attempts",
      serviceContract: {
        type: "retainer", segment: "infinityMirror",
        monthlyAmount: 2000, monthlyRenewalDay: 19,
        startDate: null, endDate: "2026-12-19",
        status: "active", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-01-19", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-02-19", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-03-19", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-04-19", amount: 2000, paid: false, paidDate: null, note: "Late" },
          { dueDate: "2026-05-19", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-19", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-19", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-19", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-19", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-10-19", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-11-19", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-12-19", amount: 2000, paid: false, paidDate: null, note: "" },
        ],
      },
      zohoCommission: {
        zohoProduct: "One", licenses: 21,
        frequency: "monthly", monthlyAmount: 810, annualAmount: 0,
        renewalDate: null, renewalDay: 5,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c2 Supreme Ecom — Infinity Mirror, end Feb 3 2027.
    {
      id: "c2", nm: "Supreme Ecom", email: "systems@supremeecom.com",
      notes: "",
      serviceContract: {
        type: "retainer", segment: "infinityMirror",
        monthlyAmount: 2000, monthlyRenewalDay: 8,
        startDate: null, endDate: "2027-02-03",
        status: "active", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-01-08", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-02-08", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-03-08", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-04-08", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-05-08", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-08", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-08", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-08", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-08", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-10-08", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-11-08", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-12-08", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-01-08", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-02-08", amount: 2000, paid: false, paidDate: null, note: "" },
        ],
      },
      zohoCommission: {
        zohoProduct: "One", licenses: 40,
        frequency: "annual", monthlyAmount: 0, annualAmount: 3942,
        renewalDate: "2026-12-29", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c3 380 Guide — Infinity Mirror at-risk, end Aug 2 2026. Late Apr + May due.
    {
      id: "c3", nm: "380 Guide", email: "shannon@fmblegacy.com",
      notes: "Late on April payment, May now due",
      serviceContract: {
        type: "retainer", segment: "infinityMirror",
        monthlyAmount: 2000, monthlyRenewalDay: 2,
        startDate: null, endDate: "2026-08-02",
        status: "at-risk", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-01-02", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-02-02", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-03-02", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-04-02", amount: 2000, paid: false, paidDate: null, note: "Late" },
          { dueDate: "2026-05-02", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-02", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-02", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-02", amount: 2000, paid: false, paidDate: null, note: "" },
        ],
      },
      zohoCommission: {
        zohoProduct: "One", licenses: 4,
        frequency: "annual", monthlyAmount: 0, annualAmount: 319.68,
        renewalDate: "2026-10-15", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c4 VanBoxel — Infinity Mirror at-risk, hasn't paid since Feb 3. inForecast:false.
    {
      id: "c4", nm: "VanBoxel", email: "kyle@vanboxelsupply.com",
      notes: "Hasn't paid since Feb 3, critical mode",
      serviceContract: {
        type: "retainer", segment: "infinityMirror",
        monthlyAmount: 2000, monthlyRenewalDay: 3,
        startDate: null, endDate: "2027-02-03",
        status: "at-risk", inForecast: false,
        paymentSchedule: [
          { dueDate: "2026-01-03", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-02-03", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-03-03", amount: 2000, paid: false, paidDate: null, note: "Late" },
          { dueDate: "2026-04-03", amount: 2000, paid: false, paidDate: null, note: "Late" },
          { dueDate: "2026-05-03", amount: 2000, paid: false, paidDate: null, note: "Late" },
          { dueDate: "2026-06-03", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-03", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-03", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-03", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-10-03", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-11-03", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-12-03", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-01-03", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2027-02-03", amount: 2000, paid: false, paidDate: null, note: "" },
        ],
      },
      zohoCommission: {
        zohoProduct: "One", licenses: 14,
        frequency: "annual", monthlyAmount: 0, annualAmount: 399,
        renewalDate: "2026-08-29", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c5 Calco — Support retainer (indefinite, $500/mo).
    {
      id: "c5", nm: "Calco", email: "sarah@calcosf.com",
      notes: "",
      serviceContract: {
        type: "support-retainer", segment: "supportRetainer",
        monthlyAmount: 500, monthlyRenewalDay: 25,
        startDate: null, endDate: null,
        status: "active", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-01-25", amount: 500, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-02-25", amount: 500, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-03-25", amount: 500, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-04-25", amount: 500, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-05-25", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-25", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-25", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-25", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-25", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-10-25", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-11-25", amount: 500, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-12-25", amount: 500, paid: false, paidDate: null, note: "" },
        ],
      },
      zohoCommission: {
        zohoProduct: "CRM Enterprise", licenses: 14,
        frequency: "annual", monthlyAmount: 0, annualAmount: 1555.20,
        renewalDate: "2026-08-30", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c6 Next Fab — Infinity Mirror, end Jul 18. Started Feb.
    {
      id: "c6", nm: "Next Fab", email: "info@nextfabstudio.com",
      notes: "Need renewal soon",
      serviceContract: {
        type: "retainer", segment: "infinityMirror",
        monthlyAmount: 2000, monthlyRenewalDay: 18,
        startDate: null, endDate: "2026-07-18",
        status: "active", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-02-18", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-03-18", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-04-18", amount: 2000, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-05-18", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-18", amount: 2000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-18", amount: 2000, paid: false, paidDate: null, note: "" },
        ],
      },
      zohoCommission: {
        zohoProduct: "One", licenses: 15,
        frequency: "monthly", monthlyAmount: 121.50, annualAmount: 0,
        renewalDate: null, renewalDay: 25,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c7 Plastics Products Mfg — Full project, May–Sep 2026, $12k/mo.
    {
      id: "c7", nm: "Plastics Products Mfg", email: null,
      notes: "Confirmed, paying this week — invoice unpaid as of May 4",
      serviceContract: {
        type: "project", segment: "fullProject",
        monthlyAmount: 12000, monthlyRenewalDay: null,
        startDate: "2026-05-01", endDate: "2026-09-30",
        status: "active", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-05-01", amount: 12000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-06-01", amount: 12000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-07-01", amount: 12000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-08-01", amount: 12000, paid: false, paidDate: null, note: "" },
          { dueDate: "2026-09-01", amount: 12000, paid: false, paidDate: null, note: "" },
        ],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },

    // c8 Patson Doors — Bank of hours, 30 hrs left, no future revenue. inForecast:false.
    {
      id: "c8", nm: "Patson Doors", email: null,
      notes: "30 hours remaining, non-refundable. Unlikely to renew.",
      serviceContract: {
        type: "bank-of-hours", segment: "bankOfHours",
        monthlyAmount: null, monthlyRenewalDay: null,
        startDate: null, endDate: null,
        status: "active", inForecast: false,
        paymentSchedule: [],
      },
      zohoCommission: null,
      lastEditedAt: null, lastEditedBy: null,
    },

    // c9 HV Health & Safety — Zoho only, owe Paul $6k, no further services planned.
    {
      id: "c9", nm: "HV Health & Safety", email: "rsoto@hvhealthandsafety.com",
      notes: "Want to sue them, they owe me 6k. No further services anticipated.",
      serviceContract: null,
      zohoCommission: {
        zohoProduct: "One", licenses: 45,
        frequency: "monthly", monthlyAmount: 393, annualAmount: 0,
        renewalDate: null, renewalDay: 2,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c10 Cloverleaf — Bank of hours + Zoho monthly. Pipeline interest in support retainer.
    {
      id: "c10", nm: "Cloverleaf", email: "steven@cloverleaflending.com",
      notes: "Has expressed interest in support retainer, not yet closed",
      serviceContract: {
        type: "bank-of-hours", segment: "bankOfHours",
        monthlyAmount: null, monthlyRenewalDay: null,
        startDate: null, endDate: null,
        status: "active", inForecast: true,
        paymentSchedule: [],
      },
      zohoCommission: {
        zohoProduct: "One", licenses: 3,
        frequency: "monthly", monthlyAmount: 135, annualAmount: 0,
        renewalDate: null, renewalDay: 10,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c11 Jeanes Mental Health — Zoho only.
    {
      id: "c11", nm: "Jeanes Mental Health", email: "raymond.jeanes@jeanesmentalhealth.com",
      notes: "Will pitch more services soon",
      serviceContract: null,
      zohoCommission: {
        zohoProduct: "One", licenses: 2,
        frequency: "monthly", monthlyAmount: 16.20, annualAmount: 0,
        renewalDate: null, renewalDay: 15,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c12 Revele — Zoho annual, large renewal Jan 2027.
    {
      id: "c12", nm: "Revele", email: "zohoadmin@revelemd.com",
      notes: "",
      serviceContract: null,
      zohoCommission: {
        zohoProduct: "One", licenses: 99,
        frequency: "annual", monthlyAmount: 0, annualAmount: 16825.82,
        renewalDate: "2027-01-06", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c13 United Weld Holdings — Zoho annual CRM Ultimate, likely won't renew.
    {
      id: "c13", nm: "United Weld Holdings", email: "zoho.admin@epicpiping.com",
      notes: "Likely not renewing, will talk to Mark",
      serviceContract: null,
      zohoCommission: {
        zohoProduct: "CRM Ultimate", licenses: 30,
        frequency: "annual", monthlyAmount: 0, annualAmount: 3369.60,
        renewalDate: "2027-01-01", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c14 Regenics — Zoho annual, likely won't renew Feb 2027.
    {
      id: "c14", nm: "Regenics", email: "elise@regenics.com",
      notes: "Likely not renewing, will talk to Mark",
      serviceContract: null,
      zohoCommission: {
        zohoProduct: "One", licenses: 27,
        frequency: "annual", monthlyAmount: 0, annualAmount: 2397.60,
        renewalDate: "2027-02-26", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c15 CoverFour — Bank of hours, two-payment arrangement. $3,125 paid, $3,125 due May.
    {
      id: "c15", nm: "CoverFour", email: "ian.todd@coverfourwins.com",
      notes: "Two-payment arrangement, second $3,125 due this month",
      serviceContract: {
        type: "bank-of-hours", segment: "bankOfHours",
        monthlyAmount: null, monthlyRenewalDay: null,
        startDate: null, endDate: null,
        status: "active", inForecast: true,
        paymentSchedule: [
          { dueDate: "2026-04-15", amount: 3125, paid: true,  paidDate: null, note: "" },
          { dueDate: "2026-05-15", amount: 3125, paid: false, paidDate: null, note: "" },
        ],
      },
      zohoCommission: {
        zohoProduct: "CRM Professional", licenses: 22,
        frequency: "annual", monthlyAmount: 0, annualAmount: 1311.55,
        renewalDate: "2027-04-17", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c16 Urban Oil — Zoho only (CRM Plus). Was Urban Operating in old data — completed scope dropped.
    {
      id: "c16", nm: "Urban Oil", email: "amoshell@uogg.com",
      notes: "Will pitch more services soon",
      serviceContract: null,
      zohoCommission: {
        zohoProduct: "CRM Plus", licenses: 20,
        frequency: "annual", monthlyAmount: 0, annualAmount: 2462.40,
        renewalDate: "2026-08-29", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c17 TKG (Aderra) — Zoho only, $0 annual but renewal flagged Aug.
    {
      id: "c17", nm: "TKG (Aderra)", email: "clayton@tkgdevelopments.com",
      notes: "Will pitch more services soon. Same client as Aderra.",
      serviceContract: null,
      zohoCommission: {
        zohoProduct: "One", licenses: 4,
        frequency: "annual", monthlyAmount: 0, annualAmount: 0,
        renewalDate: "2026-08-11", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c18 Modern Practice — Zoho One 124 lic, no commission. Q5 lockin: keep object, $0 annual.
    {
      id: "c18", nm: "Modern Practice", email: "omid@modpracticesolutions.com",
      notes: "No more commission, likely not renewing. Discuss with Mark.",
      serviceContract: null,
      zohoCommission: {
        zohoProduct: "One", licenses: 124,
        frequency: "annual", monthlyAmount: 0, annualAmount: 0,
        renewalDate: null, renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c19 New Hope — Zoho annual, renewal May 28 2026.
    {
      id: "c19", nm: "New Hope", email: "tammywynn@newhope-cdc.org",
      notes: "",
      serviceContract: null,
      zohoCommission: {
        zohoProduct: "One", licenses: 20,
        frequency: "annual", monthlyAmount: 0, annualAmount: 1918.08,
        renewalDate: "2026-05-28", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c20 Surface Solutions — Zoho One. Q5 lockin: keep object, $0 annual (defensive default).
    {
      id: "c20", nm: "Surface Solutions", email: "sam@surfacesolution.biz",
      notes: "Longshot, will talk to Mark",
      serviceContract: null,
      zohoCommission: {
        zohoProduct: "One", licenses: 24,
        frequency: "annual", monthlyAmount: 0, annualAmount: 0,
        renewalDate: null, renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c21 Buy CRM Now — Zoho annual, small renewal Nov.
    {
      id: "c21", nm: "Buy CRM Now", email: "advisors@buycrmnow.com",
      notes: "Do not anticipate any further services",
      serviceContract: null,
      zohoCommission: {
        zohoProduct: "One", licenses: 1,
        frequency: "annual", monthlyAmount: 0, annualAmount: 79.92,
        renewalDate: "2026-11-23", renewalDay: null,
        status: "active", inForecast: true, note: "",
      },
      lastEditedAt: null, lastEditedBy: null,
    },

    // c22 Jose F — HISTORICAL one-time, $450 Feb 2026 paid, churned. inForecast:false.
    {
      id: "c22", nm: "Jose F", email: null,
      notes: "One-time marketing engagement, completed and churned. No renewal.",
      serviceContract: {
        type: "one-time", segment: "oneTime",
        monthlyAmount: null, monthlyRenewalDay: null,
        startDate: null, endDate: null,
        status: "churned", inForecast: false,
        paymentSchedule: [
          { dueDate: "2026-02-15", amount: 450, paid: true, paidDate: null, note: "" },
        ],
      },
      zohoCommission: null,
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
  if (!n || n === 0) return "—";
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
