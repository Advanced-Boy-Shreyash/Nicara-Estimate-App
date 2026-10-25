"use client";

import { useMemo, useState } from "react";
import { ApiError, catalogApi, libraryApi } from "@/lib/api";
import type { BasicComponent, CatalogMeta } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Check, Field, Select, TextArea } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading } from "@/components/ui/States";

const TYPE_STYLE: Record<string, string> = {
  "Spec Purpose": "bg-purple-50 text-purple-700",
  "Procurement": "bg-blue-50 text-blue-700",
  "Service": "bg-amber-50 text-amber-700",
  "Procurement cum Service": "bg-teal-50 text-teal-700",
};

export function TypePill({ type }: { type: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${TYPE_STYLE[type] ?? "bg-surface-100 text-surface-600"}`}>
      {type || "—"}
    </span>
  );
}

/**
 * Basic Components — one per estimate row type (the calculation sheet's
 * "Specifications"). Each names a quantity rule and the Raw Material category
 * its brands, models and prices come from.
 */
export default function BasicComponentsTab({ meta, onChange }: { meta: CatalogMeta | null; onChange: () => void }) {
  const toast = useToast();
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BasicComponent | "new" | null>(null);
  const list = useApiData(() => catalogApi.basicComponents(), []);

  const ruleLabel = useMemo(
    () => Object.fromEntries((meta?.rules ?? []).map(r => [r.value, r.label])), [meta]);
  const rows = (list.data?.results ?? []).filter(c =>
    (!typeFilter || c.item_type === typeFilter)
    && (!search || c.name.toLowerCase().includes(search.toLowerCase())));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search components…"
          className="px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold w-[240px]" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white cursor-pointer outline-none focus:border-nicara-gold">
          <option value="">All types</option>
          {(meta?.item_types ?? []).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <span className="text-[11px] text-surface-400">{rows.length} component(s)</span>
        <div className="flex-1" />
        <Btn onClick={() => setEditing("new")}>+ Add Component</Btn>
      </div>

      {list.loading && <Loading />}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && rows.length === 0 && (
        <EmptyState icon="🧩" title="No basic components" hint="Run the catalogue seed, or add one." />
      )}

      {!list.loading && rows.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-nicara-dark">
                  {["Component", "Type", "Raw Material", "Unit", "Quantity rule", "GST", "Used in", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.id} className={`border-b border-surface-100 hover:bg-surface-50 ${!c.is_active ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-nicara-dark">{c.name}</div>
                      <div className="font-mono text-[9px] text-surface-400">{c.code}</div>
                    </td>
                    <td className="px-3 py-2.5"><TypePill type={c.item_type} /></td>
                    <td className="px-3 py-2.5 text-surface-600">{c.library_category_name || <span className="text-surface-400 italic">—</span>}</td>
                    <td className="px-3 py-2.5 text-surface-600">{c.unit}{c.price_unit ? <span className="text-surface-400"> · {c.price_unit}</span> : null}</td>
                    <td className="px-3 py-2.5 text-surface-600 max-w-[320px]">
                      {ruleLabel[c.quantity_rule] ?? c.quantity_rule}
                      {c.quantity_rule === "fixed" && <span className="text-surface-400"> · {parseFloat(c.default_qty)}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-surface-500">{parseFloat(c.gst_pct)}%</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">{c.used_in}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => setEditing(c)}
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

      {editing && (
        <ComponentModal component={editing === "new" ? null : editing} meta={meta}
          onClose={() => setEditing(null)}
          onSaved={msg => { setEditing(null); toast.success("Saved", msg); void list.reload(); onChange(); }} />
      )}
    </div>
  );
}

function ComponentModal({ component, meta, onClose, onSaved }: {
  component: BasicComponent | null; meta: CatalogMeta | null;
  onClose: () => void; onSaved: (msg: string) => void;
}) {
  const library = useApiData(() => libraryApi.meta(), []);
  const [form, setForm] = useState<Partial<BasicComponent>>(component ?? {
    name: "", item_type: "Procurement", library_category: null, unit: "nos", price_unit: "",
    quantity_rule: "fixed", default_qty: "1", fallback_rate: "0", gst_pct: "18", description: "", is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof BasicComponent>(k: K, v: BasicComponent[K] | null) => setForm(f => ({ ...f, [k]: v }));
  const err = (k: string) => errors[k]?.[0];

  const save = async () => {
    if (!form.name?.trim()) { setErrors({ name: ["Name is required."] }); return; }
    setSaving(true); setBanner(""); setErrors({});
    try {
      if (component) await catalogApi.updateBasicComponent(component.id, form);
      else await catalogApi.createBasicComponent(form);
      onSaved(`${form.name} saved`);
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); } else setBanner("Could not save.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!component) return;
    setSaving(true);
    try { await catalogApi.deleteBasicComponent(component.id); onSaved(`${component.name} deactivated`); }
    catch { setBanner("Could not deactivate."); setSaving(false); }
  };

  const categories = library.data?.categories ?? [];
  return (
    <Modal open onClose={onClose} size="lg"
      title={component ? `Edit ${component.name}` : "New Basic Component"}
      subtitle="One estimate row type — how its quantity is worked out and where its price comes from"
      footer={<>
        {component?.is_active && <Btn variant="danger" onClick={remove} disabled={saving}>Deactivate</Btn>}
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Name (as on the estimate)" value={form.name ?? ""} onChange={v => set("name", v)}
            required error={err("name")} placeholder="Core Material(18mm BWP Ply)" />
        </div>
        <Select label="Type" value={form.item_type ?? ""} onChange={v => set("item_type", v)}
          options={meta?.item_types ?? []} />
        <Select label="Raw material category" value={form.library_category ? String(form.library_category) : ""}
          onChange={v => set("library_category", v ? Number(v) : null)} placeholder="None"
          options={categories.map(c => ({ value: String(c.id), label: c.name }))} />
        <Select label="Unit" value={form.unit ?? "nos"} onChange={v => set("unit", v)}
          options={meta?.units ?? []} />
        <Field label="Price unit" value={form.price_unit ?? ""} onChange={v => set("price_unit", v)} placeholder="per sft" />
        <div className="col-span-2">
          <Select label="Quantity rule" value={form.quantity_rule ?? "fixed"} onChange={v => set("quantity_rule", v)}
            options={meta?.rules ?? []} error={err("quantity_rule")} />
        </div>
        <Field label="Default quantity" type="number" value={form.default_qty ?? "1"} onChange={v => set("default_qty", v)}
          hint='Used by "Fixed quantity" and "Manual entry"' />
        <Field label="Fallback rate (₹)" type="number" value={form.fallback_rate ?? "0"} onChange={v => set("fallback_rate", v)}
          hint="When no raw material is set" />
        <Field label="GST %" type="number" value={form.gst_pct ?? "18"} onChange={v => set("gst_pct", v)}
          hint="The sheet charges 0% on services" />
        <div className="flex items-end pb-2">
          <Check label="Active" checked={form.is_active ?? true} onChange={v => set("is_active", v)} />
        </div>
        <div className="col-span-2">
          <TextArea label="Notes" value={form.description ?? ""} onChange={v => set("description", v)} rows={2} />
        </div>
      </div>
    </Modal>
  );
}
