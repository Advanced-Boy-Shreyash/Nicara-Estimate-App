"use client";

import { useMemo, useState } from "react";
import { ApiError, libraryApi } from "@/lib/api";
import type { LibraryBrand, LibraryItem, LibraryItemInput, LibraryMeta } from "@/lib/apiTypes";
import { useApiData, inr } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Check, Field, FormSection, Select, TextArea } from "@/components/ui/Form";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";

const BLANK: LibraryItemInput = {
  category: "",
  brand: "",
  model_name: "",
  description: "",
  weight: "",
  length: "",
  thickness: "",
  default_unit: "nos",
  default_rate: "0",
  gst_pct: "18",
  margin_pct: "35",
  is_active: true,
  notes: "",
};

/** Raw Material Library: priced materials (category + brand + model) and the brand master list. */
export default function RawMaterialPage() {
  const [tab, setTab] = useState<"materials" | "brands">("materials");
  const { data: meta, reload: reloadMeta } = useApiData<LibraryMeta>(() => libraryApi.meta(), []);

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="flex gap-1 mb-5 bg-surface-100 p-1 rounded-xl w-fit">
        {([["materials", "🪵 Materials"], ["brands", "🏷️ Brands"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer ${tab === key
              ? "bg-white text-nicara-dark shadow-sm" : "bg-transparent text-surface-500 hover:text-nicara-dark"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "materials"
        ? <MaterialsPanel meta={meta} reloadMeta={reloadMeta} />
        : <BrandsPanel onChanged={reloadMeta} />}
    </div>
  );
}

/* ─── Materials ────────────────────────────────────────────────── */

function MaterialsPanel({ meta, reloadMeta }: { meta: LibraryMeta | null; reloadMeta: () => Promise<void> }) {
  const toast = useToast();
  const [search, setSearch]           = useState("");
  const [catFilter, setCatFilter]     = useState<number | "">("");
  const [brandFilter, setBrandFilter] = useState<number | "">("");
  const [editing, setEditing]         = useState<LibraryItem | "new" | null>(null);

  const { data, loading, error, reload } = useApiData(
    () => libraryApi.items({
      search:   search   || undefined,
      category: catFilter  || undefined,
      brand:    brandFilter || undefined,
    }),
    [search, catFilter, brandFilter]
  );

  const items = useMemo(() => data?.results ?? [], [data]);

  const grouped = useMemo(() => {
    const map = new Map<string, { icon: string; items: LibraryItem[] }>();
    for (const item of items) {
      const key = item.category_name || "Uncategorised";
      if (!map.has(key)) map.set(key, { icon: item.category_icon || "📦", items: [] });
      map.get(key)!.items.push(item);
    }
    return [...map.entries()];
  }, [items]);

  const handleCatChange = (v: string) => {
    setCatFilter(v ? Number(v) : "");
    setBrandFilter("");
  };

  // With a category chosen, only the brands that have a material in it.
  const brandOptions = useMemo(() => {
    const brands = meta?.brands ?? [];
    const filtered = catFilter ? brands.filter(b => b.category_ids?.includes(catFilter)) : brands;
    return filtered.map(b => ({ value: String(b.id), label: b.name }));
  }, [meta, catFilter]);

  const refresh = async () => { await Promise.all([reload(), reloadMeta()]); };

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0">🪵 Raw Material Library</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">
            Master list of all raw materials with dimensions, brand, model and pricing.
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="px-4 py-2.5 btn-gold rounded-xl text-[12px] font-bold border-none cursor-pointer"
        >
          + Add Material
        </button>
      </div>

      {/* KPI strip */}
      {meta && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {([
            ["Categories", meta.counts.categories, "📂", "#C9A96E"],
            ["Brands",     meta.counts.brands,     "🏷️", "#7B4FA6"],
            ["Materials",  meta.counts.items,       "🪵", "#3b82f6"],
            ["Showing",    items.length,             "📋", "#2dd4a8"],
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

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-[320px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-surface-400">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search material, brand, model…"
            className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold" />
        </div>
        <select value={catFilter} onChange={e => handleCatChange(e.target.value)}
          className="px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white cursor-pointer outline-none focus:border-nicara-gold">
          <option value="">All categories</option>
          {(meta?.categories ?? []).map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value ? Number(e.target.value) : "")}
          className="px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white cursor-pointer outline-none focus:border-nicara-gold"
          disabled={brandOptions.length === 0}>
          <option value="">All brands</option>
          {brandOptions.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <span className="text-[11px] text-surface-400">{items.length} item(s)</span>
      </div>

      {loading && <Loading />}
      {error   && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState icon="🪵"
          title={search || catFilter || brandFilter ? "No matches" : "No materials yet"}
          hint={search ? "Try a different search term." : "Click '+ Add Material' to get started."} />
      )}

      {/* Grouped table */}
      {!loading && !error && grouped.map(([categoryName, group]) => (
        <div key={categoryName} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[15px]">{group.icon}</span>
            <span className="text-[12px] font-bold text-nicara-dark uppercase tracking-wider">{categoryName}</span>
            <span className="text-[10px] text-surface-400">({group.items.length})</span>
          </div>
          <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-nicara-dark">
                    {["Material / Model", "Description", "Brand", "Weight", "Length", "Thickness", "Unit", "Rate (₹)", "Amount", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item, ri) => {
                    const rateNum = parseFloat(item.default_rate) || 0;
                    return (
                      <tr key={item.id}
                        className={`border-b border-surface-100 hover:bg-surface-50 transition-colors ${!item.is_active ? "opacity-50" : ""} ${ri % 2 === 0 ? "" : "bg-surface-50/40"}`}>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <div className="font-semibold text-nicara-dark truncate">{item.model_name}</div>
                          {!item.is_active && <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">Inactive</span>}
                        </td>
                        <td className="px-3 py-2.5 text-surface-500 max-w-[220px]"><div className="truncate">{item.description || "—"}</div></td>
                        <td className="px-3 py-2.5 font-semibold text-nicara-dark whitespace-nowrap">{item.brand_name || "—"}</td>
                        <td className="px-3 py-2.5 text-surface-600 whitespace-nowrap font-mono text-[11px]">{item.weight || "—"}</td>
                        <td className="px-3 py-2.5 text-surface-600 whitespace-nowrap font-mono text-[11px]">{item.length || "—"}</td>
                        <td className="px-3 py-2.5 text-surface-600 whitespace-nowrap font-mono text-[11px]">{item.thickness || "—"}</td>
                        <td className="px-3 py-2.5 text-surface-600">{item.default_unit}</td>
                        <td className="px-3 py-2.5 font-bold text-nicara-dark whitespace-nowrap">{inr(item.default_rate)}</td>
                        <td className="px-3 py-2.5 font-bold text-nicara-gold whitespace-nowrap">
                          {inr(String(rateNum))}<span className="text-[9px] font-normal text-surface-400 ml-1">/{item.default_unit}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => setEditing(item)}
                            className="px-2.5 py-1 bg-surface-100 rounded-lg text-[11px] cursor-pointer border-none text-surface-600 hover:bg-surface-200">
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <MaterialModal
          item={editing === "new" ? null : editing}
          meta={meta}
          onBrandAdded={reloadMeta}
          onClose={() => setEditing(null)}
          onSaved={msg => { setEditing(null); toast.success(msg); void refresh(); }}
        />
      )}
    </>
  );
}

/* ─── Add / Edit material ──────────────────────────────────────── */

function MaterialModal({ item, meta, onBrandAdded, onClose, onSaved }: {
  item: LibraryItem | null;
  meta: LibraryMeta | null;
  onBrandAdded: () => Promise<void>;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<LibraryItemInput>(
    item
      ? {
          category:     item.category_id,
          brand:        item.brand,
          model_name:   item.model_name,
          description:  item.description,
          weight:       item.weight,
          length:       item.length,
          thickness:    item.thickness,
          default_unit: item.default_unit,
          default_rate: item.default_rate,
          gst_pct:      item.gst_pct,
          margin_pct:   item.margin_pct,
          is_active:    item.is_active,
          notes:        item.notes,
        }
      : { ...BLANK }
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const [newBrand, setNewBrand] = useState<string | null>(null);

  const set = <K extends keyof LibraryItemInput>(k: K, v: LibraryItemInput[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const err = (field: string) => errors[field]?.[0];

  // Every brand is available for every category; ones already used here come first.
  const brandOptions = useMemo(() => {
    const brands = (meta?.brands ?? []).filter(b => b.is_active !== false);
    const cat = form.category;
    const used = (b: LibraryBrand) => (cat && b.category_ids?.includes(cat) ? 0 : 1);
    return [...brands].sort((a, b) => used(a) - used(b) || a.name.localeCompare(b.name))
      .map(b => ({ value: String(b.id), label: b.name }));
  }, [meta, form.category]);

  const categoryOptions = useMemo(
    () => (meta?.categories ?? []).map(c => ({ value: String(c.id), label: `${c.icon} ${c.name}` })),
    [meta]
  );

  const unitOptions = useMemo(
    () => (meta?.units ?? []).map(u => ({ value: u.value, label: u.label })),
    [meta]
  );

  const rateNum = parseFloat(form.default_rate) || 0;
  const gstPct  = parseFloat(form.gst_pct)  || 0;
  const gstAmt  = rateNum * gstPct / 100;
  const totalWithGst = rateNum + gstAmt;

  const addBrand = async () => {
    const name = (newBrand ?? "").trim();
    if (!name) return;
    try {
      const created = await libraryApi.createBrand({ name });
      await onBrandAdded();
      set("brand", created.id);
      setNewBrand(null);
    } catch (e) {
      setErrors(er => ({ ...er, brand: [e instanceof ApiError ? e.message : "Could not add the brand."] }));
    }
  };

  const save = async () => {
    const newErrors: Record<string, string[]> = {};
    if (!form.model_name?.trim()) newErrors.model_name = ["Material name is required."];
    if (!form.category)           newErrors.category   = ["Please select a category."];
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    const body = { ...form, brand: form.brand || null };
    setSaving(true);
    setBanner("");
    setErrors({});
    try {
      if (item) {
        await libraryApi.updateItem(item.id, body);
        onSaved(`${form.model_name} updated`);
      } else {
        await libraryApi.createItem(body);
        onSaved(`${form.model_name} added to library`);
      }
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); }
      else setBanner("Could not save. Is the backend running?");
      setSaving(false);
    }
  };

  const retire = async () => {
    if (!item) return;
    setSaving(true);
    try { await libraryApi.deleteItem(item.id); onSaved(`${item.model_name} removed`); }
    catch { setBanner("Could not remove this item."); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg"
      title={item ? `Edit — ${item.model_name}` : "New Raw Material"}
      subtitle={item ? `${item.brand_name || "No brand"} · ${item.category_name}` : "Add a new material to the library"}
      footer={<>
        {item && <Btn variant="danger" onClick={retire} disabled={saving}>Remove</Btn>}
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}
    >
      {banner && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700 font-medium">
          {banner}
        </div>
      )}

      {/* Identity */}
      <FormSection title="Identity">
        <Select label="Category" value={String(form.category)}
          onChange={v => set("category", v ? Number(v) : "")}
          placeholder="Select category…" options={categoryOptions} required error={err("category")} />
        <div>
          {newBrand === null ? (
            <>
              <Select label="Brand" value={form.brand ? String(form.brand) : ""}
                onChange={v => set("brand", v ? Number(v) : "")}
                placeholder="— No brand —" options={brandOptions} error={err("brand")} />
              <button type="button" onClick={() => setNewBrand("")}
                className="mt-1 bg-transparent border-none p-0 text-[10px] font-semibold text-nicara-gold cursor-pointer">
                + New brand
              </button>
            </>
          ) : (
            <div>
              <Field label="New brand" value={newBrand} onChange={setNewBrand} placeholder="e.g. Century"
                error={err("brand")} />
              <div className="flex gap-2 mt-1.5">
                <button type="button" onClick={addBrand} disabled={!newBrand.trim()}
                  className="px-2.5 py-1 rounded-lg border-none bg-nicara-gold text-white text-[10px] font-bold cursor-pointer disabled:opacity-50">
                  Add brand
                </button>
                <button type="button" onClick={() => setNewBrand(null)}
                  className="px-2.5 py-1 rounded-lg border-none bg-surface-100 text-surface-600 text-[10px] cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="col-span-2">
          <Field label="Material / Model Name" value={form.model_name}
            onChange={v => set("model_name", v)} required error={err("model_name")}
            placeholder="e.g. Lincoln BWP, Off white, Onsys Soft Close" />
        </div>
        <div className="col-span-2">
          <TextArea label="Description" value={form.description}
            onChange={v => set("description", v)} rows={2}
            placeholder="Brief description of the material…" />
        </div>
      </FormSection>

      {/* Physical Specifications */}
      <FormSection title="Physical Specifications" cols={3}>
        <Field label="Weight" value={form.weight} onChange={v => set("weight", v)}
          placeholder="e.g. 2.5 kg, 500g" />
        <Field label="Length" value={form.length} onChange={v => set("length", v)}
          placeholder="e.g. 8ft, 2440mm" />
        <Field label="Thickness" value={form.thickness} onChange={v => set("thickness", v)}
          placeholder="e.g. 16mm, 18mm" />
      </FormSection>

      {/* Pricing & Unit */}
      <FormSection title="Pricing & Unit">
        <Select label="Unit" value={form.default_unit} onChange={v => set("default_unit", v)}
          options={unitOptions.length ? unitOptions : [{ value: "nos", label: "nos" }]} />
        <Field label="Rate (₹ per unit)" type="number" value={form.default_rate}
          onChange={v => set("default_rate", v)} error={err("default_rate")} />
        <Field label="GST %" type="number" value={form.gst_pct}
          onChange={v => set("gst_pct", v)} />
        <Field label="Margin %" type="number" value={form.margin_pct}
          onChange={v => set("margin_pct", v)} hint="Target margin above cost" />
      </FormSection>

      {/* Amount preview */}
      <div className="mb-5 px-4 py-3 rounded-xl flex items-center justify-between"
        style={{ background: "rgba(201,169,110,0.07)", border: "1px solid rgba(201,169,110,0.25)" }}>
        <div>
          <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-0.5">
            Amount (per {form.default_unit || "unit"})
          </div>
          <div className="text-xl font-extrabold text-nicara-dark">{inr(String(rateNum))}</div>
        </div>
        <div className="text-right text-[11px] text-surface-500">
          <div>GST {gstPct}% → <span className="font-semibold text-nicara-dark">{inr(String(gstAmt))}</span></div>
          <div className="mt-0.5">Total incl. GST → <span className="font-bold text-nicara-dark">{inr(String(totalWithGst))}</span></div>
        </div>
      </div>

      {/* Notes & Status */}
      <FormSection title="Notes & Status">
        <div className="col-span-2">
          <TextArea label="Notes" value={form.notes} onChange={v => set("notes", v)}
            rows={2} placeholder="Any additional notes about this material…" />
        </div>
        <div className="flex items-end pb-2">
          <Check label="Active" checked={form.is_active} onChange={v => set("is_active", v)} />
        </div>
      </FormSection>
    </Modal>
  );
}

/* ─── Brands — one master list linked to raw materials ─────────── */

function BrandsPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApiData(() => libraryApi.brands(), []);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [banner, setBanner] = useState("");
  const brands = data?.results ?? [];

  const run = async (action: () => Promise<unknown>, msg: string) => {
    setBanner("");
    try {
      await action();
      await Promise.all([reload(), onChanged()]);
      toast.success(msg);
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  };

  return (
    <>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0">🏷️ Brands</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">
            One list of brands. Each raw material links to a brand; the Smart Estimate Generator offers these.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="New brand name"
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) void run(async () => { await libraryApi.createBrand({ name: name.trim() }); setName(""); }, "Brand added"); }}
            className="px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold w-[220px]" />
          <Btn disabled={!name.trim()}
            onClick={() => run(async () => { await libraryApi.createBrand({ name: name.trim() }); setName(""); }, "Brand added")}>
            + Add Brand
          </Btn>
        </div>
      </div>

      {banner && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700 font-medium">{banner}</div>
      )}
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && brands.length === 0 && <EmptyState icon="🏷️" title="No brands yet" hint="Add the first brand above." />}

      {!loading && !error && brands.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-nicara-dark">
                {["Brand", "Used in", "Materials", "Active", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {brands.map((b, ri) => (
                <tr key={b.id} className={`border-b border-surface-100 ${b.is_active === false ? "opacity-50" : ""} ${ri % 2 ? "bg-surface-50/40" : ""}`}>
                  <td className="px-3 py-2.5 font-semibold text-nicara-dark w-[220px]">
                    {editing?.id === b.id ? (
                      <input autoFocus value={editing.name} onChange={e => setEditing({ id: b.id, name: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === "Escape") setEditing(null);
                          if (e.key === "Enter" && editing.name.trim()) {
                            void run(() => libraryApi.updateBrand(b.id, { name: editing.name.trim() }), "Brand renamed");
                            setEditing(null);
                          }
                        }}
                        className="w-full px-2 py-1 border border-nicara-gold rounded-lg text-[12px] outline-none" />
                    ) : b.name}
                  </td>
                  <td className="px-3 py-2.5 text-surface-500 text-[11px]">{(b.categories ?? []).join(" · ") || "—"}</td>
                  <td className="px-3 py-2.5 font-mono">{b.item_count ?? 0}</td>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={b.is_active !== false} className="w-3.5 h-3.5 accent-nicara-gold cursor-pointer"
                      onChange={e => run(() => libraryApi.updateBrand(b.id, { is_active: e.target.checked }),
                        e.target.checked ? "Brand active" : "Brand hidden")} />
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setEditing({ id: b.id, name: b.name })}
                      className="px-2.5 py-1 bg-surface-100 rounded-lg text-[11px] cursor-pointer border-none text-surface-600 hover:bg-surface-200 mr-1.5">
                      Rename
                    </button>
                    <button onClick={() => run(() => libraryApi.deleteBrand(b.id), "Brand deleted")}
                      title={b.item_count ? "In use — reassign its materials first, or untick Active" : "Delete"}
                      className="px-2.5 py-1 bg-red-50 rounded-lg text-[11px] cursor-pointer border-none text-red-600 hover:bg-red-100">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
