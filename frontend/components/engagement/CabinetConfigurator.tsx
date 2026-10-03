"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, estimatesApi, estimatorApi } from "@/lib/api";
import type {
  CabinetConfig, Estimate, EstimateItem, EstimatorResult, Project,
} from "@/lib/apiTypes";
import { useApiData, inr } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import { Minus, Plus, Calculator, X, AlertTriangle } from "lucide-react";

type DimUnit = "mm" | "in" | "ft";
const PER_MM: Record<DimUnit, number> = { mm: 1, in: 1 / 25.4, ft: 1 / 304.8 };

const toDisplay = (mm: number, unit: DimUnit) => {
  const v = mm * PER_MM[unit];
  return unit === "mm" ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
};
const fromDisplay = (text: string, unit: DimUnit) => {
  const n = parseFloat(text);
  return Number.isFinite(n) ? n / PER_MM[unit] : NaN;
};

const LBL = "text-[9px] font-bold text-surface-500 uppercase tracking-wider block mb-1";
const INP = "w-full px-2 py-1.5 border border-surface-200 rounded-lg text-[11px] bg-white outline-none focus:border-nicara-gold";

/**
 * Cabinet calculator for one estimate line.
 *
 * Starts from the line's saved configuration, or — for an unconfigured line —
 * the default template picked from its name and written sizes. Every change
 * is recalculated live on the server (nothing is saved) so cost and material
 * quantities update as you type; "Apply" replaces the line's breakdown.
 */
