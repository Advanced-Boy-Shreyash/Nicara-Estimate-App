"use client";

import { useState } from "react";
import { INTERIOR_STYLES, WELCOME_EMAIL } from "@/lib/constants";
import { generateClientId } from "@/lib/utils";
import SectionHeader from "@/components/ui/SectionHeader";
import SendBar from "@/components/ui/SendBar";
import type { ClientFormData } from "@/lib/types";

// ── Style Picker Modal ────────────────────────────────────────
function StylePickerModal({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[500] modal-overlay">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-slide-up">
        <div className="p-5 border-b border-nicara-light flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <div className="text-base font-bold text-nicara-dark">
              Select Interior Style
            </div>
            <div className="text-xs text-stone-400 mt-0.5">
              Choose one — it sets the design direction for the project
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xl text-stone-400 bg-transparent border-none cursor-pointer hover:text-nicara-gold transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3.5">
          {INTERIOR_STYLES.map((st) => {
            const isActive = selected === st.id;
            return (
              <div
                key={st.id}
                onClick={() => {
                  onSelect(st.id);
                  onClose();
                }}
                className={`rounded-xl border-2 cursor-pointer overflow-hidden transition-all hover:scale-[1.01] ${
                  isActive
                    ? "border-nicara-gold shadow-lg"
                    : "border-nicara-light hover:border-nicara-gold/50"
                }`}
              >
                {/* Style preview */}
                <div
                  className="h-20 flex items-center justify-center"
                  style={{ background: st.img }}
                >
                  <span className="text-4xl drop-shadow-md">{st.emoji}</span>
                </div>
                <div className="p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-bold text-nicara-dark">
                      {st.name}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold bg-nicara-gold/15 text-nicara-gold px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500 leading-relaxed mb-2.5">
                    {st.desc}
                  </div>
                  <div className="flex gap-1.5 mb-2">
                    {st.palette.map((c, ci) => (
                      <div
                        key={ci}
                        className="w-5 h-5 rounded-full border border-white shadow-sm"
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {st.keywords.map((k) => (
                      <span
                        key={k}
                        className="text-[9px] bg-nicara-cream border border-nicara-light text-stone-500 px-1.5 py-0.5 rounded"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function ClientRequirements() {
  const [form, setForm] = useState<ClientFormData>({
    clientId: generateClientId(),
    name: "Ms X",
    phone: "—",
    email: "client@email.com",
    developer: "ABC",
    project: "ABC Homes",
    unit: "D2704",
    superArea: "1560",
    carpetArea: "1287",
    budget: "",
    startDate: "",
    endDate: "",
    city: "Mumbai",
    purpose: "Residential",
    use: "Self",
    type: "3BHK Apartment",
    style: "contemporary",
    notes: "",
  });

  const [showStylePicker, setShowStylePicker] = useState(false);

  const upd = (key: keyof ClientFormData, val: string) =>
    setForm((p) => ({ ...p, [key]: val }));

  const selectedStyle = INTERIOR_STYLES.find((s) => s.id === form.style);

  // Input styling
  const inputCls =
    "w-full px-3 py-2 border border-nicara-light rounded-lg text-[12px] outline-none bg-white focus:border-nicara-gold text-nicara-dark";
  const labelCls =
    "text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1";

  return (
    <div className="animate-fade-in">
      {showStylePicker && (
        <StylePickerModal
          selected={form.style}
          onSelect={(id) => upd("style", id)}
          onClose={() => setShowStylePicker(false)}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-base font-bold text-nicara-dark">
          Client Requirements
        </div>
        <SendBar
          phone="9810011111"
          emails={[
            {
              label: "Welcome Email",
              subject: WELCOME_EMAIL.subject,
              body: WELCOME_EMAIL.body,
            },
          ]}
        />
      </div>

      {/* Client Details */}
      <SectionHeader title="Client Details" />
      <div className="grid grid-cols-4 gap-3 mb-5">
        {/* Client ID — auto-generated */}
        <div>
          <div className={labelCls}>Client ID</div>
          <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-mono font-bold">
            {form.clientId}
            <div className="text-[9px] text-emerald-400 mt-0.5 font-normal">Auto-generated</div>
          </div>
        </div>
        {(
          [
            ["name", "Client Name"],
            ["phone", "Phone Number"],
            ["email", "Email ID"],
            ["developer", "Developer Name"],
            ["project", "Project Name"],
            ["unit", "Unit No."],
          ] as const
        ).map(([key, lbl]) => (
          <div key={key}>
            <div className={labelCls}>{lbl}</div>
            <input
              value={form[key]}
              onChange={(e) => upd(key, e.target.value)}
              placeholder={lbl}
              className={inputCls}
            />
          </div>
        ))}
      </div>

      {/* Project Details */}
      <SectionHeader title="Project Details" />
      <div className="grid grid-cols-4 gap-3 mb-5">
        {(
          [
            ["superArea", "Super Built-up Area (sqft)"],
            ["carpetArea", "Carpet Area (sqft)"],
            ["budget", "Budget (₹)"],
            ["startDate", "Start Date"],
            ["endDate", "End Date"],
            ["city", "City"],
          ] as const
        ).map(([key, lbl]) => (
          <div key={key}>
            <div className={labelCls}>{lbl}</div>
            <input
              value={form[key]}
              onChange={(e) => upd(key, e.target.value)}
              type={key === "startDate" || key === "endDate" ? "date" : "text"}
              className={inputCls}
            />
          </div>
        ))}
        {(
          [
            [
              "purpose",
              "Purpose",
              ["Residential", "Commercial", "Other"],
            ],
            [
              "use",
              "Self / Investment",
              ["Self", "Investment", "Both"],
            ],
            [
              "type",
              "Property Type",
              ["1BHK Apartment", "2BHK Apartment", "3BHK Apartment", "4BHK Apartment", "Independent Villa", "Duplex", "Penthouse", "Row House", "Commercial Office", "Commercial Retail"],
            ],
          ] as const
        ).map(([key, lbl, opts]) => (
          <div key={key}>
            <div className={labelCls}>{lbl}</div>
            <select
              value={form[key]}
              onChange={(e) => upd(key, e.target.value)}
              className={inputCls + " cursor-pointer"}
            >
              {opts.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Style Preference */}
      <SectionHeader title="Style Preference" />
      <div className="grid grid-cols-3 gap-3 mb-5">
        {/* Style picker */}
        <div>
          <button
            onClick={() => setShowStylePicker(true)}
            className="w-full px-3 py-2 border border-nicara-light rounded-lg text-[12px] bg-white text-left cursor-pointer flex items-center justify-between hover:border-nicara-gold transition-colors"
          >
            <span className="flex items-center gap-2">
              {selectedStyle && (
                <span className="text-base">{selectedStyle.emoji}</span>
              )}
              <span className="font-semibold text-nicara-dark">
                {selectedStyle?.name || "Select style…"}
              </span>
            </span>
            <span className="text-stone-400">▼</span>
          </button>
        </div>
        {/* Selected Style Preview inline */}
        {selectedStyle && (
          <div className="col-span-2 flex items-center gap-3 px-3 py-2 bg-nicara-dark rounded-lg">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
              style={{ background: selectedStyle.img }}
            >
              {selectedStyle.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-nicara-gold">
                {selectedStyle.name}
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5 line-clamp-1">
                {selectedStyle.desc}
              </div>
            </div>
            <div className="flex gap-1">
              {selectedStyle.palette.map((c, ci) => (
                <div
                  key={ci}
                  className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm"
                  style={{ background: c }}
                />
              ))}
            </div>
            <span className="text-[10px] text-stone-500 cursor-pointer" onClick={() => setShowStylePicker(true)}>Change</span>
          </div>
        )}
      </div>

      {/* Additional Notes */}
      <SectionHeader title="Additional Notes" />
      <textarea
        value={form.notes}
        onChange={(e) => upd("notes", e.target.value)}
        rows={3}
        placeholder="Additional notes, constraints or special requests — budget splits, specific brands, phasing requirements…"
        className="w-full p-3 border border-nicara-light rounded-xl text-xs outline-none focus:border-nicara-gold mb-5 resize-y"
      />

      {/* Footer */}
      <div className="flex justify-between items-center">
        <div className="text-[11px] text-stone-400">
          Client ID: <strong className="font-mono text-emerald-700">{form.clientId}</strong>
        </div>
        <button className="px-6 py-2.5 bg-nicara-dark border-none rounded-xl text-nicara-cream text-[13px] font-bold cursor-pointer hover:opacity-90 transition-opacity">
          Save & Proceed →
        </button>
      </div>
    </div>
  );
}
