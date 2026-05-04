// Phase E2a — pure helpers for the unified Clients tab.
// No React, no side effects. Used by ClientsTab + ClientCard + storage.js migration.

const BASE_YEAR = 2026;
const N = 24;

// "YYYY-MM-15" — 15th-of-month convention for paymentSchedule dueDates
export function dateForMonth(idx) {
  const year = BASE_YEAR + Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-15`;
}

// Convert a date string like "2026-05-01" to forecast index (0-23)
export function monthIdxFromDate(dateStr) {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})/.exec(dateStr);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  return (y - BASE_YEAR) * 12 + (mo - 1);
}

export function daysUntil(date, today) {
  const ms = (date instanceof Date ? date : new Date(date)).getTime() - today.getTime();
  return Math.floor(ms / 86400000);
}

export function monthsRemaining(endDateStr, today) {
  if (!endDateStr) return 0;
  const ed = new Date(endDateStr);
  if (isNaN(ed)) return 0;
  const months = (ed.getFullYear() - today.getFullYear()) * 12 + (ed.getMonth() - today.getMonth());
  return Math.max(0, months);
}

// Determine which UI segment a client belongs to.
// Reads serviceContract.segment if set; else derives "supportOnly" for zoho-only clients.
export function getSegment(client) {
  const sc = client.serviceContract;
  const zc = client.zohoCommission;
  if (sc && sc.segment) return sc.segment;
  if (!sc && zc) return "supportOnly";
  return null;
}

// clientValue (Q4 locked formula):
//   sum(unpaid future paymentSchedule entries with dueDate >= today)
//   + zohoCommission.monthlyAmount * 12
//   + zohoCommission.annualAmount
// Returns 0 components for null/undefined fields.
export function clientValue(client, today) {
  const sc = client.serviceContract;
  const zc = client.zohoCommission;
  const sched = sc?.paymentSchedule || [];
  const unpaidFuture = sched
    .filter(p => !p.paid && new Date(p.dueDate) >= today)
    .reduce((s, p) => s + (p.amount || 0), 0);
  const zohoMonthly = (zc?.monthlyAmount || 0) * 12;
  const zohoAnnual = zc?.annualAmount || 0;
  return unpaidFuture + zohoMonthly + zohoAnnual;
}

// Classify a paymentSchedule entry's status for display.
export function paymentDueStatus(payment, today) {
  if (payment.paid) return "paid";
  const due = new Date(payment.dueDate);
  if (isNaN(due)) return "unpaid";
  if (due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth()) return "due";
  if (due < today) return "late";
  return "upcoming";
}

// Generate paymentSchedule for a client based on serviceContract type + st[] history.
// Q3 lock: skip blank past months. Forward generation: 12 months default for null endDate, else through endDate.
export function generateSchedule(client, currentMonthIdx = null) {
  const sc = client.serviceContract;
  if (!sc) return [];

  // Default cm to actual current month index from today (data.js calls without arg)
  const cm = currentMonthIdx !== null ? currentMonthIdx : (() => {
    const t = new Date();
    return (t.getFullYear() - BASE_YEAR) * 12 + t.getMonth();
  })();

  // CASE 3: one-time → derive from payments[] kind:"service"
  if (sc.type === "one-time") {
    return (client.payments || [])
      .filter(p => !p.kind || p.kind === "service")
      .map(p => ({
        dueDate: dateForMonth(p.month),
        amount: p.amount,
        paid: p.status === "P",
        paidDate: null,
        note: p.status === "L" ? "Late" : "",
      }));
  }

  // CASE 2: project — startDate through endDate
  if (sc.type === "project") {
    const st = client.st || [];
    const startIdx = sc.startDate ? monthIdxFromDate(sc.startDate) : null;
    const endIdx = sc.endDate ? monthIdxFromDate(sc.endDate) : null;
    if (startIdx === null || endIdx === null) return [];
    const out = [];
    for (let i = startIdx; i <= Math.min(endIdx, N - 1); i++) {
      const mark = st[i] || "";
      out.push({
        dueDate: dateForMonth(i),
        amount: sc.monthlyAmount,
        paid: mark === "P",
        paidDate: null,
        note: mark === "L" ? "Late" : "",
      });
    }
    return out;
  }

  // CASE 1: retainer — past explicit P/U/L (skip blanks) + forward from cm
  if (sc.type === "retainer") {
    const st = client.st || [];
    const out = [];
    // Past explicit only
    for (let i = 0; i < cm; i++) {
      const mark = st[i];
      if (mark === "P" || mark === "U" || mark === "L") {
        out.push({
          dueDate: dateForMonth(i),
          amount: sc.monthlyAmount,
          paid: mark === "P",
          paidDate: null,
          note: mark === "L" ? "Late" : "",
        });
      }
    }
    // Forward: 12 months from cm if endDate null, else through endDate
    const endIdx = sc.endDate ? monthIdxFromDate(sc.endDate) : (cm + 11);
    for (let i = cm; i <= Math.min(endIdx, N - 1); i++) {
      const mark = st[i] || "";
      out.push({
        dueDate: dateForMonth(i),
        amount: sc.monthlyAmount,
        paid: mark === "P",
        paidDate: null,
        note: mark === "L" ? "Late" : "",
      });
    }
    return out;
  }

  return [];
}

// Map old serviceContract.type → new segment (Q1 locked: c5 Calco → infinityMirror).
export function deriveSegment(type, clientId) {
  if (type === "retainer") return "infinityMirror";
  if (type === "project") return "fullProject";
  if (type === "one-time") return "scopeOnly";
  return null;
}

export const SEGMENT_LABELS = {
  infinityMirror: "Infinity Mirror",
  scopeOnly: "Scope only",
  fullProject: "Full project",
  supportOnly: "Support only",
};

export const STATUS_LABELS = {
  active: "Active",
  "at-risk": "At-risk",
  churned: "Churned",
  pipeline: "Pipeline",
};
