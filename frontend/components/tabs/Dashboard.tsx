"use client";

import { useState } from "react";
import ModeSelector, { AILoader, AIDoneBar, BackBtn } from "@/components/ui/ModeSelector";
import { AIBadge } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import { ESTIMATE_ITEMS, PAY_SCHED, TOTAL } from "@/lib/constants";
import { fmt } from "@/lib/utils";

export default function Dashboard() {
  const [mode, setMode] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [sec, setSec] = useState("overview");

  if (!mode) return <ModeSelector tab="Dashboard" onSelect={setMode} />;

  const received = PAY_SCHED.filter((_, i) => i < 3).reduce((s, p) => s + p.amount, 0);
  const pending = TOTAL - received;
  const vendorTotal = 2115000;
  const profit = TOTAL - vendorTotal;
  const margin = ((profit / TOTAL) * 100).toFixed(1);

  const SECS = [["overview", "Overview"], ["profit", "Profitability"], ["costsheet", "Cost Sheet"], ["vendorpay", "Vendor Payments"], ["clientpay", "Client Payments"], ["final", "Final Dashboard"]];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3.5">
        <BackBtn onClick={() => { setMode(null); setAiDone(false); }} />
        {mode === "ai" && <AIBadge />}
        <div className="flex overflow-x-auto border-b border-nicara-light flex-1">
          {SECS.map(([id, label]) => (
            <button key={id} onClick={() => setSec(id)}
              className={`px-3.5 py-2 bg-transparent border-none text-xs cursor-pointer whitespace-nowrap ${
                sec === id ? "text-nicara-gold border-b-2 border-nicara-gold font-semibold" : "text-stone-500 border-b-2 border-transparent"
              }`}>{label}</button>
          ))}
        </div>
      </div>

      {mode === "ai" && !aiDone ? (
        <AILoader lines={["Consolidates all project data into one live view.", "Flags cost overruns and payment delays automatically."]} onDone={() => setAiDone(true)} />
      ) : (
        <>
          {mode === "ai" && aiDone && <AIDoneBar msg="AI Dashboard Active — all data synced" />}

          {sec === "overview" && (
            <div>
              <div className="grid grid-cols-4 gap-2.5 mb-4">
                {[["Contract Value", fmt(TOTAL), ""], ["Received", fmt(received), Math.round(received / TOTAL * 100) + "%"], ["Pending", fmt(pending), ""], ["Gross Margin", margin + "%", "On Track"]].map(([l, v, s]) => (
                  <Card key={l}>
                    <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1.5">{l}</div>
                    <div className="text-xl font-extrabold text-nicara-gold">{v}</div>
                    {s && <div className="text-[11px] text-nicara-teal mt-0.5">{s}</div>}
                  </Card>
                ))}
              </div>
              <SectionHeader title="Area-wise Breakdown" />
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(ESTIMATE_ITEMS.reduce((a, i) => { a[i.area] = (a[i.area] || 0) + i.amount; return a; }, {} as Record<string, number>)).map(([area, amt]) => (
                  <div key={area} className="bg-white border border-nicara-light rounded-lg p-2.5 cursor-pointer hover:border-nicara-gold transition-colors card-hover">
                    <div className="text-[10px] text-stone-400 mb-0.5 truncate">{area}</div>
                    <div className="text-[13px] font-bold text-nicara-dark">{fmt(amt)}</div>
                    <div className="text-[10px] text-nicara-teal mt-0.5">{((amt / TOTAL) * 100).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sec === "profit" && (
            <div>
              <SectionHeader title="Project Profitability Table" />
              <div className="overflow-x-auto border border-nicara-light rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-nicara-dark">
                      {["Area", "Revenue", "Material Cost", "Labour", "Gross Profit", "Margin %"].map(h => (
                        <th key={h} className="px-2.5 py-2 text-stone-200 font-semibold text-left text-[11px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[["Kitchen", 921471, 350000, 200000], ["Master Bedroom", 647591, 200000, 160000], ["Suite 1+2+3", 1386799, 430000, 360000], ["Living Areas", 379357, 110000, 90000], ["Pooja + Wall", 286226, 80000, 70000], ["Services", 761143, 100000, 150000]].map(([area, rev, mat, lab], i) => {
                      const gp = (rev as number) - (mat as number) - (lab as number);
                      const m = ((gp / (rev as number)) * 100).toFixed(1);
                      return (
                        <tr key={area as string} className={`border-b border-nicara-light ${i % 2 === 0 ? "bg-nicara-cream" : "bg-white"}`}>
                          <td className="px-2.5 py-2 font-semibold text-nicara-dark">{area as string}</td>
                          <td className="px-2.5 py-2 text-nicara-dark">{fmt(rev as number)}</td>
                          <td className="px-2.5 py-2 text-stone-600">{fmt(mat as number)}</td>
                          <td className="px-2.5 py-2 text-stone-600">{fmt(lab as number)}</td>
                          <td className="px-2.5 py-2 text-nicara-gold font-bold">{fmt(gp)}</td>
                          <td className="px-2.5 py-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-[5px] bg-nicara-light rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: m + "%", background: Number(m) > 40 ? "var(--color-nicara-teal)" : "var(--color-nicara-gold)" }} />
                              </div>
                              <span className={`text-[11px] font-bold ${Number(m) > 40 ? "text-nicara-teal" : "text-nicara-gold"}`}>{m}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-nicara-dark">
                      <td className="p-2.5 text-stone-200 font-bold">TOTAL</td>
                      <td className="p-2.5 text-nicara-gold font-extrabold">{fmt(TOTAL)}</td>
                      <td className="p-2.5 text-stone-400">{fmt(1270000)}</td>
                      <td className="p-2.5 text-stone-400">{fmt(1030000)}</td>
                      <td className="p-2.5 text-nicara-gold font-extrabold">{fmt(profit)}</td>
                      <td className="p-2.5 text-nicara-teal font-extrabold">{margin}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sec === "clientpay" && (
            <div>
              <SectionHeader title="Client Payment Table" />
              <Card className="mb-3.5">
                <div className="text-[11px] text-stone-400 uppercase tracking-wider mb-2">Collection Progress</div>
                <div className="h-2.5 bg-nicara-light rounded-full overflow-hidden mb-1.5">
                  <div className="h-full progress-bar" style={{ width: Math.round(received / TOTAL * 100) + "%" }} />
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-nicara-teal font-bold">{fmt(received)} collected ({Math.round(received / TOTAL * 100)}%)</span>
                  <span className="text-nicara-gold font-bold">{fmt(pending)} pending</span>
                </div>
              </Card>
              <div className="overflow-x-auto border border-nicara-light rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-nicara-dark">
                      {["#", "Stage", "Mode", "Amount", "Expected", "Received", "Status"].map(h => (
                        <th key={h} className="px-2.5 py-2 text-stone-200 font-semibold text-left text-[11px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PAY_SCHED.map((row, i) => {
                      const dates = [["15 Apr", "15 Apr"], ["20 Apr", "22 Apr"], ["10 May", "12 May"], ["15 Jun", "—"], ["20 Jun", "—"], ["30 Jun", "—"]];
                      const isPaid = i < 3;
                      return (
                        <tr key={i} className={`border-b border-nicara-light ${i % 2 === 0 ? "bg-nicara-cream" : "bg-white"}`}>
                          <td className="px-2.5 py-2 text-stone-400 text-[11px]">{row.no}</td>
                          <td className="px-2.5 py-2 font-semibold text-nicara-dark">{row.stage}</td>
                          <td className="px-2.5 py-2">
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${row.mode === "Bank" ? "bg-blue-50 text-blue-800" : "bg-orange-50 text-orange-700"}`}>{row.mode}</span>
                          </td>
                          <td className="px-2.5 py-2 text-nicara-gold font-bold">{fmt(row.amount)}</td>
                          <td className="px-2.5 py-2 text-stone-600 text-[11px]">{dates[i][0]}</td>
                          <td className={`px-2.5 py-2 text-[11px] ${isPaid ? "text-nicara-teal" : "text-stone-400"}`}>{dates[i][1]}</td>
                          <td className="px-2.5 py-2">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isPaid ? "bg-nicara-teal/15 text-nicara-teal" : "bg-nicara-gold/15 text-nicara-gold"}`}>
                              {isPaid ? "Paid ✓" : "Pending"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sec === "final" && (
            <div>
              <SectionHeader title="Final Project Dashboard — Sharma Residence" />
              <div className="bg-nicara-dark rounded-xl p-5 mb-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[["Contract Value", fmt(TOTAL), "text-nicara-gold"], ["Gross Margin", margin + "%", "text-nicara-teal"], ["42 Items", "Line Items", "text-stone-200"]].map(([l, v, vc]) => (
                    <div key={l} className="text-center">
                      <div className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">{l}</div>
                      <div className={`text-2xl font-black ${vc}`}>{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mb-1.5 flex justify-between text-[11px] text-stone-500"><span>Project Completion</span><span>45%</span></div>
                <div className="h-[7px] bg-nicara-dark-deep rounded overflow-hidden"><div className="h-full progress-bar" style={{ width: "45%" }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[["Design Sign-off", "28 Apr 2026", "Completed"], ["Execution Start", "5 May 2026", "Completed"], ["Estimated Completion", "28 Jun 2026", "On Track"], ["Revenue Collected", fmt(received) + " / " + fmt(TOTAL), Math.round(received / TOTAL * 100) + "%"], ["Gross Profit", fmt(profit), margin + "% margin"], ["Client Satisfaction", "Post-handover survey", "Pending"]].map(([label, val, note]) => (
                  <Card key={label} className="flex justify-between items-start">
                    <div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">{label}</div>
                      <div className="text-[13px] font-bold text-nicara-dark">{val}</div>
                    </div>
                    <div className="text-[11px] font-bold text-nicara-teal bg-nicara-teal/15 px-2 py-0.5 rounded-full ml-2 whitespace-nowrap">{note}</div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {sec === "costsheet" && (
            <div>
              <SectionHeader title="Cost Sheet" />
              <div className="overflow-x-auto border border-nicara-light rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-nicara-dark">
                      {["Line Item", "Category", "Amount", "% Revenue", "Notes"].map(h => (
                        <th key={h} className="px-2.5 py-2 text-stone-200 font-semibold text-left text-[11px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Client Revenue", "Income", fmt(TOTAL), "100%", "Total billed incl. GST"],
                      ["Carpentry Labour", "Expenditure", fmt(701820), "15.2%", "All carpentry work"],
                      ["Plywood & Materials", "Expenditure", fmt(384384), "8.3%", "Austin Lincoln BWP"],
                      ["Laminates & Finishes", "Expenditure", fmt(220000), "4.8%", "Greenlam + Acrylic"],
                      ["Hardware", "Expenditure", fmt(85000), "1.8%", "Hettich"],
                      ["Electrical", "Expenditure", fmt(107528), "2.3%", "Finolex wiring"],
                      ["Gross Profit", "Profit", fmt(profit), margin + "%", "Revenue minus vendor cost"],
                    ].map((row, i) => {
                      const isP = row[1] === "Profit";
                      return (
                        <tr key={i} className={`border-b border-nicara-light ${i % 2 === 0 ? "bg-nicara-cream" : "bg-white"}`}>
                          <td className="px-2.5 py-2 font-semibold text-nicara-dark">{row[0]}</td>
                          <td className="px-2.5 py-2">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${isP ? "bg-emerald-100 text-emerald-800" : row[1] === "Income" ? "bg-blue-50 text-blue-800" : "bg-red-50 text-red-800"}`}>{row[1]}</span>
                          </td>
                          <td className={`px-2.5 py-2 ${isP ? "text-nicara-teal font-bold" : "text-nicara-dark"}`}>{row[2]}</td>
                          <td className="px-2.5 py-2 text-stone-500 text-[11px]">{row[3]}</td>
                          <td className="px-2.5 py-2 text-stone-500 text-[11px]">{row[4]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sec === "vendorpay" && (
            <div>
              <SectionHeader title="Vendor Payment Table" />
              <div className="overflow-x-auto border border-nicara-light rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-nicara-dark">
                      {["Vendor", "Category", "Total", "Advance", "Balance", "Due Date", "Status"].map(h => (
                        <th key={h} className="px-2.5 py-2 text-stone-200 font-semibold text-left text-[11px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Kumar Carpentry", "Carpentry", 701820, 350910, 350910, "20 Jun", "In Progress"],
                      ["Austin Lincoln", "Plywood", 384384, 192192, 192192, "10 Jun", "Ordered"],
                      ["Bright Electricals", "Electrical", 107528, 53764, 53764, "25 Jun", "Pending"],
                      ["Apex Ceiling", "False Ceiling", 95580, 47790, 47790, "28 Jun", "Pending"],
                      ["Alt Lights", "Lighting", 95182, 47591, 47591, "20 Jun", "Pending"],
                      ["Stone World", "Stone/Granite", 191160, 95580, 95580, "22 Jun", "Pending"],
                    ].map((row, i) => (
                      <tr key={i} className={`border-b border-nicara-light ${i % 2 === 0 ? "bg-nicara-cream" : "bg-white"}`}>
                        <td className="px-2.5 py-2 font-semibold text-nicara-dark">{row[0] as string}</td>
                        <td className="px-2.5 py-2 text-stone-600 text-[11px]">{row[1] as string}</td>
                        <td className="px-2.5 py-2 font-semibold text-nicara-dark">{fmt(row[2] as number)}</td>
                        <td className="px-2.5 py-2 text-nicara-teal font-semibold">{fmt(row[3] as number)}</td>
                        <td className="px-2.5 py-2 text-nicara-gold font-semibold">{fmt(row[4] as number)}</td>
                        <td className="px-2.5 py-2 text-stone-600 text-[11px]">{row[5] as string} 2026</td>
                        <td className="px-2.5 py-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            row[6] === "Ordered" ? "bg-nicara-teal/15 text-nicara-teal" : row[6] === "In Progress" ? "bg-nicara-gold/15 text-nicara-gold" : "bg-nicara-light text-stone-400"
                          }`}>{row[6] as string}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
