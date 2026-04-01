import React, { useState, useCallback } from "react";
import { MO, P, fmt } from "./data.js";
import { Card, Lbl } from "./components.jsx";

// === CSV PARSERS — auto-detect by headers ===

function parseCSVRows(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (!lines.length) return [];
  // Simple CSV parse handling quoted fields with commas
  const parseLine = (line) => {
    const fields = [];
    let current = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    fields.push(current.trim());
    return fields;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] || "");
    return obj;
  });
}

function detectFormat(headers) {
  const h = headers.join(",").toLowerCase();
  if (h.includes("posting date") && h.includes("balance")) return "chase_checking";
  if (h.includes("card") && h.includes("transaction date") && h.includes("category")) return "chase_cc";
  if (h.includes("type") && h.includes("source") && h.includes("net") && h.includes("currency")) return "stripe";
  if (h.includes("direction") && h.includes("source amount") && h.includes("target name")) return "wise";
  return null;
}

function getMonth(dateStr) {
  // Handle MM/DD/YYYY and YYYY-MM-DD formats
  if (!dateStr) return -1;
  let m;
  if (dateStr.includes("/")) {
    m = parseInt(dateStr.split("/")[0], 10) - 1;
  } else if (dateStr.includes("-")) {
    m = parseInt(dateStr.split("-")[1], 10) - 1;
  }
  return (m >= 0 && m <= 11) ? m : -1;
}

function parseChaseChecking(rows) {
  const byMonth = {};
  rows.forEach(r => {
    const m = getMonth(r["Posting Date"]);
    if (m < 0) return;
    if (!byMonth[m]) byMonth[m] = { credits: 0, debits: 0, lastBal: 0, lastDate: "" };
    const amt = parseFloat(r["Amount"]) || 0;
    const bal = parseFloat(r["Balance"]) || 0;
    if (amt > 0) byMonth[m].credits += amt;
    else byMonth[m].debits += amt;
    // Track the latest balance in the month (rows are newest-first)
    if (!byMonth[m].lastDate || r["Posting Date"] > byMonth[m].lastDate) {
      // Actually Chase rows are newest first, so first row per month = latest
    }
    // Just use the balance from the first row we see per month (newest transaction)
    if (!byMonth[m].lastDate) {
      byMonth[m].lastBal = bal;
      byMonth[m].lastDate = r["Posting Date"];
    }
  });
  return byMonth;
}

function parseChaseCC(rows) {
  const byMonth = {};
  rows.forEach(r => {
    const m = getMonth(r["Post Date"] || r["Transaction Date"]);
    if (m < 0) return;
    if (!byMonth[m]) byMonth[m] = { charges: 0, payments: 0, fees: 0 };
    const amt = parseFloat(r["Amount"]) || 0;
    const type = (r["Type"] || "").toLowerCase();
    if (type === "fee") byMonth[m].fees += amt;
    else if (amt < 0) byMonth[m].charges += amt; // charges are negative
    else byMonth[m].payments += amt; // payments are positive
  });
  return byMonth;
}

function parseStripe(rows) {
  const byMonth = {};
  rows.forEach(r => {
    const m = getMonth(r["Created (UTC)"]);
    if (m < 0) return;
    if (!byMonth[m]) byMonth[m] = { charges: 0, payouts: 0, fees: 0, loan: 0 };
    const net = parseFloat(r["Net"]) || 0;
    const type = (r["Type"] || "").toLowerCase();
    if (type === "charge") byMonth[m].charges += net;
    else if (type === "payout") byMonth[m].payouts += Math.abs(net);
    else if (type === "stripe_fee") byMonth[m].fees += Math.abs(net);
    else if (type === "financing_paydown") byMonth[m].loan += Math.abs(net);
  });
  return byMonth;
}

