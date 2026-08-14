"use client";

import { useMemo, useState } from "react";
import {
  ApiError, catalogApi, designRequirementsApi, estimatesApi, itemsApi,
  type ComponentInput,
} from "@/lib/api";
import type {
  Estimate, EstimateItem, EstimateItemComponent, EstimateType, Item, Project, Furniture,
} from "@/lib/apiTypes";
import { useApiData, inr, inrExact } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Field } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading, StatusPill } from "@/components/ui/States";
import {
  Download, Upload, FileText, FileSpreadsheet, Send,
  RotateCcw, CheckCircle, Copy, Brain, Plus, Trash2, ChevronDown, ChevronUp,
  ClipboardList, X,
} from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { AddFurnitureModal } from "@/components/catalog/AddFurnitureModal";

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
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);

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

  /** Fetch the rendered file from the API and hand it to the browser. */
  const download = async (format: "pdf" | "excel") => {
    if (!estimate) return;
    setDownloading(format);
    setBanner("");
    try {
      if (format === "pdf") {
        await estimatesApi.downloadPdf(project.id, estimate.id);
      } else {
        await estimatesApi.downloadExcel(project.id, estimate.id);
      }
      toast.success("Downloaded", `${title} ${format.toUpperCase()}`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not generate the file.";
      setBanner(msg);
      toast.error("Download failed", msg);
    } finally {
      setDownloading(null);
    }
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
                <Upload size={13} /> Import
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Btn onClick={() => setPicking(true)} disabled={busy || locked}><Plus size={13} /> Add from Catalogue</Btn>
            <Btn variant="ghost" disabled={busy || locked}
              onClick={() => guard(
                () => estimatesApi.addItem(project.id, estimate.id, {
                  area: "", item: "New line", qty: 1, rate: 0, unit: "unit", gst_pct: 18,
                }),
                "Blank line added"
              )}>
              <Plus size={13} /> Blank Line
            </Btn>
            <Btn variant="ghost" disabled={busy || locked}
              onClick={() => setShowGenerator(!showGenerator)}>
              {showGenerator ? <><X size={13} /> Close Generator</> : <><Brain size={13} /> Smart Generator</>}
            </Btn>

            {/* Downloads — rendered server-side so every copy is identical. */}
            <Btn variant="ghost" disabled={downloading !== null}
              onClick={() => download("pdf")}>
              {downloading === "pdf" ? "Preparing…" : <><FileText size={13} /> PDF</>}
            </Btn>
            <Btn variant="ghost" disabled={downloading !== null}
              onClick={() => download("excel")}>
              {downloading === "excel" ? "Preparing…" : <><FileSpreadsheet size={13} /> Excel</>}
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
              {populating ? "Populating…" : <><ClipboardList size={13} /> Populate from Design Req</>}
            </Btn>
            <div className="flex-1" />
            {estimate.status === "draft" && (
              <Btn variant="ghost" disabled={busy}
                onClick={() => guard(() => estimatesApi.send(project.id, estimate.id), "Sent for client approval")}>
                <Send size={13} /> Send for Approval
              </Btn>
            )}
            {(estimate.status === "sent" || estimate.status === "revision") && (
              <>
                <Btn variant="ghost" disabled={busy}
                  onClick={() => guard(
                    () => estimatesApi.requestRevision(project.id, estimate.id, "Client requested changes"),
                    "Marked for revision"
                  )}>
                  <RotateCcw size={13} /> Request Revision
                </Btn>
                <Btn disabled={busy}
                  onClick={() => guard(
                    () => estimatesApi.approve(project.id, estimate.id, "Approved by client"),
                    "Estimate approved"
                  )}>
                  <CheckCircle size={13} /> Mark Approved
                </Btn>
              </>
            )}
            {locked && (
              <Btn variant="ghost" disabled={busy}
                onClick={() => guard(async () => {
                  const clone = await estimatesApi.duplicate(project.id, estimate.id);
                  setSelectedId(clone.id);
                }, "Copied into a new draft")}>
                <Copy size={13} /> Duplicate to Revise
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
            onSilentUpdate={async () => {
              if (!estimate) return;
              try {
                const updated = await estimatesApi.get(project.id, estimate.id);
                detailQuery.setData(updated);
              } catch {
                await refresh();
              }
            }}
            onError={msg => { setBanner(msg); toast.error("Error", msg); }}
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
    const headers = "Area,Item,L,B,H,Qty,Unit,Rate,GST%";
    const sample = [
      "Kitchen,Kitchen Base Unit,10,2,2.5,1,Nos,45000,18",
      "Master Bedroom,3 Door Wardrobe,8,2,9,1,Nos,120000,18",
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
          item: cols[1]?.trim() || "Imported Item",
          length: cols[2]?.trim() || "",
          breadth: cols[3]?.trim() || "",
          height: cols[4]?.trim() || "",
          qty: parseFloat(cols[5]) || 1,
          unit: cols[6]?.trim() || "Nos",
          rate: parseFloat(cols[7]) || 0,
          gst_pct: parseFloat(cols[8]) || 18,
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
              {["Area", "Item", "L", "B", "H", "Qty", "Unit", "Rate", "GST%"].map(h =>
                <th key={h} className="px-2 py-1.5 text-surface-500 font-semibold text-left">{h}</th>
              )}
            </tr></thead>
            <tbody>
              <tr className="border-t border-surface-100"><td className="px-2 py-1">Kitchen</td><td className="px-2 py-1 font-semibold">Kitchen Base Unit</td><td className="px-2 py-1">10</td><td className="px-2 py-1">2</td><td className="px-2 py-1">2.5</td><td className="px-2 py-1">1</td><td className="px-2 py-1">Nos</td><td className="px-2 py-1">45,000</td><td className="px-2 py-1">18%</td></tr>
              <tr className="border-t border-surface-100 bg-surface-50"><td className="px-2 py-1">M.Bed</td><td className="px-2 py-1 font-semibold">3 Door Wardrobe</td><td className="px-2 py-1">8</td><td className="px-2 py-1">2</td><td className="px-2 py-1">9</td><td className="px-2 py-1">1</td><td className="px-2 py-1">Nos</td><td className="px-2 py-1">1,20,000</td><td className="px-2 py-1">18%</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={downloadTemplate}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-[12px] font-semibold text-nicara-dark cursor-pointer hover:bg-surface-100 transition-colors">
          <Download size={14} /> Download Template
        </button>
        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-nicara-gold/10 border border-nicara-gold/30 rounded-xl text-[12px] font-semibold text-nicara-gold cursor-pointer hover:bg-nicara-gold/20 transition-colors">
          <Upload size={14} /> Upload CSV
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
  project, estimate, locked, busy, onChanged, onSilentUpdate, onError,
}: {
  project: Project;
  estimate: Estimate;
  locked: boolean;
  busy: boolean;
  onChanged: () => Promise<void>;
  onSilentUpdate: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Record<number, Record<string, unknown>>>({});
  const [fArea, setFArea] = useState("All");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const { data: catData, reload: reloadCat } = useApiData(() => catalogApi.furniture(), []);
  const catalogOptions = useMemo(() => {
    return (catData?.results || []).map(f => ({ value: f.name, label: f.name }));
  }, [catData]);

  const { data: zoneData, reload: reloadZones } = useApiData(() => catalogApi.zones(), []);
  const zoneOptions = useMemo(() => {
    return (zoneData?.results || []).map(z => ({ value: z.name, label: z.name }));
  }, [zoneData]);

  const [addFurnOpen, setAddFurnOpen] = useState(false);
  const [addFurnName, setAddFurnName] = useState("");
  const [addFurnTargetItem, setAddFurnTargetItem] = useState<EstimateItem | null>(null);

  const handleAddFurniture = (name: string, item: EstimateItem) => {
    setAddFurnName(name);
    setAddFurnTargetItem(item);
    setAddFurnOpen(true);
  };

  const handleFurnitureAdded = async (furniture: Furniture) => {
    if (addFurnTargetItem) {
      const nextDraft = { ...draft, [addFurnTargetItem.id]: { ...draft[addFurnTargetItem.id], item: furniture.name } };
      setDraft(nextDraft);
      // Immediately commit it
      try {
        await estimatesApi.updateItem(project.id, estimate.id, addFurnTargetItem.id, { item: furniture.name });
        await onChanged();
      } catch (e) {
        onError("Could not save item name");
      }
    }
    setAddFurnOpen(false);
    reloadCat();
  };

  const handleAddZone = async (name: string, targetItem: EstimateItem) => {
    try {
      await catalogApi.createZone({ name });
      toast.success("Zone Added", `Added ${name} to Catalogue`);
      await reloadZones();
      const nextDraft = { ...draft, [targetItem.id]: { ...draft[targetItem.id], zone: name } };
      setDraft(nextDraft);
      await estimatesApi.updateItem(project.id, estimate!.id, targetItem.id, { zone: name });
      await onSilentUpdate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not add zone");
    }
  };
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
      <EmptyState icon="" title="No line items yet"
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
            className="px-2.5 py-1 bg-transparent border border-surface-200 rounded-md text-[11px] text-surface-400 cursor-pointer hover:bg-surface-50">Clear</button>
        )}
        <span className="ml-auto text-[11px] text-surface-400">{filtered.length}/{estimate.items.length} items</span>
      </div>

      {/* ── Table (master-branch styling) ── */}
      <div className="overflow-x-auto border border-surface-200 rounded-xl">
        <table className="w-full text-[11px] min-w-[1100px]">
          <thead>
            <tr className="bg-nicara-dark">
              {["Area", "Item", "L", "B", "H", "Qty", "Unit", "Rate", "Amount", "GST", "Detail", "Del"].map(h => (
                <th key={h} className={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(group => (
              <GroupBlock
                key={group.area}
                group={group}
                project={project}
                estimate={estimate}
                locked={locked}
                busy={busy}
                val={val}
                setDraft={setDraft}
                commit={commit}
                remove={remove}
                expanded={expanded}
                setExpanded={setExpanded}
                onChanged={onChanged}
                onError={onError}
                onAddRow={async () => {
                  try {
                    await estimatesApi.addItem(project.id, estimate.id, {
                      area: group.area, item: "New line", qty: 1, rate: 0, unit: "unit", gst_pct: 18,
                    });
                    await onChanged();
                  } catch (e) {
                    onError(e instanceof ApiError ? e.message : "Could not add row.");
                  }
                }}
                catalogOptions={catalogOptions}
                zoneOptions={zoneOptions}
                onAddFurniture={handleAddFurniture}
                onAddZone={handleAddZone}
                onSilentUpdate={onSilentUpdate}
                catData={catData}
              />
            ))}
            {/* Grand total footer */}
            <tr className="bg-nicara-dark">
              <td colSpan={8} className="p-2.5 text-stone-200 font-bold text-right text-xs">
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

      <AddFurnitureModal
        open={addFurnOpen}
        onClose={() => setAddFurnOpen(false)}
        initialName={addFurnName}
        onSuccess={handleFurnitureAdded}
      />
    </div>
  );
}

/* ── Area group block with header + rows + expandable details ── */

function GroupBlock({
  group, project, estimate, locked, busy, val, setDraft, commit, remove,
  expanded, setExpanded, onChanged, onError, onAddRow,
  catalogOptions, zoneOptions, onAddFurniture, onAddZone, onSilentUpdate, catData,
}: {
  group: { area: string; items: EstimateItem[]; subtotal: number };
  project: Project;
  estimate: Estimate;
  locked: boolean;
  busy: boolean;
  val: (item: EstimateItem, key: string) => string;
  setDraft: React.Dispatch<React.SetStateAction<Record<number, Record<string, unknown>>>>;
  commit: (item: EstimateItem) => Promise<void>;
  remove: (item: EstimateItem) => Promise<void>;
  expanded: Record<number, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  onAddRow: () => void;
  catalogOptions: { value: string, label: string }[];
  zoneOptions: { value: string, label: string }[];
  onAddFurniture: (name: string, item: EstimateItem) => void;
  onAddZone: (name: string, item: EstimateItem) => void;
  onSilentUpdate: () => Promise<void>;
  catData: any;
}) {
  const [addingFurniture, setAddingFurniture] = useState<{ id: number; name: string } | null>(null);
  const BD = "border-r border-surface-200";
  return (
    <>
      {/* Area header */}
      <tr className="bg-nicara-gold/10">
        <td colSpan={12} className="px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-nicara-dark uppercase tracking-wider">{group.area}</span>
            <span className="text-[10px] text-surface-400">{group.items.length} item(s)</span>
            <span className="text-[10px] font-semibold text-nicara-gold ml-auto mr-3">{inr(String(group.subtotal))}</span>
            {!locked && (
              <button onClick={onAddRow}
                className="px-2.5 py-1 bg-white border border-surface-200 rounded-lg text-[10px] font-semibold text-nicara-gold cursor-pointer hover:bg-nicara-gold/5 hover:border-nicara-gold/30">
                + Add Row
              </button>
            )}
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
            project={project}
            estimate={estimate}
            locked={locked}
            busy={busy}
            val={val}
            setDraft={setDraft}
            commit={commit}
            remove={remove}
            onChanged={onChanged}
            onError={onError}
            onToggle={() => setExpanded(p => ({ ...p, [item.id]: !p[item.id] }))}
            BD={BD}
            catalogOptions={catalogOptions}
            zoneOptions={zoneOptions}
            onAddFurniture={onAddFurniture}
            onAddZone={onAddZone}
            onSilentUpdate={onSilentUpdate}
            catData={catData}
          />
        );
      })}
    </>
  );
}

