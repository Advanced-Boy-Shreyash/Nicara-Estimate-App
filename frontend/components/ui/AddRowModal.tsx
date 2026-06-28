"use client";

import { useState } from "react";
import {
  DD_AREAS, DD_CATEGORIES, DD_SUBCATEGORIES, DD_ITEMS,
  DD_FINISH, DD_VENDOR, DD_FACTORY, DD_UNITS, DD_PAY_STAGE, DD_PAID,
} from "@/lib/constants";
import type { EstimateTableRow, FinalEstimateRow } from "@/lib/types";

interface AddRowModalProps {
  onAdd: (row: EstimateTableRow | FinalEstimateRow) => void;
  onClose: () => void;
  isFinal?: boolean;
}

const S = "w-full px-2.5 py-2 border border-nicara-light rounded-lg text-xs outline-none bg-white cursor-pointer focus:border-nicara-gold";
const I = "w-full px-2.5 py-2 border border-nicara-light rounded-lg text-xs outline-none bg-white focus:border-nicara-gold";
const Label = "text-[10px] text-stone-400 uppercase tracking-wider mb-1 font-bold";

export default function AddRowModal({ onAdd, onClose, isFinal = false }: AddRowModalProps) {
  const [area, setArea] = useState("");
  const [cat, setCat] = useState("");
  const [subcat, setSubcat] = useState("");
  const [item, setItem] = useState("");
  const [customItem, setCustomItem] = useState("");
  const [finish, setFinish] = useState("");
  const [vendorType, setVendorType] = useState("");
  const [factorySite, setFactorySite] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [depth, setDepth] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("Sqft");
  const [amtEx, setAmtEx] = useState("");
  const [gstPct, setGstPct] = useState("18");
  const [budgetNote, setBudgetNote] = useState("");
  // Final-specific
  const [vendorCode, setVendorCode] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [rateEx, setRateEx] = useState("");
  const [payStage, setPayStage] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paidDate, setPaidDate] = useState("Pending");
  const [bank, setBank] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");

  const cats = area ? DD_CATEGORIES[area] || [] : [];
  const subcats = cat ? DD_SUBCATEGORIES[cat] || [] : [];
  const items = subcat ? DD_ITEMS[subcat] || [] : [];

  const finalItem = customItem || item;

  const add = () => {
    if (!area || !finalItem) return;
    const base: EstimateTableRow = {
      id: Date.now(),
      si: 0,
      area,
      category: cat,
      subcat,
      item: finalItem,
      finish,
      vendorType,
      factorySite,
      length,
      width,
      height,
      depth,
      qty,
      unit,
      budgetNote,
      amtEx: Number(amtEx) || 0,
      gstPct: Number(gstPct) || 18,
      summaryCategory: "Furniture",
    };

    if (isFinal) {
      const finalRow: FinalEstimateRow = {
        ...base,
        vendorCode,
        vendorName,
        rateEx: Number(rateEx) || 0,
        payStage,
        dueDate,
        paidDate,
        bank,
        expected: Number(expected) || 0,
        actual: Number(actual) || 0,
      };
      onAdd(finalRow);
    } else {
      onAdd(base);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-[500] p-5 pt-[80px] modal-overlay overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 px-7 max-w-3xl w-full shadow-2xl animate-slide-up">
        <div className="flex justify-between items-center mb-5">
          <div>
            <div className="text-[15px] font-bold text-nicara-dark">
              Add Line Item
            </div>
            <div className="text-xs text-stone-400 mt-0.5">
              All fields have dropdown options — select or type custom values
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-stone-400 text-xl cursor-pointer hover:text-nicara-gold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Grid form */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div>
            <div className={Label}>Area *</div>
            <select value={area} onChange={e => { setArea(e.target.value); setCat(""); setSubcat(""); setItem(""); }} className={S}>
              <option value="">Select…</option>
              {DD_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <div className={Label}>Category</div>
            <select value={cat} onChange={e => { setCat(e.target.value); setSubcat(""); setItem(""); }} className={S}>
              <option value="">Select…</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className={Label}>Sub Category</div>
            <select value={subcat} onChange={e => { setSubcat(e.target.value); setItem(""); }} className={S}>
              <option value="">Select…</option>
              {subcats.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className={Label}>Item (dropdown)</div>
            <select value={item} onChange={e => setItem(e.target.value)} className={S}>
              <option value="">Select…</option>
              {items.map(it => <option key={it} value={it}>{it}</option>)}
            </select>
          </div>
          <div>
            <div className={Label}>Or Custom Item Name *</div>
            <input value={customItem} onChange={e => setCustomItem(e.target.value)} placeholder="e.g. Custom TV Unit" className={I} />
          </div>
          <div>
            <div className={Label}>Finish</div>
            <select value={finish} onChange={e => setFinish(e.target.value)} className={S}>
              <option value="">Select…</option>
              {DD_FINISH.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <div className={Label}>Vendor Type</div>
            <select value={vendorType} onChange={e => setVendorType(e.target.value)} className={S}>
              <option value="">Select…</option>
              {DD_VENDOR.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <div className={Label}>Factory / Site</div>
            <select value={factorySite} onChange={e => setFactorySite(e.target.value)} className={S}>
              <option value="">Select…</option>
              {DD_FACTORY.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <div className={Label}>Unit</div>
            <select value={unit} onChange={e => setUnit(e.target.value)} className={S}>
              {DD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Dimensions + amounts */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[["Length", length, setLength], ["Width", width, setWidth], ["Height", height, setHeight], ["Depth", depth, setDepth]].map(([lbl, val, setVal]) => (
            <div key={lbl as string}>
              <div className={Label}>{lbl as string}</div>
              <input value={val as string} onChange={e => (setVal as (v: string) => void)(e.target.value)} placeholder="—" className={I} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div>
            <div className={Label}>Qty</div>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" className={I} />
          </div>
          <div>
            <div className={Label}>Amt Ex GST (₹)</div>
            <input type="number" value={amtEx} onChange={e => setAmtEx(e.target.value)} placeholder="0" className={I} />
          </div>
          <div>
            <div className={Label}>GST %</div>
            <input type="number" value={gstPct} onChange={e => setGstPct(e.target.value)} className={I} />
          </div>
          <div>
            <div className={Label}>Budget Note</div>
            <input value={budgetNote} onChange={e => setBudgetNote(e.target.value)} placeholder="e.g. ₹25/sft" className={I} />
          </div>
        </div>

        {/* Final estimate extra fields */}
        {isFinal && (
          <div className="grid grid-cols-4 gap-3 mb-5 pt-3 border-t border-nicara-light">
            <div>
              <div className={Label}>Vendor Code</div>
              <input value={vendorCode} onChange={e => setVendorCode(e.target.value)} placeholder="PV001" className={I} />
            </div>
            <div>
              <div className={Label}>Vendor Name</div>
              <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor" className={I} />
            </div>
            <div>
              <div className={Label}>Rate Ex GST</div>
              <input type="number" value={rateEx} onChange={e => setRateEx(e.target.value)} placeholder="0" className={I} />
            </div>
            <div>
              <div className={Label}>Payment Stage</div>
              <select value={payStage} onChange={e => setPayStage(e.target.value)} className={S}>
                <option value="">Select…</option>
                {DD_PAY_STAGE.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div className={Label}>Due Date</div>
              <input value={dueDate} onChange={e => setDueDate(e.target.value)} placeholder="DD Mon" className={I} />
            </div>
            <div>
              <div className={Label}>Paid Status</div>
              <select value={paidDate} onChange={e => setPaidDate(e.target.value)} className={S}>
                {DD_PAID.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div className={Label}>Bank/UPI</div>
              <input value={bank} onChange={e => setBank(e.target.value)} placeholder="HDFC/UPI" className={I} />
            </div>
            <div>
              <div className={Label}>Expected (₹)</div>
              <input type="number" value={expected} onChange={e => setExpected(e.target.value)} placeholder="0" className={I} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 bg-transparent border border-nicara-light rounded-lg text-xs text-stone-500 cursor-pointer hover:bg-nicara-cream transition-colors">
            Cancel
          </button>
          <button
            onClick={add}
            disabled={!area || !finalItem}
            className={`px-6 py-2.5 rounded-lg text-xs font-bold cursor-pointer border-none transition-all ${
              area && finalItem
                ? "btn-gold text-white"
                : "bg-stone-200 text-stone-400 cursor-not-allowed"
            }`}
          >
            Add Line Item
          </button>
        </div>
      </div>
    </div>
  );
}
