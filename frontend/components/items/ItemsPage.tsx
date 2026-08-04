"use client";

import { useMemo, useState } from "react";
import { ApiError, itemsApi, type ItemInput } from "@/lib/api";
import type { Item, ItemMeta } from "@/lib/apiTypes";
import { useApiData, inr } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Check, Field, FormSection, Select, TextArea } from "@/components/ui/Form";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";

const BLANK: ItemInput = {
  name: "", description: "", default_room: "", unit: "unit", calc_method: "per_unit",
  default_length: "", default_breadth: "", default_height: "",
  default_qty: "1", default_rate: "0", min_rate: "0", max_rate: "0",
  gst_pct: "18", margin_pct: "35", is_active: true,
};

/**
 * The master catalogue. Every row here can be dropped onto an estimate,
 * carrying its dimensions, unit and rate with it.
 */
export default function ItemsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);

  const { data, loading, error, reload } = useApiData(
    () => itemsApi.list({ search: search || undefined, category: categoryId || undefined }),
    [search, categoryId]
  );
  const { data: meta } = useApiData<ItemMeta>(() => itemsApi.meta(), []);

  const items = useMemo(() => data?.results ?? [], [data]);

  // Group by category so the catalogue reads like a price list.
  const grouped = useMemo(() => {
    const map = new Map<string, { icon: string; items: Item[] }>();
    for (const item of items) {
      const key = item.category_name || "Uncategorised";
      if (!map.has(key)) map.set(key, { icon: item.category_icon || "📦", items: [] });
      map.get(key)!.items.push(item);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0">Items Catalogue</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">
            Master list of everything you sell. Estimate lines are built from these.
          </p>
        </div>
        <button onClick={() => setEditing("new")}
          className="px-4 py-2.5 btn-gold rounded-xl text-[12px] font-bold border-none cursor-pointer">
          + Add Item
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-[320px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-surface-400">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search item, room, description…"
            className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold" />
        </div>
        <select value={categoryId} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : "")}
          className="px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white cursor-pointer outline-none focus:border-nicara-gold">
          <option value="">All categories</option>
          {meta?.categories.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name} ({c.item_count})</option>
          ))}
        </select>
        <span className="text-[11px] text-surface-400">{items.length} item(s)</span>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState icon="📦" title={search ? "No matches" : "Catalogue is empty"}
          hint={search ? "Try a different search." : "Add your first item to get started."} />
      )}

      {!loading && !error && grouped.map(([categoryName, group]) => (
        <div key={categoryName} className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[14px]">{group.icon}</span>
            <span className="text-[12px] font-bold text-nicara-dark uppercase tracking-wider">{categoryName}</span>
            <span className="text-[10px] text-surface-400">({group.items.length})</span>
          </div>
          <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-nicara-dark">
                    {["Code", "Item", "Room", "L × B × H", "Unit", "Default Rate", "Range", "GST", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(item => (
                    <tr key={item.id} className={`border-b border-surface-100 hover:bg-surface-50 ${!item.is_active ? "opacity-50" : ""}`}>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-surface-400 whitespace-nowrap">{item.code}</td>
                      <td className="px-3 py-2.5 max-w-[300px]">
                        <div className="font-semibold text-nicara-dark">{item.name}</div>
                        {item.description && (
                          <div className="text-[10px] text-surface-400 truncate">{item.description}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-surface-600 whitespace-nowrap">{item.default_room || "—"}</td>
                      <td className="px-3 py-2.5 text-surface-600 font-mono text-[11px] whitespace-nowrap">
                        {[item.default_length, item.default_breadth, item.default_height]
                          .filter(d => d && d !== "-").join(" × ") || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-surface-600">{item.unit_display}</td>
                      <td className="px-3 py-2.5 font-bold text-nicara-dark whitespace-nowrap">{inr(item.default_rate)}</td>
                      <td className="px-3 py-2.5 text-[10px] text-surface-400 whitespace-nowrap">
                        {parseFloat(item.min_rate) > 0
                          ? `${inr(item.min_rate)} – ${inr(item.max_rate)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-surface-500">{parseFloat(item.gst_pct)}%</td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => setEditing(item)}
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
        </div>
      ))}

      {editing && (
        <ItemModal
          item={editing === "new" ? null : editing}
          meta={meta}
          onClose={() => setEditing(null)}
          onSaved={msg => { setEditing(null); toast.success(msg); void reload(); }}
        />
      )}
    </div>
  );
}

/* ── Add / edit modal ─────────────────────────────────────────── */

function ItemModal({
  item, meta, onClose, onSaved,
}: {
  item: Item | null;
  meta: ItemMeta | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<ItemInput>(
    item ? { ...item } : { ...BLANK, category: meta?.categories[0]?.id }
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const err = (field: string) => errors[field]?.[0];

  const save = async () => {
    if (!form.name?.trim()) { setErrors({ name: ["Name is required."] }); return; }
    if (!form.category) { setErrors({ category: ["Pick a category."] }); return; }

    setSaving(true);
    setBanner("");
    setErrors({});
    try {
      if (item) {
        await itemsApi.update(item.id, form);
        onSaved(`${form.name} updated`);
      } else {
        await itemsApi.create(form);
        onSaved(`${form.name} added to catalogue`);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.errors);
        setBanner(e.message);
      } else {
        setBanner("Could not save. Is the backend running?");
      }
      setSaving(false);
    }
  };

  const retire = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await itemsApi.delete(item.id);
      onSaved(`${item.name} retired`);
    } catch {
      setBanner("Could not retire this item.");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={item ? `Edit ${item.name}` : "New Catalogue Item"}
      subtitle={item ? item.code : "These values become the defaults on an estimate line"}
      footer={
        <>
          {item && item.is_active && <Btn variant="danger" onClick={retire} disabled={saving}>Retire</Btn>}
          <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
        </>
      }
    >
      {banner && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700 font-medium">
          {banner}
        </div>
      )}

      <FormSection title="Identity">
        <Field label="Item Name" value={form.name ?? ""} onChange={v => set("name", v)} required error={err("name")} />
        <Select label="Category" value={String(form.category ?? "")}
          onChange={v => set("category", Number(v))} required error={err("category")}
          placeholder="Select…"
          options={(meta?.categories ?? []).map(c => ({ value: String(c.id), label: c.name }))} />
        <div className="col-span-2">
          <TextArea label="Description" value={form.description ?? ""} onChange={v => set("description", v)} rows={2}
            placeholder="e.g. 16mm BWP ply with laminate finish, mirror on one shutter" />
        </div>
        <Select label="Typical Room" value={form.default_room ?? ""} onChange={v => set("default_room", v)}
          placeholder="Any room"
          options={(meta?.rooms ?? []).map(r => ({ value: r, label: r }))} />
      </FormSection>

      <FormSection title="Measurement">
        <Select label="Unit" value={form.unit ?? "unit"} onChange={v => set("unit", v)}
          options={meta?.units ?? []} />
        <Select label="Calculation Method" value={form.calc_method ?? "per_unit"}
          onChange={v => set("calc_method", v)} options={meta?.calc_methods ?? []} />
        <Field label="Default Length" value={form.default_length ?? ""} onChange={v => set("default_length", v)}
          placeholder={`8'0"`} />
        <Field label="Default Breadth" value={form.default_breadth ?? ""} onChange={v => set("default_breadth", v)}
          placeholder={`2'0"`} />
        <Field label="Default Height" value={form.default_height ?? ""} onChange={v => set("default_height", v)}
          placeholder={`8'0"`} />
        <Field label="Default Quantity" type="number" value={form.default_qty ?? "1"}
          onChange={v => set("default_qty", v)} />
      </FormSection>

      <FormSection title="Pricing">
        <Field label="Default Rate" type="number" value={form.default_rate ?? "0"}
          onChange={v => set("default_rate", v)} error={err("default_rate")} />
        <Field label="GST %" type="number" value={form.gst_pct ?? "18"} onChange={v => set("gst_pct", v)} />
        <Field label="Minimum Rate" type="number" value={form.min_rate ?? "0"}
          onChange={v => set("min_rate", v)} error={err("min_rate")}
          hint="Guard rail when a designer edits the rate" />
        <Field label="Maximum Rate" type="number" value={form.max_rate ?? "0"}
          onChange={v => set("max_rate", v)} error={err("max_rate")} />
        <Field label="Margin %" type="number" value={form.margin_pct ?? "35"}
          onChange={v => set("margin_pct", v)}
          hint="Used once rate build-up is switched on" />
        <div className="flex items-end pb-2">
          <Check label="Active" checked={form.is_active ?? true} onChange={v => set("is_active", v)} />
        </div>
      </FormSection>
    </Modal>
  );
}
