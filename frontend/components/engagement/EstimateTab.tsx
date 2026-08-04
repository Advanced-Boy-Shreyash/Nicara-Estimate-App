"use client";

import { useMemo, useState } from "react";
import { ApiError, estimatesApi, itemsApi } from "@/lib/api";
import type { Estimate, EstimateItem, EstimateType, Item, Project } from "@/lib/apiTypes";
import { useApiData, inr, inrExact } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading, StatusPill } from "@/components/ui/States";

const CELL = "w-full px-2 py-1.5 border border-transparent rounded-lg text-[12px] bg-transparent outline-none focus:border-nicara-gold focus:bg-white";

/**
 * Initial / Intermediate / Final Estimate tab.
 *
 * Line totals and the grand total are always whatever the server just
 * returned — the UI never does its own money maths.
 */
export default function EstimateTab({
  project, type, title,
}: {
  project: Project;
  type: EstimateType;
  title: string;
}) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const listQuery = useApiData(() => estimatesApi.list(project.id, type), [project.id, type]);
  const versions = useMemo(() => listQuery.data?.results ?? [], [listQuery.data]);

  // Default to the newest version until the user picks another.
  const activeId = selectedId ?? versions[0]?.id ?? null;

  const detailQuery = useApiData(
    async () => (activeId ? estimatesApi.get(project.id, activeId) : null),
    [project.id, activeId]
  );
  const estimate = detailQuery.data;

  const refresh = async () => {
    await Promise.all([listQuery.reload(), detailQuery.reload()]);
  };

  const guard = async (action: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    setBanner("");
    try {
      await action();
      await refresh();
      toast.success("Done", successMsg);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong.";
      setBanner(msg);
      toast.error("Failed", msg);
    } finally {
      setBusy(false);
    }
  };

  const createEstimate = () =>
    guard(async () => {
      const created = await estimatesApi.create(project.id, { type, title });
      setSelectedId(created.id);
    }, `${title} created`);

  if (listQuery.loading) return <Loading />;
  if (listQuery.error) return <ErrorState message={listQuery.error} onRetry={listQuery.reload} />;

  if (versions.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title={`No ${title.toLowerCase()} yet`}
        hint="Create one, then pull items in from the catalogue."
        action={<Btn onClick={createEstimate} disabled={busy}>{busy ? "Creating…" : `Create ${title}`}</Btn>}
      />
    );
  }

  const locked = estimate?.status === "approved";

  return (
    <div>
      {banner && <InlineError message={banner} />}

      {/* Version bar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Version</span>
          {versions.map(v => (
            <button key={v.id} onClick={() => setSelectedId(v.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border cursor-pointer transition-all ${
                v.id === activeId
                  ? "bg-nicara-dark text-nicara-gold border-nicara-dark"
                  : "bg-white text-surface-500 border-surface-200 hover:border-surface-300"
              }`}>
              v{v.version} · {v.status_display}
            </button>
          ))}
          <button onClick={createEstimate} disabled={busy}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-dashed border-surface-300 text-surface-500 bg-white cursor-pointer hover:border-nicara-gold hover:text-nicara-gold">
            + New Version
          </button>
        </div>
        {estimate && <StatusPill status={estimate.status} label={estimate.status_display} />}
      </div>

      {detailQuery.loading && <Loading />}
      {detailQuery.error && <ErrorState message={detailQuery.error} onRetry={detailQuery.reload} />}

      {estimate && (
        <>
          {/* Actions */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Btn onClick={() => setPicking(true)} disabled={busy || locked}>+ Add from Catalogue</Btn>
            <Btn variant="ghost" disabled={busy || locked}
              onClick={() => guard(
                () => estimatesApi.addItem(project.id, estimate.id, {
                  area: "", item: "New line", qty: 1, rate: 0, unit: "unit", gst_pct: 18,
                }),
                "Blank line added"
              )}>
              + Blank Line
            </Btn>
            <div className="flex-1" />
            {estimate.status === "draft" && (
              <Btn variant="ghost" disabled={busy}
                onClick={() => guard(() => estimatesApi.send(project.id, estimate.id), "Sent for client approval")}>
                📤 Send for Approval
              </Btn>
            )}
            {(estimate.status === "sent" || estimate.status === "revision") && (
              <>
                <Btn variant="ghost" disabled={busy}
                  onClick={() => guard(
                    () => estimatesApi.requestRevision(project.id, estimate.id, "Client requested changes"),
                    "Marked for revision"
                  )}>
                  ↩ Request Revision
                </Btn>
                <Btn disabled={busy}
                  onClick={() => guard(
                    () => estimatesApi.approve(project.id, estimate.id, "Approved by client"),
                    "Estimate approved"
                  )}>
                  ✓ Mark Approved
                </Btn>
              </>
            )}
            {locked && (
              <Btn variant="ghost" disabled={busy}
                onClick={() => guard(async () => {
                  const clone = await estimatesApi.duplicate(project.id, estimate.id);
                  setSelectedId(clone.id);
                }, "Copied into a new draft")}>
                ⧉ Duplicate to Revise
              </Btn>
            )}
          </div>

          {locked && (
            <div className="mb-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[12px] text-emerald-800">
              Approved{estimate.approved_by_name ? ` by ${estimate.approved_by_name}` : ""} — locked for editing.
              Duplicate it to make changes.
            </div>
          )}

          <LineItems
            project={project}
            estimate={estimate}
            locked={!!locked}
            busy={busy}
            onChanged={refresh}
            onError={setBanner}
          />

          <Totals estimate={estimate} />
        </>
      )}

      {picking && estimate && (
        <CatalogPicker
          onClose={() => setPicking(false)}
          onAdd={async selections => {
            setPicking(false);
            await guard(
              () => estimatesApi.addFromCatalog(project.id, estimate.id, selections),
              `${selections.length} item(s) added`
            );
          }}
        />
      )}
    </div>
  );
}

