"use client";

import { useMemo, useState } from "react";
import {
  ApiError, catalogApi, designRequirementsApi, estimatesApi, itemsApi,
  type ComponentInput,
} from "@/lib/api";
import type {
  Estimate, EstimateItem, EstimateItemComponent, EstimateType, Item, Project,
} from "@/lib/apiTypes";
import { useApiData, inr, inrExact } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Field } from "@/components/ui/Form";
import SearchSelect from "@/components/ui/SearchSelect";
import CabinetConfigurator from "./CabinetConfigurator";
import { EmptyState, ErrorState, InlineError, Loading, StatusPill } from "@/components/ui/States";
import {
  Download, Upload, FileText, FileSpreadsheet, Send,
  RotateCcw, CheckCircle, Copy, Brain, Plus, Trash2, ChevronDown, ChevronUp,
  ClipboardList, X, Calculator,
} from "lucide-react";

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

  // Items master backing the "Item" dropdown — the same catalogue Design
  // Requirements draws from. Picking one links the line and, if that item is
  // tied to a furniture, pulls its material breakdown.
  const itemsQuery = useApiData(() => itemsApi.list({}), []);
  const masterItems = itemsQuery.data?.results ?? [];
  const createMasterItem = async (name: string): Promise<Item> => {
    const created = await itemsApi.create({ name });
    await itemsQuery.reload();
    return created;
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
      subtotal: items.reduce((s, i) => s + parseFloat(i.total_amount || "0"), 0),
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

      {/* ── Table (spreadsheet-style) ── */}
      <div className="overflow-x-auto border border-surface-200 rounded-xl">
        <table className="w-full text-[11px] min-w-[2400px]">
          <thead>
            <tr className="bg-nicara-dark">
              {[
                "Area", "Item",
                "W(ft)", "W(in)", "H(ft)", "H(in)", "D(ft)", "D(in)",
                "Type", "Specification", "Brand", "Model", "Application", "Specifications",
                "Spec", "Qty", "Unit", "Price", "Price Unit", "Cost",
                "Margin %", "Margin Amt", "Ref %", "Ref Amt",
                "GST %", "GST Amt", "Total", "Flag",
                "Detail", "Del",
              ].map(h => (
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
                masterItems={masterItems}
                itemsLoading={itemsQuery.loading}
                onCreateItem={createMasterItem}
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
              />
            ))}
            {/* Grand total footer */}
            <tr className="bg-nicara-dark">
              <td colSpan={25} className="p-2.5 text-stone-200 font-bold text-right text-xs">
                GRAND TOTAL ({filtered.length} items)
              </td>
              <td className="p-2.5 text-nicara-gold font-extrabold text-right font-mono text-[14px]">
                {inr(String(grouped.reduce((s, g) => s + g.subtotal, 0)))}
              </td>
              <td className="bg-nicara-dark" colSpan={4} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Area group block with header + rows + expandable details ── */

function GroupBlock({
  group, project, estimate, locked, busy, val, setDraft, commit, remove,
  expanded, setExpanded, masterItems, itemsLoading, onCreateItem, onChanged, onError, onAddRow,
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
  masterItems: Item[];
  itemsLoading: boolean;
  onCreateItem: (name: string) => Promise<Item>;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  onAddRow: () => void;
}) {
  const BD = "border-r border-surface-200";
  return (
    <>
      {/* Area header */}
      <tr className="bg-nicara-gold/10">
        <td colSpan={30} className="px-3 py-2">
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
            masterItems={masterItems}
            itemsLoading={itemsLoading}
            onCreateItem={onCreateItem}
            onChanged={onChanged}
            onError={onError}
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
  item, ri, isOpen, project, estimate, locked, busy, val, setDraft, commit, remove,
  masterItems, itemsLoading, onCreateItem, onChanged, onError, onToggle, BD,
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
  masterItems: Item[];
  itemsLoading: boolean;
  onCreateItem: (name: string) => Promise<Item>;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  onToggle: () => void;
  BD: string;
}) {
  // Picking a master item names the line, copies its rate/unit, and — when the
  // item is linked to a furniture — pulls that furniture's material breakdown.
  const applyMaster = async (master: Item) => {
    try {
      // Copy defaults: name, rate, unit AND dimensions + quantity
      await estimatesApi.updateItem(project.id, estimate.id, item.id, {
        item: master.name,
        rate: master.default_rate,
        unit: master.unit,
        length: master.default_length || "",
        breadth: master.default_breadth || "",
        height: master.default_height || "",
        qty: master.default_qty || "1",
      });
      if (master.catalog_furniture) {
        await estimatesApi.populateFromFurniture(project.id, estimate.id, item.id, master.catalog_furniture);
      } else if (!parseFloat(master.default_rate)) {
        // Unpriced cabinet/drawer item: start from the default template so the
        // line gets a baseline cost (the server skips non-cabinet items).
        await estimatesApi.configure(project.id, estimate.id, item.id, { auto: true });
      }
      await onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not apply the item.");
    }
  };

  const createAndApply = async (name: string) => {
    try {
      const master = await onCreateItem(name);
      await estimatesApi.updateItem(project.id, estimate.id, item.id, { item: master.name });
      await estimatesApi.configure(project.id, estimate.id, item.id, { auto: true });
      await onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not add the item.");
    }
  };

  return (
    <>
      <tr className={`border-b border-surface-100 ${isOpen ? "bg-nicara-gold/5 border-l-[3px] border-l-nicara-gold" : ri % 2 === 0 ? "bg-white" : "bg-surface-50/50"}`}>
        {/* Area */}
        <td className={`px-2 py-1.5 font-semibold text-nicara-dark ${BD}`}>
          <EditableCell locked={locked} value={val(item, "area")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], area: v } }))}
            onCommit={() => commit(item)} placeholder="Room" />
        </td>
        {/* Item — searchable Items dropdown with inline add */}
        <td className={`px-2 py-1.5 font-semibold text-nicara-dark min-w-[160px] ${BD}`}>
          {locked ? (
            <div className="px-2 py-1.5 font-semibold text-nicara-dark">{val(item, "item") || "—"}</div>
          ) : (
            <SearchSelect
              value={val(item, "item")}
              options={masterItems}
              loading={itemsLoading}
              getLabel={i => i.name}
              getSublabel={i => [i.category_name, i.catalog_furniture_name && `⇄ ${i.catalog_furniture_name}`].filter(Boolean).join(" · ")}
              placeholder="Item name"
              className="w-full px-2 py-1.5 border border-transparent rounded-lg text-[11px] font-semibold text-nicara-dark bg-transparent outline-none focus:border-nicara-gold focus:bg-white cursor-text"
              onPick={applyMaster}
              onCreate={createAndApply}
            />
          )}
          {item.catalog_item_code && (
            <div className="px-2 text-[9px] text-surface-300 font-mono">{item.catalog_item_code}</div>
          )}
        </td>
        {/* Width ft/in */}
        {(["width_ft", "width_in", "height_ft", "height_in", "depth_ft", "depth_in"] as const).map(dim => (
          <td key={dim} className={`px-2 py-1.5 w-[42px] ${BD}`}>
            <EditableCell locked={locked} value={String(val(item, dim) || "0")} mono type="number"
              onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], [dim]: parseInt(v) || 0 } }))}
              onCommit={() => commit(item)} />
          </td>
        ))}
        {/* Type */}
        <td className={`px-2 py-1.5 min-w-[100px] ${BD}`}>
          {locked ? (
            <span className="text-surface-600">{item.item_type || "—"}</span>
          ) : (
            <select
              value={val(item, "item_type")}
              onChange={e => { setDraft(d => ({ ...d, [item.id]: { ...d[item.id], item_type: e.target.value } })); setTimeout(() => commit(item), 0); }}
              className="w-full px-1.5 py-1 border border-transparent rounded-lg text-[10px] bg-transparent outline-none focus:border-nicara-gold focus:bg-white cursor-pointer"
            >
              <option value="">—</option>
              <option value="Procurement">Procurement</option>
              <option value="Service">Service</option>
              <option value="Spec Purpose">Spec Purpose</option>
              <option value="Procurement cum Service">Procurement cum Service</option>
            </select>
          )}
        </td>
        {/* Specification */}
        <td className={`px-2 py-1.5 min-w-[140px] ${BD}`}>
          <EditableCell locked={locked} value={val(item, "specification")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], specification: v } }))}
            onCommit={() => commit(item)} placeholder="Spec" />
        </td>
        {/* Brand */}
        <td className={`px-2 py-1.5 min-w-[80px] ${BD}`}>
          <EditableCell locked={locked} value={val(item, "brand")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], brand: v } }))}
            onCommit={() => commit(item)} placeholder="Brand" />
        </td>
        {/* Model */}
        <td className={`px-2 py-1.5 min-w-[120px] ${BD}`}>
          <EditableCell locked={locked} value={val(item, "model_name")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], model_name: v } }))}
            onCommit={() => commit(item)} placeholder="Model" />
        </td>
        {/* Application */}
        <td className={`px-2 py-1.5 min-w-[100px] ${BD}`}>
          <EditableCell locked={locked} value={val(item, "application")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], application: v } }))}
            onCommit={() => commit(item)} placeholder="Application" />
        </td>
        {/* Specifications (auto-generated, read-only) */}
        <td className={`px-2 py-1.5 text-[10px] text-surface-500 min-w-[180px] ${BD}`}>
          {item.specifications_text || "—"}
        </td>
        {/* Estimate Spec Flag */}
        <td className={`px-2 py-1.5 text-center w-[40px] ${BD}`}>
          {locked ? (
            <span>{item.estimate_spec_flag ? "1" : "0"}</span>
          ) : (
            <input type="checkbox" checked={!!item.estimate_spec_flag}
              onChange={e => {
                setDraft(d => ({ ...d, [item.id]: { ...d[item.id], estimate_spec_flag: e.target.checked } }));
                setTimeout(() => commit(item), 0);
              }}
              className="w-3.5 h-3.5 accent-nicara-gold cursor-pointer" />
          )}
        </td>
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
        {/* Price (rate) */}
        <td className={`px-2 py-1.5 w-[70px] text-right font-mono ${BD}`}>
          <EditableCell locked={locked} value={val(item, "rate")} mono type="number"
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], rate: v } }))}
            onCommit={() => commit(item)} />
        </td>
        {/* Price Unit */}
        <td className={`px-2 py-1.5 w-[70px] ${BD}`}>
          <EditableCell locked={locked} value={val(item, "price_unit")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], price_unit: v } }))}
            onCommit={() => commit(item)} placeholder="per unit" />
        </td>
        {/* Cost (read-only: qty × rate) */}
        <td className={`px-2 py-1.5 text-right font-mono font-semibold text-nicara-dark whitespace-nowrap ${BD}`}>
          {inr(item.cost)}
        </td>
        {/* Margin % */}
        <td className={`px-2 py-1.5 w-[50px] text-right font-mono ${BD}`}>
          <EditableCell locked={locked} value={val(item, "margin_pct")} mono type="number"
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], margin_pct: v } }))}
            onCommit={() => commit(item)} />
        </td>
        {/* Margin Amount (read-only) */}
        <td className={`px-2 py-1.5 text-right font-mono text-surface-600 whitespace-nowrap ${BD}`}>
          {inr(item.margin_amount)}
        </td>
        {/* Referral % */}
        <td className={`px-2 py-1.5 w-[50px] text-right font-mono ${BD}`}>
          <EditableCell locked={locked} value={val(item, "referral_pct")} mono type="number"
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], referral_pct: v } }))}
            onCommit={() => commit(item)} />
        </td>
        {/* Referral Amount (read-only) */}
        <td className={`px-2 py-1.5 text-right font-mono text-surface-600 whitespace-nowrap ${BD}`}>
          {inr(item.referral_amount)}
        </td>
        {/* GST % */}
        <td className={`px-2 py-1.5 text-center text-surface-500 w-[45px] ${BD}`}>
          {parseFloat(item.gst_pct)}%
        </td>
        {/* GST Amount (read-only) */}
        <td className={`px-2 py-1.5 text-right font-mono text-surface-500 whitespace-nowrap ${BD}`}>
          {inr(item.gst_amount)}
        </td>
        {/* Total Amount (read-only) */}
        <td className={`px-2 py-1.5 text-right font-bold text-nicara-gold font-mono whitespace-nowrap ${BD}`}>
          {inr(item.total_amount)}
        </td>
        {/* Flag */}
        <td className={`px-2 py-1.5 text-center w-[40px] ${BD}`}>
          {locked ? (
            <span>{item.flag ? "🚩" : ""}</span>
          ) : (
            <input type="checkbox" checked={!!item.flag}
              onChange={e => {
                setDraft(d => ({ ...d, [item.id]: { ...d[item.id], flag: e.target.checked } }));
                setTimeout(() => commit(item), 0);
              }}
              className="w-3.5 h-3.5 accent-red-500 cursor-pointer" />
          )}
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
          <td colSpan={30} className="p-0">
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
  const [configuring, setConfiguring] = useState(false);
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
            <button onClick={() => setConfiguring(c => !c)}
              className={`flex items-center gap-1 px-2.5 py-1 border rounded-lg text-[10px] font-semibold cursor-pointer ${configuring
                ? "bg-nicara-dark border-nicara-dark text-nicara-gold"
                : "bg-white border-amber-300 text-amber-700 hover:bg-amber-100"}`}>
              <Calculator size={11} /> {item.config ? "Edit Calculation" : "Cabinet Calculator"}
            </button>
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

      {configuring && !locked && (
        <CabinetConfigurator
          project={project} estimate={estimate} item={item}
          onApplied={onChanged} onClose={() => setConfiguring(false)} />
      )}
      {item.config && !configuring && (
        <div className="mb-2 text-[10px] text-amber-700">
          Calculated from: {(item.config.quantity ?? 1) > 1 ? `${item.config.quantity} × ` : ""}{item.config.template.replace(/_/g, " ")} · {Math.round(item.config.length)}×{Math.round(item.config.depth)}×{Math.round(item.config.height)} mm
          · {item.config.drawers} drawer(s), {item.config.doors} door(s), {item.config.shelves} shelf(s)
          · {item.config.carcass_thickness}mm carcass on {item.config.board} sheets · {item.config.finish}
          · +{item.config.wastage_pct ?? 0}% waste, {item.config.margin_pct ?? 0}% margin
        </div>
      )}

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
   SMART ESTIMATE GENERATOR — Picks items from catalogue, auto-fills
   BOM via add-from-catalog (which triggers populate_line_from_furniture)
   ══════════════════════════════════════════════════════════════════ */

