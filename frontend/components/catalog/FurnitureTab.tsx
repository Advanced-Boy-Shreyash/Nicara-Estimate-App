"use client";

import { useEffect, useState } from "react";
import { ApiError, catalogApi, libraryApi } from "@/lib/api";
import type {
  CalcOptions, CatalogMeta, CatalogRoom, Furniture, FurnitureCalc, FurnitureComponent,
} from "@/lib/apiTypes";
import { useApiData, inr } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Check, Field, Select, TextArea } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading } from "@/components/ui/States";
import { TypePill } from "@/components/catalog/BasicComponentsTab";

/** Furniture list with a room filter; each opens its components with a live size preview. */
export default function FurnitureTab({ meta, onChange }: { meta: CatalogMeta | null; onChange: () => void }) {
  const toast = useToast();
  const [roomFilter, setRoomFilter] = useState<number | "">("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [editFurniture, setEditFurniture] = useState<Furniture | "new" | null>(null);

  const rooms = useApiData(() => catalogApi.rooms(), []);
  const list = useApiData(() => catalogApi.furniture(roomFilter || undefined), [roomFilter]);
  const furniture = list.data?.results ?? [];
  const roomOptions = rooms.data?.results ?? [];

  if (openId !== null) {
    return (
      <FurnitureComponents furnitureId={openId} meta={meta} rooms={roomOptions}
        onBack={() => { setOpenId(null); void list.reload(); }}
        onChanged={() => { void list.reload(); onChange(); }} />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={roomFilter} onChange={e => setRoomFilter(e.target.value ? Number(e.target.value) : "")}
          className="px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white cursor-pointer outline-none focus:border-nicara-gold">
          <option value="">All rooms</option>
          {roomOptions.map(r => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
        </select>
        <span className="text-[11px] text-surface-400">{furniture.length} item(s)</span>
        <div className="flex-1" />
        <Btn onClick={() => setEditFurniture("new")}>+ Add Furniture</Btn>
      </div>

      {list.loading && <Loading />}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {!list.loading && furniture.length === 0 && (
        <EmptyState icon="🪑" title={roomFilter ? "No furniture for this room" : "No furniture yet"}
          hint="Add a finished product, then list the basic components it's estimated from." />
      )}

      {!list.loading && furniture.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-nicara-dark">
                  {["Furniture", "Cabinet type", "Rooms", "Default size (W × H × D)", "Components", "Margin", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {furniture.map(f => (
                  <tr key={f.id} className={`border-b border-surface-100 hover:bg-surface-50 ${!f.is_active ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-nicara-dark">{f.name}</div>
                      <div className="font-mono text-[9px] text-surface-400">{f.code}</div>
                      {f.description && <div className="text-[10px] text-amber-700 max-w-[300px]">{f.description}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-surface-600 whitespace-nowrap">{f.cabinet_type_display}</td>
                    <td className="px-3 py-2.5 text-surface-600 max-w-[220px]">
                      {f.room_names.length ? f.room_names.join(", ") : <span className="text-surface-400 italic">All rooms</span>}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-surface-600 whitespace-nowrap">
                      {[f.default_length, f.default_height, f.default_breadth].some(Boolean)
                        ? [f.default_length, f.default_height, f.default_breadth].map(v => v || "—").join(" × ") : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{f.component_count}</span>
                    </td>
                    <td className="px-3 py-2.5 text-surface-500">{parseFloat(f.margin_pct)}%</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => setOpenId(f.id)}
                        className="px-2.5 py-1 btn-gold rounded-lg text-[11px] cursor-pointer border-none font-semibold mr-1.5">
                        Components
                      </button>
                      <button onClick={() => setEditFurniture(f)}
                        className="px-2.5 py-1 bg-surface-100 rounded-lg text-[11px] cursor-pointer border-none text-surface-600 hover:bg-surface-200">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editFurniture && (
        <FurnitureModal furniture={editFurniture === "new" ? null : editFurniture} rooms={roomOptions} meta={meta}
          onClose={() => setEditFurniture(null)}
          onSaved={msg => { setEditFurniture(null); toast.success("Saved", msg); void list.reload(); onChange(); }} />
      )}
    </div>
  );
}

/* ── Components of one furniture, previewed at a size ───────── */

const SIZE_INPUT = "w-[90px] px-2 py-1.5 border border-surface-200 rounded-lg text-[12px] font-mono outline-none focus:border-nicara-gold";

function FurnitureComponents({ furnitureId, meta, rooms, onBack, onChanged }: {
  furnitureId: number; meta: CatalogMeta | null; rooms: CatalogRoom[];
  onBack: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const detail = useApiData(() => catalogApi.furnitureDetail(furnitureId), [furnitureId]);
  const f = detail.data;
  const [size, setSize] = useState({ width: "", height: "", depth: "" });
  const [options, setOptions] = useState<CalcOptions>({});
  const [calc, setCalc] = useState<FurnitureCalc | null>(null);
  const [calcError, setCalcError] = useState("");
  const [editing, setEditing] = useState<FurnitureComponent | "new" | null>(null);
  const [editFurniture, setEditFurniture] = useState(false);

  // Live preview: recalculates (debounced) as the size or options change.
  useEffect(() => {
    if (!f) return;
    const t = setTimeout(async () => {
      try {
        setCalc(await catalogApi.calculate(furnitureId, { ...size, options }));
        setCalcError("");
      } catch (e) {
        setCalcError(e instanceof ApiError ? e.message : "Could not calculate.");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [f, furnitureId, size, options]);

  const reloadAll = async () => { await detail.reload(); onChanged(); };

  if (detail.loading && !f) return <Loading />;
  if (detail.error) return <ErrorState message={detail.error} onRetry={detail.reload} />;
  if (!f) return null;

  const components = f.components ?? [];
  const rowFor = (id: number) => calc?.rows.find(r => r.component_id === id);
  const counts = calc?.calculation.counts;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack}
          className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-surface-500 cursor-pointer border-none hover:bg-surface-200">←</button>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-nicara-dark">{f.name}</div>
          <div className="text-[11px] text-surface-500">
            {f.cabinet_type_display} · {f.room_names.length ? f.room_names.join(", ") : "All rooms"} · {parseFloat(f.margin_pct)}% margin
          </div>
        </div>
        <Btn variant="ghost" onClick={() => setEditFurniture(true)}>Edit Furniture</Btn>
        <Btn onClick={() => setEditing("new")}>+ Add Component</Btn>
      </div>
      {f.description && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">{f.description}</div>
      )}

      {/* Preview size & options */}
      <div className="bg-white border border-surface-200 rounded-2xl p-4 mb-4 flex items-end gap-4 flex-wrap">
        {(["width", "height", "depth"] as const).map(k => (
          <label key={k} className="block">
            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block mb-1">{k}</span>
            <input className={SIZE_INPUT} value={size[k]}
              placeholder={{ width: f.default_length, height: f.default_height, depth: f.default_breadth }[k] || "—"}
              onChange={e => setSize(s => ({ ...s, [k]: e.target.value }))} />
          </label>
        ))}
        <OptionsControls options={options} onChange={setOptions} />
        {counts && (
          <div className="ml-auto flex gap-2 text-[11px]">
            {(["doors", "drawers", "shelves", "verticals"] as const).map(k => (
              <span key={k} className="px-2.5 py-1 rounded-full bg-surface-100 text-surface-600">
                {k}: <b className="text-nicara-dark">{counts[k]}</b>
              </span>
            ))}
          </div>
        )}
      </div>
      {calcError && <InlineError message={calcError} />}
      {calc?.calculation.warnings.map(w => (
        <div key={w} className="mb-2 text-[11px] text-amber-700">⚠ {w}</div>
      ))}

      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-nicara-dark">
                {["Type", "Basic Component", "Brand / Model", "Qty", "Unit", "Rate", "Amount", "How it's worked out", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {components.map(c => {
                const r = rowFor(c.id);
                return (
                  <tr key={c.id} className="border-b border-surface-100 hover:bg-surface-50">
                    <td className="px-3 py-2"><TypePill type={c.item_type} /></td>
                    <td className="px-3 py-2 font-semibold text-nicara-dark">
                      {c.basic_component_name}
                      {c.fixed_qty !== null && <span className="ml-1.5 text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 rounded">FIXED</span>}
                    </td>
                    <td className="px-3 py-2 text-surface-600">
                      {c.item_type === "Spec Purpose" ? <span className="text-surface-400">{r?.application}</span>
                        : [r?.brand, r?.model].filter(Boolean).join(" — ") || <span className="text-red-500">no price</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-right">{r ? r.qty : "…"}</td>
                    <td className="px-3 py-2 text-surface-500">{c.unit}</td>
                    <td className="px-3 py-2 font-mono text-right">{r && c.item_type !== "Spec Purpose" ? inr(String(r.rate)) : ""}</td>
                    <td className="px-3 py-2 font-mono text-right font-semibold text-nicara-dark">
                      {r && c.item_type !== "Spec Purpose" ? inr(String(r.amount)) : ""}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-surface-400 max-w-[360px]">
                      {r?.basis}{r?.needs_input && <span className="text-amber-600"> — set the quantity on the estimate</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(c)}
                        className="px-2 py-0.5 bg-surface-100 rounded text-[10px] cursor-pointer border-none text-surface-600 hover:bg-surface-200">
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {components.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-surface-400">No components yet — add Doors, ply, hinges, …</td></tr>
              )}
            </tbody>
            {calc && components.length > 0 && (
              <tfoot>
                <tr className="bg-surface-50">
                  <td colSpan={6} className="px-3 py-2.5 text-right text-[11px] font-bold text-surface-600">
                    Cost at {calc.calculation.size} (before margin & GST)
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-nicara-gold">{inr(String(calc.total_cost))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {editing && (
        <ComponentLinkModal furnitureId={f.id} link={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async msg => { setEditing(null); toast.success("Saved", msg); await reloadAll(); }} />
      )}
      {editFurniture && (
        <FurnitureModal furniture={f} rooms={rooms} meta={meta} onClose={() => setEditFurniture(false)}
          onSaved={async msg => { setEditFurniture(false); toast.success("Saved", msg); await reloadAll(); }} />
      )}
    </div>
  );
}

/** Shelf type / handleless / visible side — the options the rules take. */
export function OptionsControls({ options, onChange, compact }: {
  options: CalcOptions; onChange: (o: CalcOptions) => void; compact?: boolean;
}) {
  const set = (patch: Partial<CalcOptions>) => onChange({ ...options, ...patch });
  return (
    <div className={`flex items-center ${compact ? "gap-3" : "gap-4"} flex-wrap`}>
      <label className="flex items-center gap-1.5 text-[11px] text-surface-600">
        Shelves
        <select value={options.shelf_type ?? "ply"} onChange={e => set({ shelf_type: e.target.value as "ply" | "glass" })}
          className="px-2 py-1 border border-surface-200 rounded-lg text-[11px] bg-white cursor-pointer">
          <option value="ply">Ply</option>
          <option value="glass">Glass</option>
        </select>
      </label>
      <Check label="Handleless" checked={!!options.handleless} onChange={v => set({ handleless: v })} />
      <Check label="One side visible" checked={!!options.one_side_visible} onChange={v => set({ one_side_visible: v })} />
    </div>
  );
}

/* ── Add / edit one component link ───────────────────────────── */

function ComponentLinkModal({ furnitureId, link, onClose, onSaved }: {
  furnitureId: number; link: FurnitureComponent | null;
  onClose: () => void; onSaved: (msg: string) => void;
}) {
  const components = useApiData(() => catalogApi.basicComponents(), []);
  const [form, setForm] = useState({
    basic_component: link?.basic_component ?? 0,
    default_material: link?.default_material ?? null as number | null,
    fixed_qty: link?.fixed_qty ?? "",
    application: link?.application ?? "",
  });
  const chosen = (components.data?.results ?? []).find(c => c.id === form.basic_component);
  const categoryId = chosen?.library_category ?? null;
  const materials = useApiData(
    async () => (categoryId ? libraryApi.categoryItems(categoryId) : null), [categoryId]);
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.basic_component) { setBanner("Pick a basic component."); return; }
    setSaving(true); setBanner("");
    const payload = {
      basic_component: form.basic_component,
      default_material: form.default_material,
      fixed_qty: form.fixed_qty === "" ? null : String(form.fixed_qty),
      application: form.application,
    };
    try {
      if (link) await catalogApi.updateComponent(link.id, payload);
      else await catalogApi.addComponent(furnitureId, payload);
      onSaved(`${chosen?.name ?? "Component"} saved`);
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : "Could not save.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!link) return;
    setSaving(true);
    try { await catalogApi.deleteComponent(link.id); onSaved(`${link.basic_component_name} removed`); }
    catch { setBanner("Could not remove."); setSaving(false); }
  };

  const isSpec = chosen?.item_type === "Spec Purpose";
  return (
    <Modal open onClose={onClose} size="md" title={link ? `Edit ${link.basic_component_name}` : "Add Component"}
      subtitle="Quantity comes from the component's rule unless you fix it here"
      footer={<>
        {link && <Btn variant="danger" onClick={remove} disabled={saving}>Remove</Btn>}
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}
      <div className="grid grid-cols-1 gap-3">
        <Select label="Basic component" value={form.basic_component ? String(form.basic_component) : ""}
          onChange={v => setForm(f => ({ ...f, basic_component: Number(v), default_material: null }))}
          placeholder="Select…" required
          options={(components.data?.results ?? []).filter(c => c.is_active)
            .map(c => ({ value: String(c.id), label: `${c.name} — ${c.item_type}` }))} />
        {!isSpec && (
          <Select label="Default brand / model" value={form.default_material ? String(form.default_material) : ""}
            onChange={v => setForm(f => ({ ...f, default_material: v ? Number(v) : null }))}
            placeholder={categoryId ? "Cheapest in the category" : "No raw material category on this component"}
            options={(materials.data?.results ?? []).map(m => ({
              value: String(m.id), label: `${[m.brand_name, m.model_name].filter(Boolean).join(" — ")} (₹${parseFloat(m.default_rate)}/${m.default_unit})`,
            }))} />
        )}
        <Field label="Fixed quantity" type="number" value={String(form.fixed_qty ?? "")}
          onChange={v => setForm(f => ({ ...f, fixed_qty: v }))}
          hint="Leave blank to use the quantity rule" />
        <Field label="Application" value={form.application} onChange={v => setForm(f => ({ ...f, application: v }))}
          placeholder={isSpec ? "Auto, e.g. Ply - 4 nos" : "e.g. For drawers"} />
      </div>
    </Modal>
  );
}

/* ── Add / edit furniture ────────────────────────────────────── */

function FurnitureModal({ furniture, rooms, meta, onClose, onSaved }: {
  furniture: Furniture | null; rooms: CatalogRoom[]; meta: CatalogMeta | null;
  onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<Furniture>>(furniture ?? {
    name: "", description: "", rooms: [], cabinet_type: "wardrobe_openable",
    default_length: "", default_height: "", default_breadth: "", margin_pct: "15", gst_pct: "18", is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Furniture>(k: K, v: Furniture[K]) => setForm(f => ({ ...f, [k]: v }));
  const toggleRoom = (id: number) => set("rooms", (form.rooms ?? []).includes(id)
    ? (form.rooms ?? []).filter(r => r !== id) : [...(form.rooms ?? []), id]);

  const save = async () => {
    if (!form.name?.trim()) { setErrors({ name: ["Name is required."] }); return; }
    setSaving(true); setBanner(""); setErrors({});
    const payload: Partial<Furniture> = {
      name: form.name, description: form.description, rooms: form.rooms, cabinet_type: form.cabinet_type,
      default_length: form.default_length, default_height: form.default_height, default_breadth: form.default_breadth,
      margin_pct: form.margin_pct, gst_pct: form.gst_pct, is_active: form.is_active,
    };
    try {
      if (furniture) await catalogApi.updateFurniture(furniture.id, payload);
      else await catalogApi.createFurniture(payload);
      onSaved(`${form.name} saved`);
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); } else setBanner("Could not save.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!furniture) return;
    setSaving(true);
    try { await catalogApi.deleteFurniture(furniture.id); onSaved(`${furniture.name} deactivated`); }
    catch { setBanner("Could not deactivate."); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={furniture ? `Edit ${furniture.name}` : "New Furniture"}
      subtitle="A finished product — its cabinet type decides which quantity rules apply"
      footer={<>
        {furniture?.is_active && <Btn variant="danger" onClick={remove} disabled={saving}>Deactivate</Btn>}
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" value={form.name ?? ""} onChange={v => set("name", v)} required error={errors.name?.[0]}
          placeholder="Wardrobe with Openable Shutters" />
        <Select label="Cabinet type" value={form.cabinet_type ?? ""} onChange={v => set("cabinet_type", v)}
          options={meta?.cabinet_types ?? []} />
        <Field label="Default width" value={form.default_length ?? ""} onChange={v => set("default_length", v)} placeholder={`7'0"`} />
        <Field label="Default height" value={form.default_height ?? ""} onChange={v => set("default_height", v)} placeholder={`9'6"`} />
        <Field label="Default depth" value={form.default_breadth ?? ""} onChange={v => set("default_breadth", v)} placeholder={`2'0"`} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Margin %" type="number" value={form.margin_pct ?? "15"} onChange={v => set("margin_pct", v)} />
          <Field label="GST %" type="number" value={form.gst_pct ?? "18"} onChange={v => set("gst_pct", v)} />
        </div>
        <div className="col-span-2">
          <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Rooms (none = every room)</div>
          <div className="flex flex-wrap gap-1.5">
            {rooms.map(r => {
              const on = (form.rooms ?? []).includes(r.id);
              return (
                <button key={r.id} type="button" onClick={() => toggleRoom(r.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] border cursor-pointer ${on
                    ? "bg-nicara-gold/10 border-nicara-gold text-nicara-dark font-semibold" : "bg-white border-surface-200 text-surface-500"}`}>
                  {r.icon} {r.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col-span-2">
          <TextArea label="Description" value={form.description ?? ""} onChange={v => set("description", v)} rows={2} />
        </div>
        <Check label="Active" checked={form.is_active ?? true} onChange={v => set("is_active", v)} />
      </div>
    </Modal>
  );
}