export default function CabinetConfigurator({
  project, estimate, item, onApplied, onClose,
}: {
  project: Project;
  estimate: Estimate;
  item: EstimateItem;
  onApplied: () => Promise<void>;
  onClose: () => void;
}) {
  const toast = useToast();
  const meta = useApiData(() => estimatorApi.meta(), []);
  const [config, setConfig] = useState<CabinetConfig | null>(null);
  const [result, setResult] = useState<EstimatorResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [unit, setUnit] = useState<DimUnit>("mm");
  // Text being typed into a size box, so "2." or "" isn't fought by the parser.
  const [dimText, setDimText] = useState<Partial<Record<"length" | "depth" | "height", string>>>({});
  const seq = useRef(0);

  const run = async (cfg: Partial<CabinetConfig>, withHint = false) => {
    const mine = ++seq.current;
    setCalculating(true);
    try {
      const res = await estimatorApi.preview(cfg, withHint
        ? { name: item.item, length: item.length, breadth: item.breadth, height: item.height }
        : undefined);
      if (mine !== seq.current) return;           // a newer edit is in flight
      setResult(res);
      setErrors({});
      setBanner("");
      if (withHint) setConfig(res.config);
    } catch (e) {
      if (mine !== seq.current) return;
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); }
      else setBanner("Could not calculate.");
    } finally {
      if (mine === seq.current) setCalculating(false);
    }
  };

  // First load: saved config, or the default template from the line itself.
  useEffect(() => {
    run(item.config ?? {}, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Live recalculation, debounced while typing.
  useEffect(() => {
    if (!config) return;
    const t = setTimeout(() => run(config), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const set = <K extends keyof CabinetConfig>(key: K, value: CabinetConfig[K]) =>
    setConfig(c => (c ? { ...c, [key]: value } : c));

  const setOption = (key: "hinge" | "channel" | "handle" | "finish", value: string) =>
    setConfig(c => (c ? { ...c, options: { ...(c.options ?? {}), [key]: value ? Number(value) : null } } : c));

  const pickTemplate = (key: string) => {
    const t = meta.data?.templates.find(x => x.key === key);
    if (!t) return;
    setDimText({});
    setConfig(c => c ? {
      ...c, template: key, length: t.length, depth: t.depth, height: t.height,
      drawers: t.drawers, doors: t.doors, shelves: t.shelves,
    } : c);
  };

  const apply = async () => {
    if (!config) return;
    setApplying(true);
    try {
      const res = await estimatesApi.configure(project.id, estimate.id, item.id, { config });
      toast.success("Breakdown recalculated", res.detail);
      await onApplied();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); }
      else setBanner("Could not apply the configuration.");
    } finally {
      setApplying(false);
    }
  };

  const err = (k: string) => errors[k]?.[0];
  const m = meta.data;

  const dimInput = (key: "length" | "depth" | "height", label: string) => (
    <div>
      <label className={LBL}>{label} ({unit})</label>
      <input className={`${INP} font-mono ${err(key) ? "border-red-300" : ""}`} inputMode="decimal"
        value={dimText[key] ?? (config ? toDisplay(config[key], unit) : "")}
        onChange={e => {
          const text = e.target.value;
          setDimText(d => ({ ...d, [key]: text }));
          const mm = fromDisplay(text, unit);
          if (Number.isFinite(mm)) set(key, Math.round(mm * 10) / 10);
        }}
        onBlur={() => setDimText(d => ({ ...d, [key]: undefined }))} />
      {err(key) && <div className="text-[9px] text-red-600 mt-0.5">{err(key)}</div>}
    </div>
  );

  const counter = (key: "drawers" | "doors" | "shelves", label: string) => (
    <div>
      <label className={LBL}>{label}</label>
      <div className={`flex items-center border rounded-lg bg-white ${err(key) ? "border-red-300" : "border-surface-200"}`}>
        <button type="button" onClick={() => config && set(key, Math.max(0, config[key] - 1))}
          className="px-2 py-1.5 bg-transparent border-none cursor-pointer text-surface-500 hover:text-nicara-gold"><Minus size={11} /></button>
        <span className="flex-1 text-center text-[12px] font-bold font-mono text-nicara-dark">{config?.[key] ?? "–"}</span>
        <button type="button" onClick={() => config && set(key, Math.min(20, config[key] + 1))}
          className="px-2 py-1.5 bg-transparent border-none cursor-pointer text-surface-500 hover:text-nicara-gold"><Plus size={11} /></button>
      </div>
      {err(key) && <div className="text-[9px] text-red-600 mt-0.5">{err(key)}</div>}
    </div>
  );

  const select = (label: string, value: string | number, onChange: (v: string) => void,
                  options: { value: string; label: string }[], errKey?: string) => (
    <div>
      <label className={LBL}>{label}</label>
      <select className={`${INP} cursor-pointer ${errKey && err(errKey) ? "border-red-300" : ""}`}
        value={String(value ?? "")} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {errKey && err(errKey) && <div className="text-[9px] text-red-600 mt-0.5">{err(errKey)}</div>}
    </div>
  );

  const mmOpts = (list: number[] = []) => list.map(t => ({ value: String(t), label: `${t} mm` }));
  const optList = (list: { id: number; label: string }[] = []) =>
    [{ value: "", label: "Cheapest in catalogue" }, ...list.map(o => ({ value: String(o.id), label: o.label }))];
  const finishOptions = config?.finish === "acrylic" ? m?.acrylics : m?.laminates;
  const delta = result ? parseFloat(result.total) - parseFloat(item.amount || "0") : 0;

  return (
    <div className="bg-white border border-nicara-gold/40 rounded-xl p-3 mb-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[11px] font-bold text-nicara-dark">
          <Calculator size={13} className="text-nicara-gold" /> Cabinet Calculator
          {calculating && <span className="text-[10px] font-normal text-surface-400">recalculating…</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-surface-200 overflow-hidden">
            {(["mm", "in", "ft"] as DimUnit[]).map(u => (
              <button key={u} type="button" onClick={() => { setUnit(u); setDimText({}); }}
                className={`px-2 py-0.5 text-[10px] font-semibold border-none cursor-pointer ${unit === u ? "bg-nicara-dark text-nicara-gold" : "bg-white text-surface-500"}`}>{u}</button>
            ))}
          </div>
          <button type="button" onClick={onClose} title="Close"
            className="bg-transparent border-none cursor-pointer text-surface-400 hover:text-red-500 p-0"><X size={14} /></button>
        </div>
      </div>

      {m && (
        <div className="mb-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800">
          Formulas are <b>provisional</b> ({m.formula_version}) — pending the client-verified formula sheet.
          Each row below shows how its quantity was worked out.
        </div>
      )}
      {banner && Object.keys(errors).length === 0 && (
        <div className="mb-2 text-[11px] text-red-600">{banner}</div>
      )}

      {!config || !m ? (
        <div className="py-6 text-center text-[11px] text-surface-400">Loading calculator…</div>
      ) : (
        <>
          {/* ── Inputs ── */}
          <div className="grid grid-cols-6 gap-2 mb-2">
            {select("Template", config.template, pickTemplate,
              m.templates.map(t => ({ value: t.key, label: t.label })), "template")}
            {dimInput("length", "Width (L)")}
            {dimInput("depth", "Depth (B)")}
            {dimInput("height", "Height (H)")}
            {select("Board size", config.board, v => set("board", v),
              m.boards.map(b => ({ value: b, label: b })), "board")}
            <div>
              <label className={LBL}>Wastage %</label>
              <input className={`${INP} font-mono`} inputMode="decimal" value={String(config.wastage_pct)}
                onChange={e => set("wastage_pct", parseFloat(e.target.value) || 0)} />
              {err("wastage_pct") && <div className="text-[9px] text-red-600 mt-0.5">{err("wastage_pct")}</div>}
            </div>

            {counter("drawers", "Drawers")}
            {counter("doors", "Doors")}
            {counter("shelves", "Shelves")}
            {select("Carcass ply", config.carcass_thickness, v => set("carcass_thickness", Number(v)),
              mmOpts(m.thicknesses.carcass), "carcass_thickness")}
            {select("Shutter ply", config.shutter_thickness, v => set("shutter_thickness", Number(v)),
              mmOpts(m.thicknesses.shutter), "shutter_thickness")}
            {select("Back / bottoms", config.back_thickness, v => set("back_thickness", Number(v)),
              mmOpts(m.thicknesses.back), "back_thickness")}

            {select("Drawer box ply", config.drawer_box_thickness, v => set("drawer_box_thickness", Number(v)),
              mmOpts(m.thicknesses.drawer_box), "drawer_box_thickness")}
            {select("Plywood brand", config.ply_brand, v => set("ply_brand", v),
              m.ply_brands.map(b => ({ value: b, label: b })))}
            {select("Finish", config.finish, v => set("finish", v),
              m.finishes.map(f => ({ value: f, label: f[0].toUpperCase() + f.slice(1) })), "finish")}
            {select("Hinge", config.options?.hinge ?? "", v => setOption("hinge", v), optList(m.hinges))}
            {select("Drawer channel", config.options?.channel ?? "", v => setOption("channel", v), optList(m.channels))}
            {select("Handle", config.options?.handle ?? "", v => setOption("handle", v), optList(m.handles))}
          </div>
          {config.finish !== "none" && (
            <div className="grid grid-cols-6 gap-2 mb-2">
              {select(config.finish === "acrylic" ? "Acrylic sheet" : "Laminate sheet",
                config.options?.finish ?? "", v => setOption("finish", v), optList(finishOptions))}
            </div>
          )}

          {/* ── Derived quantities ── */}
          {result && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Object.entries(result.quantities.plywood).map(([t, p]) => (
                <Chip key={t} label={`${t} ply`} value={`${p.gross_sft} sft · ${p.sheets} sheet${p.sheets === 1 ? "" : "s"}`} />
              ))}
              <Chip label="Slides" value={result.quantities.slides} />
              <Chip label="Hinges" value={result.quantities.hinges} />
              <Chip label="Handles" value={result.quantities.handles} />
              <Chip label="Screws" value={result.quantities.screws} />
              <Chip label="Edge band" value={`${result.quantities.edge_band_rft} rft`} />
              {result.quantities.finish_sheets > 0 && <Chip label="Finish" value={`${result.quantities.finish_sheets} sheet(s)`} />}
            </div>
          )}
          {result?.warnings.map(w => (
            <div key={w} className="flex items-center gap-1.5 text-[10px] text-amber-700 mb-1">
              <AlertTriangle size={11} /> {w}
            </div>
          ))}

          {/* ── Live preview ── */}
          {result && (
            <div className={`overflow-x-auto border border-surface-200 rounded-lg ${calculating ? "opacity-60" : ""}`}>
              <table className="w-full text-[10px] min-w-[760px]">
                <thead>
                  <tr className="bg-surface-100">
                    {["Basic Component", "Detail", "Brand", "Model", "Qty", "Unit", "Price", "Amount", "How it's worked out"].map(h => (
                      <th key={h} className="px-2 py-1.5 text-surface-500 font-semibold text-left text-[9px] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, i) => (
                    <tr key={i} className="border-t border-surface-100">
                      <td className="px-2 py-1 font-semibold text-nicara-dark whitespace-nowrap">{r.basic_component}</td>
                      <td className="px-2 py-1 text-surface-600 whitespace-nowrap">{r.detail}</td>
                      <td className="px-2 py-1 text-surface-600">{r.brand || "—"}</td>
                      <td className="px-2 py-1 text-surface-600">{r.model || "—"}</td>
                      <td className="px-2 py-1 font-mono text-right">{parseFloat(r.qty)}</td>
                      <td className="px-2 py-1">{r.unit}</td>
                      <td className="px-2 py-1 font-mono text-right whitespace-nowrap">
                        {inr(r.price)}
                        {r.source === "provisional" && (
                          <span className="ml-1 px-1 rounded bg-amber-100 text-amber-700 text-[8px] font-bold" title="No catalogue price — provisional rate">PROV</span>
                        )}
                      </td>
                      <td className="px-2 py-1 font-mono text-right font-semibold text-nicara-dark whitespace-nowrap">{inr(r.amount)}</td>
                      <td className="px-2 py-1 text-surface-400 text-[9px]">{r.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Apply ── */}
          <div className="flex items-center justify-between mt-2">
            <div className="text-[11px] text-surface-500">
              {result && (
                <>
                  Calculated total <b className="text-nicara-dark text-[13px]">{inr(result.total)}</b>
                  {item.has_components && Math.abs(delta) >= 0.01 && (
                    <span className={`ml-2 font-semibold ${delta > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {delta > 0 ? "+" : "−"}{inr(String(Math.abs(delta)))} vs current
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {item.has_components && (
                <span className="text-[10px] text-surface-400">Replaces the current breakdown</span>
              )}
              <button type="button" onClick={apply}
                disabled={applying || calculating || !result || Object.keys(errors).length > 0}
                className="px-3 py-1.5 bg-nicara-gold border-none rounded-lg text-[11px] font-bold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {applying ? "Applying…" : "Apply to line"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="px-2 py-0.5 bg-surface-50 border border-surface-200 rounded-full text-[10px] text-surface-600">
      {label}: <b className="text-nicara-dark">{value}</b>
    </span>
  );
}
