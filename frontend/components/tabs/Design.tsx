"use client";

import { useState } from "react";
import ModeSelector, { AILoader, AIDoneBar, BackBtn } from "@/components/ui/ModeSelector";
import { AIBadge } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import SendBar from "@/components/ui/SendBar";
import { SHARE_DESIGNS_EMAIL, DESIGN_SIGNOFF_EMAIL } from "@/lib/constants";

/* ── Intermediate Estimate (sub-tab placeholder) ─────────────── */
function IntermediateEstimate() {
  return (
    <div className="animate-fade-in">
      <div className="bg-nicara-dark rounded-xl p-4 mb-4">
        <div className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Intermediate Estimate</div>
        <div className="text-2xl font-black text-nicara-gold">₹38,45,000</div>
        <div className="text-xs text-stone-500 mt-1">Revised after design development</div>
      </div>
      <div className="overflow-x-auto border border-nicara-light rounded-xl">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-nicara-dark">
              {["#", "Area", "Category", "Item", "Initial Est", "Revised Amt", "Variance", "▼", "🗑"].map(h => (
                <th key={h} className="px-2.5 py-2 text-stone-200 font-semibold text-[10px] text-left whitespace-nowrap border-r border-stone-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Drawing", "Cabinetry", "East Wall TV Unit", 116799, 120000],
              ["Suite 3", "Cabinetry", "Wardrobe", 249989, 255000],
              ["Suite 1", "Cabinetry", "Wardrobe", 267982, 270000],
              ["Kitchen", "Cabinetry", "Base + Wall + Loft", 921471, 910000],
              ["False Ceiling", "Ceiling Work", "False Ceiling", 95580, 95580],
              ["Electrical", "Wiring", "Electrical Works", 107528, 107528],
            ].map(([area, cat, item, init, revised], ri) => {
              const variance = (revised as number) - (init as number);
              const isPos = variance <= 0;
              return (
                <tr key={ri} className={`border-b border-nicara-light ${ri % 2 === 0 ? "bg-nicara-cream" : "bg-white"}`}>
                  <td className="px-2.5 py-1.5 text-stone-400 border-r border-nicara-light">{ri + 1}</td>
                  <td className="px-2.5 py-1.5 font-semibold text-nicara-dark border-r border-nicara-light">{area as string}</td>
                  <td className="px-2.5 py-1.5 border-r border-nicara-light">{cat as string}</td>
                  <td className="px-2.5 py-1.5 font-semibold text-nicara-dark border-r border-nicara-light">{item as string}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono text-stone-500 border-r border-nicara-light">₹{(init as number).toLocaleString("en-IN")}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-emerald-700 bg-emerald-50 border-r border-nicara-light">₹{(revised as number).toLocaleString("en-IN")}</td>
                  <td className={`px-2.5 py-1.5 text-right font-mono font-bold rounded-sm ${isPos ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {isPos ? "-" : "+"}₹{Math.abs(variance).toLocaleString("en-IN")}
                  </td>
                  <td className="px-2.5 py-1.5 text-center border-r border-nicara-light"><span className="text-stone-300 text-[10px]">—</span></td>
                  <td className="px-2.5 py-1.5 text-center"><button className="bg-transparent border-none text-red-300 cursor-pointer text-[15px] p-0 hover:text-red-500">🗑</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main Design Tab ─────────────────────────────────────────── */
export default function Design() {
  const [mode, setMode] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [sub, setSub] = useState("tracker");

  if (!mode) return <ModeSelector tab="Design" onSelect={setMode} />;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2.5 mb-3.5">
        <BackBtn onClick={() => { setMode(null); setAiDone(false); }} />
        {mode === "ai" && <AIBadge />}
        <div className="flex border-b border-nicara-light flex-1">
          {[["tracker", "Progress"], ["intermediate", "Intermediate Est."], ["materials", "Materials"], ["drawings", "Drawings"]].map(([id, label]) => (
            <button key={id} onClick={() => setSub(id)}
              className={`px-3.5 py-2 bg-transparent border-none text-xs cursor-pointer ${sub === id ? "text-nicara-gold border-b-2 border-nicara-gold font-semibold" : "text-stone-500 border-b-2 border-transparent"}`}>
              {label}
            </button>
          ))}
        </div>
        <SendBar phone="9810011111" emails={[
          { label: "Share Designs", subject: SHARE_DESIGNS_EMAIL.subject, body: SHARE_DESIGNS_EMAIL.body },
          { label: "Design Sign-Off", subject: DESIGN_SIGNOFF_EMAIL.subject, body: DESIGN_SIGNOFF_EMAIL.body },
        ]} />
      </div>

      {mode === "ai" && !aiDone ? (
        <AILoader lines={["Generates 3D renders from 2D layouts.", "Suggests material combos matching mood board."]} onDone={() => setAiDone(true)} />
      ) : (
        <>
          {mode === "ai" && aiDone && <AIDoneBar msg="AI Design Analysis Complete" />}

          {sub === "intermediate" && <IntermediateEstimate />}

          {sub === "tracker" && (
            <div className="grid grid-cols-2 gap-2.5">
              {[["Layout Finalization", "Completed", "✓"], ["Design Development", "Completed", "✓"], ["Elevations", "In Progress", "⟳"], ["3D Creation", "Upcoming", "○"], ["Material Selection", "Upcoming", "○"], ["Working Drawings", "Upcoming", "○"], ["Design Sign-Off", "Upcoming", "○"], ["Brand Selection", "Upcoming", "○"]].map(([phase, status, icon]) => (
                <Card key={phase} className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] shrink-0 ${
                    status === "Completed" ? "bg-nicara-teal/15 text-nicara-teal" : status === "In Progress" ? "bg-nicara-gold/15 text-nicara-gold" : "bg-nicara-light text-stone-400"
                  }`}>{icon}</div>
                  <div>
                    <div className="text-xs font-semibold text-nicara-dark">{phase}</div>
                    <div className={`text-[11px] mt-0.5 ${
                      status === "Completed" ? "text-nicara-teal" : status === "In Progress" ? "text-nicara-gold" : "text-stone-400"
                    }`}>{status}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {sub === "materials" && (
            <div className="grid grid-cols-2 gap-2">
              {[["Plywood", "Austin Lincoln BWP ✓"], ["Laminates", "Greenlam — pending"], ["Hardware", "Hettich — pending"], ["Kitchen Acc.", "Hettich/Ebco — pending"], ["Finishing", "Acrylic/Thermo — pending"], ["Stone", "Granite/Quartz — pending"]].map(([cat, status]) => (
                <div key={cat} className="p-3 bg-white border border-nicara-light rounded-xl flex justify-between">
                  <span className="text-xs font-semibold text-nicara-dark">{cat}</span>
                  <span className={`text-[11px] ${(status as string).includes("✓") ? "text-nicara-teal" : "text-stone-400"}`}>{status}</span>
                </div>
              ))}
            </div>
          )}

          {sub === "drawings" && (
            <div className="overflow-x-auto border border-nicara-light rounded-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-nicara-dark">
                    {["Drawing", "Scope", "Status", "Version"].map(h => (
                      <th key={h} className="px-2.5 py-2 text-stone-200 font-semibold text-left text-[11px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[["Furniture Drawings", "All rooms", "In Progress", "v1.2"], ["Ceiling Drawings", "All areas", "Completed", "v2.0"], ["Electrical Drawings", "Complete", "Completed", "v1.5"], ["Plumbing Drawings", "Kitchen+Baths", "Pending", "—"], ["Civil Drawings", "Breaking+Flooring", "Pending", "—"]].map((row, i) => (
                    <tr key={i} className={`border-b border-nicara-light ${i % 2 === 0 ? "bg-nicara-cream" : "bg-white"}`}>
                      {row.map((val, j) => (
                        <td key={j} className={`px-2.5 py-2 ${j === 0 ? "font-semibold text-nicara-dark" : ""} ${
                          j === 2 ? (val === "Completed" ? "text-nicara-teal" : val === "In Progress" ? "text-nicara-gold" : "text-stone-400") : "text-nicara-dark"
                        }`}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
