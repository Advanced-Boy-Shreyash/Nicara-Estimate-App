"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (project: Record<string, string>) => void;
}

export default function NewProjectModal({ open, onClose, onAdd }: NewProjectModalProps) {
  const [form, setForm] = useState({
    name: "", clientName: "", clientPhone: "", clientEmail: "",
    developer: "", projectName: "", unitNo: "", city: "Mumbai",
    superBuiltUp: "", carpetArea: "", propertyType: "3BHK",
    budget: "", purpose: "residential", use: "self",
    handoverDate: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.name || !form.clientName) return;
    setSaving(true);
    setTimeout(() => {
      onAdd(form);
      setForm({ name: "", clientName: "", clientPhone: "", clientEmail: "", developer: "", projectName: "", unitNo: "", city: "Mumbai", superBuiltUp: "", carpetArea: "", propertyType: "3BHK", budget: "", purpose: "residential", use: "self", handoverDate: "", notes: "" });
      setSaving(false);
      onClose();
    }, 800);
  };

  const inputCls = "w-full px-3.5 py-2.5 border border-surface-300 rounded-xl text-[13px] bg-white text-nicara-dark";
  const labelCls = "block text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5";

  return (
    <Modal open={open} onClose={onClose} title="Create New Project" subtitle="Set up a new interior design project" size="lg"
      footer={
        <>
          <button onClick={onClose} className="px-5 py-2.5 bg-transparent border border-surface-300 rounded-xl text-[13px] text-surface-500 cursor-pointer hover:bg-surface-100">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.name || !form.clientName || saving}
            className={`px-6 py-2.5 rounded-xl text-[13px] font-bold border-none cursor-pointer flex items-center gap-2 ${
              !form.name || !form.clientName || saving ? "bg-surface-200 text-surface-400 cursor-not-allowed" : "btn-gold"
            }`}>
            {saving ? <><span className="animate-spin-slow inline-block">⟳</span> Creating…</> : <>✦ Create Project</>}
          </button>
        </>
      }>

      <div className="space-y-5">
        {/* Project Name */}
        <div className="bg-nicara-dark rounded-xl p-4">
          <label className="block text-[10px] font-bold text-nicara-gold uppercase tracking-wider mb-1.5">Project Name *</label>
          <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Sharma Residence"
            className="w-full px-3.5 py-2.5 border border-surface-700 rounded-xl text-[14px] bg-nicara-dark-deep text-white font-semibold" />
        </div>

        {/* Client Details */}
        <div>
          <div className="text-[11px] font-bold text-nicara-gold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>👤</span> Client Details
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Client Name *</label>
              <input value={form.clientName} onChange={e => set("clientName", e.target.value)} placeholder="Ms X" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.clientPhone} onChange={e => set("clientPhone", e.target.value)} placeholder="+91 98100 11111" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Email</label>
              <input type="email" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)} placeholder="client@email.com" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Property Details */}
        <div>
          <div className="text-[11px] font-bold text-nicara-gold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>🏢</span> Property Details
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Developer</label>
              <input value={form.developer} onChange={e => set("developer", e.target.value)} placeholder="ABC" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Project/Society Name</label>
              <input value={form.projectName} onChange={e => set("projectName", e.target.value)} placeholder="ABC Homes" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unit / Flat No</label>
              <input value={form.unitNo} onChange={e => set("unitNo", e.target.value)} placeholder="D2704" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <select value={form.city} onChange={e => set("city", e.target.value)} className={inputCls + " cursor-pointer"}>
                {["Mumbai", "Delhi", "Bangalore", "Pune", "Hyderabad", "Chennai", "Kolkata", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Super Built-Up Area (sqft)</label>
              <input type="number" value={form.superBuiltUp} onChange={e => set("superBuiltUp", e.target.value)} placeholder="1850" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Carpet Area (sqft)</label>
              <input type="number" value={form.carpetArea} onChange={e => set("carpetArea", e.target.value)} placeholder="1287" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Property Type</label>
              <select value={form.propertyType} onChange={e => set("propertyType", e.target.value)} className={inputCls + " cursor-pointer"}>
                {["1BHK", "2BHK", "3BHK", "4BHK", "Penthouse", "Independent Villa", "Duplex", "Commercial", "Other"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Approx Budget (₹)</label>
              <input value={form.budget} onChange={e => set("budget", e.target.value)} placeholder="45,00,000" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Project Settings */}
        <div>
          <div className="text-[11px] font-bold text-nicara-gold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>⚙️</span> Project Settings
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Purpose</label>
              <select value={form.purpose} onChange={e => set("purpose", e.target.value)} className={inputCls + " cursor-pointer"}>
                {["residential", "commercial", "hospitality", "retail"].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Use</label>
              <select value={form.use} onChange={e => set("use", e.target.value)} className={inputCls + " cursor-pointer"}>
                {["self", "investment", "rental"].map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Handover Date</label>
              <input type="date" value={form.handoverDate} onChange={e => set("handoverDate", e.target.value)} className={inputCls + " cursor-pointer"} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
