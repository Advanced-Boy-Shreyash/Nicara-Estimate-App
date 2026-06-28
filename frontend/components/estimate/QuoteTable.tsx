"use client";

import { useState } from "react";

/* ── Estimate row matching sample template.xlsx ──────────────── */
export interface QuoteItem {
  siNo: number;
  area: string;
  item: string;
  width: string;   // e.g. "8'0\""
  height: string;
  depth: string;
  amount: number;
  specs: string[];  // Expandable detail specs
}

interface QuoteTableProps {
  items: QuoteItem[];
  grandTotal: number;
}

export default function QuoteTable({ items, grandTotal }: QuoteTableProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

  /* Group by area for subtotals */
  const areaGroups = items.reduce<Record<string, { items: QuoteItem[]; total: number }>>((acc, item) => {
    if (!acc[item.area]) acc[item.area] = { items: [], total: 0 };
    acc[item.area].items.push(item);
    acc[item.area].total += item.amount;
    return acc;
  }, {});

  return (
    <div className="print-break">
      <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-wider mb-3 flex items-center gap-2">
        📊 Estimate Summary
      </div>

      <div className="border border-surface-200 rounded-2xl overflow-hidden shadow-sm bg-white">
        <table className="w-full text-[12px] quote-table">
          <thead>
            <tr className="bg-nicara-dark">
              {["SI No", "Area", "Item", "Width", "Height", "Depth", "Amount", ""].map((h, i) => (
                <th key={i} className={`px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider ${h === "Amount" ? "text-right" : ""} ${h === "" ? "w-8" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, ri) => {
              const isOpen = !!expanded[item.siNo];
              const hasSpecs = item.specs.length > 0;
              return (
                <>
                  <tr key={item.siNo} className={`border-b border-surface-100 transition-colors ${isOpen ? "bg-nicara-gold-light" : ri % 2 === 0 ? "bg-surface-50" : "bg-white"} ${hasSpecs ? "cursor-pointer" : ""}`}
                    onClick={() => hasSpecs && setExpanded(p => ({ ...p, [item.siNo]: !p[item.siNo] }))}>
                    <td className="px-3 py-2 text-surface-400 font-mono text-[11px]">{item.siNo}</td>
                    <td className="px-3 py-2 font-semibold text-nicara-dark">{item.area}</td>
                    <td className="px-3 py-2 font-semibold text-nicara-dark">{item.item}</td>
                    <td className="px-3 py-2 font-mono text-surface-600">{item.width || "—"}</td>
                    <td className="px-3 py-2 font-mono text-surface-600">{item.height || "—"}</td>
                    <td className="px-3 py-2 font-mono text-surface-600">{item.depth || "—"}</td>
                    <td className="px-3 py-2 text-right font-bold text-nicara-dark font-mono">{fmt(item.amount)}</td>
                    <td className="px-2 py-2 text-center">
                      {hasSpecs && (
                        <span className={`text-[10px] transition-transform inline-block ${isOpen ? "text-nicara-gold" : "text-surface-400"}`}>
                          {isOpen ? "▲" : "▼"}
                        </span>
                      )}
                    </td>
                  </tr>
                  {isOpen && hasSpecs && (
                    <tr key={item.siNo + "-specs"} className="bg-nicara-gold-light/50">
                      <td colSpan={8} className="px-4 py-2.5">
                        <div className="pl-8 text-[11px] text-surface-600">
                          <div className="text-[9px] font-bold text-nicara-gold uppercase tracking-wider mb-1.5">Specifications</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                            {item.specs.map((spec, si) => (
                              <div key={si} className="flex items-start gap-1.5 py-0.5">
                                <span className="text-nicara-gold mt-0.5">•</span>
                                <span>{spec}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}

            {/* Area Subtotals */}
            <tr className="bg-surface-100 border-t-2 border-surface-300">
              <td colSpan={8} className="px-3 py-2">
                <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-wider mb-1.5">Area-wise Breakdown</div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(areaGroups).map(([area, data]) => (
                    <div key={area} className="flex justify-between bg-white rounded-lg px-2.5 py-1.5 border border-surface-200">
                      <span className="text-[11px] text-surface-600 truncate">{area}</span>
                      <span className="text-[11px] font-bold text-nicara-dark ml-1">{fmt(data.total)}</span>
                    </div>
                  ))}
                </div>
              </td>
            </tr>

            {/* Grand Total */}
            <tr className="bg-nicara-dark">
              <td colSpan={6} className="px-3 py-3 text-right">
                <span className="text-[13px] font-bold text-surface-300">GRAND TOTAL</span>
              </td>
              <td className="px-3 py-3 text-right">
                <span className="text-[17px] font-black text-nicara-gold font-mono">{fmt(grandTotal)}</span>
              </td>
              <td className="bg-nicara-dark" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
