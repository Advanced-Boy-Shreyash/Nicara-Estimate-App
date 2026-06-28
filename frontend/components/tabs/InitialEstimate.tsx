"use client";

import { useState, useMemo } from "react";
import ModeSelector, { AILoader, AIDoneBar, BackBtn } from "@/components/ui/ModeSelector";
import { AIBadge } from "@/components/ui/Badge";
import SendBar from "@/components/ui/SendBar";
import AddRowModal from "@/components/ui/AddRowModal";
import InlineCell from "@/components/ui/InlineCell";
import ExportBtn from "@/components/ui/ExportBtn";
import { FactorySiteBadge, TypeBadge } from "@/components/ui/Badge";
import {
  SAMPLE_EST_ROWS, SAMPLE_DETAIL, WELCOME_EMAIL,
  PAYMENT_REQUEST_EMAIL, PAYMENT_ACK_EMAIL,
  PLYWOOD_OPTIONS, HARDWARE_OPTIONS, KITCHEN_ACC_OPTIONS, FINISH_OPTIONS,
} from "@/lib/constants";
import { fmt, gstValue, incGST, exportCSVFile } from "@/lib/utils";
import type { EstimateTableRow } from "@/lib/types";

/* ── Estimate Summary ────────────────────────────────────────── */
function EstSummary({ rows }: { rows: EstimateTableRow[] }) {
  const total = rows.reduce((s, r) => s + incGST(r.amtEx, r.gstPct), 0);
  const groups = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => { m[r.area] = (m[r.area] || 0) + incGST(r.amtEx, r.gstPct); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <div className="animate-fade-in">
      <div className="bg-nicara-dark rounded-xl p-5 mb-4">
        <div className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Total Estimate (Inc GST)</div>
        <div className="text-3xl font-black text-nicara-gold">{fmt(total)}</div>
        <div className="text-xs text-stone-500 mt-1">{rows.length} line items</div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {groups.map(([area, amt]) => (
          <div key={area} className="bg-white border border-nicara-light rounded-xl p-3 hover:border-nicara-gold transition-colors">
            <div className="text-[10px] text-stone-400 mb-1 truncate">{area}</div>
            <div className="text-sm font-bold text-nicara-dark">{fmt(amt)}</div>
            <div className="text-[10px] text-nicara-teal mt-0.5">{((amt / total) * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Estimate Table ──────────────────────────────────────────── */
function InitEstTable({ rows, setRows }: { rows: EstimateTableRow[]; setRows: React.Dispatch<React.SetStateAction<EstimateTableRow[]>> }) {
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [fArea, setFArea] = useState("All");
  const [fCat, setFCat] = useState("All");
  const [fVendor, setFVendor] = useState("All");
  const [fFactory, setFFactory] = useState("All");

  /* Material selectors */
  const [selPlywood, setSelPlywood] = useState("");
  const [selHardware, setSelHardware] = useState("");
  const [selKitchenAcc, setSelKitchenAcc] = useState("");
  const [selFinish, setSelFinish] = useState("");
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const canGenerate = !!(selPlywood && selHardware && selKitchenAcc && selFinish);

  const generateEstimate = () => {
    if (!canGenerate) return;
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 1500);
  };

  const uAreas = ["All", ...new Set(rows.map((r) => r.area).filter(Boolean))];
  const uCats = ["All", ...new Set(rows.map((r) => r.category).filter(Boolean))];
  const uVendors = ["All", ...new Set(rows.map((r) => r.vendorType).filter(Boolean))];
  const uFactory = ["All", ...new Set(rows.map((r) => r.factorySite).filter(Boolean))];

  const filtered = rows.filter(
    (r) => (fArea === "All" || r.area === fArea) && (fCat === "All" || r.category === fCat) &&
      (fVendor === "All" || r.vendorType === fVendor) && (fFactory === "All" || r.factorySite === fFactory)
  );

  const totalInc = rows.reduce((s, r) => s + incGST(r.amtEx, r.gstPct), 0);

  const exportCSV = () => {
    const hdr = "Area,Category,Sub Cat,Item,Finish,Vendor Type,Factory/Site,Qty,Unit,Budget Note,Amt Ex GST,GST%,GST Value,Amt Inc GST";
    const data = rows.map((r) => {
      const gv = gstValue(r.amtEx, r.gstPct);
      const ig = incGST(r.amtEx, r.gstPct);
      return [r.area, r.category, r.subcat, r.item, r.finish, r.vendorType, r.factorySite, r.qty, r.unit, r.budgetNote, r.amtEx, r.gstPct + "%", gv, ig].join(",");
    });
    exportCSVFile("InitialEstimate.csv", hdr, data);
  };

  const ddCls = "px-2.5 py-1.5 border border-nicara-light rounded-lg text-[11px] outline-none bg-white cursor-pointer";
  const selCls = "w-full px-2.5 py-2 bg-nicara-dark-deep border rounded-lg text-[11px] text-stone-400 outline-none cursor-pointer focus:border-nicara-gold";

  return (
    <div className="animate-fade-in">
      {showAdd && <AddRowModal onAdd={(r) => setRows((p) => [...p, r as EstimateTableRow])} onClose={() => setShowAdd(false)} />}

      {/* Material Selector */}
      <div className="bg-nicara-dark rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="text-xs font-bold text-nicara-gold uppercase tracking-wider">Material Preferences</div>
            <div className="text-[11px] text-stone-500 mt-0.5">Select your material preferences — we&apos;ll generate the estimate automatically</div>
          </div>
          {generated && (
            <div className="text-[11px] text-emerald-400 bg-emerald-900 px-3 py-1 rounded-full font-semibold">✓ Estimate Generated</div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3.5 mb-4">
          {([
            ["🪵", "Plywood", selPlywood, setSelPlywood, PLYWOOD_OPTIONS.map(o => ({ value: o.label, display: `${o.label} — ₹${o.price.toLocaleString("en-IN")}/${o.perUnit}`, detail: `${o.brand} · ${o.model} · ${o.thick}` }))],
            ["⚙️", "Hardware", selHardware, setSelHardware, HARDWARE_OPTIONS.map(o => ({ value: o.label, display: o.label, detail: `${o.brand} · ${o.model}` }))],
            ["🍳", "Kitchen Acc", selKitchenAcc, setSelKitchenAcc, KITCHEN_ACC_OPTIONS.map(o => ({ value: o.label, display: `${o.label} — ₹${o.total.toLocaleString("en-IN")}`, detail: `${o.brand} · ${o.model}` }))],
            ["🎨", "Finish", selFinish, setSelFinish, FINISH_OPTIONS.map(o => ({ value: o.label, display: `${o.label} — ₹${o.pricePerSheet.toLocaleString("en-IN")}/sheet`, detail: `${o.brand} · ${o.finish}` }))],
          ] as const).map(([emoji, label, val, setVal, opts]) => (
            <div key={label}>
              <div className="text-[10px] text-nicara-gold uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1">
                <span className="text-sm">{emoji}</span> {label}
              </div>
              <select value={val} onChange={(e) => (setVal as (v: string) => void)(e.target.value)}
                className={`${selCls} ${val ? "border-nicara-gold text-stone-200" : "border-stone-700"}`}>
                <option value="">Select {label.toLowerCase()}…</option>
                {(opts as Array<{value: string; display: string; detail: string}>).map(o => (
                  <option key={o.value} value={o.value}>{o.display}</option>
                ))}
              </select>
              {val && (() => {
                const o = (opts as Array<{value: string; display: string; detail: string}>).find(x => x.value === val);
                return o ? <div className="mt-1 text-[10px] text-nicara-teal bg-emerald-950 rounded-md px-2 py-1">{o.detail}</div> : null;
              })()}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex gap-1.5 flex-wrap">
            {[["🪵 Plywood", selPlywood], ["⚙️ Hardware", selHardware], ["🍳 Kitchen Acc", selKitchenAcc], ["🎨 Finish", selFinish]].map(([lbl, val]) => (
              <div key={lbl} className={`text-[10px] px-2.5 py-0.5 rounded-full border ${val ? "bg-nicara-gold/10 border-nicara-gold text-nicara-gold font-bold" : "bg-nicara-dark-deep border-stone-700 text-stone-600"}`}>
                {val ? `${lbl} ✓` : `${lbl} —`}
              </div>
            ))}
          </div>
          <button onClick={generateEstimate} disabled={!canGenerate || generating}
            className={`px-7 py-2.5 rounded-xl text-[13px] font-bold border-none flex items-center gap-2 transition-all ${
              canGenerate ? "btn-gold text-white cursor-pointer" : "bg-nicara-dark-deep text-stone-600 cursor-not-allowed"
            }`}>
            {generating ? <><span className="animate-spin-slow inline-block">⟳</span> Generating…</> : <>✦ Generate Estimate</>}
          </button>
        </div>
        {!canGenerate && (
          <div className="mt-2.5 text-[11px] text-stone-600 text-center">
            Select all 4 material preferences above to enable estimate generation
          </div>
        )}
      </div>

      {/* Top bar */}
      <div className="bg-nicara-dark rounded-xl p-3 px-4.5 mb-3.5 flex justify-between items-center flex-wrap gap-2.5">
        <div>
          <div className="text-[10px] text-stone-500 uppercase tracking-wider mb-0.5">Initial Estimate</div>
          <div className="text-2xl font-black text-nicara-gold">{fmt(totalInc)}</div>
          <div className="text-[11px] text-stone-500">{rows.length} items inc GST</div>
        </div>
        <div className="flex gap-2 items-center">
          <ExportBtn onClick={exportCSV} label="⬇ CSV" />
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4.5 py-2 bg-nicara-gold border-none rounded-lg text-white text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity">
            + Add Line Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-3 p-2.5 px-3.5 bg-white border border-nicara-light rounded-xl items-center">
        <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mr-1">Filter:</span>
        {([["Area", fArea, setFArea, uAreas], ["Category", fCat, setFCat, uCats], ["Vendor", fVendor, setFVendor, uVendors], ["Location", fFactory, setFFactory, uFactory]] as const).map(([lbl, val, setVal, opts]) => (
          <select key={lbl} value={val} onChange={(e) => (setVal as (v: string) => void)(e.target.value)} className={ddCls}>
            {(opts as string[]).map(o => <option key={o} value={o}>{o === "All" ? `All ${lbl}s` : o}</option>)}
          </select>
        ))}
        {(fArea !== "All" || fCat !== "All" || fVendor !== "All" || fFactory !== "All") && (
          <button onClick={() => { setFArea("All"); setFCat("All"); setFVendor("All"); setFFactory("All"); }}
            className="px-2.5 py-1 bg-transparent border border-nicara-light rounded-md text-[11px] text-stone-400 cursor-pointer hover:bg-nicara-cream transition-colors">✕ Clear</button>
        )}
        <span className="ml-auto text-[11px] text-stone-400">{filtered.length}/{rows.length}</span>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="text-center py-12 bg-white border-2 border-dashed border-nicara-light rounded-xl">
          <div className="text-3xl mb-3">📋</div>
          <div className="text-[15px] font-bold text-nicara-dark mb-1.5">No line items yet</div>
          <div className="text-xs text-stone-400 mb-4">Click <strong>+ Add Line Item</strong> — all fields have dropdowns.</div>
          <button onClick={() => setShowAdd(true)} className="px-6 py-2.5 bg-nicara-gold border-none rounded-xl text-white text-[13px] font-bold cursor-pointer">+ Add First Line Item</button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-nicara-light rounded-xl">
          <table className="w-full text-[11px] min-w-[1300px]">
            <thead>
              <tr className="bg-nicara-dark">
                {["#", "Area", "Category", "Sub Cat", "Item", "Finish", "Vendor Type", "Fac/Site", "Qty", "Unit", "Budget Note", "Amt Ex GST", "GST%", "GST Value", "Amt Inc GST", "▼", "🗑"].map((h, i) => (
                  <th key={i} className={`px-2 py-2 text-stone-200 font-semibold text-[10px] text-left whitespace-nowrap border-r border-stone-700 ${h === "🗑" ? "bg-nicara-dark-deep" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, ri) => {
                const gv = gstValue(row.amtEx, row.gstPct);
                const ig = incGST(row.amtEx, row.gstPct);
                const isOpen = !!expanded[row.id];
                const detailKey = SAMPLE_DETAIL[row.id] ? row.id : null;
                const hasDetail = !!detailKey;
                return (
                  <tr key={row.id} className={`border-b border-nicara-light ${isOpen ? "bg-nicara-gold-light border-l-[3px] border-l-nicara-gold" : ri % 2 === 0 ? "bg-nicara-cream" : "bg-white"}`}>
                    <td className="px-2 py-1.5 text-stone-400 border-r border-nicara-light">{ri + 1}</td>
                    <td className="px-2 py-1.5 font-semibold text-nicara-dark border-r border-nicara-light">
                      <InlineCell val={row.area || "—"} onChange={v => setRows(p => p.map(r => r.id === row.id ? { ...r, area: v } : r))} width="80px" />
                    </td>
                    <td className="px-2 py-1.5 border-r border-nicara-light">
                      <InlineCell val={row.category || "—"} onChange={v => setRows(p => p.map(r => r.id === row.id ? { ...r, category: v } : r))} width="80px" />
                    </td>
                    <td className="px-2 py-1.5 border-r border-nicara-light">
                      <InlineCell val={row.subcat || "—"} onChange={v => setRows(p => p.map(r => r.id === row.id ? { ...r, subcat: v } : r))} width="90px" />
                    </td>
                    <td className="px-2 py-1.5 font-semibold text-nicara-dark border-r border-nicara-light">
                      <InlineCell val={row.item || "—"} onChange={v => setRows(p => p.map(r => r.id === row.id ? { ...r, item: v } : r))} width="130px" />
                    </td>
                    <td className="px-2 py-1.5 border-r border-nicara-light">{row.finish || "—"}</td>
                    <td className="px-2 py-1.5 border-r border-nicara-light">{row.vendorType || "—"}</td>
                    <td className="px-2 py-1.5 border-r border-nicara-light text-center"><FactorySiteBadge value={row.factorySite} /></td>
                    <td className="px-2 py-1.5 border-r border-nicara-light text-right font-mono">{row.qty || "—"}</td>
                    <td className="px-2 py-1.5 border-r border-nicara-light">{row.unit || "—"}</td>
                    <td className="px-2 py-1.5 border-r border-nicara-light text-[10px] text-stone-600">{row.budgetNote || "—"}</td>
                    <td className="px-2 py-1.5 border-r border-nicara-light text-right font-semibold font-mono">{row.amtEx > 0 ? fmt(row.amtEx) : "—"}</td>
                    <td className="px-2 py-1.5 border-r border-nicara-light text-center text-stone-500">{row.gstPct || 18}%</td>
                    <td className="px-2 py-1.5 border-r border-nicara-light text-right text-stone-600 font-mono">{fmt(gv)}</td>
                    <td className="px-2 py-1.5 border-r border-nicara-light text-right font-bold text-nicara-gold font-mono">{fmt(ig)}</td>
                    <td className="px-2 py-1.5 border-r border-nicara-light text-center">
                      {hasDetail ? (
                        <button onClick={() => setExpanded(p => ({ ...p, [row.id]: !p[row.id] }))}
                          className={`px-2 py-0.5 rounded-md text-[10px] cursor-pointer border ${isOpen ? "bg-nicara-gold-light border-nicara-gold text-nicara-gold" : "bg-nicara-cream border-nicara-light text-stone-500"}`}>
                          {isOpen ? "▲" : "▼"}
                        </button>
                      ) : <span className="text-stone-300 text-[10px]">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => setRows(p => p.filter(r => r.id !== row.id))}
                        className="bg-transparent border-none text-red-300 cursor-pointer text-[15px] p-0 hover:text-red-500 transition-colors" title="Delete row">🗑</button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-nicara-dark">
                <td colSpan={14} className="p-2.5 text-stone-200 font-bold text-right text-xs">GRAND TOTAL ({rows.length} items)</td>
                <td className="p-2.5 text-nicara-gold font-black text-right font-mono text-[15px]">{fmt(totalInc)}</td>
                <td className="bg-nicara-dark" /><td className="bg-nicara-dark" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Main Tab ────────────────────────────────────────────────── */
export default function InitialEstimate() {
  const [mode, setMode] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [view, setView] = useState("summary");
  const [rows, setRows] = useState<EstimateTableRow[]>(SAMPLE_EST_ROWS);

  if (!mode) return <ModeSelector tab="Initial Estimate" onSelect={setMode} />;

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-3.5">
        <div className="flex items-center gap-2">
          <BackBtn onClick={() => { setMode(null); setAiDone(false); }} />
          {mode === "ai" && <AIBadge />}
          <div className="flex border-b border-nicara-light">
            {[["summary", "Summary"], ["estimate", "Estimate"]].map(([id, lbl]) => (
              <button key={id} onClick={() => setView(id)}
                className={`px-4 py-2 bg-transparent border-none text-[13px] cursor-pointer ${view === id ? "text-nicara-gold border-b-2 border-nicara-gold font-bold" : "text-stone-500 border-b-2 border-transparent"}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <SendBar phone="9810011111" emails={[
          { label: "Welcome Email", subject: WELCOME_EMAIL.subject, body: WELCOME_EMAIL.body },
          { label: "Payment Request", subject: PAYMENT_REQUEST_EMAIL.subject, body: PAYMENT_REQUEST_EMAIL.body },
          { label: "Payment Ack", subject: PAYMENT_ACK_EMAIL.subject, body: PAYMENT_ACK_EMAIL.body },
        ]} />
      </div>

      {view === "summary" && <EstSummary rows={rows} />}
      {view === "estimate" && (
        mode === "ai" && !aiDone
          ? <AILoader lines={["Analyses past projects with similar area.", "Pre-fills line items based on requirements."]} onDone={() => setAiDone(true)} />
          : <>
              {mode === "ai" && aiDone && <AIDoneBar msg="AI Estimate Generated — review and edit below" />}
              <InitEstTable rows={rows} setRows={setRows} />
            </>
      )}
    </div>
  );
}
