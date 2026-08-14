"use client";

import { useState } from "react";
import { ApiError, catalogApi } from "@/lib/api";
import type {
  CatalogMaterial, CatalogMeta, CatalogRoom, Furniture, FurniturePart, MaterialOption,
} from "@/lib/apiTypes";
import { useApiData, inr, inrExact } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Check, Field, Select, TextArea } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading } from "@/components/ui/States";

/** Furniture list with a room filter; each opens a build-sheet (parts → materials). */
export default function FurnitureTab({ meta, onChange }: { meta: CatalogMeta | null; onChange: () => void }) {
  const toast = useToast();
  const [roomFilter, setRoomFilter] = useState<number | "">("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [editFurniture, setEditFurniture] = useState<Furniture | "new" | null>(null);

  const rooms = useApiData(() => catalogApi.rooms(), []);
  const list = useApiData(
    () => catalogApi.furniture(roomFilter || undefined),
    [roomFilter]
  );

  const furniture = list.data?.results ?? [];
  const roomOptions = rooms.data?.results ?? [];

  if (openId !== null) {
    return (
      <FurnitureBuildSheet furnitureId={openId} meta={meta}
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
          hint="Add a product, then break it into parts and materials." />
      )}

      {!list.loading && furniture.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-nicara-dark">
                  {["Code", "Furniture", "Rooms", "Unit", "Parts", "Base Rate", "GST", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {furniture.map(f => (
                  <tr key={f.id} className={`border-b border-surface-100 hover:bg-surface-50 ${!f.is_active ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-surface-400 whitespace-nowrap">{f.code}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-nicara-dark">{f.name}</div>
                      {f.description && <div className="text-[10px] text-surface-400 truncate max-w-[280px]">{f.description}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-surface-600 max-w-[220px]">
                      {f.room_names.length ? f.room_names.join(", ") : <span className="text-surface-400 italic">All rooms</span>}
                    </td>
                    <td className="px-3 py-2.5 text-surface-600">{f.default_unit}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{f.part_count}</span>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-nicara-dark whitespace-nowrap">
                      {parseFloat(f.base_rate) > 0 ? inr(f.base_rate) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-surface-500">{parseFloat(f.gst_pct)}%</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => setOpenId(f.id)}
                        className="px-2.5 py-1 btn-gold rounded-lg text-[11px] cursor-pointer border-none font-semibold mr-1.5">
                        Build Sheet
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
        <FurnitureModal furniture={editFurniture === "new" ? null : editFurniture}
          rooms={roomOptions} meta={meta}
          onClose={() => setEditFurniture(null)}
          onSaved={msg => { setEditFurniture(null); toast.success("Saved", msg); void list.reload(); onChange(); }} />
      )}
    </div>
  );
}

/* ── Build sheet: parts → materials, with a live cost roll-up ── */

function FurnitureBuildSheet({ furnitureId, meta, onBack, onChanged }: {
  furnitureId: number; meta: CatalogMeta | null; onBack: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const detail = useApiData(() => catalogApi.furnitureDetail(furnitureId), [furnitureId]);
  const materials = useApiData(() => catalogApi.materials(true), []);
  const [addingPart, setAddingPart] = useState(false);
  const [partName, setPartName] = useState("");
  const [editMaterialFor, setEditMaterialFor] = useState<{ part: FurniturePart; existing?: import("@/lib/apiTypes").PartMaterial } | null>(null);
  const [banner, setBanner] = useState("");

  const furniture = detail.data;

  const refresh = () => { void detail.reload(); onChanged(); };

  const addPart = async () => {
    if (!partName.trim()) return;
    try {
      await catalogApi.createPart(furnitureId, { name: partName });
      setPartName(""); setAddingPart(false);
      refresh();
    } catch (e) { setBanner(e instanceof ApiError ? e.message : "Could not add part."); }
  };

  const removePart = async (part: FurniturePart) => {
    try { await catalogApi.deletePart(part.id); refresh(); }
    catch (e) { setBanner(e instanceof ApiError ? e.message : "Could not remove part."); }
  };

  const removeMaterial = async (id: number) => {
    try { await catalogApi.deletePartMaterial(id); refresh(); }
    catch (e) { setBanner(e instanceof ApiError ? e.message : "Could not remove material."); }
  };

  if (detail.loading) return <Loading label="Loading build sheet…" />;
  if (detail.error || !furniture) return <ErrorState message={detail.error ?? "Not found"} onRetry={detail.reload} />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack}
          className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-surface-500 cursor-pointer border-none hover:bg-surface-200 text-sm">←</button>
        <div>
          <div className="text-[16px] font-bold text-nicara-dark">{furniture.name}</div>
          <div className="text-[11px] text-surface-400">
            {furniture.code} · {furniture.room_names.length ? furniture.room_names.join(", ") : "All rooms"}
          </div>
        </div>
      </div>

      {banner && <InlineError message={banner} />}

      {/* Cost summary from the roll-up */}
      <div className="bg-nicara-dark rounded-2xl px-5 py-4 mb-4 flex items-center gap-8 flex-wrap">
        <Stat label="Material Cost" value={inrExact(furniture.material_cost ?? "0")} />
        <Stat label={`Margin (${parseFloat(furniture.margin_pct)}%)`} value=""
          note="applied to material cost" />
        <Stat label="Suggested Rate" value={inrExact(furniture.suggested_rate ?? "0")} gold />
        <div className="flex-1" />
        <div className="text-[10px] text-stone-400 max-w-[220px]">
          Rolled up from the parts below. Set a base rate on the furniture to override.
        </div>
      </div>

      {(furniture.parts ?? []).length === 0 && (
        <EmptyState icon="🧩" title="No parts yet"
          hint="Break the furniture into parts (Cabinet, Shutter, Panel…), then add materials to each." />
      )}

      <div className="space-y-3">
        {(furniture.parts ?? []).map(part => (
          <div key={part.id} className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-nicara-dark">🧩 {part.name}</span>
                <span className="text-[10px] text-surface-400">
                  {part.materials.length} material(s) · {inrExact(part.material_cost)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditMaterialFor({ part })}
                  className="px-2.5 py-1 bg-nicara-gold/10 rounded-lg text-[11px] cursor-pointer border-none text-nicara-gold font-semibold">
                  + Material
                </button>
                <button onClick={() => removePart(part)} title="Remove part"
                  className="text-surface-300 hover:text-red-500 bg-transparent border-none cursor-pointer text-[13px]">✕</button>
              </div>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-surface-50 text-surface-400 text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-1.5">Material</th>
                  <th className="text-left">Option</th>
                  <th className="text-right">Qty</th>
                  <th className="text-left pl-3">Unit</th>
                  <th className="text-right">Wastage</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Line Cost</th>
                  <th className="pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {part.materials.map(pm => (
                  <tr key={pm.id} className="border-t border-surface-100">
                    <td className="px-4 py-2 font-semibold text-nicara-dark">{pm.material_name}</td>
                    <td className="text-surface-600 max-w-[220px] truncate" title={pm.option_label}>{pm.option_label || "cheapest"}</td>
                    <td className="text-right font-mono">{parseFloat(pm.qty_per_unit)}</td>
                    <td className="pl-3 text-surface-500">{pm.unit || "—"}</td>
                    <td className="text-right text-surface-500">{parseFloat(pm.wastage_pct)}%</td>
                    <td className="text-right">{inr(pm.unit_price)}</td>
                    <td className="text-right font-semibold text-nicara-dark">{inr(pm.line_cost)}</td>
                    <td className="pr-4 text-right">
                      <button onClick={() => setEditMaterialFor({ part, existing: pm })}
                        className="text-surface-400 hover:text-nicara-gold bg-transparent border-none cursor-pointer text-[11px] mr-2">edit</button>
                      <button onClick={() => removeMaterial(pm.id)}
                        className="text-surface-300 hover:text-red-500 bg-transparent border-none cursor-pointer text-[12px]">✕</button>
                    </td>
                  </tr>
                ))}
                {part.materials.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-3 text-center text-surface-400">No materials — add one</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {addingPart ? (
        <div className="flex items-center gap-2 mt-3">
          <input value={partName} onChange={e => setPartName(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === "Enter") addPart(); if (e.key === "Escape") setAddingPart(false); }}
            placeholder="Part name (Cabinet, Shutter, Panel…)"
            className="flex-1 max-w-[320px] px-3 py-2 border border-surface-200 rounded-xl text-[12px] outline-none focus:border-nicara-gold" />
          <Btn onClick={addPart}>Add</Btn>
          <button onClick={() => setAddingPart(false)} className="text-[12px] text-surface-500 bg-transparent border-none cursor-pointer">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAddingPart(true)}
          className="mt-3 text-[12px] font-semibold text-nicara-gold bg-transparent border-none cursor-pointer hover:underline">
          + Add Part
        </button>
      )}

      {editMaterialFor && (
        <PartMaterialModal part={editMaterialFor.part} existing={editMaterialFor.existing}
          materials={materials.data?.results ?? []} meta={meta}
          onClose={() => setEditMaterialFor(null)}
          onSaved={() => { setEditMaterialFor(null); toast.success("Saved", "Material updated"); refresh(); }} />
      )}
    </div>
  );
}

function Stat({ label, value, note, gold }: { label: string; value: string; note?: string; gold?: boolean }) {
  return (
    <div>
      <div className="text-[9px] text-stone-400 uppercase tracking-[0.15em]">{label}</div>
      {value && <div className={`text-[16px] font-bold ${gold ? "text-nicara-gold" : "text-white"}`}>{value}</div>}
      {note && <div className="text-[9px] text-stone-500">{note}</div>}
    </div>
  );
}

/* ── Modals ── */

function FurnitureModal({ furniture, rooms, meta, onClose, onSaved }: {
  furniture: Furniture | null; rooms: CatalogRoom[]; meta: CatalogMeta | null;
  onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<Furniture>>(
    furniture ? { ...furniture } : {
      name: "", description: "", rooms: [], default_unit: "nos",
      base_rate: "0", gst_pct: "18", margin_pct: "35", is_active: true,
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
    try {
      if (furniture) { await catalogApi.updateFurniture(furniture.id, form); onSaved(`${form.name} updated`); }
      else { await catalogApi.createFurniture(form); onSaved(`${form.name} added`); }
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); } else setBanner("Could not save.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!furniture) return;
    setSaving(true);
    try { await catalogApi.deleteFurniture(furniture.id); onSaved(`${furniture.name} archived`); }
    catch { setBanner("Could not archive."); setSaving(false); }
  };

  const units = meta?.units ?? [{ value: "nos", label: "nos" }];

  return (
    <Modal open onClose={onClose} size="md" title={furniture ? `Edit ${furniture.name}` : "New Furniture"}
      subtitle="Leave rooms empty to make it available in every room"
      footer={<>
        {furniture && furniture.is_active && <Btn variant="danger" onClick={remove} disabled={saving}>Archive</Btn>}
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}
      <div className="space-y-3">
        <Field label="Furniture Name" value={form.name ?? ""} onChange={v => set("name", v)}
          required error={errors.name?.[0]} placeholder="Wardrobe" />
        <TextArea label="Description" value={form.description ?? ""} onChange={v => set("description", v)} rows={2} />

        <div>
          <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block mb-1.5">Rooms</label>
          <div className="flex flex-wrap gap-2">
            {rooms.map(room => {
              const on = (form.rooms ?? []).includes(room.id);
              return (
                <button key={room.id} type="button" onClick={() => toggleRoom(room.id)}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-medium border cursor-pointer ${
                    on ? "bg-nicara-gold/10 border-nicara-gold text-nicara-gold" : "bg-white border-surface-200 text-surface-500"
                  }`}>
                  {room.icon} {room.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Select label="Unit" value={form.default_unit ?? "nos"} onChange={v => set("default_unit", v)} options={units} />
          <Field label="Base Rate" type="number" value={form.base_rate ?? "0"} onChange={v => set("base_rate", v)} />
          <Field label="GST %" type="number" value={form.gst_pct ?? "18"} onChange={v => set("gst_pct", v)} />
          <Field label="Margin %" type="number" value={form.margin_pct ?? "35"} onChange={v => set("margin_pct", v)} />
        </div>
      </div>
    </Modal>
  );
}

function PartMaterialModal({ part, existing, materials, meta, onClose, onSaved }: {
  part: FurniturePart;
  existing?: import("@/lib/apiTypes").PartMaterial;
  materials: CatalogMaterial[];
  meta: CatalogMeta | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [materialId, setMaterialId] = useState<number | "">(existing?.material ?? "");
  const [optionId, setOptionId] = useState<number | "">(existing?.default_option ?? "");
  const [qty, setQty] = useState(existing?.qty_per_unit ?? "1");
  const [unit, setUnit] = useState(existing?.unit ?? "");
  const [wastage, setWastage] = useState(existing?.wastage_pct ?? "0");
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedMaterial = materials.find(m => m.id === materialId);
  const options: MaterialOption[] = selectedMaterial?.options ?? [];

  const save = async () => {
    if (!materialId) { setBanner("Pick a material."); return; }
    setSaving(true); setBanner("");
    const payload = {
      material: materialId as number,
      default_option: optionId ? (optionId as number) : null,
      qty_per_unit: qty, unit, wastage_pct: wastage,
    };
    try {
      if (existing) await catalogApi.updatePartMaterial(existing.id, payload);
      else await catalogApi.addPartMaterial(part.id, payload);
      onSaved();
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : "Could not save.");
      setSaving(false);
    }
  };

  const units = meta?.units ?? [];

  return (
    <Modal open onClose={onClose} size="md"
      title={existing ? "Edit Material" : `Add Material to ${part.name}`}
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}
      <div className="grid grid-cols-2 gap-3">
        <Select label="Material" value={String(materialId)}
          onChange={v => { setMaterialId(v ? Number(v) : ""); setOptionId(""); }}
          placeholder="Select…"
          options={materials.map(m => ({ value: String(m.id), label: m.name }))} />
        <Select label="Option (optional)" value={String(optionId)}
          onChange={v => setOptionId(v ? Number(v) : "")}
          placeholder={options.length ? "Cheapest active" : "No options"}
          options={options.map(o => ({ value: String(o.id), label: `${o.label} — ₹${o.price}` }))} />
        <Field label="Qty per unit" type="number" value={qty} onChange={setQty} />
        <Select label="Unit" value={unit} onChange={setUnit}
          placeholder="Material default"
          options={units} />
        <Field label="Wastage %" type="number" value={wastage} onChange={setWastage} />
      </div>
      {selectedMaterial && (
        <p className="text-[11px] text-surface-400 mt-3">
          Leave the option blank to always price against the cheapest active option of {selectedMaterial.name}.
        </p>
      )}
    </Modal>
  );
}