/* ── Line items table ─────────────────────────────────────────── */

function LineItems({
  project, estimate, locked, busy, onChanged, onError,
}: {
  project: Project;
  estimate: Estimate;
  locked: boolean;
  busy: boolean;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<Record<number, Partial<EstimateItem>>>({});

  const commit = async (item: EstimateItem) => {
    const changes = draft[item.id];
    if (!changes) return;
    setDraft(d => { const next = { ...d }; delete next[item.id]; return next; });
    try {
      await estimatesApi.updateItem(project.id, estimate.id, item.id, changes);
      await onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not update the line.");
    }
  };

  const remove = async (item: EstimateItem) => {
    try {
      await estimatesApi.deleteItem(project.id, estimate.id, item.id);
      await onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not delete the line.");
    }
  };

  const value = (item: EstimateItem, key: keyof EstimateItem) =>
    (draft[item.id]?.[key] as string) ?? (item[key] as string);

  if (estimate.items.length === 0) {
    return (
      <EmptyState icon="🧾" title="No line items yet"
        hint="Use “Add from Catalogue” to pull in items with their standard rates." />
    );
  }

  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-nicara-dark">
              {["#", "Area", "Item & Description", "L", "B", "H", "Qty", "Unit", "Rate", "Amount", "GST", ""].map(h => (
                <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {estimate.items.map(item => (
              <tr key={item.id} className="border-b border-surface-100 hover:bg-surface-50">
                <td className="px-3 py-2 text-surface-400 font-mono">{item.sno}</td>
                <td className="px-2 py-2 min-w-[130px]">
                  <EditableCell locked={locked} value={value(item, "area")}
                    onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], area: v } }))}
                    onCommit={() => commit(item)} placeholder="Room" />
                </td>
                <td className="px-2 py-2 min-w-[240px]">
                  <EditableCell locked={locked} value={value(item, "item")} bold
                    onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], item: v } }))}
                    onCommit={() => commit(item)} placeholder="Item name" />
                  <EditableCell locked={locked} value={value(item, "description")} small
                    onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], description: v } }))}
                    onCommit={() => commit(item)} placeholder="Description" />
                  {item.catalog_item_code && (
                    <div className="px-2 text-[9px] text-surface-300 font-mono">{item.catalog_item_code}</div>
                  )}
                </td>
                {(["length", "breadth", "height"] as const).map(dim => (
                  <td key={dim} className="px-2 py-2 w-[70px]">
                    <EditableCell locked={locked} value={value(item, dim)} mono
                      onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], [dim]: v } }))}
                      onCommit={() => commit(item)} placeholder="—" />
                  </td>
                ))}
                <td className="px-2 py-2 w-[70px]">
                  <EditableCell locked={locked} value={value(item, "qty")} mono type="number"
                    onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], qty: v } }))}
                    onCommit={() => commit(item)} />
                </td>
                <td className="px-2 py-2 w-[70px]">
                  <EditableCell locked={locked} value={value(item, "unit")}
                    onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], unit: v } }))}
                    onCommit={() => commit(item)} />
                </td>
                <td className="px-2 py-2 w-[100px]">
                  <EditableCell locked={locked} value={value(item, "rate")} mono type="number"
                    onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], rate: v } }))}
                    onCommit={() => commit(item)} />
                </td>
                <td className="px-3 py-2 font-bold text-nicara-dark whitespace-nowrap">{inr(item.amount)}</td>
                <td className="px-3 py-2 text-surface-500 whitespace-nowrap">{parseFloat(item.gst_pct)}%</td>
                <td className="px-3 py-2 text-right">
                  {!locked && (
                    <button onClick={() => remove(item)} disabled={busy} title="Remove line"
                      className="text-surface-300 hover:text-red-500 bg-transparent border-none cursor-pointer text-[13px]">✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableCell({
  value, onChange, onCommit, locked, placeholder, mono, bold, small, type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  locked: boolean;
  placeholder?: string;
  mono?: boolean;
  bold?: boolean;
  small?: boolean;
  type?: string;
}) {
  if (locked) {
    return (
      <div className={`px-2 py-1.5 ${mono ? "font-mono" : ""} ${bold ? "font-semibold text-nicara-dark" : "text-surface-600"} ${small ? "text-[10px] text-surface-400" : ""}`}>
        {value || placeholder || "—"}
      </div>
    );
  }
  return (
    <input
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`${CELL} ${mono ? "font-mono" : ""} ${bold ? "font-semibold text-nicara-dark" : ""} ${small ? "text-[10px] text-surface-400" : ""}`}
    />
  );
}

/* ── Totals ───────────────────────────────────────────────────── */

function Totals({ estimate }: { estimate: Estimate }) {
  const rows: [string, string, boolean?][] = [
    ["Subtotal", inrExact(estimate.subtotal)],
    ...(parseFloat(estimate.total_discount) > 0
      ? ([["Discount", `− ${inrExact(estimate.total_discount)}`]] as [string, string][])
      : []),
    ["GST", inrExact(estimate.gst_total)],
    ["Grand Total", inrExact(estimate.grand_total), true],
  ];

  return (
    <div className="flex justify-end mt-4">
      <div className="bg-white border border-surface-200 rounded-2xl px-5 py-4 min-w-[300px]">
        {rows.map(([label, amount, strong]) => (
          <div key={label}
            className={`flex justify-between items-center py-1.5 ${strong ? "border-t border-surface-200 mt-1.5 pt-2.5" : ""}`}>
            <span className={strong ? "text-[12px] font-bold text-nicara-dark uppercase tracking-wider" : "text-[12px] text-surface-500"}>
              {label}
            </span>
            <span className={strong ? "text-[16px] font-extrabold text-nicara-gold" : "text-[13px] font-semibold text-nicara-dark"}>
              {amount}
            </span>
          </div>
        ))}
        <div className="text-[10px] text-surface-400 mt-2 text-right">
          {estimate.item_count} line item(s) · calculated by the server
        </div>
      </div>
    </div>
  );
}

/* ── Catalogue picker ─────────────────────────────────────────── */

function CatalogPicker({
  onClose, onAdd,
}: {
  onClose: () => void;
  onAdd: (items: { item_id: number; area?: string; qty?: number }[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<number, { area: string; qty: number }>>(new Map());
  const { data, loading, error, reload } = useApiData(
    () => itemsApi.list({ search: search || undefined }),
    [search]
  );

  const items = data?.results ?? [];

  const toggle = (item: Item) => {
    setSelected(current => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, { area: item.default_room, qty: parseFloat(item.default_qty) || 1 });
      return next;
    });
  };

  const update = (id: number, patch: Partial<{ area: string; qty: number }>) => {
    setSelected(current => {
      const next = new Map(current);
      const existing = next.get(id);
      if (existing) next.set(id, { ...existing, ...patch });
      return next;
    });
  };

  const submit = () =>
    onAdd([...selected.entries()].map(([item_id, v]) => ({ item_id, area: v.area, qty: v.qty })));

  return (
    <Modal open onClose={onClose} size="xl" title="Add Items from Catalogue"
      subtitle="Rates, dimensions and GST come from the catalogue — adjust room and quantity here."
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit} disabled={selected.size === 0}>
            Add {selected.size > 0 ? `${selected.size} item(s)` : "Items"}
          </Btn>
        </>
      }>
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-surface-400">🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
          placeholder="Search wardrobe, ceiling, kitchen…"
          className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold" />
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <div className="border border-surface-200 rounded-xl overflow-hidden max-h-[420px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0">
              <tr className="bg-surface-100">
                {["", "Item", "Category", "L × B × H", "Rate", "Room", "Qty"].map(h => (
                  <th key={h} className="px-3 py-2 text-surface-500 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const picked = selected.get(item.id);
                return (
                  <tr key={item.id}
                    className={`border-b border-surface-100 ${picked ? "bg-nicara-gold/5" : "hover:bg-surface-50"}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={!!picked} onChange={() => toggle(item)}
                        className="w-4 h-4 accent-nicara-gold cursor-pointer" />
                    </td>
                    <td className="px-3 py-2 max-w-[260px] cursor-pointer" onClick={() => toggle(item)}>
                      <div className="font-semibold text-nicara-dark">{item.name}</div>
                      {item.description && <div className="text-[10px] text-surface-400 truncate">{item.description}</div>}
                    </td>
                    <td className="px-3 py-2 text-surface-500 whitespace-nowrap">
                      {item.category_icon} {item.category_name}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-surface-500 whitespace-nowrap">
                      {[item.default_length, item.default_breadth, item.default_height]
                        .filter(d => d && d !== "-").join(" × ") || "—"}
                    </td>
                    <td className="px-3 py-2 font-semibold text-nicara-dark whitespace-nowrap">
                      {inr(item.default_rate)}<span className="text-[10px] text-surface-400">/{item.unit}</span>
                    </td>
                    <td className="px-2 py-2 w-[140px]">
                      {picked && (
                        <input value={picked.area} onChange={e => update(item.id, { area: e.target.value })}
                          placeholder="Room"
                          className="w-full px-2 py-1 border border-surface-200 rounded-lg text-[11px] outline-none focus:border-nicara-gold" />
                      )}
                    </td>
                    <td className="px-2 py-2 w-[80px]">
                      {picked && (
                        <input type="number" value={picked.qty}
                          onChange={e => update(item.id, { qty: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border border-surface-200 rounded-lg text-[11px] font-mono outline-none focus:border-nicara-gold" />
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">No items match that search</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
