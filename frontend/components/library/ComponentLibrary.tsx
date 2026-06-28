"use client";

import { useState } from "react";

/* ── Demo data matching library fixtures ────────────────────── */
interface Category { id: number; name: string; type: string; icon: string; brands: Brand[] }
interface Brand { id: number; name: string; items: MaterialItem[] }
interface MaterialItem { id: number; model_name: string; default_unit: string; default_rate: number; gst_pct: number; margin_pct: number; is_active: boolean }
interface ServiceItemType { id: number; name: string; category: string; sub_type: string; default_unit: string; default_rate: number; gst_pct: number; margin_pct: number }

const DEMO_CATEGORIES: Category[] = [
  { id: 1, name: "Core Material(16mm BWP Ply)", type: "Procurement", icon: "🪵", brands: [
    { id: 1, name: "Austin", items: [{ id: 1, model_name: "Lincoln BWP", default_unit: "sheets", default_rate: 2800, gst_pct: 18, margin_pct: 35, is_active: true }] }
  ]},
  { id: 4, name: "Box Hinges", type: "Procurement", icon: "🔩", brands: [
    { id: 4, name: "Hettich", items: [{ id: 4, model_name: "Onsys - 0 Crank Soft Close", default_unit: "sets", default_rate: 450, gst_pct: 18, margin_pct: 35, is_active: true }] }
  ]},
  { id: 5, name: "Draw Channels", type: "Procurement", icon: "🔩", brands: [
    { id: 5, name: "Hettich", items: [{ id: 5, model_name: "Quadro - 18\" Soft Close", default_unit: "sets", default_rate: 1200, gst_pct: 18, margin_pct: 35, is_active: true }] }
  ]},
  { id: 6, name: "Finishing - Laminate", type: "Procurement", icon: "🎨", brands: [
    { id: 6, name: "Greenlam", items: [
      { id: 6, model_name: "Off white", default_unit: "sheets", default_rate: 1100, gst_pct: 18, margin_pct: 35, is_active: true },
      { id: 7, model_name: "Wooden Laminate", default_unit: "sheets", default_rate: 1400, gst_pct: 18, margin_pct: 35, is_active: true },
    ]},
    { id: 18, name: "Acrylic", items: [{ id: 18, model_name: "RM 6104 Fern", default_unit: "sheets", default_rate: 2200, gst_pct: 18, margin_pct: 35, is_active: true }] },
  ]},
  { id: 8, name: "Adhesive(Bonding)", type: "Procurement", icon: "🧴", brands: [
    { id: 8, name: "Fevicol", items: [{ id: 8, model_name: "Hi-Per", default_unit: "kg", default_rate: 280, gst_pct: 18, margin_pct: 35, is_active: true }] }
  ]},
  { id: 10, name: "Handles/Knobs", type: "Procurement", icon: "🚪", brands: [
    { id: 9, name: "Generic", items: [
      { id: 9, model_name: "Foldable Handles INR 200", default_unit: "nos", default_rate: 200, gst_pct: 18, margin_pct: 35, is_active: true },
      { id: 10, model_name: "Handles INR 1000", default_unit: "nos", default_rate: 1000, gst_pct: 18, margin_pct: 35, is_active: true },
    ]}
  ]},
  { id: 11, name: "Accessories", type: "Procurement", icon: "⚙️", brands: [
    { id: 10, name: "Hettich", items: [
      { id: 11, model_name: "Architech 4\" Tandem basket", default_unit: "nos", default_rate: 3500, gst_pct: 18, margin_pct: 35, is_active: true },
      { id: 12, model_name: "Cutlery Tray", default_unit: "nos", default_rate: 1800, gst_pct: 18, margin_pct: 35, is_active: true },
    ]},
    { id: 11, name: "Godrej", items: [{ id: 13, model_name: "Nuovo - Draw locks 25mm", default_unit: "nos", default_rate: 650, gst_pct: 18, margin_pct: 35, is_active: true }] },
    { id: 12, name: "Sincore", items: [{ id: 14, model_name: "Sink and Tap upto INR 35000", default_unit: "nos", default_rate: 35000, gst_pct: 18, margin_pct: 35, is_active: true }] },
  ]},
  { id: 12, name: "Lights", type: "Procurement", icon: "💡", brands: [
    { id: 14, name: "Alt", items: [
      { id: 15, model_name: "Profile Light", default_unit: "rft", default_rate: 120, gst_pct: 18, margin_pct: 35, is_active: true },
      { id: 16, model_name: "5 amp driver With Sensors", default_unit: "nos", default_rate: 2500, gst_pct: 18, margin_pct: 35, is_active: true },
      { id: 17, model_name: "Down lights", default_unit: "nos", default_rate: 850, gst_pct: 18, margin_pct: 35, is_active: true },
    ]}
  ]},
];