function SmartEstimateGenerator({
  projectId, estimateId, disabled, onGenerated, onError,
}: {
  projectId: number;
  estimateId: number;
  disabled: boolean;
  onGenerated: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  // Fetch real items from catalogue
  const itemsQuery = useApiData(() => itemsApi.list({}), []);
  const masterItems: Item[] = itemsQuery.data?.results ?? [];

  // Group items by category
  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    masterItems.forEach(item => {
      const cat = item.category_name || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    });
    return Array.from(map.entries());
  }, [masterItems]);

  // Track selected items with area + qty overrides
  const [selected, setSelected] = useState<Map<number, { area: string; qty: number }>>(new Map());

  const toggle = (item: Item) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, { area: item.default_room || "", qty: parseFloat(item.default_qty) || 1 });
      return next;
    });
  };

  const update = (id: number, patch: Partial<{ area: string; qty: number }>) => {
    setSelected(prev => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) next.set(id, { ...existing, ...patch });
      return next;
    });
  };

  const generate = async () => {
    if (selected.size === 0) return;
    setGenerating(true);
    try {
      const selections = [...selected.entries()].map(([item_id, v]) => ({
        item_id, area: v.area, qty: v.qty,
      }));
      await estimatesApi.addFromCatalog(projectId, estimateId, selections);
      await onGenerated();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Failed to generate estimate.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mb-4 bg-gradient-to-br from-nicara-dark to-[#2a1f18] rounded-2xl overflow-hidden border border-stone-700">
      {/* Header */}
      <div className="px-5 py-3 border-b border-stone-700">
        <div className="text-[14px] font-bold text-white flex items-center gap-2">
          <Brain size={16} /> Smart Estimate Generator
        </div>
        <div className="text-[11px] text-stone-400 mt-0.5">
          Select items for a typical scope — each item auto-populates its full material breakdown (BOM) from the catalogue
        </div>
      </div>

      {/* Items grouped by category */}
      <div className="max-h-[380px] overflow-y-auto">
        {itemsQuery.loading && <div className="p-4 text-center text-stone-400 text-[11px]">Loading catalogue…</div>}
        {grouped.map(([cat, items]) => (
          <div key={cat}>
            <div className="px-5 py-1.5 bg-stone-800/60 text-[10px] font-bold text-stone-300 uppercase tracking-wider border-b border-stone-700">
              {items[0]?.category_icon} {cat} ({items.length})
            </div>
            {items.map(item => {
              const picked = selected.get(item.id);
              const dims = [item.default_length, item.default_breadth, item.default_height].filter(d => d && d !== "—" && d !== "-").join(" × ");
              return (
                <div key={item.id}
                  className={`flex items-center gap-3 px-5 py-2 border-b border-stone-700/50 transition-colors ${
                    picked ? "bg-nicara-gold/10" : "hover:bg-stone-800/40"
                  }`}>
                  <input type="checkbox" checked={!!picked} onChange={() => toggle(item)}
                    className="w-3.5 h-3.5 accent-nicara-gold cursor-pointer flex-shrink-0" />
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggle(item)}>
                    <div className="text-[11px] font-semibold text-white truncate">
                      {item.name}
                      {item.catalog_furniture_name && (
                        <span className="ml-1.5 text-[9px] text-nicara-gold font-normal">⇄ {item.catalog_furniture_name}</span>
                      )}
                    </div>
                    <div className="text-[9px] text-stone-400 truncate">
                      {dims && <span className="font-mono mr-2">{dims}</span>}
                      {item.description}
                    </div>
                  </div>
                  <div className="text-[11px] text-nicara-gold font-semibold whitespace-nowrap">
                    {inr(item.default_rate)}<span className="text-[9px] text-stone-400">/{item.unit}</span>
                  </div>
                  {picked && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input value={picked.area} onChange={e => update(item.id, { area: e.target.value })}
                        placeholder="Room"
                        className="w-[110px] px-2 py-1 bg-stone-800 border border-stone-600 rounded-lg text-[10px] text-white outline-none focus:border-nicara-gold" />
                      <input type="number" value={picked.qty}
                        onChange={e => update(item.id, { qty: parseFloat(e.target.value) || 0 })}
                        className="w-[50px] px-2 py-1 bg-stone-800 border border-stone-600 rounded-lg text-[10px] text-white font-mono outline-none focus:border-nicara-gold" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected count + Generate */}
      <div className="px-5 py-3 border-t border-stone-700 flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {selected.size > 0 && (
            <span className="text-[11px] text-stone-300">
              {selected.size} item(s) selected — each will auto-generate its material breakdown
            </span>
          )}
        </div>
        <button onClick={generate} disabled={disabled || generating || selected.size === 0}
          className="px-6 py-2.5 bg-nicara-gold border-none rounded-xl text-white text-[12px] font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50">
          {generating ? "Generating…" : `Generate ${selected.size > 0 ? `${selected.size} Item(s)` : "Estimate"}`}
        </button>
      </div>
    </div>
  );
}
