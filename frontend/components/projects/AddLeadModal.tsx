"use client";

import { useState } from "react";
import { ApiError, projectsApi } from "@/lib/api";
import type { Project, ProjectMeta } from "@/lib/apiTypes";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Field, Select, TextArea } from "@/components/ui/Form";
import { INTERIOR_STYLES } from "@/lib/constants";

function generateLeadClientId(prefix: string, suffix: string) {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${num}${suffix}`;
}

function LeadStylePicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = INTERIOR_STYLES.find(s => s.id === selected);

  return (
    <div>
      <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">Style Preference</div>
      <button
        type="button" onClick={() => setOpen(true)}
        className="w-full px-3 py-2 border border-surface-200 rounded-xl text-[12px] bg-white text-left cursor-pointer flex items-center justify-between hover:border-nicara-gold transition-colors"
      >
        <span className="flex items-center gap-2">
          {current && <span className="text-base">{current.emoji}</span>}
          <span className="font-semibold text-nicara-dark">{current?.name || "Select style…"}</span>
        </span>
        <span className="text-surface-400">▼</span>
      </button>
      {current && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl" style={{ background: current.img }}>
          <span className="text-xl">{current.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-white drop-shadow-md">{current.name}</div>
            <div className="text-[9px] text-white/70 truncate drop-shadow-md">{current.desc}</div>
          </div>
          <div className="flex gap-0.5">
            {current.palette.map((c, i) => <div key={i} className="w-3 h-3 rounded-full border border-white/40 shadow-sm" style={{ background: c }} />)}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[600]" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-surface-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <div className="text-[15px] font-bold text-nicara-dark">Select Interior Style</div>
                <div className="text-[11px] text-surface-400 mt-0.5">Choose one — it sets the design direction</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-xl text-surface-400 bg-transparent border-none cursor-pointer hover:text-nicara-gold">✕</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {INTERIOR_STYLES.map(st => {
                const isActive = selected === st.id;
                return (
                  <div key={st.id} onClick={() => { onSelect(st.id); setOpen(false); }}
                    className={`rounded-xl border-2 cursor-pointer overflow-hidden transition-all hover:scale-[1.01] ${isActive ? "border-nicara-gold shadow-lg" : "border-surface-200 hover:border-nicara-gold/50"}`}>
                    <div className="h-16 flex items-center justify-center" style={{ background: st.img }}>
                      <span className="text-3xl drop-shadow-md">{st.emoji}</span>
                    </div>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-bold text-nicara-dark">{st.name}</span>
                        {isActive && <span className="text-[9px] font-bold bg-nicara-gold/15 text-nicara-gold px-1.5 py-0.5 rounded-full">Selected</span>}
                      </div>
                      <div className="text-[10px] text-surface-500 leading-relaxed mb-2">{st.desc}</div>
                      <div className="flex gap-1 mb-1.5">
                        {st.palette.map((c, ci) => <div key={ci} className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: c }} />)}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {st.keywords.map(k => <span key={k} className="text-[8px] bg-surface-50 border border-surface-200 text-surface-500 px-1.5 py-0.5 rounded">{k}</span>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddLeadModal({ open, onClose, meta, onCreated }: {
  open: boolean; onClose: () => void; meta: ProjectMeta | null; onCreated: (id: number) => void;
}) {
  const toast = useToast();
  const [clientIdPrefix, setClientIdPrefix] = useState("NIC-");
  const [clientIdSuffix, setClientIdSuffix] = useState("");
  const [clientId, setClientId] = useState(() => generateLeadClientId("NIC-", ""));
  const regenerateId = () => setClientId(generateLeadClientId(clientIdPrefix, clientIdSuffix));

  const [form, setForm] = useState<Partial<Project>>({
    client_name: "", client_phone: "", client_email: "", client_address: "",
    name: "", developer: "", unit_no: "", city: "", state: "", pincode: "",
    area: "", property_type: "3BHK Apartment", project_type: "Residential", purpose: "Self",
    interior_style: "", stage: "lead", budget: "", start_date: null, target_date: null,
  });
  const [carpetArea, setCarpetArea] = useState("");
  const [selfInvestment, setSelfInvestment] = useState("Self");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Project>(k: K, v: Project[K]) => setForm(f => ({ ...f, [k]: v }));
  const err = (field: string) => errors[field]?.[0];

  const IC = "w-full px-3 py-2 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold";
  const LC = "text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1";
  const selectCls = IC + " cursor-pointer";

  const submit = async () => {
    if (!form.client_name?.trim() || !form.name?.trim()) {
      setErrors({
        ...(form.client_name?.trim() ? {} : { client_name: ["Client name is required."] }),
        ...(form.name?.trim() ? {} : { name: ["Project name is required."] }),
      });
      return;
    }
    setSaving(true);
    setBanner("");
    setErrors({});
    try {
      const created = await projectsApi.create({ ...form, budget: form.budget || null });
      toast.success("Lead created", created.name);
      onCreated(created.id);
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); }
      else setBanner("Could not create the lead.");
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open onClose={onClose} size="lg" title="+ Add New Lead" subtitle="Enter client and project details"
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create Lead"}</Btn>
      </>}>
      {banner && <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">{banner}</div>}

      <div className="mb-5">
        <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-[0.12em] mb-2.5 pb-1.5 border-b border-surface-100">Client</div>
        <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 mb-3">
          <div className={LC}>Client ID (Auto-Generated)</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1">
              <input value={clientIdPrefix} onChange={e => setClientIdPrefix(e.target.value)}
                placeholder="Prefix" className="w-16 px-2 py-1.5 border border-surface-200 rounded-lg text-[11px] outline-none bg-white text-center font-mono" />
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[12px] text-emerald-800 font-mono font-bold flex-1 text-center">
                {clientId}
              </div>
              <input value={clientIdSuffix} onChange={e => setClientIdSuffix(e.target.value)}
                placeholder="Suffix" className="w-16 px-2 py-1.5 border border-surface-200 rounded-lg text-[11px] outline-none bg-white text-center font-mono" />
            </div>
            <button onClick={regenerateId} className="px-3 py-1.5 bg-nicara-gold/10 border-none rounded-lg text-[10px] text-nicara-gold font-bold cursor-pointer whitespace-nowrap">🔄 Regenerate</button>
          </div>
          <div className="text-[9px] text-surface-400 mt-1.5">Customize prefix & suffix, then regenerate. Example: NIC-84321-MUM</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" value={form.client_name ?? ""} onChange={v => set("client_name", v)} required error={err("client_name")} />
          <Field label="Phone" value={form.client_phone ?? ""} onChange={v => set("client_phone", v)} />
          <div className="col-span-2"><Field label="Email" type="email" value={form.client_email ?? ""} onChange={v => set("client_email", v)} error={err("client_email")} /></div>
          <div className="col-span-2"><TextArea label="Address" value={form.client_address ?? ""} onChange={v => set("client_address", v)} rows={2} /></div>
        </div>
      </div>

      <div className="mb-5">
        <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-[0.12em] mb-2.5 pb-1.5 border-b border-surface-100">Project</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Project Name" value={form.name ?? ""} onChange={v => set("name", v)} required error={err("name")} placeholder="Sharma Residence" /></div>
          <Field label="Developer - Project" value={form.developer ?? ""} onChange={v => set("developer", v)} />
          <Field label="Unit No" value={form.unit_no ?? ""} onChange={v => set("unit_no", v)} />
          <Field label="City" value={form.city ?? ""} onChange={v => set("city", v)} />
          <Field label="State" value={form.state ?? ""} onChange={v => set("state", v)} />
          <Field label="Super Area (sqft)" value={form.area ?? ""} onChange={v => set("area", v)} placeholder="1,850 sqft" />
          <div>
            <div className={LC}>Carpet Area (sqft)</div>
            <input value={carpetArea} onChange={e => setCarpetArea(e.target.value)} placeholder="1,287 sqft" className={IC} />
          </div>
          <Field label="Budget (₹)" type="number" value={form.budget ?? ""} onChange={v => set("budget", v)} error={err("budget")} />
          <div>
            <div className={LC}>Start Date</div>
            <input type="date" value={form.start_date ?? ""} onChange={e => set("start_date", e.target.value || null)} className={IC} />
          </div>
          <div>
            <div className={LC}>End Date</div>
            <input type="date" value={form.target_date ?? ""} onChange={e => set("target_date", e.target.value || null)} className={IC} />
          </div>
        </div>
      </div>

      <div className="mb-5">
        <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-[0.12em] mb-2.5 pb-1.5 border-b border-surface-100">Classification</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className={LC}>Purpose</div>
            <select value={form.project_type ?? "Residential"} onChange={e => set("project_type", e.target.value)} className={selectCls}>
              {["Residential", "Commercial", "Other"].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <div className={LC}>Self / Investment</div>
            <select value={selfInvestment} onChange={e => setSelfInvestment(e.target.value)} className={selectCls}>
              {["Self", "Investment", "Both"].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <div className={LC}>Property Type</div>
            <select value={form.property_type ?? "3BHK Apartment"} onChange={e => set("property_type", e.target.value)} className={selectCls}>
              {["1BHK Apartment", "2BHK Apartment", "3BHK Apartment", "4BHK Apartment", "Independent Villa", "Duplex", "Penthouse", "Row House", "Commercial Office", "Commercial Retail"].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-2">
        <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-[0.12em] mb-2.5 pb-1.5 border-b border-surface-100">Design Direction</div>
        <LeadStylePicker selected={form.interior_style ?? ""} onSelect={v => set("interior_style", v)} />
      </div>
    </Modal>
  );
}