/* ── Single item row + collapsible detail sub-table ── */

function ItemRow({
  item, ri, isOpen, project, estimate, locked, busy, val, setDraft, commit, remove,
  onChanged, onError, onToggle, BD, catalogOptions, zoneOptions, onAddFurniture, onAddZone, onSilentUpdate, catData,
}: {
  item: EstimateItem;
  ri: number;
  isOpen: boolean;
  project: Project;
  estimate: Estimate;
  locked: boolean;
  busy: boolean;
  val: (item: EstimateItem, key: string) => string;
  setDraft: React.Dispatch<React.SetStateAction<Record<number, Record<string, unknown>>>>;
  commit: (item: EstimateItem) => Promise<void>;
  remove: (item: EstimateItem) => Promise<void>;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  onToggle: () => void;
  BD: string;
  catalogOptions: { value: string, label: string }[];
  zoneOptions: { value: string, label: string }[];
  onAddFurniture: (name: string, item: EstimateItem) => void;
  onAddZone: (name: string, item: EstimateItem) => void;
  onSilentUpdate: () => Promise<void>;
  catData: any;
}) {
  return (
    <>
      <tr className={`border-b border-surface-100 ${isOpen ? "bg-nicara-gold/5 border-l-[3px] border-l-nicara-gold" : ri % 2 === 0 ? "bg-white" : "bg-surface-50/50"}`}>
        {/* Area / Zone */}
        <td className={`px-2 py-1.5 font-semibold text-nicara-dark min-w-[120px] ${BD}`}>
          {!locked ? (
            <SearchableSelect
              value={val(item, "zone")}
              onChange={v => {
                setDraft(d => ({ ...d, [item.id]: { ...d[item.id], zone: v } }));
                estimatesApi.updateItem(project.id, estimate.id, item.id, { zone: v }).then(() => onSilentUpdate());
              }}
              options={zoneOptions}
              onAdd={searchTerm => onAddZone(searchTerm, item)}
              placeholder="Zone (e.g. East Wall)"
            />
          ) : (
            <div className="px-2 py-1.5 text-[11px] font-semibold text-nicara-dark">{val(item, "zone")}</div>
          )}
        </td>
        {/* Item */}
        <td className={`px-2 py-1.5 min-w-[200px] font-semibold text-nicara-dark ${BD}`}>
          {!locked ? (
            <SearchableSelect
              value={val(item, "item")}
              onChange={async v => {
                setDraft(d => ({ ...d, [item.id]: { ...d[item.id], item: v } }));
                try {
                  await estimatesApi.updateItem(project.id, estimate.id, item.id, { item: v });
                  const match = (catData?.results || []).find((f: any) => f.name === v);
                  if (match) {
                    await estimatesApi.populateFromFurniture(project.id, estimate.id, item.id, match.id);
                  }
                  await onSilentUpdate();
                } catch (e) {
                  onError(e instanceof ApiError ? e.message : "Failed to update item");
                }
              }}
              options={catalogOptions}
              onAdd={searchTerm => onAddFurniture(searchTerm, item)}
              placeholder="Item name"
            />
          ) : (
            <div className="px-2 py-1.5 text-[11px] font-semibold text-nicara-dark">{val(item, "item")}</div>
          )}
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
            {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </td>
        {/* Delete */}
        <td className="px-2 py-1.5 text-center">
          {!locked && (
            <button onClick={() => remove(item)} disabled={busy} title="Delete row"
              className="bg-transparent border-none text-red-300 cursor-pointer p-0 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
          )}
        </td>
      </tr>
      {/* Collapsible detail row — live material breakdown */}
      {isOpen && (
        <tr>
          <td colSpan={12} className="p-0">
            <ComponentBreakdown
              item={item} project={project} estimate={estimate}
              locked={locked} onChanged={onChanged} onError={onError} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Live material breakdown (bill of materials) ──────────────── */

function ComponentBreakdown({
  item, project, estimate, locked, onChanged, onError,
}: {
  item: EstimateItem;
  project: Project;
  estimate: Estimate;
  locked: boolean;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const toast = useToast();
  const components = item.components ?? [];
  const [editing, setEditing] = useState<EstimateItemComponent | "new" | null>(null);
  const [pulling, setPulling] = useState(false);
  const [showPull, setShowPull] = useState(false);
  const [busy, setBusy] = useState(false);

  const removeComponent = async (id: number) => {
    setBusy(true);
    try {
      await estimatesApi.deleteComponent(project.id, estimate.id, item.id, id);
      await onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not remove the component.");
    } finally { setBusy(false); }
  };

  const pull = async (furnitureId: number) => {
    setPulling(true);
    try {
      const res = await estimatesApi.populateFromFurniture(project.id, estimate.id, item.id, furnitureId);
      setShowPull(false);
      toast.success("Breakdown pulled", res.detail);
      await onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not pull the breakdown.");
    } finally { setPulling(false); }
  };

  return (
    <div className="bg-amber-50 border-l-[3px] border-l-nicara-gold px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-amber-800">
          📋 Material Breakdown — {item.item || "line"}
          {components.length > 0 && (
            <span className="ml-2 text-amber-600 font-normal">
              amount rolls up from these {components.length} component(s)
            </span>
          )}
        </div>
        {!locked && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPull(true)} disabled={pulling}
              className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-[10px] font-semibold text-amber-700 cursor-pointer hover:bg-amber-100">
              {pulling ? "Pulling…" : "⇊ Pull from Catalogue"}
            </button>
            <button onClick={() => setEditing("new")}
              className="px-2.5 py-1 bg-nicara-gold border-none rounded-lg text-[10px] font-bold text-white cursor-pointer">
              + Basic Component
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px] min-w-[760px] border border-amber-200 rounded-lg overflow-hidden bg-white">
          <thead>
            <tr className="bg-amber-100">
              {["Basic Component", "Detail", "Brand", "Model", "Qty", "Unit", "Price", "Amount", ""].map(h => (
                <th key={h} className="px-2 py-1.5 text-amber-800 font-semibold text-left text-[9px] uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {components.map(c => (
              <tr key={c.id} className="border-t border-amber-200">
                <td className="px-2 py-1.5 font-semibold text-nicara-dark">{c.basic_component}</td>
                <td className="px-2 py-1.5 text-surface-600">{c.detail || "—"}</td>
                <td className="px-2 py-1.5 text-surface-600">{c.brand || "—"}</td>
                <td className="px-2 py-1.5 text-surface-600">{c.model || "—"}</td>
                <td className="px-2 py-1.5 font-mono text-right">{parseFloat(c.qty)}</td>
                <td className="px-2 py-1.5">{c.unit || "—"}</td>
                <td className="px-2 py-1.5 font-mono text-right">{inr(c.price)}</td>
                <td className="px-2 py-1.5 font-mono text-right font-semibold text-nicara-dark">{inr(c.amount)}</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {!locked && (
                    <>
                      <button onClick={() => setEditing(c)}
                        className="text-amber-700 hover:text-nicara-gold bg-transparent border-none cursor-pointer text-[10px] mr-2">edit</button>
                      <button onClick={() => removeComponent(c.id)} disabled={busy}
                        className="text-red-300 hover:text-red-500 bg-transparent border-none cursor-pointer text-[11px]">✕</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {components.length === 0 && (
              <tr className="border-t border-amber-200">
                <td colSpan={9} className="px-2 py-3 text-center text-surface-400 text-[10px] italic">
                  No breakdown yet. Add a basic component, or pull one from the catalogue.
                  {" "}Until then the line uses qty × rate.
                </td>
              </tr>
            )}
          </tbody>
          {components.length > 0 && (
            <tfoot>
              <tr className="bg-amber-100 border-t-2 border-amber-300">
                <td colSpan={7} className="px-2 py-1.5 text-right font-bold text-amber-800 text-[10px]">Line Total</td>
                <td className="px-2 py-1.5 text-right font-extrabold text-nicara-gold font-mono">{inr(item.amount)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editing && (
        <ComponentModal
          component={editing === "new" ? null : editing}
          project={project} estimate={estimate} itemId={item.id}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); toast.success("Saved", "Breakdown updated"); await onChanged(); }} />
      )}
      {showPull && (
        <PullFromCatalogueModal onClose={() => setShowPull(false)} onPick={pull} busy={pulling} />
      )}
    </div>
  );
}

function ComponentModal({
  component, project, estimate, itemId, onClose, onSaved,
}: {
  component: EstimateItemComponent | null;
  project: Project;
  estimate: Estimate;
  itemId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ComponentInput>(
    component ? { ...component } : { basic_component: "", detail: "", brand: "", model: "", qty: "1", unit: "sft", price: "0" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ComponentInput, v: string) => setForm(f => ({ ...f, [k]: v }));
  const previewAmount = (parseFloat(String(form.qty)) || 0) * (parseFloat(String(form.price)) || 0);

  const save = async () => {
    if (!String(form.basic_component ?? "").trim()) { setErrors({ basic_component: ["Required."] }); return; }
    setSaving(true); setBanner(""); setErrors({});
    try {
      if (component) await estimatesApi.updateComponent(project.id, estimate.id, itemId, component.id, form);
      else await estimatesApi.addComponent(project.id, estimate.id, itemId, form);
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); } else setBanner("Could not save.");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md"
      title={component ? "Edit Component" : "Add Basic Component"}
      subtitle="Amount is quantity × price"
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Basic Component" value={String(form.basic_component ?? "")}
            onChange={v => set("basic_component", v)} required error={errors.basic_component?.[0]}
            placeholder="Plywood, Laminate, Hinges…" />
        </div>
        <Field label="Detail" value={String(form.detail ?? "")} onChange={v => set("detail", v)} placeholder="18mm" />
        <Field label="Brand" value={String(form.brand ?? "")} onChange={v => set("brand", v)} placeholder="Austin" />
        <Field label="Model" value={String(form.model ?? "")} onChange={v => set("model", v)} placeholder="Lincoln" />
        <Field label="Unit" value={String(form.unit ?? "")} onChange={v => set("unit", v)} placeholder="sft" />
        <Field label="Qty" type="number" value={String(form.qty ?? "0")} onChange={v => set("qty", v)} error={errors.qty?.[0]} />
        <Field label="Price (₹)" type="number" value={String(form.price ?? "0")} onChange={v => set("price", v)} error={errors.price?.[0]} />
      </div>
      <div className="mt-3 text-right text-[12px] text-surface-500">
        Amount: <span className="font-bold text-nicara-dark">{inr(String(previewAmount))}</span>
      </div>
    </Modal>
  );
}

function PullFromCatalogueModal({
  onClose, onPick, busy,
}: {
  onClose: () => void;
  onPick: (furnitureId: number) => void;
  busy: boolean;
}) {
  const [search, setSearch] = useState("");
  const { data, loading, error, reload } = useApiData(() => catalogApi.furniture(), []);
  const furniture = (data?.results ?? []).filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal open onClose={onClose} size="md" title="Pull Breakdown from Catalogue"
      subtitle="Copies the furniture's bill of materials into this line's breakdown"
      footer={<Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>}>
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-surface-400">🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
          placeholder="Search wardrobe, kitchen base unit…"
          className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] outline-none focus:border-nicara-gold" />
      </div>
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && (
        <div className="max-h-[360px] overflow-y-auto border border-surface-200 rounded-xl">
          {furniture.map(f => (
            <button key={f.id} onClick={() => onPick(f.id)} disabled={busy}
              className="w-full flex items-center justify-between px-3 py-2.5 border-b border-surface-100 last:border-0 cursor-pointer hover:bg-nicara-gold/5 text-left bg-white">
              <div>
                <div className="text-[12px] font-semibold text-nicara-dark">{f.name}</div>
                <div className="text-[10px] text-surface-400">
                  {f.room_names.length ? f.room_names.join(", ") : "All rooms"} · {f.part_count} part(s)
                </div>
              </div>
              <span className="text-[11px] text-nicara-gold font-semibold">Pull →</span>
            </button>
          ))}
          {furniture.length === 0 && (
            <div className="px-3 py-6 text-center text-surface-400 text-[12px]">No furniture matches</div>
          )}
        </div>
      )}
    </Modal>
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
  { label: "Austin Lincoln", brand: "Austin", model: "Lincoln" },
  { label: "Austin Gold", brand: "Austin", model: "Gold" },
  { label: "Century BWP Marine", brand: "Century", model: "BWP Marine" },
  { label: "Greenply Green Club MR", brand: "Greenply", model: "Green Club MR" },
  { label: "Kitply Kit Club", brand: "Kitply", model: "Kit Club" },
];

const HARDWARE_OPTIONS = [
  { label: "Hettich — Onsys 0-Crank", brand: "Hettich", model: "Onsys 0-Crank" },
  { label: "Hettich — Sensys 8-Crank", brand: "Hettich", model: "Sensys 8-Crank" },
  { label: "Hafele — Matrix Box", brand: "Hafele", model: "Matrix Box + H-Box" },
  { label: "Ebco — Tandem Drawer", brand: "Ebco", model: "Tandem Drawer" },
];

const KITCHEN_ACC_OPTIONS = [
  { label: "Hettich — Architech Tandem Basket", brand: "Hettich", model: "Architech Tandem Basket" },
  { label: "Hafele — Modular Kitchen Accessories", brand: "Hafele", model: "Modular Kitchen Accessories" },
  { label: "Ebco — Corner Magic + Pull-out", brand: "Ebco", model: "Corner Magic + Pull-out" },
];

const FINISH_OPTIONS = [
  { label: "Greenlam Laminate — Suede", brand: "Greenlam", model: "Suede" },
  { label: "Greenlam Laminate — SU", brand: "Greenlam", model: "SU" },
  { label: "Virgo Laminate — SU", brand: "Virgo", model: "SU" },
  { label: "Merino Acrylic — Hi-Gloss", brand: "Merino", model: "Hi-Gloss" },
  { label: "Rehau Acrylic — Champagne Gloss", brand: "Rehau", model: "Champagne Gloss" },
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

      const materialsToApply = [
        { basic_component: "Plywood", brand: ply.brand, model: ply.model },
        { basic_component: "Hardware", brand: hw.brand, model: hw.model },
        { basic_component: "Kitchen Accessories", brand: kac.brand, model: kac.model },
        { basic_component: "Laminate", brand: fin.brand, model: fin.model },
        { basic_component: "Acrylic", brand: fin.brand, model: fin.model },
      ];

      await estimatesApi.applySmartMaterials(projectId, estimateId, materialsToApply);
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
          Smart Estimate Generator
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
            Plywood
          </div>
          <select value={selPlywood} onChange={e => setSelPlywood(e.target.value)}
            className={`${ddCls} ${selPlywood ? "border-nicara-gold bg-nicara-gold/10 text-white" : "border-stone-600 bg-stone-800/50 text-stone-400"}`}>
            <option className="text-gray-500 bg-white" value="">Select plywood…</option>
            {PLYWOOD_OPTIONS.map(o => <option className="text-black bg-white" key={o.label} value={o.label}>{o.label}</option>)}
          </select>
          {selPlywood && <div className="text-[9px] text-nicara-gold mt-1">Pricing dynamically applies per component size.</div>}
        </div>

        {/* Hardware */}
        <div>
          <div className="text-[10px] font-bold text-stone-300 mb-1.5 flex items-center gap-1">
            Hardware
          </div>
          <select value={selHardware} onChange={e => setSelHardware(e.target.value)}
            className={`${ddCls} ${selHardware ? "border-nicara-gold bg-nicara-gold/10 text-white" : "border-stone-600 bg-stone-800/50 text-stone-400"}`}>
            <option className="text-gray-500 bg-white" value="">Select hardware…</option>
            {HARDWARE_OPTIONS.map(o => <option className="text-black bg-white" key={o.label} value={o.label}>{o.label}</option>)}
          </select>
          {selHardware && <div className="text-[9px] text-nicara-gold mt-1">Hardware specs updated globally.</div>}
        </div>

        {/* Kitchen Accessories */}
        <div>
          <div className="text-[10px] font-bold text-stone-300 mb-1.5 flex items-center gap-1">
            Kitchen Acc.
          </div>
          <select value={selKitchenAcc} onChange={e => setSelKitchenAcc(e.target.value)}
            className={`${ddCls} ${selKitchenAcc ? "border-nicara-gold bg-nicara-gold/10 text-white" : "border-stone-600 bg-stone-800/50 text-stone-400"}`}>
            <option className="text-gray-500 bg-white" value="">Select kitchen accessories…</option>
            {KITCHEN_ACC_OPTIONS.map(o => <option className="text-black bg-white" key={o.label} value={o.label}>{o.label}</option>)}
          </select>
          {selKitchenAcc && <div className="text-[9px] text-nicara-gold mt-1">Kitchen accessories updated.</div>}
        </div>

        {/* Finishing */}
        <div>
          <div className="text-[10px] font-bold text-stone-300 mb-1.5 flex items-center gap-1">
            Finishing
          </div>
          <select value={selFinish} onChange={e => setSelFinish(e.target.value)}
            className={`${ddCls} ${selFinish ? "border-nicara-gold bg-nicara-gold/10 text-white" : "border-stone-600 bg-stone-800/50 text-stone-400"}`}>
            <option className="text-gray-500 bg-white" value="">Select finish…</option>
            {FINISH_OPTIONS.map(o => <option className="text-black bg-white" key={o.label} value={o.label}>{o.label}</option>)}
          </select>
          {selFinish && <div className="text-[9px] text-nicara-gold mt-1">Pricing dynamically applies.</div>}
        </div>
      </div>

      {/* Selected preferences summary */}
      {(selPlywood || selHardware || selKitchenAcc || selFinish) && (
        <div className="px-5 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {[["Plywood", selPlywood], ["Hardware", selHardware],
            ["Kitchen", selKitchenAcc], ["Finish", selFinish]].map(([label, val]) =>
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
            {generating ? "Generating Estimate\u2026" : "Generate Estimate"}
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
