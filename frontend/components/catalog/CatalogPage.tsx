"use client";

import { useState } from "react";
import { catalogApi } from "@/lib/api";
import type { CatalogMeta } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";
import FurnitureTab from "@/components/catalog/FurnitureTab";
import BasicComponentsTab from "@/components/catalog/BasicComponentsTab";
import RoomsTab from "@/components/catalog/RoomsTab";

type Tab = "furniture" | "components" | "rooms";

const TABS: { id: Tab; label: string; icon: string; hint: string }[] = [
  { id: "furniture", label: "Furniture", icon: "🪑", hint: "Finished products and the components they're estimated from" },
  { id: "components", label: "Basic Components", icon: "🧩", hint: "Estimate row types and how their quantity is calculated" },
  { id: "rooms", label: "Rooms & Zones", icon: "🏠", hint: "Where furniture can be placed" },
];

/**
 * Furniture Catalogue — the master data the Initial Estimate is calculated from.
 *
 * Furniture is a finished product of a cabinet type (wardrobe, crockery unit,
 * kitchen base…). It lists Basic Components — Doors/Drawers/Shelves (spec
 * purpose), ply, hinges, laminate… (procurement), carpentry (service) — each
 * with a quantity rule from the calculation sheet and a Raw Material category
 * for its brand, model and price.
 */
export default function CatalogPage() {
  const [tab, setTab] = useState<Tab>("furniture");
  const { data: meta, reload: reloadMeta } = useApiData<CatalogMeta>(() => catalogApi.meta(), []);

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-nicara-dark m-0">Furniture Catalogue</h1>
        <p className="text-[12px] text-surface-500 mt-1 m-0">
          Furniture is a finished product of a cabinet type. Its estimate rows come from its basic components:
          quantities follow the calculation sheet&apos;s rules, brands and prices come from Raw Material.
        </p>
      </div>

      {meta && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {([
            ["Furniture", meta.counts.furniture, "🪑", "#3b82f6"],
            ["Basic Components", meta.counts.basic_components, "🧩", "#F59E0B"],
            ["Rooms", meta.counts.rooms, "🏠", "#C9A96E"],
            ["Zones", meta.counts.zones, "📐", "#7B4FA6"],
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
      {tab === "components" && <BasicComponentsTab meta={meta} onChange={reloadMeta} />}
      {tab === "rooms" && <RoomsTab onChange={reloadMeta} />}
    </div>
  );
}
