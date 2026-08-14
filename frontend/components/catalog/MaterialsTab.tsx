"use client";

import { useState } from "react";
import { ApiError, catalogApi } from "@/lib/api";
import type { CatalogMaterial, MaterialOption } from "@/lib/apiTypes";
import { useApiData, inr } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Field, Select } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading } from "@/components/ui/States";

const UNITS = ["nos", "set", "sft", "rft", "sqm", "sheets", "kg", "litre", "lot"];

/** Materials (Plywood, Hardware) each expandable to their priced Options. */
export default function MaterialsTab({ onChange }: { onChange: () => void }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApiData(() => catalogApi.materials(true), []);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editMaterial, setEditMaterial] = useState<CatalogMaterial | "new" | null>(null);
  const [editOption, setEditOption] = useState<{ materialId: number; option: MaterialOption | "new" } | null>(null);

  const materials = data?.results ?? [];

  const refresh = () => { void reload(); onChange(); };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Btn onClick={() => setEditMaterial("new")}>+ Add Material</Btn>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && materials.length === 0 && (
        <EmptyState icon="🧱" title="No materials yet"
          hint="Add Plywood, Hardware, Laminate, … then give each its priced options." />
      )}

      <div className="space-y-2">
        {materials.map(material => {
          const open = expanded === material.id;
          return (
            <div key={material.id} className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <button onClick={() => setExpanded(open ? null : material.id)}
                  className="flex items-center gap-2.5 bg-transparent border-none cursor-pointer text-left flex-1">
                  <span className="text-[10px] text-surface-400">{open ? "▾" : "▸"}</span>
                  <span className="text-[16px]">{material.icon}</span>
                  <div>
                    <div className="text-[13px] font-bold text-nicara-dark">{material.name}</div>
                    <div className="text-[10px] text-surface-400 font-mono">{material.code} · per {material.default_unit}</div>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-surface-500">
                    {material.option_count} option(s)
                    {material.price_from != null && <> · from <span className="font-semibold text-nicara-dark">{inr(material.price_from)}</span></>}
                  </span>
                  <button onClick={() => setEditMaterial(material)}
                    className="px-2.5 py-1 bg-surface-100 rounded-lg text-[11px] cursor-pointer border-none text-surface-600 hover:bg-surface-200">
                    Edit
                  </button>
                </div>
              </div>

              {open && (
                <div className="border-t border-surface-100 bg-surface-50 px-4 py-3">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-surface-400 text-[10px] uppercase tracking-wider">
                        <th className="text-left py-1.5">Detail</th>
                        <th className="text-left">Brand</th>
                        <th className="text-left">Model</th>
                        <th className="text-left">Size</th>
                        <th className="text-right">Price</th>
                        <th className="text-left pl-3">Unit</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(material.options ?? []).map(option => (
                        <tr key={option.id} className="border-t border-surface-200">
                          <td className="py-2 font-semibold text-nicara-dark">{option.detail}</td>
                          <td className="text-surface-600">{option.brand || "—"}</td>
                          <td className="text-surface-600">{option.model_no || "—"}</td>
                          <td className="text-surface-500 font-mono text-[11px]">{option.size || "—"}</td>
                          <td className="text-right font-semibold text-nicara-dark">{inr(option.price)}</td>
                          <td className="pl-3 text-surface-500">{option.unit}</td>
                          <td className="text-right">
                            <button onClick={() => setEditOption({ materialId: material.id, option })}
                              className="text-surface-400 hover:text-nicara-gold bg-transparent border-none cursor-pointer text-[11px]">
                              edit
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(material.options ?? []).length === 0 && (
                        <tr><td colSpan={7} className="py-3 text-center text-surface-400">No options yet</td></tr>
                      )}
                    </tbody>
                  </table>
                  <button onClick={() => setEditOption({ materialId: material.id, option: "new" })}
                    className="mt-2 text-[12px] font-semibold text-nicara-gold bg-transparent border-none cursor-pointer hover:underline">
                    + Add Option
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editMaterial && (
        <MaterialModal material={editMaterial === "new" ? null : editMaterial}
          onClose={() => setEditMaterial(null)}
          onSaved={msg => { setEditMaterial(null); toast.success("Saved", msg); refresh(); }} />
      )}
      {editOption && (
        <OptionModal materialId={editOption.materialId}
          option={editOption.option === "new" ? null : editOption.option}
          onClose={() => setEditOption(null)}
          onSaved={msg => { setEditOption(null); toast.success("Saved", msg); refresh(); }} />
      )}
    </div>
  );
}

function MaterialModal({ material, onClose, onSaved }: {
  material: CatalogMaterial | null; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<CatalogMaterial>>(
    material ? { ...material } : { name: "", default_unit: "sft", icon: "🧱", is_active: true });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name?.trim()) { setErrors({ name: ["Name is required."] }); return; }
    setSaving(true); setBanner(""); setErrors({});
    try {
      if (material) { await catalogApi.updateMaterial(material.id, form); onSaved(`${form.name} updated`); }
      else { await catalogApi.createMaterial(form); onSaved(`${form.name} added`); }
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); } else setBanner("Could not save.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!material) return;
    setSaving(true);
    try { await catalogApi.deleteMaterial(material.id); onSaved(`${material.name} archived`); }
    catch { setBanner("Could not archive."); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="sm" title={material ? `Edit ${material.name}` : "New Material"}
      footer={<>
        {material && material.is_active && <Btn variant="danger" onClick={remove} disabled={saving}>Archive</Btn>}
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <Field label="Icon" value={form.icon ?? ""} onChange={v => setForm(f => ({ ...f, icon: v }))} />
          <div className="col-span-3">
            <Field label="Material Name" value={form.name ?? ""} onChange={v => setForm(f => ({ ...f, name: v }))}
              required error={errors.name?.[0]} placeholder="Plywood" />
          </div>
        </div>
        <Select label="Default Unit" value={form.default_unit ?? "sft"}
          onChange={v => setForm(f => ({ ...f, default_unit: v }))}
          options={UNITS.map(u => ({ value: u, label: u }))} />
      </div>
    </Modal>
  );
}

function OptionModal({ materialId, option, onClose, onSaved }: {
  materialId: number; option: MaterialOption | null; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<MaterialOption>>(
    option ? { ...option } : { detail: "", brand: "", model_no: "", size: "", price: "0", unit: "sft", is_active: true });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof MaterialOption>(k: K, v: MaterialOption[K]) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.detail?.trim()) { setErrors({ detail: ["Detail is required."] }); return; }
    setSaving(true); setBanner(""); setErrors({});
    try {
      if (option) { await catalogApi.updateOption(materialId, option.id, form); onSaved("Option updated"); }
      else { await catalogApi.createOption(materialId, form); onSaved("Option added"); }
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); } else setBanner("Could not save.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!option) return;
    setSaving(true);
    try { await catalogApi.deleteOption(materialId, option.id); onSaved("Option removed"); }
    catch { setBanner("Could not remove."); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="md" title={option ? "Edit Option" : "New Material Option"}
      subtitle="A specific purchasable material — brand, model, size and price"
      footer={<>
        {option && <Btn variant="danger" onClick={remove} disabled={saving}>Remove</Btn>}
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Detail" value={form.detail ?? ""} onChange={v => set("detail", v)}
            required error={errors.detail?.[0]} placeholder="18mm Plywood" />
        </div>
        <Field label="Brand" value={form.brand ?? ""} onChange={v => set("brand", v)} placeholder="Austin" />
        <Field label="Model No" value={form.model_no ?? ""} onChange={v => set("model_no", v)} placeholder="Lincoln" />
        <Field label="Size" value={form.size ?? ""} onChange={v => set("size", v)} placeholder="8x4" />
        <Select label="Unit" value={form.unit ?? "sft"} onChange={v => set("unit", v)}
          options={UNITS.map(u => ({ value: u, label: u }))} />
        <Field label="Price (₹)" type="number" value={form.price ?? "0"} onChange={v => set("price", v)}
          error={errors.price?.[0]} />
      </div>
    </Modal>
  );
}
