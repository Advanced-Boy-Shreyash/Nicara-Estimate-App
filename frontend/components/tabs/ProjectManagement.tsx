"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import ExportBtn from "@/components/ui/ExportBtn";
import SendBar from "@/components/ui/SendBar";
import {
  ITEMIZED_ROWS, ITEM_TASKS, TASK_STATUS_OPTS,
  INIT_PROC_ROWS, PROCUREMENT_CATEGORIES,
  PROJECT_COMPLETION_EMAIL, SAMPLE_DETAIL,
} from "@/lib/constants";
import { fmt, gstValue, incGST, exportCSVFile } from "@/lib/utils";
import type { ProcurementRow } from "@/lib/types";

/* ── Itemized Dues ───────────────────────────────────────────── */
function ItemizedDues() {
  const [taskStatus, setTaskStatus] = useState<Record<number, Record<string, string>>>(() => {
    const s: Record<number, Record<string, string>> = {};
    ITEMIZED_ROWS.forEach(r => { s[r.id] = {}; ITEM_TASKS.forEach(t => { s[r.id][t] = "Not Started"; }); });
    return s;
  });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [fArea, setFArea] = useState("All");
  const [fPaid, setFPaid] = useState("All");

  const uAreas = ["All", ...new Set(ITEMIZED_ROWS.map(r => r.area))];
  const filtered = ITEMIZED_ROWS.filter(r => (fArea === "All" || r.area === fArea) && (fPaid === "All" || r.paidDate === fPaid));
  const totalDue = ITEMIZED_ROWS.filter(r => r.paidDate !== "Paid").reduce((s, r) => s + incGST(r.amtEx, r.gstPct), 0);
  const totalPaid = ITEMIZED_ROWS.filter(r => r.paidDate === "Paid").reduce((s, r) => s + incGST(r.amtEx, r.gstPct), 0);
  const totalAll = ITEMIZED_ROWS.reduce((s, r) => s + incGST(r.amtEx, r.gstPct), 0);
  const ddCls = "px-2.5 py-1.5 border border-nicara-light rounded-lg text-[11px] outline-none bg-white cursor-pointer";

  const setTask = (itemId: number, task: string, status: string) =>
    setTaskStatus(p => ({ ...p, [itemId]: { ...p[itemId], [task]: status } }));

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5 mb-3.5">
        {[["Total Payable", fmt(totalAll), "text-nicara-gold"], ["Amount Paid", fmt(totalPaid), "text-emerald-600"], ["Amount Due", fmt(totalDue), "text-red-600"]].map(([l, v, vc]) => (
          <div key={l} className="bg-white border border-nicara-light rounded-xl p-3">
            <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">{l}</div>
            <div className={`text-lg font-extrabold ${vc}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap mb-3 items-center">
        <select value={fArea} onChange={e => setFArea(e.target.value)} className={ddCls}>
          {uAreas.map(a => <option key={a} value={a}>{a === "All" ? "All Areas" : a}</option>)}
        </select>
        <select value={fPaid} onChange={e => setFPaid(e.target.value)} className={ddCls}>
          {["All", "Paid", "Pending", "Partial"].map(s => <option key={s} value={s}>{s === "All" ? "All Status" : s}</option>)}
        </select>
        <span className="text-[11px] text-stone-400">{filtered.length}/{ITEMIZED_ROWS.length} items</span>
        <div className="ml-auto"><ExportBtn onClick={() => {}} label="⬇ Export CSV" /></div>
      </div>
      <div className="overflow-x-auto border border-nicara-light rounded-xl">
        <table className="w-full text-[11px] min-w-[1100px]">
          <thead>
            <tr className="bg-nicara-dark">
              {["#", "Area", "Category", "Item", "Vendor", "Amt Ex GST", "GST%", "Amt Inc GST", "Pay Stage", "Due", "Paid", "Bank", "Tasks ▼"].map((h, i) => (
                <th key={i} className="px-2 py-2 text-stone-200 font-semibold text-[10px] text-left whitespace-nowrap border-r border-stone-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, ri) => {
              const ig = incGST(row.amtEx, row.gstPct);
              const isOpen = !!expanded[row.id];
              const tasks = taskStatus[row.id] || {};
              const doneCount = Object.values(tasks).filter(s => s === "Completed").length;
              return (
                <tr key={row.id} className={`border-b border-nicara-light ${isOpen ? "bg-nicara-gold-light border-l-[3px] border-l-nicara-gold" : ri % 2 === 0 ? "bg-nicara-cream" : "bg-white"}`}>
                  <td className="px-2 py-1.5 text-stone-400 border-r border-nicara-light">{ri + 1}</td>
                  <td className="px-2 py-1.5 font-semibold text-nicara-dark border-r border-nicara-light">{row.area}</td>
                  <td className="px-2 py-1.5 border-r border-nicara-light">{row.category}</td>
                  <td className="px-2 py-1.5 font-semibold text-nicara-dark border-r border-nicara-light">{row.item}</td>
                  <td className="px-2 py-1.5 border-r border-nicara-light">{row.vendor}</td>
                  <td className="px-2 py-1.5 border-r border-nicara-light text-right font-mono font-semibold">{fmt(row.amtEx)}</td>
                  <td className="px-2 py-1.5 border-r border-nicara-light text-center text-stone-500">{row.gstPct}%</td>
                  <td className="px-2 py-1.5 border-r border-nicara-light text-right font-mono font-bold text-nicara-gold">{fmt(ig)}</td>
                  <td className="px-2 py-1.5 border-r border-nicara-light">{row.payStage}</td>
                  <td className="px-2 py-1.5 border-r border-nicara-light text-center">{row.dueDate}</td>
                  <td className="px-2 py-1.5 border-r border-nicara-light text-center"><StatusBadge status={row.paidDate} /></td>
                  <td className="px-2 py-1.5 border-r border-nicara-light">{row.bank || "—"}</td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => setExpanded(p => ({ ...p, [row.id]: !p[row.id] }))}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] cursor-pointer font-semibold border ${
                        isOpen ? "bg-nicara-gold-light border-nicara-gold text-nicara-gold" : "bg-nicara-cream border-nicara-light text-stone-600"
                      }`}>
                      {isOpen ? "▲" : "▼"} {doneCount}/{ITEM_TASKS.length}{doneCount === ITEM_TASKS.length && " ✓"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Procurement ─────────────────────────────────────────────── */
function Procurement() {
  const [rows, setRows] = useState<ProcurementRow[]>(INIT_PROC_ROWS);
  const [fCat, setFCat] = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({ cat: "", material: "", brand: "", model: "", qty: "", unit: "Nos", price: "", vendor: "", status: "Pending" });

  const uCats = ["All", ...PROCUREMENT_CATEGORIES.map(c => c.cat)];
  const catItems = PROCUREMENT_CATEGORIES.find(c => c.cat === newRow.cat)?.items || [];
  const filtered = rows.filter(r => (fCat === "All" || r.cat === fCat) && (fStatus === "All" || r.status === fStatus));
  const totalValue = rows.reduce((s, r) => s + r.qty * r.price, 0);
  const pendingValue = rows.filter(r => r.status === "Pending").reduce((s, r) => s + r.qty * r.price, 0);
  const ddCls = "px-2.5 py-1.5 border border-nicara-light rounded-lg text-[11px] outline-none bg-white cursor-pointer";
  const inputCls = "w-full px-2.5 py-2 border border-nicara-light rounded-lg text-xs outline-none bg-white focus:border-nicara-gold";

  const addRow = () => {
    if (!newRow.material || !newRow.qty) return;
    setRows(p => [...p, { ...newRow, id: "p" + Date.now(), qty: Number(newRow.qty) || 0, price: Number(newRow.price) || 0 }]);
    setNewRow({ cat: "", material: "", brand: "", model: "", qty: "", unit: "Nos", price: "", vendor: "", status: "Pending" });
    setShowAdd(false);
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        {[["Total Materials", rows.length + " items", "text-nicara-gold"], ["Total Value", fmt(totalValue), "text-nicara-dark"], ["Pending Value", fmt(pendingValue), "text-red-600"], ["Ordered", rows.filter(r => r.status === "Ordered").length + " items", "text-emerald-600"]].map(([l, v, vc]) => (
          <div key={l} className="bg-white border border-nicara-light rounded-xl p-3">
            <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">{l}</div>
            <div className={`text-base font-extrabold ${vc}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap mb-3 items-center">
        <select value={fCat} onChange={e => setFCat(e.target.value)} className={ddCls}>
          {uCats.map(c => <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>)}
        </select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={ddCls}>
          {["All", "Pending", "Ordered", "Received"].map(s => <option key={s} value={s}>{s === "All" ? "All Status" : s}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <ExportBtn onClick={() => {}} />
          <button onClick={() => setShowAdd(v => !v)} className="px-4.5 py-2 bg-nicara-gold border-none rounded-lg text-white text-xs font-bold cursor-pointer">+ Add Material</button>
        </div>
      </div>
      {showAdd && (
        <div className="bg-nicara-cream border border-nicara-light rounded-xl p-4 mb-3.5 animate-slide-up">
          <div className="text-xs font-bold text-nicara-dark mb-3">Add Procurement Item</div>
          <div className="grid grid-cols-3 gap-2.5 mb-2.5">
            <div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1 font-bold">Category</div>
              <select value={newRow.cat} onChange={e => setNewRow(p => ({ ...p, cat: e.target.value, material: "" }))} className={inputCls + " cursor-pointer"}>
                <option value="">Select…</option>
                {PROCUREMENT_CATEGORIES.map(c => <option key={c.cat} value={c.cat}>{c.cat}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1 font-bold">Material</div>
              <select value={newRow.material} onChange={e => setNewRow(p => ({ ...p, material: e.target.value }))} className={inputCls + " cursor-pointer"}>
                <option value="">Select…</option>
                {catItems.map(it => <option key={it} value={it}>{it}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1 font-bold">Brand</div>
              <input value={newRow.brand} onChange={e => setNewRow(p => ({ ...p, brand: e.target.value }))} placeholder="e.g. Hettich" className={inputCls} />
            </div>
            <div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1 font-bold">Qty</div>
              <input type="number" value={newRow.qty} onChange={e => setNewRow(p => ({ ...p, qty: e.target.value }))} placeholder="0" className={inputCls} />
            </div>
            <div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1 font-bold">Unit Price (₹)</div>
              <input type="number" value={newRow.price} onChange={e => setNewRow(p => ({ ...p, price: e.target.value }))} placeholder="0" className={inputCls} />
            </div>
            <div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1 font-bold">Vendor</div>
              <input value={newRow.vendor} onChange={e => setNewRow(p => ({ ...p, vendor: e.target.value }))} placeholder="Supplier" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addRow} className="px-5 py-2 bg-nicara-gold border-none rounded-lg text-white text-xs font-bold cursor-pointer">Add</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-transparent border border-nicara-light rounded-lg text-xs text-stone-500 cursor-pointer">Cancel</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto border border-nicara-light rounded-xl">
        <table className="w-full text-[11px] min-w-[900px]">
          <thead>
            <tr className="bg-nicara-dark">
              {["#", "Category", "Material", "Brand", "Model", "Qty", "Unit", "Unit Price", "Total Value", "Vendor", "Status", "🗑"].map((h, i) => (
                <th key={i} className="px-2 py-2 text-stone-200 font-semibold text-[10px] text-left whitespace-nowrap border-r border-stone-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, ri) => (
              <tr key={row.id} className={`border-b border-nicara-light ${ri % 2 === 0 ? "bg-nicara-cream" : "bg-white"}`}>
                <td className="px-2 py-1.5 text-stone-400 border-r border-nicara-light">{ri + 1}</td>
                <td className="px-2 py-1.5 border-r border-nicara-light">{row.cat}</td>
                <td className="px-2 py-1.5 font-semibold text-nicara-dark border-r border-nicara-light">{row.material}</td>
                <td className="px-2 py-1.5 border-r border-nicara-light">{row.brand}</td>
                <td className="px-2 py-1.5 border-r border-nicara-light">{row.model}</td>
                <td className="px-2 py-1.5 text-right font-mono border-r border-nicara-light">{row.qty}</td>
                <td className="px-2 py-1.5 text-stone-500 border-r border-nicara-light">{row.unit}</td>
                <td className="px-2 py-1.5 text-right font-mono border-r border-nicara-light">₹{row.price.toLocaleString("en-IN")}</td>
                <td className="px-2 py-1.5 text-right font-mono font-bold text-nicara-gold border-r border-nicara-light">₹{(row.qty * row.price).toLocaleString("en-IN")}</td>
                <td className="px-2 py-1.5 border-r border-nicara-light">{row.vendor}</td>
                <td className="px-2 py-1.5 border-r border-nicara-light text-center"><StatusBadge status={row.status} /></td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => setRows(p => p.filter(r => r.id !== row.id))} className="bg-transparent border-none text-red-300 cursor-pointer text-[15px] p-0 hover:text-red-500">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main ProjectManagement ──────────────────────────────────── */
export default function ProjectManagement() {
  const [sub, setSub] = useState("itemized");

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="flex border-b border-nicara-light overflow-x-auto flex-1">
          {[["itemized", "Itemized Dues"], ["procurement", "Procurement"]].map(([id, label]) => (
            <button key={id} onClick={() => setSub(id)}
              className={`px-4 py-2 bg-transparent border-none text-xs cursor-pointer whitespace-nowrap ${
                sub === id ? "text-nicara-gold border-b-2 border-nicara-gold font-bold" : "text-stone-500 border-b-2 border-transparent"
              }`}>
              {label}
            </button>
          ))}
        </div>
        <SendBar phone="9810011111" emails={[{ label: "Project Completion", subject: PROJECT_COMPLETION_EMAIL.subject, body: PROJECT_COMPLETION_EMAIL.body }]} />
      </div>
      {sub === "itemized" && <ItemizedDues />}
      {sub === "procurement" && <Procurement />}
    </div>
  );
}
