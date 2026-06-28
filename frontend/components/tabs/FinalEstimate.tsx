"use client";

import { useState } from "react";
import ModeSelector, { AILoader, AIDoneBar, BackBtn } from "@/components/ui/ModeSelector";
import { AIBadge, FactorySiteBadge, StatusBadge } from "@/components/ui/Badge";
import AddRowModal from "@/components/ui/AddRowModal";
import ExportBtn from "@/components/ui/ExportBtn";
import SendBar from "@/components/ui/SendBar";
import { SAMPLE_FINAL_ROWS, PAYMENT_REQUEST_EMAIL, PAYMENT_ACK_EMAIL } from "@/lib/constants";
import { fmt, gstValue, incGST, exportCSVFile } from "@/lib/utils";
import type { FinalEstimateRow } from "@/lib/types";

export default function FinalEstimate() {
  const [mode, setMode] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [rows, setRows] = useState<FinalEstimateRow[]>(SAMPLE_FINAL_ROWS);
  const [showAdd, setShowAdd] = useState(false);
  const [fArea, setFArea] = useState("All");
  const [fCat, setFCat] = useState("All");
  const [fVendor, setFVendor] = useState("All");
  const [fPaid, setFPaid] = useState("All");

  if (!mode) return <ModeSelector tab="Final Estimate" onSelect={setMode} />;

  const uAreas = ["All", ...new Set(rows.map(r => r.area).filter(Boolean))];
  const uCats = ["All", ...new Set(rows.map(r => r.category).filter(Boolean))];
  const uVendors = ["All", ...new Set(rows.map(r => r.vendorType).filter(Boolean))];

  const filtered = rows.filter(r =>
    (fArea === "All" || r.area === fArea) && (fCat === "All" || r.category === fCat) &&
    (fVendor === "All" || r.vendorType === fVendor) && (fPaid === "All" || r.paidDate === fPaid)
  );

  const totalExp = rows.reduce((s, r) => s + (r.expected || 0), 0);
  const totalAct = rows.reduce((s, r) => s + (r.actual || 0), 0);
  const totalDiff = totalAct - totalExp;

  const exportCSVData = () => {
    const hdr = "Area,Category,Item,Vendor Code,Vendor Name,Amt Ex GST,GST%,Expected,Actual,Variance,Paid Status";
    const data = rows.map(r => {
      const d = (r.actual || 0) - (r.expected || 0);
      return [r.area, r.category, r.item, r.vendorCode, r.vendorName, r.amtEx, r.gstPct + "%", r.expected, r.actual, d, r.paidDate].join(",");
    });
    exportCSVFile("FinalEstimate.csv", hdr, data);
  };

  const ddCls = "px-2.5 py-1.5 border border-nicara-light rounded-lg text-[11px] outline-none bg-white cursor-pointer";

  return (
    <div className="animate-fade-in">
      {showAdd && <AddRowModal onAdd={r => setRows(p => [...p, r as FinalEstimateRow])} onClose={() => setShowAdd(false)} isFinal />}

      <div className="flex justify-between items-center mb-3.5">
        <div className="flex items-center gap-2">
          <BackBtn onClick={() => { setMode(null); setAiDone(false); }} />
          {mode === "ai" && <AIBadge />}
        </div>
        <SendBar phone="9810011111" emails={[
          { label: "Payment Request", subject: PAYMENT_REQUEST_EMAIL.subject, body: PAYMENT_REQUEST_EMAIL.body },
          { label: "Payment Ack", subject: PAYMENT_ACK_EMAIL.subject, body: PAYMENT_ACK_EMAIL.body },
        ]} />
      </div>

      {mode === "ai" && !aiDone ? (
        <AILoader lines={["Reviews BOQ against drawings.", "Cross-checks vendor rates against historical data."]} onDone={() => setAiDone(true)} />
      ) : (
        <>
          {mode === "ai" && aiDone && <AIDoneBar msg="AI BOQ Review Complete" />}

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-2.5 mb-3.5">
            {[
              ["Total Expected", fmt(totalExp), "text-nicara-gold"],
              ["Total Actual", fmt(totalAct), "text-nicara-dark"],
              ["Variance", (totalDiff >= 0 ? "+" : "") + fmt(Math.abs(totalDiff)), totalDiff <= 0 ? "text-emerald-600" : "text-red-600"],
              ["Items", rows.length + " line items", "text-stone-500"],
            ].map(([l, v, vc]) => (
              <div key={l} className="bg-white border border-nicara-light rounded-xl p-3">
                <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">{l}</div>
                <div className={`text-base font-extrabold ${vc}`}>{v}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap items-center">
              {([["Area", fArea, setFArea, uAreas], ["Category", fCat, setFCat, uCats], ["Vendor", fVendor, setFVendor, uVendors], ["Paid", fPaid, setFPaid, ["All", "Pending", "Paid", "Partial"]]] as const).map(([lbl, val, setVal, opts]) => (
                <select key={lbl} value={val} onChange={e => (setVal as (v: string) => void)(e.target.value)} className={ddCls}>
                  {(opts as readonly string[]).map(o => <option key={o} value={o}>{o === "All" ? `All ${lbl}` : o}</option>)}
                </select>
              ))}
              {(fArea !== "All" || fCat !== "All" || fVendor !== "All" || fPaid !== "All") && (
                <button onClick={() => { setFArea("All"); setFCat("All"); setFVendor("All"); setFPaid("All"); }}
                  className="px-2.5 py-1 bg-transparent border border-nicara-light rounded-md text-[11px] text-stone-400 cursor-pointer">✕</button>
              )}
            </div>
            <div className="flex gap-2">
              <ExportBtn onClick={exportCSVData} label="⬇ CSV" />
              <button onClick={() => setShowAdd(true)} className="px-4.5 py-2 bg-nicara-gold border-none rounded-lg text-white text-xs font-bold cursor-pointer">+ Add Line Item</button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-nicara-light rounded-xl">
            <table className="w-full text-[11px] min-w-[1800px]">
              <thead>
                <tr className="bg-nicara-dark">
                  {["#", "Area", "Category", "Item", "Vendor Code", "Vendor Name", "Vendor Type", "Finish", "Fac/Site", "Qty", "Unit", "Rate Ex GST", "Amt Ex GST", "GST%", "Amt Inc GST", "Pay Stage", "Due", "Paid", "Bank", "Expected", "Actual", "Compare", "🗑"].map((h, i) => (
                    <th key={i} className={`px-2 py-2 text-stone-200 font-semibold text-[10px] text-left whitespace-nowrap border-r border-stone-700 ${
                      ["Expected", "Actual", "Compare"].includes(h) ? "bg-purple-950/30" : h === "🗑" ? "bg-nicara-dark-deep" : ""
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, ri) => {
                  const gv = gstValue(row.amtEx, row.gstPct);
                  const ig = incGST(row.amtEx, row.gstPct);
                  const dv = (row.actual || 0) - (row.expected || 0);
                  const isPos = dv <= 0;
                  return (
                    <tr key={row.id} className={`border-b border-nicara-light ${ri % 2 === 0 ? "bg-nicara-cream" : "bg-white"}`}>
                      <td className="px-2 py-1.5 text-stone-400 border-r border-nicara-light">{ri + 1}</td>
                      <td className="px-2 py-1.5 font-semibold text-nicara-dark border-r border-nicara-light">{row.area || "—"}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light">{row.category || "—"}</td>
                      <td className="px-2 py-1.5 font-semibold text-nicara-dark border-r border-nicara-light">{row.item || "—"}</td>
                      <td className="px-2 py-1.5 text-blue-800 font-mono border-r border-nicara-light">{row.vendorCode || "—"}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light">{row.vendorName || "—"}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light">{row.vendorType || "—"}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light">{row.finish || "—"}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light text-center"><FactorySiteBadge value={row.factorySite} /></td>
                      <td className="px-2 py-1.5 border-r border-nicara-light text-right font-mono">{row.qty || "—"}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light">{row.unit || "—"}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light text-right font-mono">{fmt(row.rateEx || 0)}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light text-right font-semibold font-mono">{fmt(row.amtEx || 0)}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light text-center text-stone-500">{row.gstPct || 18}%</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light text-right font-bold text-nicara-gold font-mono">{fmt(ig)}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light">{row.payStage || "—"}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light text-center">{row.dueDate || "—"}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light text-center"><StatusBadge status={row.paidDate || "Pending"} /></td>
                      <td className="px-2 py-1.5 border-r border-nicara-light">{row.bank || "—"}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light text-right font-mono font-semibold bg-purple-50 text-purple-700">{fmt(row.expected || 0)}</td>
                      <td className="px-2 py-1.5 border-r border-nicara-light text-right font-mono font-semibold bg-emerald-50 text-emerald-700">{fmt(row.actual || 0)}</td>
                      <td className={`px-2 py-1.5 border-r border-nicara-light text-right font-mono font-extrabold ${isPos ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        {isPos ? "-" : "+"}₹{Math.abs(dv).toLocaleString("en-IN")}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => setRows(p => p.filter(r => r.id !== row.id))} className="bg-transparent border-none text-red-300 cursor-pointer text-[15px] p-0 hover:text-red-500">🗑</button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-nicara-dark">
                  <td colSpan={19} className="p-2.5 text-stone-200 font-bold text-right text-xs">TOTALS</td>
                  <td className="p-2.5 text-purple-300 font-extrabold text-right font-mono">{fmt(totalExp)}</td>
                  <td className="p-2.5 text-emerald-300 font-extrabold text-right font-mono">{fmt(totalAct)}</td>
                  <td className={`p-2.5 font-black text-right font-mono ${totalDiff <= 0 ? "text-emerald-300 bg-emerald-950" : "text-red-300 bg-red-950"}`}>
                    {totalDiff <= 0 ? "-" : "+"}₹{Math.abs(totalDiff).toLocaleString("en-IN")}
                  </td>
                  <td className="bg-nicara-dark" />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[11px] text-stone-400 text-center">
            💡 Green Compare = under/on budget · Red = over budget · 🗑 to delete any row
          </div>
        </>
      )}
    </div>
  );
}