function parseWise(rows) {
  const byMonth = {};
  rows.forEach(r => {
    if (r["Status"] !== "COMPLETED") return;
    const m = getMonth(r["Finished on"] || r["Created on"]);
    if (m < 0) return;
    if (!byMonth[m]) byMonth[m] = { out: 0, fees: 0, recipients: {} };
    const dir = (r["Direction"] || "").toUpperCase();
    if (dir === "OUT") {
      const srcAmt = parseFloat(r["Source amount (after fees)"]) || 0;
      const fee = parseFloat(r["Source fee amount"]) || 0;
      byMonth[m].out += srcAmt;
      byMonth[m].fees += fee;
      const name = r["Target name"] || "Unknown";
      byMonth[m].recipients[name] = (byMonth[m].recipients[name] || 0) + srcAmt + fee;
    }
  });
  return byMonth;
}

// === MAIN COMPONENT ===

export default function Reconcile({ d, save, compute }) {
  const [files, setFiles] = useState([]); // { name, format, data }
  const [parsed, setParsed] = useState(null); // combined results by month
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() - 1); // default to last month
  const [saving, setSaving] = useState(false);

  const handleFiles = useCallback((e) => {
    const fileList = Array.from(e.target.files);
    const results = [];

    let loaded = 0;
    fileList.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        const rows = parseCSVRows(text);
        if (!rows.length) { loaded++; return; }
        const headers = Object.keys(rows[0]);
        const format = detectFormat(headers);
        if (format) {
          results.push({ name: file.name, format, rows });
        }
        loaded++;
        if (loaded === fileList.length) {
          setFiles(results);
          // Parse all files
          const combined = {};
          results.forEach(f => {
            let monthData;
            if (f.format === "chase_checking") monthData = { type: "chase", data: parseChaseChecking(f.rows) };
            else if (f.format === "chase_cc") monthData = { type: "cc", data: parseChaseCC(f.rows) };
            else if (f.format === "stripe") monthData = { type: "stripe", data: parseStripe(f.rows) };
            else if (f.format === "wise") monthData = { type: "wise", data: parseWise(f.rows) };
            if (monthData) {
              Object.entries(monthData.data).forEach(([mo, vals]) => {
                const m = parseInt(mo);
                if (!combined[m]) combined[m] = {};
                combined[m][monthData.type] = vals;
              });
            }
          });
          setParsed(combined);
        }
      };
      reader.readAsText(file);
    });
  }, []);

  const c = compute;
  const actuals = d.actuals || {};

  // Build month summary from parsed data
  const getMonthSummary = (m) => {
    if (!parsed || !parsed[m]) return null;
    const p = parsed[m];
    const chase = p.chase || {};
    const cc = p.cc || {};
    const stripe = p.stripe || {};
    const wise = p.wise || {};

    return {
      closingBal: chase.lastBal || 0,
      totalIn: Math.round((chase.credits || 0) * 100) / 100,
      totalOut: Math.round(Math.abs(chase.debits || 0) * 100) / 100,
      chaseIn: Math.round((chase.credits || 0) * 100) / 100,
      chaseOut: Math.round(Math.abs(chase.debits || 0) * 100) / 100,
      stripeIn: Math.round((stripe.charges || 0) * 100) / 100,
      stripePayout: Math.round((stripe.payouts || 0) * 100) / 100,
      stripeLoan: Math.round((stripe.loan || 0) * 100) / 100,
      wiseOut: Math.round((wise.out || 0 + (wise.fees || 0)) * 100) / 100,
      wiseFees: Math.round((wise.fees || 0) * 100) / 100,
      ccSpend: Math.round(Math.abs(cc.charges || 0) * 100) / 100,
      ccFees: Math.round(Math.abs(cc.fees || 0) * 100) / 100,
    };
  };

  const saveReconciliation = async (monthIdx) => {
    const summary = getMonthSummary(monthIdx);
    if (!summary) return;
    setSaving(true);
    const newActuals = { ...actuals, [monthIdx]: { ...summary, reconDate: new Date().toISOString() } };
    // Update cashNow to the latest closing balance
    const latestMonth = Math.max(...Object.keys(newActuals).map(Number));
    const latestBal = newActuals[latestMonth]?.closingBal;
    const updates = { actuals: newActuals };
    if (latestBal && latestMonth === monthIdx) {
      updates.cashNow = Math.round(latestBal * 100) / 100;
    }
    await save({ ...d, ...updates });
    setSaving(false);
  };

  // Months that have data (from parsed or previously saved)
  const availableMonths = new Set([
    ...Object.keys(actuals).map(Number),
    ...(parsed ? Object.keys(parsed).map(Number) : []),
  ]);

  const summary = getMonthSummary(selectedMonth);
  const saved = actuals[selectedMonth];
  const forecastRev = c.rv[selectedMonth] || 0;
  const forecastExp = c.ex[selectedMonth] || 0;
  const forecastBal = c.bl[selectedMonth] || 0;

  // Use saved or fresh parsed data for display
  const display = saved || summary;

  const formatLabels = { chase_checking: "Chase Checking", chase_cc: "Chase Credit Card", stripe: "Stripe", wise: "Wise" };

  return (
    <div>
      {/* Upload area */}
      <Card style={{ padding: 16, marginBottom: 16, border: `1px dashed ${P.bd}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Lbl>Upload Bank Statements</Lbl>
          <span style={{ fontSize: 10, color: P.td }}>Accepts: Chase CSV, Stripe CSV, Wise CSV</span>
        </div>
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px",
          border: `2px dashed ${P.bd}`, borderRadius: 8, cursor: "pointer",
          background: `${P.c2}60`, transition: "border-color 0.2s",
        }}>
          <input type="file" accept=".csv,.CSV" multiple onChange={handleFiles} style={{ display: "none" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>📄</div>
            <div style={{ fontSize: 12, color: P.tm }}>Drop CSVs here or click to browse</div>
            <div style={{ fontSize: 10, color: P.td, marginTop: 4 }}>Upload all at once — Chase checking, CC, Stripe, Wise</div>
          </div>
        </label>
        {files.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {files.map((f, i) => (
              <span key={i} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 4, background: P.gB, color: P.g }}>
                {formatLabels[f.format] || f.format} — {f.rows.length} transactions
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Month selector */}
      {(parsed || Object.keys(actuals).length > 0) && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {MO.map((m, i) => {
              const hasParsed = parsed && parsed[i];
              const hasSaved = actuals[i];
              const active = i === selectedMonth;
              return (
                <button key={i} onClick={() => setSelectedMonth(i)}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 6, cursor: "pointer",
                    border: `1px solid ${active ? P.g : hasSaved ? P.g + "44" : hasParsed ? P.a + "44" : P.bd}`,
                    background: active ? P.gB : hasSaved ? `${P.gB}40` : hasParsed ? `${P.aB}40` : "transparent",
                    color: active ? P.g : hasSaved ? P.g : hasParsed ? P.a : P.td,
                    fontSize: 10, fontWeight: active || hasSaved ? 700 : 400,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                  {m}
                  {hasSaved && <div style={{ fontSize: 7, marginTop: 2 }}>✓</div>}
                </button>
              );
            })}
          </div>

          {/* Reconciliation results */}
          {display ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Actual column */}
              <Card style={{ padding: 16 }}>
                <Lbl>Actual — {MO[selectedMonth]}</Lbl>
                {saved && <div style={{ fontSize: 9, color: P.g, marginBottom: 8 }}>Reconciled {new Date(saved.reconDate).toLocaleDateString()}</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${P.bd}20` }}>
                    <span style={{ color: P.tm, fontSize: 12 }}>Closing Balance</span>
                    <span style={{ color: P.g, fontWeight: 800, fontSize: 16, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(display.closingBal)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ color: P.tm, fontSize: 12 }}>Total In (Chase)</span>
                    <span style={{ color: P.g, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmt(display.totalIn || display.chaseIn)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ color: P.tm, fontSize: 12 }}>Total Out (Chase)</span>
                    <span style={{ color: P.r, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{fmt(-(display.totalOut || display.chaseOut))}</span>
                  </div>
                  {display.stripeIn > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ color: P.td, fontSize: 11 }}>Stripe Charges</span>
                    <span style={{ color: P.tm, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{fmt(display.stripeIn)}</span>
                  </div>}
                  {display.stripeLoan > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ color: P.td, fontSize: 11 }}>Stripe Loan Paydown</span>
                    <span style={{ color: P.r, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{fmt(-display.stripeLoan)}</span>
                  </div>}
                  {display.wiseOut > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ color: P.td, fontSize: 11 }}>Wise Transfers</span>
                    <span style={{ color: P.r, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{fmt(-display.wiseOut)}</span>
                  </div>}
                  {display.ccSpend > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ color: P.td, fontSize: 11 }}>CC Spend</span>
                    <span style={{ color: P.r, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{fmt(-display.ccSpend)}</span>
                  </div>}
                </div>
              </Card>

              {/* Forecast vs Actual comparison */}
              <Card style={{ padding: 16 }}>
                <Lbl>Forecast vs Actual — {MO[selectedMonth]}</Lbl>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {/* Balance comparison */}
                  {(() => {
                    const balDelta = display.closingBal - forecastBal;
                    return (
                      <div style={{ padding: 10, borderRadius: 8, background: Math.abs(balDelta) > 1000 ? P.aB : P.gB, border: `1px solid ${Math.abs(balDelta) > 1000 ? P.a + "33" : P.g + "33"}` }}>
                        <div style={{ fontSize: 10, color: P.td, textTransform: "uppercase", marginBottom: 4 }}>Closing Balance</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <div>
                            <span style={{ fontSize: 11, color: P.tm }}>Forecast: </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: P.tm, fontSize: 12 }}>{fmt(forecastBal)}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: 11, color: P.tm }}>Actual: </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: P.tx, fontSize: 12 }}>{fmt(display.closingBal)}</span>
                          </div>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: balDelta >= 0 ? P.g : P.r, fontFamily: "'JetBrains Mono', monospace" }}>
                          {balDelta >= 0 ? "+" : ""}{fmt(balDelta)} {Math.abs(balDelta) > 1000 ? "⚠" : "✓"}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Revenue comparison */}
                  {(() => {
                    const actualIn = display.totalIn || display.chaseIn || 0;
                    const revDelta = actualIn - forecastRev;
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${P.bd}20` }}>
                        <span style={{ color: P.tm, fontSize: 12 }}>Revenue</span>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ color: P.td, fontSize: 11 }}>Forecast {fmt(forecastRev)} → Actual {fmt(actualIn)} </span>
                          <span style={{ color: revDelta >= 0 ? P.g : P.r, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                            {revDelta >= 0 ? "+" : ""}{fmt(revDelta)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Expense comparison */}
                  {(() => {
                    const actualOut = display.totalOut || display.chaseOut || 0;
                    const expDelta = -actualOut - forecastExp; // forecastExp is already negative
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${P.bd}20` }}>
                        <span style={{ color: P.tm, fontSize: 12 }}>Expenses</span>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ color: P.td, fontSize: 11 }}>Forecast {fmt(forecastExp)} → Actual {fmt(-actualOut)} </span>
                          <span style={{ color: expDelta <= 0 ? P.g : P.r, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                            {expDelta >= 0 ? "+" : ""}{fmt(expDelta)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Save button */}
                {summary && !saved && (
                  <button onClick={() => saveReconciliation(selectedMonth)} disabled={saving}
                    style={{
                      marginTop: 14, width: "100%", padding: "10px 16px", borderRadius: 8,
                      background: P.g, color: P.bg, border: "none", fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer",
                    }}>
                    {saving ? "Saving..." : `Reconcile ${MO[selectedMonth]} — Update Cash Balance to ${fmt(summary.closingBal)}`}
                  </button>
                )}
                {saved && (
                  <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, background: P.gB, border: `1px solid ${P.g}33`, fontSize: 11, color: P.g, textAlign: "center" }}>
                    ✓ Reconciled — cashNow updated to {fmt(saved.closingBal)}
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card style={{ padding: 20, textAlign: "center" }}>
              <div style={{ color: P.td, fontSize: 12 }}>No data for {MO[selectedMonth]}. Upload statements that include this month.</div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
