"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import ApprovalWidget from "@/components/ui/ApprovalWidget";
import RefImages from "@/components/ui/RefImages";
import SendBar from "@/components/ui/SendBar";
import { SHARE_DESIGNS_EMAIL, DESIGN_SIGNOFF_EMAIL } from "@/lib/constants";

const AREAS = ["Living Room", "Master Bedroom", "Kitchen", "Bedroom 2", "Dining", "Pooja"];

export default function MoodBoard() {
  const [sub, setSub] = useState<"moodboard" | "floorplan" | "refs" | "approval">("moodboard");
  const [selectedArea, setSelectedArea] = useState(AREAS[0]);
  const [approvalStatus, setApprovalStatus] = useState<Record<string, "approved" | "denied" | null>>(
    Object.fromEntries(AREAS.map((a) => [a, null]))
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="flex border-b border-nicara-light flex-1">
          {([
            ["moodboard", "Mood Board"],
            ["floorplan", "Floor Plan"],
            ["refs", "References"],
            ["approval", "Approval"],
          ] as const).map(([id, lbl]) => (
            <button
              key={id}
              onClick={() => setSub(id)}
              className={`px-4 py-2 bg-transparent border-none text-[13px] cursor-pointer transition-colors ${
                sub === id
                  ? "text-nicara-gold border-b-2 border-nicara-gold font-bold"
                  : "text-stone-500 border-b-2 border-transparent"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
        <SendBar
          phone="9810011111"
          emails={[
            { label: "Share Designs", subject: SHARE_DESIGNS_EMAIL.subject, body: SHARE_DESIGNS_EMAIL.body },
            { label: "Design Sign-Off", subject: DESIGN_SIGNOFF_EMAIL.subject, body: DESIGN_SIGNOFF_EMAIL.body },
          ]}
        />
      </div>

      {sub === "moodboard" && (
        <div>
          <SectionHeader title="Area Mood Boards" />
          <div className="flex gap-2 flex-wrap mb-4">
            {AREAS.map((a) => (
              <button
                key={a}
                onClick={() => setSelectedArea(a)}
                className={`px-3 py-1.5 rounded-full text-[11px] border cursor-pointer font-semibold transition-all chip ${
                  selectedArea === a
                    ? "bg-nicara-gold/10 border-nicara-gold text-nicara-gold"
                    : "bg-white border-nicara-light text-stone-500"
                }`}
              >
                {selectedArea === a ? "● " : ""}{a}
              </button>
            ))}
          </div>

          <Card className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm font-bold text-nicara-dark">{selectedArea} — Mood Board</div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                approvalStatus[selectedArea] === "approved" ? "bg-emerald-100 text-emerald-800"
                : approvalStatus[selectedArea] === "denied" ? "bg-red-100 text-red-800"
                : "bg-amber-100 text-amber-800"
              }`}>
                {approvalStatus[selectedArea] === "approved" ? "Approved" : approvalStatus[selectedArea] === "denied" ? "Denied" : "Pending"}
              </span>
            </div>

            {/* Mood board grid */}
            <div className="grid grid-cols-4 gap-2.5">
              {[1,2,3,4,5,6].map((i) => (
                <div key={i} className="bg-gradient-to-br from-stone-200 to-stone-300 rounded-lg h-24 flex items-center justify-center text-2xl border border-nicara-light hover:border-nicara-gold transition-colors cursor-pointer">
                  🖼
                </div>
              ))}
              <label className="border-2 border-dashed border-nicara-light rounded-lg h-24 flex flex-col items-center justify-center cursor-pointer hover:border-nicara-gold transition-colors">
                <span className="text-xl text-stone-400">+</span>
                <span className="text-[9px] text-stone-400">Add Image</span>
                <input type="file" className="hidden" accept="image/*" />
              </label>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <div className="text-xs font-bold text-nicara-dark mb-1.5">Color Palette</div>
              <div className="flex gap-2 mb-2">
                {["#E8E0D5", "#3D3530", "#C9A96E", "#7CB9A8", "#FAF8F5"].map((c) => (
                  <div key={c} className="w-8 h-8 rounded-lg border border-white shadow-sm" style={{ background: c }} title={c} />
                ))}
              </div>
              <div className="text-[10px] text-stone-400">Warm neutrals with gold accents</div>
            </Card>
            <Card>
              <div className="text-xs font-bold text-nicara-dark mb-1.5">Material Board</div>
              <div className="flex gap-1.5 flex-wrap">
                {["Oak Veneer", "Brass Hardware", "Linen", "Granite", "White Marble"].map((m) => (
                  <span key={m} className="text-[10px] bg-nicara-cream border border-nicara-light px-2 py-0.5 rounded text-stone-600">
                    {m}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {sub === "floorplan" && (
        <div>
          <SectionHeader title="Floor Plan" />
          <Card className="flex flex-col items-center py-8">
            <span className="text-5xl mb-3">📐</span>
            <div className="text-sm font-bold text-nicara-dark mb-1">Floor Plan View</div>
            <div className="text-xs text-stone-400 mb-4">Upload or view the floor plan for this project</div>
            <label className="px-5 py-2 bg-nicara-gold border-none rounded-lg text-white text-xs cursor-pointer font-bold hover:opacity-90 transition-opacity">
              Upload Floor Plan
              <input type="file" className="hidden" />
            </label>
          </Card>
        </div>
      )}

      {sub === "refs" && (
        <div>
          <SectionHeader title="Design References" />
          <RefImages label="Mood Board References" images={[
            { id: 1, name: "Living Ref 1" }, { id: 2, name: "Kitchen Ref" }, { id: 3, name: "Master Bed Ref" }
          ]} />
        </div>
      )}

      {sub === "approval" && (
        <div>
          <SectionHeader title="Mood Board Approval" />
          <div className="flex flex-col gap-3">
            {AREAS.map((area) => (
              <div key={area}>
                <div className="text-xs font-bold text-nicara-dark mb-2">{area}</div>
                <ApprovalWidget
                  stage={`${area} Mood Board`}
                  status={approvalStatus[area]}
                  onApprove={(c) => setApprovalStatus((p) => ({ ...p, [area]: "approved" }))}
                  onDeny={(c) => setApprovalStatus((p) => ({ ...p, [area]: "denied" }))}
                  phone="9810011111"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
