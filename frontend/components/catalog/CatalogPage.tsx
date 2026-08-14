"use client";

import { useState } from "react";
import { catalogApi } from "@/lib/api";
import type { CatalogMeta } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";
import FurnitureTab from "@/components/catalog/FurnitureTab";
import MaterialsTab from "@/components/catalog/MaterialsTab";
import RoomsTab from "@/components/catalog/RoomsTab";

type Tab = "furniture" | "materials" | "rooms";

const TABS: { id: Tab; label: string; icon: string; hint: string }[] = [
  { id: "furniture", label: "Furniture", icon: "🪑", hint: "Products built from parts & materials" },
  { id: "materials", label: "Materials", icon: "🧱", hint: "Material types and their priced options" },
  { id: "rooms", label: "Rooms & Zones", icon: "🏠", hint: "Where furniture can be placed" },
];

/**
 * Furniture Catalogue — the master data behind estimates.
 *
 * The chain reads plainly: a Room has Zones; on a Zone you place Furniture;
 * Furniture is built from Parts; each Part uses Materials; each Material has
 * priced Options.
 */
export default function CatalogPage() {
  const [tab, setTab] = useState<Tab>("furniture");
  const { data: meta, reload: reloadMeta } = useApiData<CatalogMeta>(() => catalogApi.meta(), []);

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-nicara-dark m-0">Furniture Catalogue</h1>
        <p className="text-[12px] text-surface-500 mt-1 m-0">
          Master data your team maintains. A room has zones; on a zone you place furniture;
          furniture is built from parts; each part uses materials; each material has priced options.
        </p>
      </div>

      {meta && (
        <div className="grid grid-cols-5 gap-3 mb-5">
          {([
            ["Rooms", meta.counts.rooms, "🏠", "#C9A96E"],
            ["Zones", meta.counts.zones, "📐", "#7B4FA6"],
            ["Furniture", meta.counts.furniture, "🪑", "#3b82f6"],
            ["Materials", meta.counts.materials, "🧱", "#F59E0B"],
            ["Material Options", meta.counts.options, "🏷️", "#2dd4a8"],
          ] as const).map(([label, value, icon, colour]) => (
            <div key={label} className="kpi-card">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] text-surface-400 uppercase tracking-wider">{label}</div>
                  <div className="text-2xl font-extrabold text-nicara-dark mt-1">{value}</div>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: colour + "15" }}>{icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 bg-surface-100 rounded-xl p-1 mb-5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} title={t.hint}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer transition-all ${
              tab === t.id ? "bg-white text-nicara-dark shadow-sm" : "bg-transparent text-surface-500"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "furniture" && <FurnitureTab meta={meta} onChange={reloadMeta} />}
      {tab === "materials" && <MaterialsTab onChange={reloadMeta} />}
      {tab === "rooms" && <RoomsTab onChange={reloadMeta} />}
    </div>
  );
}
