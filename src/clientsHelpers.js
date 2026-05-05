// Phase E2b/E2c — pure helpers for the unified Clients tab.
// No React, no side effects. Used by ClientsTab/ClientList/ClientDetail/ClientTable.

const BASE_YEAR = 2026;
const N = 24;

// "YYYY-MM-15" — 15th-of-month convention used when generating fresh schedules
// (Add service contract form). Existing schedules preserve their own dueDates.
export function dateForMonth(idx, day = 15) {
  const year = BASE_YEAR + Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  const d = String(day).padStart(2, "0");
  return `${year}-${String(month).padStart(2, "0")}-${d}`;
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
// Reads serviceContract.segment if set; else derives "zohoCommissionOnly" for zoho-only clients.
export function getSegment(client) {
  const sc = client.serviceContract;
  const zc = client.zohoCommission;
  if (sc && sc.segment) return sc.segment;
  if (!sc && zc) return "zohoCommissionOnly";
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

// Generate an empty paymentSchedule for a freshly-added serviceContract.
// Retainer / support-retainer: 12 forward months from current month.
// Project: startDate through endDate.
// Bank-of-hours / one-time: empty (caller adds entries explicitly).
export function generateScheduleForNew(sc, today) {
  if (!sc) return [];
  const t = today instanceof Date ? today : new Date();
  const cm = (t.getFullYear() - BASE_YEAR) * 12 + t.getMonth();
  const day = sc.monthlyRenewalDay || 15;

  if (sc.type === "retainer" || sc.type === "support-retainer") {
    const endIdx = sc.endDate ? monthIdxFromDate(sc.endDate) : (cm + 11);
    const out = [];
    for (let i = cm; i <= Math.min(endIdx, N - 1); i++) {
      out.push({
        dueDate: dateForMonth(i, day),
        amount: sc.monthlyAmount || 0,
        paid: false, paidDate: null, note: "",
      });
    }
    return out;
  }

  if (sc.type === "project") {
    const startIdx = sc.startDate ? monthIdxFromDate(sc.startDate) : cm;
    const endIdx = sc.endDate ? monthIdxFromDate(sc.endDate) : startIdx;
    if (startIdx === null || endIdx === null) return [];
    const out = [];
    for (let i = startIdx; i <= Math.min(endIdx, N - 1); i++) {
      out.push({
        dueDate: dateForMonth(i, sc.monthlyRenewalDay || 1),
        amount: sc.monthlyAmount || 0,
        paid: false, paidDate: null, note: "",
      });
    }
    return out;
  }

  return [];
}

// Map serviceContract.type → segment. Used by Add Service form.
export function deriveSegment(type) {
  if (type === "retainer") return "infinityMirror";
  if (type === "support-retainer") return "supportRetainer";
  if (type === "bank-of-hours") return "bankOfHours";
  if (type === "project") return "fullProject";
  if (type === "one-time") return "oneTime";
  return null;
}

export const SEGMENT_LABELS = {
  infinityMirror:      "Infinity Mirror",
  supportRetainer:     "Support Retainer",
  bankOfHours:         "Bank of Hours",
  fullProject:         "Full Project",
  zohoCommissionOnly:  "Zoho Commission Only",
  oneTime:             "Historical (One-Time)",
};

export const STATUS_LABELS = {
  active:    "Active",
  "at-risk": "At-risk",
  churned:   "Churned",
  pipeline:  "Pipeline",
};

// Display order for By Segment view. oneTime renders separately as Historical.
export const SEGMENT_ORDER = [
  "infinityMirror",
  "supportRetainer",
  "bankOfHours",
  "fullProject",
  "zohoCommissionOnly",
];

export const HISTORICAL_SEGMENT = "oneTime";

// Permissions stub — E2c will replace with real role check.
export function canEdit(/* user, field */) { return true; }

// Compact subtitle for ClientList rows. Surface the most operationally
// relevant fact: ending-soon contracts > status risk > monthly value > annual.
const MO_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function clientSubtitle(client, today) {
  const sc = client.serviceContract;
  const zc = client.zohoCommission;
  const status = sc?.status || zc?.status || "active";

  if (sc?.endDate) {
    const days = daysUntil(new Date(sc.endDate), today);
    if (days >= 0 && days <= 180) {
      const ed = new Date(sc.endDate);
      return `ends ${MO_SHORT[ed.getMonth()]}'${String(ed.getFullYear()).slice(-2)}`;
    }
  }
  if (status === "at-risk")  return "at-risk";
  if (status === "churned")  return "churned";

  const monthly = (sc?.monthlyAmount || 0) + (zc?.monthlyAmount || 0);
  if (monthly > 0) return `$${Math.round(monthly).toLocaleString()}/mo`;
  const annual = zc?.annualAmount || 0;
  if (annual > 0) return `$${Math.round(annual).toLocaleString()}/yr`;
  return "—";
}

// Generate the next sequential client id (c23, c24...) — never reuses old IDs.
// Per C1.5 lockin: human-readable, no Date.now() junk.
export function nextClientId(existingClients) {
  const used = new Set((existingClients || []).map(c => c.id));
  let n = 1;
  while (used.has(`c${n}`)) n++;
  return `c${n}`;
}
