"use client";

import { useState } from "react";
import { DEFAULT_ROOMS, INTERIOR_STYLES, WELCOME_EMAIL } from "@/lib/constants";
import { generateClientId } from "@/lib/utils";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import SendBar from "@/components/ui/SendBar";
import RefImages from "@/components/ui/RefImages";
import type { RoomData, ClientFormData } from "@/lib/types";

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
    purpose: "Primary Home",
    use: "Self Use",
    type: "3BHK",
    style: "contemporary",
    notes: "",
  });

  const [rooms, setRooms] = useState<Record<string, RoomData>>(
    Object.fromEntries(
      DEFAULT_ROOMS.map((r) => [
        r,
        {
          selected: [
            "Foyer",
            "Living Room",
            "Dining Room",
            "Kitchen",
            "Master Bedroom",
            "Bedroom 2",
            "Bedroom 3",
            "Master Bathroom",
            "Common Bathroom",
            "Pooja Room",
          ].includes(r),
          req: "",
        },
      ])
    )
  );

  const [showStylePicker, setShowStylePicker] = useState(false);

  const upd = (key: keyof ClientFormData, val: string) =>
    setForm((p) => ({ ...p, [key]: val }));

  const toggleRoom = (name: string) =>
    setRooms((p) => ({
      ...p,
      [name]: { ...p[name], selected: !p[name].selected },
    }));

  const setReq = (name: string, req: string) =>
    setRooms((p) => ({ ...p, [name]: { ...p[name], req } }));

  const selectedRooms = Object.entries(rooms).filter(([, r]) => r.selected);

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
        <div>
          <div className={labelCls}>Client ID</div>
          <div className="px-3 py-2 bg-stone-50 border border-nicara-light rounded-lg text-xs text-stone-500 font-mono">
            {form.clientId}
          </div>
        </div>
        {(
          [
            ["name", "Client Name"],
            ["phone", "Phone"],
            ["email", "Email"],
          ] as const
        ).map(([key, lbl]) => (
          <div key={key}>
            <div className={labelCls}>{lbl}</div>
            <input
              value={form[key]}
              onChange={(e) => upd(key, e.target.value)}
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
            ["developer", "Developer"],
            ["project", "Project Name"],
            ["unit", "Unit / Flat No"],
            ["city", "City"],
            ["superArea", "Super Built-up Area (sqft)"],
            ["carpetArea", "Carpet Area (sqft)"],
            ["budget", "Approx Budget"],
            ["type", "Property Type"],
          ] as const
        ).map(([key, lbl]) => (
          <div key={key}>
            <div className={labelCls}>{lbl}</div>
            <input
              value={form[key]}
              onChange={(e) => upd(key, e.target.value)}
              className={inputCls}
            />
          </div>
        ))}
      </div>

      {/* Purpose + Use */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {(
          [
            [
              "purpose",
              "Purpose",
              ["Primary Home", "Second Home", "Rental", "Investment"],
            ],
            [
              "use",
              "Use",
              ["Self Use", "For Parents", "For Tenants", "Commercial"],
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

        {/* Style picker */}
        <div>
          <div className={labelCls}>Interior Style</div>
          <button
            onClick={() => setShowStylePicker(true)}
            className="w-full px-3 py-2 border border-nicara-light rounded-lg text-[12px] bg-white text-left cursor-pointer flex items-center justify-between hover:border-nicara-gold transition-colors"
          >
            <span className="flex items-center gap-2">
              {selectedStyle && (
                <span className="text-base">{selectedStyle.emoji}</span>
              )}
              <span className="font-semibold text-nicara-dark">
                {selectedStyle?.name || "Select…"}
              </span>
            </span>
            <span className="text-stone-400">▼</span>
          </button>
        </div>
      </div>

      {/* Selected Style Preview */}
      {selectedStyle && (
        <Card className="mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: selectedStyle.img }}
            >
              {selectedStyle.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-nicara-dark">
                {selectedStyle.name}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">
                {selectedStyle.desc}
              </div>
            </div>
            <div className="flex gap-1">
              {selectedStyle.palette.map((c, ci) => (
                <div
                  key={ci}
                  className="w-4 h-4 rounded-full border border-white shadow-sm"
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Room Selection */}
      <SectionHeader title="Room Selection" />
      <div className="flex flex-wrap gap-2 mb-5">
        {DEFAULT_ROOMS.map((r) => {
          const isOn = rooms[r]?.selected;
          return (
            <button
              key={r}
              onClick={() => toggleRoom(r)}
              className={`px-3 py-1.5 rounded-full text-[11px] border cursor-pointer font-semibold transition-all chip ${
                isOn
                  ? "bg-nicara-gold/10 border-nicara-gold text-nicara-gold"
                  : "bg-white border-nicara-light text-stone-500 hover:bg-nicara-cream"
              }`}
            >
              {isOn ? "✓ " : ""}
              {r}
            </button>
          );
        })}
      </div>

      {/* Room Requirements */}
      {selectedRooms.length > 0 && (
        <>
          <SectionHeader title="Room Requirements" />
          <div className="grid grid-cols-2 gap-3 mb-5">
            {selectedRooms.map(([name, data]) => (
              <Card key={name}>
                <div className="text-xs font-bold text-nicara-dark mb-1.5">
                  {name}
                </div>
                <textarea
                  value={data.req}
                  onChange={(e) => setReq(name, e.target.value)}
                  rows={2}
                  placeholder={`Requirements for ${name}…`}
                  className="w-full p-2 border border-nicara-light rounded-lg text-[11px] resize-y outline-none focus:border-nicara-gold"
                />
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Notes */}
      <SectionHeader title="Additional Notes" />
      <textarea
        value={form.notes}
        onChange={(e) => upd("notes", e.target.value)}
        rows={3}
        placeholder="Any additional requirements, preferences, or special instructions…"
        className="w-full p-3 border border-nicara-light rounded-xl text-xs outline-none focus:border-nicara-gold mb-5 resize-y"
      />

      {/* Floor Plan & References */}
      <div className="grid grid-cols-2 gap-5">
        <div>
          <SectionHeader title="Floor Plan Upload" />
          <label className="flex items-center justify-center gap-2 py-5 border-2 border-dashed border-nicara-light rounded-xl cursor-pointer hover:border-nicara-gold transition-colors">
            <span className="text-xl">📐</span>
            <div>
              <div className="text-xs font-semibold text-nicara-dark">
                Upload Floor Plan
              </div>
              <div className="text-[10px] text-stone-400">
                PDF, DWG, or Image
              </div>
            </div>
            <input type="file" className="hidden" />
          </label>
        </div>
        <RefImages label="Client Reference Images" />
      </div>
    </div>
  );
}