const DEMO_SERVICES: ServiceItemType[] = [
  { id: 1, name: "Box Carpentry", category: "Carpentry", sub_type: "Box", default_unit: "sft", default_rate: 25, gst_pct: 18, margin_pct: 35 },
  { id: 2, name: "Panel Carpentry", category: "Carpentry", sub_type: "Panel", default_unit: "sft", default_rate: 18, gst_pct: 18, margin_pct: 35 },
  { id: 3, name: "Electrical Works", category: "Electrical", sub_type: "", default_unit: "points", default_rate: 450, gst_pct: 18, margin_pct: 35 },
  { id: 4, name: "Plain False Ceiling", category: "False Ceiling", sub_type: "Gypsum", default_unit: "sft", default_rate: 33, gst_pct: 18, margin_pct: 35 },
  { id: 5, name: "Ceiling Paint - Premium Emulsion", category: "Painting", sub_type: "Ceiling", default_unit: "sft", default_rate: 40, gst_pct: 18, margin_pct: 35 },
  { id: 6, name: "Wall Paint - Premium Emulsion", category: "Painting", sub_type: "Walls", default_unit: "sft", default_rate: 14, gst_pct: 18, margin_pct: 35 },
  { id: 7, name: "Melamine Matt Finish", category: "Polishing", sub_type: "", default_unit: "sft", default_rate: 75, gst_pct: 18, margin_pct: 35 },
  { id: 8, name: "Deep Cleaning", category: "Cleaning", sub_type: "", default_unit: "sft", default_rate: 8, gst_pct: 18, margin_pct: 35 },
  { id: 9, name: "Transport and Hamali", category: "Transport", sub_type: "", default_unit: "trip", default_rate: 3000, gst_pct: 18, margin_pct: 35 },
  { id: 10, name: "Debris Management", category: "Debris", sub_type: "", default_unit: "load", default_rate: 2500, gst_pct: 18, margin_pct: 35 },
];

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function ComponentLibrary() {
  const [activeTab, setActiveTab] = useState<"materials" | "services">("materials");
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredCategories = DEMO_CATEGORIES.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.brands.some(b => b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.items.some(it => it.model_name.toLowerCase().includes(search.toLowerCase())))
  );

  const filteredServices = DEMO_SERVICES.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = DEMO_CATEGORIES.reduce((s, c) => s + c.brands.reduce((s2, b) => s2 + b.items.length, 0), 0);

  return (
    <div className="p-6 px-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0">📦 Component Library</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">Manage materials, brands, and service items for estimates</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="px-5 py-2.5 btn-gold rounded-xl text-[13px] font-bold border-none cursor-pointer flex items-center gap-2">
          + Add Item
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          ["Categories", DEMO_CATEGORIES.length, "📂", "#C9A96E"],
          ["Materials", totalItems, "🪵", "#3b82f6"],
          ["Services", DEMO_SERVICES.length, "🔧", "#2dd4a8"],
          ["Brands", DEMO_CATEGORIES.reduce((s, c) => s + c.brands.length, 0), "🏷️", "#7B4FA6"],
        ].map(([l, v, icon, color]) => (
          <div key={l as string} className="kpi-card">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] text-surface-400 uppercase tracking-wider">{l as string}</div>
                <div className="text-2xl font-extrabold text-nicara-dark mt-1">{v as number}</div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: (color as string) + "15" }}>{icon as string}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
          {(["materials", "services"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer transition-all ${
                activeTab === tab ? "bg-white text-nicara-dark shadow-sm" : "bg-transparent text-surface-500"
              }`}>
              {tab === "materials" ? "🪵 Materials" : "🔧 Services"}
            </button>
          ))}
        </div>
        <div className="relative min-w-[250px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search materials, brands..."
            className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none" />
        </div>
      </div>

      {/* Materials Tab */}
      {activeTab === "materials" && (
        <div className="grid grid-cols-[220px_1fr] gap-4">
          {/* Category sidebar */}
          <div className="bg-white border border-surface-200 rounded-2xl p-3 h-fit">
            <div className="text-[9px] font-bold text-surface-400 uppercase tracking-wider px-2 mb-2">Categories</div>
            {filteredCategories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-left border-none cursor-pointer mb-0.5 transition-all ${
                  selectedCat === cat.id
                    ? "bg-nicara-gold/10 text-nicara-gold font-bold"
                    : "bg-transparent text-surface-600 hover:bg-surface-50"
                }`}>
                <span className="text-sm">{cat.icon}</span>
                <span className="truncate">{cat.name}</span>
                <span className="ml-auto text-[9px] text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full">
                  {cat.brands.reduce((s, b) => s + b.items.length, 0)}
                </span>
              </button>
            ))}
          </div>

          {/* Items table */}
          <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-nicara-dark">
                  {["Category", "Brand", "Model / Item", "Unit", "Rate", "GST%", "Margin%", "Status"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(selectedCat ? filteredCategories.filter(c => c.id === selectedCat) : filteredCategories).map(cat =>
                  cat.brands.map(brand =>
                    brand.items.map((item, ri) => (
                      <tr key={item.id} className={`border-b border-surface-100 hover:bg-surface-50 ${ri % 2 === 0 ? "bg-white" : "bg-surface-50/50"}`}>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm">{cat.icon}</span>
                            <span className="text-surface-500 text-[10px] truncate max-w-[120px]">{cat.name}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-nicara-dark">{brand.name}</td>
                        <td className="px-3 py-2 font-semibold text-nicara-dark">{item.model_name}</td>
                        <td className="px-3 py-2 text-surface-500">{item.default_unit}</td>
                        <td className="px-3 py-2 font-bold text-nicara-gold font-mono">{fmt(item.default_rate)}</td>
                        <td className="px-3 py-2 text-surface-500">{item.gst_pct}%</td>
                        <td className="px-3 py-2 text-surface-500">{item.margin_pct}%</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                            {item.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Services Tab */}
      {activeTab === "services" && (
        <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-nicara-dark">
                {["Service Name", "Category", "Sub Type", "Unit", "Default Rate", "GST%", "Margin%"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((svc, ri) => (
                <tr key={svc.id} className={`border-b border-surface-100 hover:bg-surface-50 ${ri % 2 === 0 ? "bg-white" : "bg-surface-50/50"}`}>
                  <td className="px-3 py-2 font-semibold text-nicara-dark">{svc.name}</td>
                  <td className="px-3 py-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{svc.category}</span>
                  </td>
                  <td className="px-3 py-2 text-surface-500">{svc.sub_type || "—"}</td>
                  <td className="px-3 py-2 text-surface-500">{svc.default_unit}</td>
                  <td className="px-3 py-2 font-bold text-nicara-gold font-mono">{fmt(svc.default_rate)}</td>
                  <td className="px-3 py-2 text-surface-500">{svc.gst_pct}%</td>
                  <td className="px-3 py-2 text-surface-500">{svc.margin_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-[500px] max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-nicara-dark mb-4">Add Material Item</h2>
            <div className="space-y-3">
              {[["Category", "select"], ["Brand", "select"], ["Model Name", "text"], ["Default Unit", "text"], ["Default Rate (₹)", "number"], ["GST %", "number"], ["Margin %", "number"]].map(([label, type]) => (
                <div key={label as string}>
                  <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block mb-1">{label as string}</label>
                  {type === "select" ? (
                    <select className="w-full px-3 py-2 border border-surface-200 rounded-xl text-[12px] bg-white outline-none cursor-pointer">
                      <option>Select...</option>
                      {label === "Category" ? DEMO_CATEGORIES.map(c => <option key={c.id}>{c.name}</option>) :
                        <option>Select category first</option>}
                    </select>
                  ) : (
                    <input type={type as string} className="w-full px-3 py-2 border border-surface-200 rounded-xl text-[12px] bg-white outline-none" placeholder={`Enter ${(label as string).toLowerCase()}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-surface-100 border-none rounded-lg text-[12px] cursor-pointer text-surface-600">Cancel</button>
              <button onClick={() => setShowAddModal(false)} className="px-5 py-2 btn-gold rounded-lg text-[12px] font-bold border-none cursor-pointer">Save Item</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
