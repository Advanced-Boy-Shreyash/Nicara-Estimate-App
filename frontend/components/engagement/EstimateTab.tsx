"use client";

import { useMemo, useState } from "react";
import { ApiError, designRequirementsApi, estimatesApi, itemsApi } from "@/lib/api";
import type { Estimate, EstimateItem, EstimateType, Item, Project } from "@/lib/apiTypes";
import { useApiData, inr, inrExact } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading, StatusPill } from "@/components/ui/States";

const CELL = "w-full px-2 py-1.5 border border-transparent rounded-lg text-[11px] bg-transparent outline-none focus:border-nicara-gold focus:bg-white";
const TH = "px-2 py-2 text-stone-200 font-semibold text-[10px] text-left whitespace-nowrap border-r border-stone-700";

/**
 * Initial / Intermediate / Final Estimate tab.
 * Line totals and the grand total are always whatever the server just returned.
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
  const [importing, setImporting] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [populating, setPopulating] = useState(false);

  const listQuery = useApiData(() => estimatesApi.list(project.id, type), [project.id, type]);
  const versions = useMemo(() => listQuery.data?.results ?? [], [listQuery.data]);
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
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border cursor-pointer transition-all ${v.id === activeId
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
          {/* ── Prominent Total Bar (master-style dark) ── */}
          <div className="bg-nicara-dark rounded-xl p-3 px-5 mb-4 flex justify-between items-center flex-wrap gap-2.5">
            <div>
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">{title}</div>
              <div className="text-2xl font-extrabold text-nicara-gold">{inrExact(estimate.grand_total)}</div>
              <div className="text-[11px] text-surface-500">{estimate.item_count} items · inc GST</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setImporting(true)} disabled={busy || !!locked}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-[11px] font-semibold cursor-pointer hover:bg-white/20 transition-colors">
                📥 Import
              </button>
            </div>
          </div>

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
            <Btn variant="ghost" disabled={busy || locked}
              onClick={() => setShowGenerator(!showGenerator)}>
              {showGenerator ? "✕ Close Generator" : "🧠 Smart Generator"}
            </Btn>
            <Btn variant="ghost" disabled={busy || locked || populating}
              onClick={async () => {
                if (!estimate) return;
                setPopulating(true);
                setBanner("");
                try {
                  const drData = await designRequirementsApi.list(project.id);
                  const rows = drData.results ?? [];
                  if (rows.length === 0) {
                    setBanner("No design requirements found. Add them first.");
                    setPopulating(false);
                    return;
                  }
                  let added = 0;
                  for (const row of rows) {
                    if (!row.unit?.trim()) continue;
                    // Try to find matching catalogue item
                    let rate = 0;
                    let unit = "Sft";
                    try {
                      const items = await itemsApi.list({ search: row.unit });
                      const match = (items.results ?? []).find(
                        (i: Item) => i.name.toLowerCase().includes(row.unit.toLowerCase())
                      );
                      if (match) {
                        rate = parseFloat(match.default_rate) || 0;
                        unit = match.unit || "Sft";
                      }
                    } catch { /* no match */ }
                    // Calculate qty from dimensions
                    const l = parseFloat(row.length) || 1;
                    const b = parseFloat(row.breadth) || 1;
                    const h = parseFloat(row.height) || 1;
                    const qty = Math.round(l * b * 100) / 100; // L×B area
                    await estimatesApi.addItem(project.id, estimate.id, {
                      area: row.room,
                      item: row.unit,
                      qty, unit, rate, gst_pct: 18,
                    });
                    added++;
                  }
                  await refresh();
                  toast.success("Populated", `${added} item(s) from Design Requirements`);
                } catch (e) {
                  setBanner(e instanceof ApiError ? e.message : "Failed to populate.");
                } finally {
                  setPopulating(false);
                }
              }}>
              {populating ? "Populating…" : "📋 Populate from Design Req"}
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

          {/* ── Smart Estimate Generator ── */}
          {showGenerator && (
            <SmartEstimateGenerator
              projectId={project.id}
              estimateId={estimate.id}
              disabled={busy || !!locked}
              onGenerated={async () => {
                await refresh();
                setShowGenerator(false);
                toast.success("Generated", "Estimate items created from material preferences");
              }}
              onError={setBanner}
            />
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

      {importing && estimate && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={async () => {
            setImporting(false);
            await refresh();
            toast.success("Imported", "Items added from file");
          }}
          projectId={project.id}
          estimateId={estimate.id}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   IMPORT MODAL — download template + upload CSV
   ══════════════════════════════════════════════════════════════════ */

function ImportModal({ onClose, onImported, projectId, estimateId }: {
  onClose: () => void;
  onImported: () => void;
  projectId: number;
  estimateId: number;
}) {
  const downloadTemplate = () => {
    const headers = "Area,Category,Sub Category,Item,Qty,Unit,Rate,GST%";
    const sample = [
      "Kitchen,Cabinetry,Base Unit,Kitchen Base Unit - Laminate,1,Nos,45000,18",
      "Kitchen,Hardware,Hinges,Box Hinges Hettich Onsys,6,Sets,260,18",
      "Master Bedroom,Cabinetry,Wardrobe,3 Door Wardrobe,1,Nos,120000,18",
    ];
    const csv = [headers, ...sample].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estimate_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split("\n").slice(1); // skip header
    for (const line of lines) {
      const cols = line.split(",");
      if (cols.length < 8) continue;
      try {
        await estimatesApi.addItem(projectId, estimateId, {
          area: cols[0]?.trim() || "",
          item: cols[3]?.trim() || "Imported Item",
          qty: parseFloat(cols[4]) || 1,
          unit: cols[5]?.trim() || "Nos",
          rate: parseFloat(cols[6]) || 0,
          gst_pct: parseFloat(cols[7]) || 18,
        });
      } catch { /* skip bad rows */ }
    }
    onImported();
  };

  return (
    <Modal open onClose={onClose} size="md" title="📥 Import Estimate Items"
      subtitle="Download the template, fill it in, then upload the CSV."
      footer={<Btn variant="ghost" onClick={onClose}>Close</Btn>}>

      {/* Sample format preview */}
      <div className="mb-4">
        <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">Sample Format</div>
        <div className="border border-surface-200 rounded-xl overflow-hidden">
          <table className="w-full text-[10px]">
            <thead><tr className="bg-surface-100">
              {["Area", "Category", "Sub Cat", "Item", "Qty", "Unit", "Rate", "GST%"].map(h =>
                <th key={h} className="px-2 py-1.5 text-surface-500 font-semibold text-left">{h}</th>
              )}
            </tr></thead>
            <tbody>
              <tr className="border-t border-surface-100"><td className="px-2 py-1">Kitchen</td><td className="px-2 py-1">Cabinetry</td><td className="px-2 py-1">Base Unit</td><td className="px-2 py-1 font-semibold">Kitchen Base Unit</td><td className="px-2 py-1">1</td><td className="px-2 py-1">Nos</td><td className="px-2 py-1">45,000</td><td className="px-2 py-1">18%</td></tr>
              <tr className="border-t border-surface-100 bg-surface-50"><td className="px-2 py-1">M.Bed</td><td className="px-2 py-1">Cabinetry</td><td className="px-2 py-1">Wardrobe</td><td className="px-2 py-1 font-semibold">3 Door Wardrobe</td><td className="px-2 py-1">1</td><td className="px-2 py-1">Nos</td><td className="px-2 py-1">1,20,000</td><td className="px-2 py-1">18%</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={downloadTemplate}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-[12px] font-semibold text-nicara-dark cursor-pointer hover:bg-surface-100 transition-colors">
          ⬇ Download Template
        </button>
        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-nicara-gold/10 border border-nicara-gold/30 rounded-xl text-[12px] font-semibold text-nicara-gold cursor-pointer hover:bg-nicara-gold/20 transition-colors">
          📤 Upload CSV
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleUpload} />
        </label>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LINE ITEMS TABLE — master-branch style with cell borders,
   area grouping, collapsible details, Category/SubCat, no serial #
   ══════════════════════════════════════════════════════════════════ */

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
  const [draft, setDraft] = useState<Record<number, Record<string, unknown>>>({});
  const [fArea, setFArea] = useState("All");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

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

  const val = (item: EstimateItem, key: string) =>
    (draft[item.id]?.[key] as string) ?? ((item as unknown as Record<string, string>)[key] ?? "");

  const uAreas = useMemo(() => {
    const areas = Array.from(new Set(estimate.items.map(i => i.area).filter(Boolean)));
    return ["All", ...areas.sort()];
  }, [estimate.items]);

  const filtered = useMemo(() => {
    if (fArea === "All") return estimate.items;
    return estimate.items.filter(i => i.area === fArea);
  }, [estimate.items, fArea]);

  const grouped = useMemo(() => {
    const map = new Map<string, EstimateItem[]>();
    filtered.forEach(item => {
      const area = item.area || "Uncategorized";
      if (!map.has(area)) map.set(area, []);
      map.get(area)!.push(item);
    });
    return Array.from(map.entries()).map(([area, items]) => ({
      area,
      items,
      subtotal: items.reduce((s, i) => s + parseFloat(i.amount || "0"), 0),
    }));
  }, [filtered]);

  if (estimate.items.length === 0) {
    return (
      <EmptyState icon="🧾" title="No line items yet"
        hint={'Use "Add from Catalogue" to pull in items with their standard rates.'} />
    );
  }

  const ddCls = "px-2.5 py-1.5 border border-surface-200 rounded-lg text-[11px] outline-none bg-white cursor-pointer focus:border-nicara-gold";

  return (
    <div>
      {/* ── Filter Bar ── */}
      <div className="flex gap-2 flex-wrap mb-3 p-2.5 px-3.5 bg-white border border-surface-200 rounded-xl items-center">
        <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mr-1">Filter:</span>
        <select value={fArea} onChange={e => setFArea(e.target.value)} className={ddCls}>
          {uAreas.map(o => <option key={o} value={o}>{o === "All" ? "All Areas" : o}</option>)}
        </select>
        {fArea !== "All" && (
          <button onClick={() => setFArea("All")}
            className="px-2.5 py-1 bg-transparent border border-surface-200 rounded-md text-[11px] text-surface-400 cursor-pointer hover:bg-surface-50">✕ Clear</button>
        )}
        <span className="ml-auto text-[11px] text-surface-400">{filtered.length}/{estimate.items.length} items</span>
      </div>

      {/* ── Table (master-branch styling) ── */}
      <div className="overflow-x-auto border border-surface-200 rounded-xl">
        <table className="w-full text-[11px] min-w-[1100px]">
          <thead>
            <tr className="bg-nicara-dark">
              {["Area", "Category", "Sub Cat", "Item", "L", "B", "H", "Qty", "Unit", "Rate", "Amount", "GST", "▼", "🗑"].map(h => (
                <th key={h} className={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(group => (
              <GroupBlock
                key={group.area}
                group={group}
                locked={locked}
                busy={busy}
                val={val}
                setDraft={setDraft}
                commit={commit}
                remove={remove}
                expanded={expanded}
                setExpanded={setExpanded}
              />
            ))}
            {/* Grand total footer */}
            <tr className="bg-nicara-dark">
              <td colSpan={10} className="p-2.5 text-stone-200 font-bold text-right text-xs">
                GRAND TOTAL ({filtered.length} items)
              </td>
              <td className="p-2.5 text-nicara-gold font-extrabold text-right font-mono text-[14px]">
                {inr(String(grouped.reduce((s, g) => s + g.subtotal, 0)))}
              </td>
              <td className="bg-nicara-dark" colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Area group block with header + rows + expandable details ── */

function GroupBlock({
  group, locked, busy, val, setDraft, commit, remove, expanded, setExpanded,
}: {
  group: { area: string; items: EstimateItem[]; subtotal: number };
  locked: boolean;
  busy: boolean;
  val: (item: EstimateItem, key: string) => string;
  setDraft: React.Dispatch<React.SetStateAction<Record<number, Record<string, unknown>>>>;
  commit: (item: EstimateItem) => Promise<void>;
  remove: (item: EstimateItem) => Promise<void>;
  expanded: Record<number, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}) {
  const BD = "border-r border-surface-200";
  return (
    <>
      {/* Area header */}
      <tr className="bg-nicara-gold/10">
        <td colSpan={14} className="px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-nicara-dark uppercase tracking-wider">{group.area}</span>
            <span className="text-[10px] text-surface-400">{group.items.length} item(s)</span>
            <span className="text-[10px] font-semibold text-nicara-gold ml-auto">{inr(String(group.subtotal))}</span>
          </div>
        </td>
      </tr>
      {/* Item rows */}
      {group.items.map((item, ri) => {
        const isOpen = expanded[item.id];
        return (
          <ItemRow
            key={item.id}
            item={item}
            ri={ri}
            isOpen={isOpen}
            locked={locked}
            busy={busy}
            val={val}
            setDraft={setDraft}
            commit={commit}
            remove={remove}
            onToggle={() => setExpanded(p => ({ ...p, [item.id]: !p[item.id] }))}
            BD={BD}
          />
        );
      })}
    </>
  );
}

/* ── Single item row + collapsible detail sub-table ── */

function ItemRow({
  item, ri, isOpen, locked, busy, val, setDraft, commit, remove, onToggle, BD,
}: {
  item: EstimateItem;
  ri: number;
  isOpen: boolean;
  locked: boolean;
  busy: boolean;
  val: (item: EstimateItem, key: string) => string;
  setDraft: React.Dispatch<React.SetStateAction<Record<number, Record<string, unknown>>>>;
  commit: (item: EstimateItem) => Promise<void>;
  remove: (item: EstimateItem) => Promise<void>;
  onToggle: () => void;
  BD: string;
}) {
  return (
    <>
      <tr className={`border-b border-surface-100 ${isOpen ? "bg-nicara-gold/5 border-l-[3px] border-l-nicara-gold" : ri % 2 === 0 ? "bg-white" : "bg-surface-50/50"}`}>
        {/* Area */}
        <td className={`px-2 py-1.5 font-semibold text-nicara-dark ${BD}`}>
          <EditableCell locked={locked} value={val(item, "area")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], area: v } }))}
            onCommit={() => commit(item)} placeholder="Room" />
        </td>
        {/* Category */}
        <td className={`px-2 py-1.5 ${BD}`}>
          <EditableCell locked={locked} value={val(item, "category") || ""}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], category: v } }))}
            onCommit={() => commit(item)} placeholder="Category" />
        </td>
        {/* Sub Cat */}
        <td className={`px-2 py-1.5 ${BD}`}>
          <EditableCell locked={locked} value={val(item, "subcategory") || ""}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], subcategory: v } }))}
            onCommit={() => commit(item)} placeholder="Sub Cat" />
        </td>
        {/* Item */}
        <td className={`px-2 py-1.5 font-semibold text-nicara-dark ${BD}`}>
          <EditableCell locked={locked} value={val(item, "item")} bold
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], item: v } }))}
            onCommit={() => commit(item)} placeholder="Item name" />
          {item.catalog_item_code && (
            <div className="px-2 text-[9px] text-surface-300 font-mono">{item.catalog_item_code}</div>
          )}
        </td>
        {/* L B H */}
        {(["length", "breadth", "height"] as const).map(dim => (
          <td key={dim} className={`px-2 py-1.5 w-[55px] ${BD}`}>
            <EditableCell locked={locked} value={val(item, dim)} mono
              onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], [dim]: v } }))}
              onCommit={() => commit(item)} placeholder="—" />
          </td>
        ))}
        {/* Qty */}
        <td className={`px-2 py-1.5 w-[55px] text-right font-mono ${BD}`}>
          <EditableCell locked={locked} value={val(item, "qty")} mono type="number"
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], qty: v } }))}
            onCommit={() => commit(item)} />
        </td>
        {/* Unit */}
        <td className={`px-2 py-1.5 w-[55px] ${BD}`}>
          <EditableCell locked={locked} value={val(item, "unit")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], unit: v } }))}
            onCommit={() => commit(item)} />
        </td>
        {/* Rate */}
        <td className={`px-2 py-1.5 w-[80px] text-right font-mono ${BD}`}>
          <EditableCell locked={locked} value={val(item, "rate")} mono type="number"
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], rate: v } }))}
            onCommit={() => commit(item)} />
        </td>
        {/* Amount */}
        <td className={`px-2 py-1.5 text-right font-bold text-nicara-gold font-mono whitespace-nowrap ${BD}`}>
          {inr(item.amount)}
        </td>
        {/* GST */}
        <td className={`px-2 py-1.5 text-center text-surface-500 ${BD}`}>
          {parseFloat(item.gst_pct)}%
        </td>
        {/* Expand toggle */}
        <td className={`px-2 py-1.5 text-center ${BD}`}>
          <button onClick={onToggle}
            className={`px-2 py-0.5 rounded-md text-[10px] cursor-pointer border ${isOpen ? "bg-nicara-gold/10 border-nicara-gold text-nicara-gold" : "bg-surface-50 border-surface-200 text-surface-500"
              }`}>
            {isOpen ? "▲" : "▼"}
          </button>
        </td>
        {/* Delete */}
        <td className="px-2 py-1.5 text-center">
          {!locked && (
            <button onClick={() => remove(item)} disabled={busy} title="Delete row"
              className="bg-transparent border-none text-red-300 cursor-pointer text-[14px] p-0 hover:text-red-500 transition-colors">🗑</button>
          )}
        </td>
      </tr>
      {/* Collapsible detail row */}
      {isOpen && (
        <tr>
          <td colSpan={14} className="p-0">
            <div className="bg-amber-50 border-l-[3px] border-l-nicara-gold px-4 py-3">
              <div className="text-[10px] font-bold text-amber-800 mb-2">📋 Item Breakdown — {val(item, "item")}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] min-w-[700px] border border-amber-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-amber-100">
                      {["Type", "Specification", "Brand", "Model", "Qty", "Unit", "Price", "Cost", "GST%", "Total"].map(h => (
                        <th key={h} className="px-2 py-1.5 text-amber-800 font-semibold text-left text-[9px] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-amber-200">
                      <td className="px-2 py-1.5 text-surface-500">Procurement</td>
                      <td className="px-2 py-1.5 font-semibold">{val(item, "item")}</td>
                      <td className="px-2 py-1.5 text-surface-500">—</td>
                      <td className="px-2 py-1.5 text-surface-500">—</td>
                      <td className="px-2 py-1.5 font-mono">{val(item, "qty") || 1}</td>
                      <td className="px-2 py-1.5">{val(item, "unit") || "Nos"}</td>
                      <td className="px-2 py-1.5 font-mono">{inr(val(item, "rate") || "0")}</td>
                      <td className="px-2 py-1.5 font-mono">{inr(item.amount)}</td>
                      <td className="px-2 py-1.5">{parseFloat(item.gst_pct)}%</td>
                      <td className="px-2 py-1.5 font-bold text-nicara-gold font-mono">{inr(item.amount)}</td>
                    </tr>
                    <tr className="border-t border-amber-200 text-surface-400 italic">
                      <td colSpan={10} className="px-2 py-1.5 text-[9px]">
                        Detail breakdown will be auto-populated when linked to catalogue items with BOMs.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Editable cell ─────────────────────────────────────────────── */

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

/* ══════════════════════════════════════════════════════════════════
   SMART ESTIMATE GENERATOR — Material preferences → auto-generate
   ══════════════════════════════════════════════════════════════════ */

const PLYWOOD_OPTIONS = [
  { label: "Austin Lincoln BWP 16mm", brand: "Austin", model: "Lincoln BWP", thick: "16mm", price: 3520, perUnit: "sheet" },
  { label: "Austin Lincoln BWP 8mm", brand: "Austin", model: "Lincoln BWP", thick: "8mm", price: 2560, perUnit: "sheet" },
  { label: "Century BWP 16mm", brand: "Century", model: "BWP Marine", thick: "16mm", price: 3800, perUnit: "sheet" },
  { label: "Greenply MR 16mm", brand: "Greenply", model: "Green Club MR", thick: "16mm", price: 2800, perUnit: "sheet" },
  { label: "Kitply BWP 16mm", brand: "Kitply", model: "Kit Club", thick: "16mm", price: 3200, perUnit: "sheet" },
];

const HARDWARE_OPTIONS = [
  { label: "Hettich — Onsys Soft Close Hinges", brand: "Hettich", model: "Onsys 0-Crank", unitCost: 260 },
  { label: "Hettich — Quadro Draw Channels", brand: "Hettich", model: "Quadro 18\" Soft Close", unitCost: 2600 },
  { label: "Hafele — Full Hardware Set", brand: "Hafele", model: "Matrix Box + H-Box", unitCost: 12000 },
  { label: "Ebco — Tandem Drawer System", brand: "Ebco", model: "Tandem Drawer", unitCost: 3500 },
  { label: "Godrej — Locks + Accessories", brand: "Godrej", model: "Nuovo Draw Locks 25mm", unitCost: 650 },
];

const KITCHEN_ACC_OPTIONS = [
  { label: "Hettich — Tandem Baskets (4 nos)", brand: "Hettich", model: "Architech Tandem Basket", qty: 4, unitCost: 3650, total: 14600 },
  { label: "Hafele — Full Modular Kitchen Set", brand: "Hafele", model: "Modular Kitchen Accessories", qty: 1, unitCost: 45000, total: 45000 },
  { label: "Ebco — Corner Unit + Basket", brand: "Ebco", model: "Corner Magic + Pull-out", qty: 1, unitCost: 8500, total: 8500 },
  { label: "Hettich — Cutlery + Thali Tray", brand: "Hettich", model: "Cutlery + Thali Tray", qty: 2, unitCost: 850, total: 1700 },
  { label: "Sincore — Sink & Tap (upto ₹35,000)", brand: "Sincore", model: "Sink & Tap Set", qty: 1, unitCost: 35000, total: 35000 },
];

const FINISH_OPTIONS = [
  { label: "Greenlam Laminate — Matt White", brand: "Greenlam", model: "White Matt", finish: "Laminate", pricePerSheet: 3000 },
  { label: "Greenlam Laminate — Wooden Oak", brand: "Greenlam", model: "Wooden Oak", finish: "Laminate", pricePerSheet: 3000 },
  { label: "Merino Laminate — Off White", brand: "Merino", model: "Off White", finish: "Laminate", pricePerSheet: 3200 },
  { label: "Merino Acrylic — High Gloss White", brand: "Merino", model: "High Gloss White", finish: "Acrylic", pricePerSheet: 4500 },
  { label: "Rehau Acrylic — Champagne", brand: "Rehau", model: "Champagne Gloss", finish: "Acrylic", pricePerSheet: 5200 },
  { label: "Thermo Laminate — Off White", brand: "Thermo", model: "Off White", finish: "Thermo Laminate", pricePerSheet: 5500 },
  { label: "Duropal HPL — Anthracite", brand: "Duropal", model: "Anthracite", finish: "HPL", pricePerSheet: 4800 },
];

function SmartEstimateGenerator({
  projectId, estimateId, disabled, onGenerated, onError,
}: {
  projectId: number;
  estimateId: number;
  disabled: boolean;
  onGenerated: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [selPlywood, setSelPlywood] = useState("");
  const [selHardware, setSelHardware] = useState("");
  const [selKitchenAcc, setSelKitchenAcc] = useState("");
  const [selFinish, setSelFinish] = useState("");
  const [generating, setGenerating] = useState(false);

  const canGenerate = selPlywood && selHardware && selKitchenAcc && selFinish;

  const generate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const ply = PLYWOOD_OPTIONS.find(o => o.label === selPlywood)!;
      const hw = HARDWARE_OPTIONS.find(o => o.label === selHardware)!;
      const kac = KITCHEN_ACC_OPTIONS.find(o => o.label === selKitchenAcc)!;
      const fin = FINISH_OPTIONS.find(o => o.label === selFinish)!;

      // Generate plywood items for common areas
      const rooms = ["Living Room", "Kitchen", "Master Bedroom", "Bedroom 2", "Bedroom 3"];
      for (const room of rooms) {
        const sheets = room === "Kitchen" ? 11 : room === "Master Bedroom" ? 8 : 4;
        await estimatesApi.addItem(projectId, estimateId, {
          area: room, item: `Core Material ${ply.thick} BWP Ply - ${ply.brand} ${ply.model}`,
          qty: sheets, unit: "Sheets", rate: ply.price, gst_pct: 18,
        });
      }

      // Hardware items
      const hwRooms = ["Kitchen", "Master Bedroom", "Bedroom 2", "Living Room"];
      for (const room of hwRooms) {
        const qty = room === "Kitchen" ? 20 : room === "Master Bedroom" ? 12 : 6;
        await estimatesApi.addItem(projectId, estimateId, {
          area: room, item: `${hw.brand} ${hw.model}`,
          qty, unit: "Sets", rate: hw.unitCost, gst_pct: 18,
        });
      }

      // Kitchen accessories
      await estimatesApi.addItem(projectId, estimateId, {
        area: "Kitchen", item: `${kac.brand} ${kac.model}`,
        qty: kac.qty, unit: "Nos", rate: kac.unitCost, gst_pct: 18,
      });

      // Finishing for all rooms
      for (const room of rooms) {
        const sheets = room === "Kitchen" ? 6 : room === "Master Bedroom" ? 4 : 2;
        await estimatesApi.addItem(projectId, estimateId, {
          area: room, item: `Finishing ${fin.finish} - ${fin.brand} ${fin.model}`,
          qty: sheets, unit: "Sheets", rate: fin.pricePerSheet, gst_pct: 18,
        });
      }

      await onGenerated();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Failed to generate estimate.");
    } finally {
      setGenerating(false);
    }
  };

  const ddCls = "w-full px-3 py-2.5 border rounded-xl text-[11px] outline-none cursor-pointer transition-colors";

  return (
    <div className="mb-4 bg-gradient-to-br from-nicara-dark to-[#2a1f18] rounded-2xl overflow-hidden border border-stone-700">
      {/* Header */}
      <div className="px-5 py-3 border-b border-stone-700">
        <div className="text-[14px] font-bold text-white flex items-center gap-2">
          <span className="text-lg">🧠</span> Smart Estimate Generator
        </div>
        <div className="text-[11px] text-stone-400 mt-0.5">
          Select your material preferences — we&apos;ll generate the estimate automatically
        </div>
      </div>

      {/* Material preference selectors */}
      <div className="grid grid-cols-4 gap-3 p-5">
        {/* Plywood */}
        <div>
          <div className="text-[10px] font-bold text-stone-300 mb-1.5 flex items-center gap-1">
            <span>🪵</span> Plywood
          </div>
          <select value={selPlywood} onChange={e => setSelPlywood(e.target.value)}
            className={`${ddCls} ${selPlywood ? "border-nicara-gold bg-nicara-gold/10 text-white" : "border-stone-600 bg-stone-800/50 text-stone-400"}`}>
            <option className="text-gray-500 bg-white" value="">Select plywood…</option>
            {PLYWOOD_OPTIONS.map(o => <option className="text-black bg-white" key={o.label} value={o.label}>{o.label}</option>)}
          </select>
          {selPlywood && (() => {
            const o = PLYWOOD_OPTIONS.find(p => p.label === selPlywood);
            return o ? <div className="text-[9px] text-nicara-gold mt-1">₹{o.price.toLocaleString()}/{o.perUnit}</div> : null;
          })()}
        </div>

        {/* Hardware */}
        <div>
          <div className="text-[10px] font-bold text-stone-300 mb-1.5 flex items-center gap-1">
            <span>🔩</span> Hardware
          </div>
          <select value={selHardware} onChange={e => setSelHardware(e.target.value)}
            className={`${ddCls} ${selHardware ? "border-nicara-gold bg-nicara-gold/10 text-white" : "border-stone-600 bg-stone-800/50 text-stone-400"}`}>
            <option className="text-gray-500 bg-white" value="">Select hardware…</option>
            {HARDWARE_OPTIONS.map(o => <option className="text-black bg-white" key={o.label} value={o.label}>{o.label}</option>)}
          </select>
          {selHardware && (() => {
            const o = HARDWARE_OPTIONS.find(p => p.label === selHardware);
            return o ? <div className="text-[9px] text-nicara-gold mt-1">₹{o.unitCost.toLocaleString()}/set</div> : null;
          })()}
        </div>

        {/* Kitchen Accessories */}
        <div>
          <div className="text-[10px] font-bold text-stone-300 mb-1.5 flex items-center gap-1">
            <span>🍳</span> Kitchen Acc.
          </div>
          <select value={selKitchenAcc} onChange={e => setSelKitchenAcc(e.target.value)}
            className={`${ddCls} ${selKitchenAcc ? "border-nicara-gold bg-nicara-gold/10 text-white" : "border-stone-600 bg-stone-800/50 text-stone-400"}`}>
            <option className="text-gray-500 bg-white" value="">Select kitchen accessories…</option>
            {KITCHEN_ACC_OPTIONS.map(o => <option className="text-black bg-white" key={o.label} value={o.label}>{o.label}</option>)}
          </select>
          {selKitchenAcc && (() => {
            const o = KITCHEN_ACC_OPTIONS.find(p => p.label === selKitchenAcc);
            return o ? <div className="text-[9px] text-nicara-gold mt-1">₹{o.total.toLocaleString()} total</div> : null;
          })()}
        </div>

        {/* Finishing */}
        <div>
          <div className="text-[10px] font-bold text-stone-300 mb-1.5 flex items-center gap-1">
            <span>✨</span> Finishing
          </div>
          <select value={selFinish} onChange={e => setSelFinish(e.target.value)}
            className={`${ddCls} ${selFinish ? "border-nicara-gold bg-nicara-gold/10 text-white" : "border-stone-600 bg-stone-800/50 text-stone-400"}`}>
            <option className="text-gray-500 bg-white" value="">Select finish…</option>
            {FINISH_OPTIONS.map(o => <option className="text-black bg-white" key={o.label} value={o.label}>{o.label}</option>)}
          </select>
          {selFinish && (() => {
            const o = FINISH_OPTIONS.find(p => p.label === selFinish);
            return o ? <div className="text-[9px] text-nicara-gold mt-1">₹{o.pricePerSheet.toLocaleString()}/sheet</div> : null;
          })()}
        </div>
      </div>

      {/* Selected preferences summary */}
      {(selPlywood || selHardware || selKitchenAcc || selFinish) && (
        <div className="px-5 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {[["🪵 Plywood", selPlywood], ["🔩 Hardware", selHardware],
            ["🍳 Kitchen", selKitchenAcc], ["✨ Finish", selFinish]].map(([label, val]) =>
              val ? (
                <span key={label as string} className="px-2.5 py-1 bg-nicara-gold/10 border border-nicara-gold/30 rounded-full text-[9px] font-semibold text-nicara-gold">
                  {label}: {(val as string).split("—")[0]?.trim() || val}
                </span>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Generate button */}
      <div className="px-5 py-3 border-t border-stone-700 flex items-center justify-between">
        {canGenerate ? (
          <button onClick={generate} disabled={disabled || generating}
            className="px-6 py-2.5 bg-nicara-gold border-none rounded-xl text-white text-[12px] font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50">
            {generating ? "⏳ Generating Estimate…" : "⚡ Generate Estimate"}
          </button>
        ) : (
          <div className="text-[11px] text-stone-500">
            Select all 4 material preferences above to enable estimate generation
          </div>
        )}
      </div>
    </div>
  );
}
