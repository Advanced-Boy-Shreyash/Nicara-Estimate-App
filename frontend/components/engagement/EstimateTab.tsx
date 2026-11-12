"use client";

import { Fragment, useMemo, useState } from "react";
import {
  ApiError, catalogApi, estimatesApi, libraryApi,
  type ComponentInput,
} from "@/lib/api";
import type {
  CalcOptions, Estimate, EstimateItem, EstimateItemComponent, EstimateType, Furniture, LibraryItem, Project,
} from "@/lib/apiTypes";
import { useApiData, inr, inrExact } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Field } from "@/components/ui/Form";
import SearchSelect from "@/components/ui/SearchSelect";
import { OptionsControls } from "@/components/catalog/FurnitureTab";
import { EmptyState, ErrorState, InlineError, Loading, StatusPill } from "@/components/ui/States";
import {
  Download, Upload, FileText, FileSpreadsheet, Send,
  RotateCcw, CheckCircle, Copy, Brain, Plus, Trash2, ChevronDown, ChevronUp,
  ClipboardList, X, Armchair, RefreshCw,
  Pencil,
} from "lucide-react";

const CELL = "w-full px-2 py-1.5 border border-transparent rounded-lg text-[11px] bg-transparent outline-none focus:border-nicara-gold focus:bg-white";
const TH = "px-2 py-2 text-stone-200 font-semibold text-[10px] text-left whitespace-nowrap border-r border-stone-700";

type EstimateDisplayEntry =
  | { kind: "furniture"; key: string; rows: EstimateItem[] }
  | { kind: "line"; item: EstimateItem };

type EstimateCatalogOption =
  | { kind: "furniture"; id: number; label: string; detail: string; furniture: Furniture }
  | { kind: "material"; id: number; label: string; detail: string; material: LibraryItem };

function estimateDisplayEntries(items: EstimateItem[], groupFurniture: boolean): EstimateDisplayEntry[] {
  const entries: EstimateDisplayEntry[] = [];
  const furnitureIndexes = new Map<string, number>();

  for (const item of items) {
    if (!groupFurniture || !item.group_key) {
      entries.push({ kind: "line", item });
      continue;
    }

    const index = furnitureIndexes.get(item.group_key);
    if (index === undefined) {
      furnitureIndexes.set(item.group_key, entries.length);
      entries.push({ kind: "furniture", key: item.group_key, rows: [item] });
    } else {
      const entry = entries[index];
      if (entry?.kind === "furniture") entry.rows.push(item);
    }
  }

  return entries;
}

function totalOf(rows: EstimateItem[], field: keyof EstimateItem) {
  return rows.reduce((total, row) => total + (parseFloat(String(row[field] ?? "0")) || 0), 0);
}

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
  const [importing, setImporting] = useState(false);
  const [showGenerator, setShowGenerator] = useState(type === "initial");
  const [populating, setPopulating] = useState(false);
  const [addingFurniture, setAddingFurniture] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);
  const [appliedPricingEstimateId, setAppliedPricingEstimateId] = useState<number | null>(null);
  const [pendingRecalcGroups, setPendingRecalcGroups] = useState<Set<string>>(() => new Set());

  const listQuery = useApiData(() => estimatesApi.list(project.id, type), [project.id, type]);
  const versions = useMemo(() => listQuery.data?.results ?? [], [listQuery.data]);
  const activeId = selectedId ?? versions[0]?.id ?? null;

  const detailQuery = useApiData(
    async () => (activeId ? estimatesApi.get(project.id, activeId) : null),
    [project.id, activeId]
  );
  const estimate = detailQuery.data;
  const furnitureGroups = useMemo(() => {
    if (!estimate) return [];
    const groups = new Map<string, EstimateItem>();
    for (const item of estimate.items) {
      if (item.group_key && !groups.has(item.group_key)) groups.set(item.group_key, item);
    }
    return [...groups.entries()];
  }, [estimate]);
  const sizesSelected = furnitureGroups.every(([, item]) =>
    item.width_ft + item.width_in / 12 > 0
    && item.height_ft + item.height_in / 12 > 0
    && item.depth_ft + item.depth_in / 12 > 0
  );
  const missingSizeGroups = furnitureGroups
    .filter(([, item]) =>
      item.width_ft + item.width_in / 12 <= 0
      || item.height_ft + item.height_in / 12 <= 0
      || item.depth_ft + item.depth_in / 12 <= 0
    )
    .map(([, item]) => item.item || item.furniture_name || "Furniture");
  const pendingGroups = furnitureGroups
    .filter(([groupKey]) => pendingRecalcGroups.has(groupKey))
    .map(([, item]) => item.item || item.furniture_name || "Furniture");
  const priceReadinessReasons = [
    appliedPricingEstimateId !== estimate?.id
      ? "Apply the current Smart Estimate brand selections."
      : "",
    missingSizeGroups.length
      ? `Enter width, height, and depth for: ${missingSizeGroups.join(", ")}.`
      : "",
    pendingGroups.length
      ? `Click Recalculate for: ${pendingGroups.join(", ")}.`
      : "",
  ].filter(Boolean);
  const pricesReady = type !== "initial" || (
    !!estimate
    && appliedPricingEstimateId === estimate.id
    && sizesSelected
    && pendingGroups.length === 0
  );
  const pricesHiddenMessage = priceReadinessReasons.length
    ? `Prices are hidden. ${priceReadinessReasons.join(" ")}`
    : "Prices are hidden until the estimate finishes recalculating.";
  const setGroupPricingPending = (groupKey: string, pending: boolean) => {
    setPendingRecalcGroups(previous => {
      const next = new Set(previous);
      if (pending) next.add(groupKey);
      else next.delete(groupKey);
      return next;
    });
  };

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
              <div className="text-2xl font-extrabold text-nicara-gold">
                {pricesReady ? inrExact(estimate.grand_total) : "Prices hidden"}
              </div>
              <div className="text-[11px] text-surface-500">
                {pricesReady
                  ? `${estimate.item_count} items · inc GST`
                  : pricesHiddenMessage}
              </div>
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
            <Btn variant="ghost" disabled={busy || locked}
              onClick={() => {
                setAppliedPricingEstimateId(null);
                return guard(
                () => estimatesApi.addItem(project.id, estimate.id, {
                  area: "", item: "New line", qty: 1, rate: 0, unit: "unit", gst_pct: 18,
                }),
                "Blank line added"
                );
              }}>
              <Plus size={13} /> Blank Line
            </Btn>
            <Btn variant="ghost" disabled={busy || locked}
              onClick={() => setShowGenerator(!showGenerator)}>
              {showGenerator
                ? <><X size={13} /> {type === "initial" ? "Hide Generator" : "Close Generator"}</>
                : <><Brain size={13} /> Smart Generator</>}
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
            <Btn disabled={busy || locked || populating}
              onClick={async () => {
                setPopulating(true);
                setAppliedPricingEstimateId(null);
                setBanner("");
                try {
                  const res = await estimatesApi.generateFromDesign(project.id, estimate.id);
                  await refresh();
                  if (res.created + res.updated === 0) {
                    setBanner(res.skipped.length
                      ? `No design requirement is linked to catalogue furniture yet (${res.skipped.slice(0, 4).join(", ")}…). Pick a furniture for each row in Design Requirements.`
                      : "No design requirements found. Add them first.");
                  } else {
                    toast.success("Calculated from Design Requirements", res.detail);
                  }
                } catch (e) {
                  setBanner(e instanceof ApiError ? e.message : "Could not generate the estimate.");
                } finally {
                  setPopulating(false);
                }
              }}>
              {populating ? "Calculating…" : <><ClipboardList size={13} /> Generate from Design Req</>}
            </Btn>
            <Btn variant="ghost" disabled={busy || locked} onClick={() => setAddingFurniture(true)}>
              <Armchair size={13} /> Add Furniture
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
              onApplied={() => {
                setAppliedPricingEstimateId(estimate.id);
                setPendingRecalcGroups(new Set());
              }}
              onSelectionsChanged={() => setAppliedPricingEstimateId(null)}
              onGenerated={async () => {
                await refresh();
                setShowGenerator(type === "initial");
                toast.success("Applied", "Chosen brands applied to the estimate rows");
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
            initialEstimate={type === "initial"}
            pricesVisible={pricesReady}
            onInvalidatePricing={() => setAppliedPricingEstimateId(null)}
            onGroupPricingPending={setGroupPricingPending}
          />

          {pricesReady
            ? <Totals estimate={estimate} />
            : <div className="mt-4 text-right text-[11px] text-surface-500" aria-live="polite">
              {pricesHiddenMessage}
            </div>}
        </>
      )}

      {addingFurniture && estimate && (
        <AddFurnitureModal
          onClose={() => setAddingFurniture(false)}
          onAdd={async body => {
            setAddingFurniture(false);
            setAppliedPricingEstimateId(null);
            await guard(() => estimatesApi.addFurniture(project.id, estimate.id, body), "Furniture added");
          }}
        />
      )}

      {importing && estimate && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={async () => {
            setImporting(false);
            setAppliedPricingEstimateId(null);
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
  project, estimate, locked, busy, onChanged, onError, initialEstimate,
  pricesVisible, onInvalidatePricing, onGroupPricingPending,
}: {
  project: Project;
  estimate: Estimate;
  locked: boolean;
  busy: boolean;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  initialEstimate: boolean;
  pricesVisible: boolean;
  onInvalidatePricing: () => void;
  onGroupPricingPending: (groupKey: string, pending: boolean) => void;
}) {
  const [draft, setDraft] = useState<Record<number, Record<string, unknown>>>({});
  const [fArea, setFArea] = useState("All");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [changingItemIds, setChangingItemIds] = useState<Set<number>>(() => new Set());
  const catalogOptions = useApiData(async (): Promise<EstimateCatalogOption[]> => {
    if (!initialEstimate) return [];
    const [furniture, materials] = await Promise.all([
      catalogApi.furniture(),
      libraryApi.items({ is_active: true, page_size: 500 }),
    ]);
    return [
      ...furniture.results.filter(item => item.is_active).map(item => ({
        kind: "furniture" as const,
        id: item.id,
        label: item.name,
        detail: `Furniture Catalogue · ${item.cabinet_type_display}`,
        furniture: item,
      })),
      ...materials.results.map(item => ({
        kind: "material" as const,
        id: item.id,
        label: item.full_display || [item.category_name, item.model_name].filter(Boolean).join(" — "),
        detail: `Raw Material · ${item.category_name} · ${item.default_unit}`,
        material: item,
      })),
    ];
  }, [initialEstimate]);

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

  const addFurnitureForLine = async (item: EstimateItem, furniture: Furniture, replaceGroup = false) => {
    const dimension = (feet: number, inches: number) =>
      feet || inches ? `${feet}'${inches}"` : undefined;
    if (changingItemIds.has(item.id)) return;
    onInvalidatePricing();
    setChangingItemIds(previous => new Set(previous).add(item.id));
    try {
      try {
        await estimatesApi.addFurniture(project.id, estimate.id, {
          furniture_id: furniture.id,
          area: item.area,
          zone: item.zone || undefined,
          item: item.furniture && item.item && item.item !== item.furniture_name
            ? item.item
            : undefined,
          width: dimension(item.width_ft, item.width_in),
          height: dimension(item.height_ft, item.height_in),
          depth: dimension(item.depth_ft, item.depth_in),
          options: item.config ?? {},
        });
      } catch (e) {
        onError(e instanceof ApiError ? e.message : "Could not add the selected furniture.");
        return;
      }

      try {
        if (replaceGroup && item.group_key) {
          await estimatesApi.deleteGroup(project.id, estimate.id, item.group_key);
        } else {
          await estimatesApi.deleteItem(project.id, estimate.id, item.id);
        }
      } catch (e) {
        await onChanged();
        const message = e instanceof ApiError ? e.message : "Could not remove the previous item.";
        onError(`Furniture was added, but the previous item could not be removed: ${message}`);
        return;
      }
      await onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Furniture was added, but the estimate could not be refreshed.");
    } finally {
      setChangingItemIds(previous => {
        const next = new Set(previous);
        next.delete(item.id);
        return next;
      });
    }
  };

  const selectCatalogOption = async (item: EstimateItem, option: EstimateCatalogOption) => {
    if (option.kind === "furniture") {
      if (item.furniture === option.furniture.id) return;
      await addFurnitureForLine(item, option.furniture);
      return;
    }

    if (changingItemIds.has(item.id)) return;
    onInvalidatePricing();
    setChangingItemIds(previous => new Set(previous).add(item.id));
    try {
      await estimatesApi.updateItem(project.id, estimate.id, item.id, {
        item: option.material.full_display || option.label,
        description: option.material.description,
        category: option.material.category_name,
        specification: option.material.description || option.material.category_name,
        brand: option.material.brand_name,
        model_name: option.material.model_name,
        item_type: "Procurement",
        unit: option.material.default_unit,
        price_unit: option.material.default_unit,
        rate: option.material.default_rate,
        margin_pct: option.material.margin_pct,
        gst_pct: option.material.gst_pct,
        raw_material: option.material.id,
      });
      await onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not apply the raw material.");
    } finally {
      setChangingItemIds(previous => {
        const next = new Set(previous);
        next.delete(item.id);
        return next;
      });
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
      entries: estimateDisplayEntries(items, initialEstimate),
      subtotal: items.reduce((s, i) => s + parseFloat(i.total_amount || "0"), 0),
    }));
  }, [filtered, initialEstimate]);
  const visibleItemCount = grouped.reduce((sum, group) => sum + group.entries.length, 0);

  if (estimate.items.length === 0) {
    return (
      <EmptyState icon="" title="No line items yet"
        hint={'Use "Generate from Design Req" or "Add Furniture" to calculate rows from the catalogue.'} />
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
        <span className="ml-auto text-[11px] text-surface-400">{visibleItemCount}/{estimateDisplayEntries(estimate.items, initialEstimate).length} items</span>
      </div>
      {initialEstimate && catalogOptions.error && (
        <InlineError message={`Could not load Furniture Catalogue / Raw Materials: ${catalogOptions.error}`} />
      )}

      {/* ── Table (spreadsheet-style) ── */}
      <div className="overflow-x-auto border border-surface-200 rounded-xl">
        <table className="w-full text-[11px] min-w-[2480px]">
          <thead>
            <tr className="bg-nicara-dark">
              {[
                "Area", "Item",
                "W(ft)", "W(in)", "H(ft)", "H(in)", "D(ft)", "D(in)",
                "Type", "Specification", "Brand", "Model", ...(!initialEstimate ? ["Application"] : []),
                ...(!initialEstimate ? ["Specifications"] : []),
                ...(!initialEstimate ? ["Spec"] : []),
                "Qty", "Unit", "Price", "Price Unit", "Cost",
                "Margin %", "Margin Amt", "Ref %", "Ref Amt",
                "GST %", "GST Amt", "Total",
                ...(!initialEstimate ? ["Flag"] : []),
                initialEstimate ? "Materials" : "Detail", "Del",
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
                onChanged={onChanged}
                onError={onError}
                initialEstimate={initialEstimate}
                pricesVisible={pricesVisible}
                onInvalidatePricing={onInvalidatePricing}
                onGroupPricingPending={onGroupPricingPending}
                catalogOptions={catalogOptions.data ?? []}
                catalogLoading={catalogOptions.loading}
                changingItemIds={changingItemIds}
                onSelectCatalogOption={selectCatalogOption}
                onChangeFurniture={(item, furniture) => addFurnitureForLine(item, furniture, true)}
                onAddRow={async () => {
                  try {
                    onInvalidatePricing();
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
              <td colSpan={initialEstimate ? 23 : 26} className="p-2.5 text-stone-200 font-bold text-right text-xs">
              GRAND TOTAL ({visibleItemCount} items)
              </td>
              <td className="p-2.5 text-nicara-gold font-extrabold text-right font-mono text-[14px]">
                {pricesVisible ? inr(String(grouped.reduce((s, g) => s + g.subtotal, 0))) : "—"}
              </td>
              <td className="bg-nicara-dark" colSpan={initialEstimate ? 2 : 3} />
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
  expanded, setExpanded, onChanged, onError, onAddRow, initialEstimate,
  catalogOptions, catalogLoading, changingItemIds, onSelectCatalogOption, onChangeFurniture,
  pricesVisible, onInvalidatePricing, onGroupPricingPending,
}: {
  group: { area: string; items: EstimateItem[]; entries: EstimateDisplayEntry[]; subtotal: number };
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
  initialEstimate: boolean;
  catalogOptions: EstimateCatalogOption[];
  catalogLoading: boolean;
  changingItemIds: Set<number>;
  onSelectCatalogOption: (item: EstimateItem, option: EstimateCatalogOption) => void;
  onChangeFurniture: (item: EstimateItem, furniture: Furniture) => void;
  pricesVisible: boolean;
  onInvalidatePricing: () => void;
  onGroupPricingPending: (groupKey: string, pending: boolean) => void;
}) {
  const BD = "border-r border-surface-200";
  return (
    <>
      {/* Area header */}
      <tr className="bg-nicara-gold/10">
        <td colSpan={initialEstimate ? 26 : 30} className="px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-nicara-dark uppercase tracking-wider">{group.area}</span>
            <span className="text-[10px] text-surface-400">{group.entries.length} item(s)</span>
            <span className="text-[10px] font-semibold text-nicara-gold ml-auto mr-3">
              {pricesVisible ? inr(String(group.subtotal)) : "—"}
            </span>
            {!locked && (
              <button onClick={onAddRow}
                className="px-2.5 py-1 bg-white border border-surface-200 rounded-lg text-[10px] font-semibold text-nicara-gold cursor-pointer hover:bg-nicara-gold/5 hover:border-nicara-gold/30">
                + Add Row
              </button>
            )}
          </div>
        </td>
      </tr>
      {/* Initial Estimate furniture is one room item; its generated rows live in the breakdown. */}
      {group.entries.map((entry, ri) => {
        if (entry.kind === "furniture") {
          const first = entry.rows[0];
          if (!first) return null;
          const isOpen = expanded[first.id] ?? false;
          const optionKey = [
            first.config?.shelf_type ?? "ply",
            !!first.config?.handleless,
            !!first.config?.one_side_visible,
          ].join(".");
          return (
            <InitialEstimateFurnitureGroup
              key={`${entry.key}:${[first.width_ft, first.width_in, first.height_ft, first.height_in,
                first.depth_ft, first.depth_in].join(".")}:${optionKey}`}
              rows={entry.rows}
              project={project}
              estimate={estimate}
              locked={locked}
              busy={busy}
              expanded={isOpen}
              stripe={ri % 2 !== 0}
              val={val}
              setDraft={setDraft}
              commit={commit}
              remove={remove}
              onToggle={() => setExpanded(previous => ({ ...previous, [first.id]: !previous[first.id] }))}
              onChanged={onChanged}
              onError={onError}
              pricesVisible={pricesVisible}
              onGroupPricingPending={onGroupPricingPending}
              furnitureOptions={catalogOptions
                .filter((option): option is Extract<EstimateCatalogOption, { kind: "furniture" }> => option.kind === "furniture")
                .map(option => option.furniture)}
              catalogLoading={catalogLoading || changingItemIds.has(first.id)}
              onChangeFurniture={furniture => {
                onInvalidatePricing();
                onChangeFurniture(first, furniture);
              }}
            />
          );
        }

        const item = entry.item;
        const isOpen = expanded[item.id] ?? false;
        const previous = group.items[ri - 1];
        const startsGroup = !initialEstimate && !!item.group_key
          && (ri === 0 || previous?.group_key !== item.group_key);
        const furnitureRows = startsGroup
          ? group.items.filter(row => row.group_key === item.group_key)
          : [];
        return (
          <Fragment key={`line-${item.id}`}>
            {startsGroup && (
              <FurnitureGroupHeader
                key={`${item.group_key}:${[item.width_ft, item.width_in, item.height_ft, item.height_in,
                  item.depth_ft, item.depth_in].join(".")}:${JSON.stringify(item.config ?? {})}`}
                rows={furnitureRows}
                project={project}
                estimate={estimate}
                locked={locked}
                onChanged={onChanged}
                onError={onError}
                initialEstimate={initialEstimate}
              />
            )}
            <ItemRow
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
              onToggle={() => setExpanded(previous => ({ ...previous, [item.id]: !previous[item.id] }))}
              BD={BD}
              initialEstimate={initialEstimate}
              pricesVisible={pricesVisible}
              catalogOptions={catalogOptions}
              catalogLoading={catalogLoading || changingItemIds.has(item.id)}
              onSelectCatalogOption={onSelectCatalogOption}
            />
          </Fragment>
        );
      })}
    </>
  );
}

type FurnitureDimensions = Pick<EstimateItem, "width_ft" | "width_in" | "height_ft" | "height_in" | "depth_ft" | "depth_in">;

function InitialEstimateFurnitureGroup({
  rows, project, estimate, locked, busy, expanded, stripe, val, setDraft, commit, remove,
  onToggle, onChanged, onError, furnitureOptions, catalogLoading, onChangeFurniture,
  pricesVisible, onGroupPricingPending,
}: {
  rows: EstimateItem[];
  project: Project;
  estimate: Estimate;
  locked: boolean;
  busy: boolean;
  expanded: boolean;
  stripe: boolean;
  val: (item: EstimateItem, key: string) => string;
  setDraft: React.Dispatch<React.SetStateAction<Record<number, Record<string, unknown>>>>;
  commit: (item: EstimateItem) => Promise<void>;
  remove: (item: EstimateItem) => Promise<void>;
  onToggle: () => void;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  furnitureOptions: Furniture[];
  catalogLoading: boolean;
  onChangeFurniture: (furniture: Furniture) => void;
  pricesVisible: boolean;
  onGroupPricingPending: (groupKey: string, pending: boolean) => void;
}) {
  const first = rows[0];
  const initialSize: FurnitureDimensions = {
    width_ft: first.width_ft,
    width_in: first.width_in,
    height_ft: first.height_ft,
    height_in: first.height_in,
    depth_ft: first.depth_ft,
    depth_in: first.depth_in,
  };
  const [size, setSize] = useState(initialSize);
  const [options, setOptions] = useState<CalcOptions>(first.config ?? {});
  const [saving, setSaving] = useState(false);
  const savedOptions = first.config ?? {};
  const dirty = JSON.stringify(size) !== JSON.stringify(initialSize)
    || (options.shelf_type ?? "ply") !== (savedOptions.shelf_type ?? "ply")
    || !!options.handleless !== !!savedOptions.handleless
    || !!options.one_side_visible !== !!savedOptions.one_side_visible;
  const sizeIsDirty = JSON.stringify(size) !== JSON.stringify(initialSize);
  const optionsAreDirty = (next: CalcOptions) =>
    (next.shelf_type ?? "ply") !== (savedOptions.shelf_type ?? "ply")
    || !!next.handleless !== !!savedOptions.handleless
    || !!next.one_side_visible !== !!savedOptions.one_side_visible;
  const changeSize = (key: keyof FurnitureDimensions, value: number) => {
    const next = { ...size, [key]: value };
    setSize(next);
    onGroupPricingPending(first.group_key, JSON.stringify(next) !== JSON.stringify(initialSize) || optionsAreDirty(options));
  };
  const changeOptions = (next: CalcOptions) => {
    setOptions(next);
    onGroupPricingPending(first.group_key, sizeIsDirty || optionsAreDirty(next));
  };

  const recalculate = async () => {
    setSaving(true);
    try {
      const currentOptions: CalcOptions = { ...options };
      if (first.config?.overrides) currentOptions.overrides = first.config.overrides;
      else delete currentOptions.overrides;
      await estimatesApi.recalculateGroup(project.id, estimate.id, first.group_key, { ...size, options: currentOptions });
      await onChanged();
      onGroupPricingPending(first.group_key, false);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not recalculate the furniture.");
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async () => {
    setSaving(true);
    try {
      await estimatesApi.deleteGroup(project.id, estimate.id, first.group_key);
      await onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not remove the furniture.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FurnitureItemSummary
        item={first}
        rows={rows}
        size={size}
        onDimensionChange={changeSize}
        expanded={expanded}
        stripe={stripe}
        dirty={dirty}
        busy={busy || saving}
        locked={locked}
        onRecalculate={recalculate}
        onToggle={onToggle}
        furnitureOptions={furnitureOptions}
        catalogLoading={catalogLoading}
        onChangeFurniture={onChangeFurniture}
        pricesVisible={pricesVisible && !dirty}
      />
      {expanded && (
        <tr>
          <td colSpan={26} className="p-0">
            <FurnitureMaterialBreakdown
              rows={rows}
              project={project}
              estimate={estimate}
              locked={locked}
              busy={busy || saving}
              options={options}
              onOptionsChange={changeOptions}
              onDeleteGroup={deleteGroup}
              val={val}
              setDraft={setDraft}
              commit={commit}
              remove={remove}
              onChanged={onChanged}
              onError={onError}
              pricesVisible={pricesVisible && !dirty}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function FurnitureItemSummary({
  item, rows, size, onDimensionChange, expanded, stripe, dirty, busy, locked, onRecalculate, onToggle,
  furnitureOptions, catalogLoading, onChangeFurniture, pricesVisible,
}: {
  item: EstimateItem;
  rows: EstimateItem[];
  size: FurnitureDimensions;
  onDimensionChange: (key: keyof FurnitureDimensions, value: number) => void;
  expanded: boolean;
  stripe: boolean;
  dirty: boolean;
  busy: boolean;
  locked: boolean;
  onRecalculate: () => void;
  onToggle: () => void;
  furnitureOptions: Furniture[];
  catalogLoading: boolean;
  onChangeFurniture: (furniture: Furniture) => void;
  pricesVisible: boolean;
}) {
  const cost = totalOf(rows, "cost");
  const marginAmount = totalOf(rows, "margin_amount");
  const referralAmount = totalOf(rows, "referral_amount");
  const gstAmount = totalOf(rows, "gst_amount");
  const taxable = totalOf(rows, "amount") + marginAmount + referralAmount;
  const percent = (amount: number, base: number) => base > 0 ? `${(amount / base * 100).toFixed(2)}%` : "—";
  const BD = "border-r border-surface-200";
  const dimension = (key: keyof FurnitureDimensions, label: string) => (
    <input
      type="number"
      min={0}
      step={1}
      aria-label={`${label} ${key.endsWith("_ft") ? "feet" : "inches"}`}
      value={size[key]}
      disabled={locked || busy}
      onChange={event => onDimensionChange(key, parseInt(event.target.value, 10) || 0)}
      className="w-[54px] px-1.5 py-1 border border-transparent rounded text-[11px] font-mono text-center outline-none bg-transparent focus:border-nicara-gold focus:bg-white disabled:text-surface-400"
    />
  );

  return (
    <tr className={`border-b border-surface-100 ${expanded ? "bg-nicara-gold/5 border-l-[3px] border-l-nicara-gold" : stripe ? "bg-surface-50/50" : "bg-white"}`}>
      <td className={`px-2 py-1.5 font-semibold text-nicara-dark ${BD}`}>{item.area || "—"}</td>
      <td className={`px-2 py-1.5 font-semibold text-nicara-dark min-w-[160px] ${BD}`}>
        {locked ? (
          item.item || item.furniture_name || "Furniture"
        ) : (
          <SearchSelect
            value={item.item || item.furniture_name || "Furniture"}
            options={furnitureOptions.filter(option => option.is_active)}
            getLabel={option => option.name}
            getSublabel={option => option.cabinet_type_display}
            onPick={onChangeFurniture}
            loading={catalogLoading}
            disabled={busy || catalogLoading}
            placeholder="Choose furniture…"
            className="w-full min-w-[140px] px-2 py-1.5 border border-transparent rounded-lg text-[11px] bg-transparent outline-none focus:border-nicara-gold focus:bg-white cursor-pointer"
          />
        )}
        {item.zone && <div className="text-[9px] font-normal text-surface-400">{item.zone}</div>}
      </td>
      <td className={`px-1 py-1 w-[68px] ${BD}`}>{dimension("width_ft", "Width")}</td>
      <td className={`px-1 py-1 w-[68px] ${BD}`}>{dimension("width_in", "Width")}</td>
      <td className={`px-1 py-1 w-[68px] ${BD}`}>{dimension("height_ft", "Height")}</td>
      <td className={`px-1 py-1 w-[68px] ${BD}`}>{dimension("height_in", "Height")}</td>
      <td className={`px-1 py-1 w-[68px] ${BD}`}>{dimension("depth_ft", "Depth")}</td>
      <td className={`px-1 py-1 w-[68px] ${BD}`}>{dimension("depth_in", "Depth")}</td>
      <td className={`px-2 py-1.5 text-surface-500 ${BD}`}>Furniture</td>
      <td className={`px-2 py-1.5 text-surface-500 ${BD}`}>{rows.length} breakdown rows</td>
      <td className={`px-2 py-1.5 text-surface-400 ${BD}`}>—</td>
      <td className={`px-2 py-1.5 text-surface-400 ${BD}`}>—</td>
      <td className={`px-2 py-1.5 text-right font-mono ${BD}`}>1</td>
      <td className={`px-2 py-1.5 ${BD}`}>nos</td>
      <td className={`px-2 py-1.5 text-right font-mono ${BD}`}>—</td>
      <td className={`px-2 py-1.5 ${BD}`}>—</td>
      <td className={`px-2 py-1.5 text-right font-mono font-semibold text-nicara-dark whitespace-nowrap ${BD}`}>{pricesVisible ? inr(String(cost)) : "—"}</td>
      <td className={`px-2 py-1.5 text-right font-mono ${BD}`}>{pricesVisible ? percent(marginAmount, cost) : "—"}</td>
      <td className={`px-2 py-1.5 text-right font-mono text-surface-600 whitespace-nowrap ${BD}`}>{pricesVisible ? inr(String(marginAmount)) : "—"}</td>
      <td className={`px-2 py-1.5 text-right font-mono ${BD}`}>{pricesVisible ? percent(referralAmount, cost) : "—"}</td>
      <td className={`px-2 py-1.5 text-right font-mono text-surface-600 whitespace-nowrap ${BD}`}>{pricesVisible ? inr(String(referralAmount)) : "—"}</td>
      <td className={`px-2 py-1.5 text-center text-surface-500 ${BD}`}>{pricesVisible ? percent(gstAmount, taxable) : "—"}</td>
      <td className={`px-2 py-1.5 text-right font-mono text-surface-500 whitespace-nowrap ${BD}`}>{pricesVisible ? inr(String(gstAmount)) : "—"}</td>
      <td className={`px-2 py-1.5 text-right font-bold text-nicara-gold font-mono whitespace-nowrap ${BD}`}>{pricesVisible ? inr(String(totalOf(rows, "total_amount"))) : "—"}</td>
      <td className={`px-2 py-1.5 text-center whitespace-nowrap ${BD}`}>
        <button onClick={onToggle} aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} material breakdown for ${item.item || "furniture"}`}
          title={expanded ? "Hide material breakdown" : "Show material breakdown"}
          className={`px-2 py-1 rounded-md cursor-pointer border ${expanded ? "bg-nicara-gold/10 border-nicara-gold text-nicara-gold" : "bg-surface-50 border-surface-200 text-surface-500"}`}>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {!locked && (
          <button onClick={onRecalculate} disabled={!dirty || busy}
            title={dirty ? "Recalculate this furniture with the edited dimensions/options" : "No pending changes to recalculate"}
            className={`ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-semibold ${dirty && !busy
              ? "border-nicara-gold bg-nicara-gold text-white cursor-pointer"
              : "border-surface-200 bg-surface-50 text-surface-400 cursor-not-allowed"}`}>
            <RefreshCw size={10} /> Recalculate
          </button>
        )}
      </td>
      <td className="px-2 py-1.5 text-center" />
    </tr>
  );
}

function FurnitureMaterialBreakdown({
  rows, project, estimate, locked, busy, options, onOptionsChange, onDeleteGroup,
  val, setDraft, commit, remove, onChanged, onError, pricesVisible,
}: {
  rows: EstimateItem[];
  project: Project;
  estimate: Estimate;
  locked: boolean;
  busy: boolean;
  options: CalcOptions;
  onOptionsChange: (options: CalcOptions) => void;
  onDeleteGroup: () => void;
  val: (item: EstimateItem, key: string) => string;
  setDraft: React.Dispatch<React.SetStateAction<Record<number, Record<string, unknown>>>>;
  commit: (item: EstimateItem) => Promise<void>;
  remove: (item: EstimateItem) => Promise<void>;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  pricesVisible: boolean;
}) {
  const total = (field: keyof EstimateItem) => inr(String(totalOf(rows, field)));
  const headers = [
    "Type", "Component", "Brand", "Model", "Application", "Qty", "Unit", "Price", "Price Unit",
    "Cost", "Margin %", "Margin Amt", "Ref %", "Ref Amt", "GST %", "GST Amt", "Total", "",
  ];

  return (
    <div className="bg-amber-50 border-l-[3px] border-l-nicara-gold px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[10px] font-bold text-amber-800">
          Material Breakdown — {rows[0]?.item || rows[0]?.furniture_name || "Furniture"}
          <span className="ml-2 text-amber-600 font-normal">{rows.length} component row(s)</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!locked && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-700">Furniture options</span>
              <OptionsControls compact options={options} onChange={onOptionsChange} />
            </div>
          )}
          {!locked && (
            <button onClick={onDeleteGroup} disabled={busy}
              title="Remove all rows for this furniture item"
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-red-500 cursor-pointer hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 size={11} /> Remove furniture
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] min-w-[1750px] border border-amber-200 rounded-lg overflow-hidden bg-white">
          <thead>
            <tr className="bg-amber-100">
              {headers.map(header => (
                <th key={header || "actions"} className="px-2 py-1.5 text-amber-800 font-semibold text-left text-[9px] uppercase whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => (
              <Fragment key={item.id}>
                <GeneratedMaterialRow
                  item={item}
                  stripe={index % 2 !== 0}
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
                  pricesVisible={pricesVisible}
                />
                {(item.components?.length ?? 0) > 0 && (
                  <tr>
                    <td colSpan={headers.length} className="p-0">
                      <ComponentBreakdown
                        item={item}
                        project={project}
                        estimate={estimate}
                        locked={locked}
                        onChanged={onChanged}
                        onError={onError}
                        pricesVisible={pricesVisible}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-amber-100 border-t-2 border-amber-300">
              <td colSpan={9} className="px-2 py-1.5 text-right text-[10px] font-bold text-amber-800">Furniture Total</td>
              <td className="px-2 py-1.5 text-right font-semibold font-mono">{pricesVisible ? total("cost") : "—"}</td>
              <td />
              <td className="px-2 py-1.5 text-right font-mono">{pricesVisible ? total("margin_amount") : "—"}</td>
              <td />
              <td className="px-2 py-1.5 text-right font-mono">{pricesVisible ? total("referral_amount") : "—"}</td>
              <td />
              <td className="px-2 py-1.5 text-right font-mono">{pricesVisible ? total("gst_amount") : "—"}</td>
              <td className="px-2 py-1.5 text-right font-extrabold text-nicara-gold font-mono">{pricesVisible ? total("total_amount") : "—"}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function GeneratedMaterialRow({
  item, stripe, project, estimate, locked, busy, val, setDraft, commit, remove, onChanged, onError,
  pricesVisible,
}: {
  item: EstimateItem;
  stripe: boolean;
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
  pricesVisible: boolean;
}) {
  const BD = "border-r border-amber-100";
  const change = (field: string, value: unknown) =>
    setDraft(draft => ({ ...draft, [item.id]: { ...draft[item.id], [field]: value } }));
  const [editing, setEditing] = useState(false);

  return (
    <>
    <tr className={`border-t border-amber-200 ${stripe ? "bg-amber-50/40" : "bg-white"}`}>
      <td className={`px-2 py-1.5 min-w-[110px] ${BD}`}>
        {locked ? (
          <span className="text-surface-600">{item.item_type || "—"}</span>
        ) : (
          <select value={val(item, "item_type")}
            onChange={event => {
              change("item_type", event.target.value);
              setTimeout(() => commit(item), 0);
            }}
            className="w-full px-1 py-1 border border-transparent rounded-lg text-[10px] bg-transparent outline-none focus:border-nicara-gold focus:bg-white cursor-pointer">
            <option value="">—</option>
            <option value="Procurement">Procurement</option>
            <option value="Service">Service</option>
            <option value="Spec Purpose">Spec Purpose</option>
            <option value="Procurement cum Service">Procurement cum Service</option>
          </select>
        )}
      </td>
      <td className={`px-2 py-1.5 min-w-[170px] font-semibold text-nicara-dark ${BD}`}>
        <EditableCell locked={locked} value={val(item, "specification")}
          onChange={value => change("specification", value)} onCommit={() => commit(item)} placeholder="Component" />
        {item.flag && <div className="px-2 text-[9px] text-amber-700">Quantity needs review</div>}
      </td>
      <td className={`px-2 py-1.5 min-w-[150px] ${BD}`}>
        {item.raw_material_category && !locked ? (
          <RawMaterialPicker item={item} project={project} estimate={estimate} pricesVisible={pricesVisible}
            onChanged={onChanged} onError={onError} />
        ) : (
          <EditableCell locked={locked} value={val(item, "brand")}
            onChange={value => change("brand", value)} onCommit={() => commit(item)} placeholder="Brand" />
        )}
      </td>
      <td className={`px-2 py-1.5 min-w-[150px] ${BD}`}>
        <EditableCell locked={locked} value={val(item, "model_name")}
          onChange={value => change("model_name", value)} onCommit={() => commit(item)} placeholder="Model" />
      </td>
      <td className={`px-2 py-1.5 min-w-[130px] ${BD}`}>
        <EditableCell locked={locked} value={val(item, "application")}
          onChange={value => change("application", value)} onCommit={() => commit(item)} placeholder="Application" />
      </td>
      <td className={`px-2 py-1.5 w-[85px] text-right font-mono ${BD} ${item.qty_overridden ? "bg-blue-50" : ""}`}
        title={item.calc_basis || undefined}>
        <EditableCell locked={locked} value={val(item, "qty")} mono type="number"
          onChange={value => change("qty", value)} onCommit={() => commit(item)} />
        <QtyNote item={item} locked={locked} project={project} estimate={estimate} onChanged={onChanged} onError={onError} />
      </td>
      <td className={`px-2 py-1.5 min-w-[55px] ${BD}`}>
        <EditableCell locked={locked} value={val(item, "unit")}
          onChange={value => change("unit", value)} onCommit={() => commit(item)} />
      </td>
      <td className={`px-2 py-1.5 w-[90px] text-right font-mono ${BD}`}>
        <EditableCell locked={locked || !pricesVisible} value={pricesVisible ? val(item, "rate") : "—"} mono type="number"
          onChange={value => change("rate", value)} onCommit={() => commit(item)} />
      </td>
      <td className={`px-2 py-1.5 min-w-[80px] ${BD}`}>
        <EditableCell locked={locked} value={val(item, "price_unit")}
          onChange={value => change("price_unit", value)} onCommit={() => commit(item)} placeholder="Unit" />
      </td>
      <td className={`px-2 py-1.5 text-right font-mono font-semibold text-nicara-dark whitespace-nowrap ${BD}`}>{pricesVisible ? inr(item.cost) : "—"}</td>
      <td className={`px-2 py-1.5 w-[75px] text-right font-mono ${BD}`}>
        <EditableCell locked={locked || !pricesVisible} value={pricesVisible ? val(item, "margin_pct") : "—"} mono type="number"
          onChange={value => change("margin_pct", value)} onCommit={() => commit(item)} />
      </td>
      <td className={`px-2 py-1.5 text-right font-mono text-surface-600 whitespace-nowrap ${BD}`}>{pricesVisible ? inr(item.margin_amount) : "—"}</td>
      <td className={`px-2 py-1.5 w-[75px] text-right font-mono ${BD}`}>
        <EditableCell locked={locked || !pricesVisible} value={pricesVisible ? val(item, "referral_pct") : "—"} mono type="number"
          onChange={value => change("referral_pct", value)} onCommit={() => commit(item)} />
      </td>
      <td className={`px-2 py-1.5 text-right font-mono text-surface-600 whitespace-nowrap ${BD}`}>{pricesVisible ? inr(item.referral_amount) : "—"}</td>
      <td className={`px-2 py-1.5 text-center text-surface-500 ${BD}`}>{pricesVisible ? `${parseFloat(item.gst_pct)}%` : "—"}</td>
      <td className={`px-2 py-1.5 text-right font-mono text-surface-500 whitespace-nowrap ${BD}`}>{pricesVisible ? inr(item.gst_amount) : "—"}</td>
      <td className={`px-2 py-1.5 text-right font-bold text-nicara-gold font-mono whitespace-nowrap ${BD}`}>{pricesVisible ? inr(item.total_amount) : "—"}</td>
      <td className="px-2 py-1.5 text-center">
        {!locked && (
          <div className="inline-flex items-center gap-2">
            <button onClick={() => setEditing(true)} disabled={busy} title="Edit material breakdown row"
              className="bg-transparent border-none text-amber-700 cursor-pointer p-0 hover:text-nicara-gold transition-colors">
              <Pencil size={12} />
            </button>
            <button onClick={() => remove(item)} disabled={busy} title="Remove this breakdown row"
              className="bg-transparent border-none text-red-300 cursor-pointer p-0 hover:text-red-500 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </td>
    </tr>
    {editing && (
      <GeneratedMaterialEditModal
        item={item}
        project={project}
        estimate={estimate}
        pricesVisible={pricesVisible}
        onClose={() => setEditing(false)}
        onError={onError}
        onSaved={async () => {
          setEditing(false);
          await onChanged();
        }}
      />
    )}
    </>
  );
}

function GeneratedMaterialEditModal({ item, project, estimate, pricesVisible, onClose, onError, onSaved }: {
  item: EstimateItem;
  project: Project;
  estimate: Estimate;
  pricesVisible: boolean;
  onClose: () => void;
  onError: (message: string) => void;
  onSaved: () => Promise<void>;
}) {
  const materials = useApiData(
    () => item.raw_material_category
      ? libraryApi.categoryItems(item.raw_material_category)
      : libraryApi.items({ is_active: true, page_size: 500 }),
    [item.raw_material_category],
  );
  const [materialId, setMaterialId] = useState(item.raw_material ? String(item.raw_material) : "");
  const [form, setForm] = useState({
    specification: item.specification,
    application: item.application,
    qty: item.qty,
    unit: item.unit,
    rate: item.rate,
  });
  const [saving, setSaving] = useState(false);
  const selectedMaterial = materials.data?.results.find(material => String(material.id) === materialId);
  const options = materials.data?.results ?? [];
  const set = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await estimatesApi.updateItem(project.id, estimate.id, item.id, {
        ...form,
        gst_pct: item.gst_pct,
        ...(selectedMaterial ? {
          raw_material: selectedMaterial.id,
          brand: selectedMaterial.brand_name,
          model_name: selectedMaterial.model_name,
        } : {}),
      });
      await onSaved();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not save the material row.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md" title="Edit Material Breakdown"
      subtitle="Choose a raw material to apply its stored price and details."
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Raw Material</div>
          <SearchSelect
            value={selectedMaterial?.full_display ?? [item.brand, item.model_name].filter(Boolean).join(" — ")}
            options={options}
            getLabel={material => `${material.category_name} — ${material.full_display || [material.brand_name, material.model_name].filter(Boolean).join(" — ")}`}
            getSublabel={material => pricesVisible
              ? `${material.category_name} · ${inr(material.default_rate)} / ${material.default_unit}`
              : `${material.category_name} · ${material.default_unit}`}
            onPick={material => {
              setMaterialId(String(material.id));
              setForm(previous => ({
                ...previous,
                specification: material.description || material.category_name,
                unit: material.default_unit,
                rate: material.default_rate,
              }));
            }}
            loading={materials.loading}
            disabled={materials.loading}
            placeholder="Search raw materials…"
          />
          {materials.error && <InlineError message={materials.error} />}
        </div>
        <Field label="Component" value={form.specification} onChange={value => set("specification", value)} />
        <Field label="Application" value={form.application} onChange={value => set("application", value)} />
        <Field label="Quantity" type="number" value={form.qty} onChange={value => set("qty", value)} />
        <Field label="Unit" value={form.unit} onChange={value => set("unit", value)} />
        <Field label="Price (₹)" type="number" value={pricesVisible ? form.rate : "—"}
          onChange={value => set("rate", value)} disabled={!pricesVisible} />
      </div>
    </Modal>
  );
}

/* ── Single item row + collapsible detail sub-table ── */

function ItemRow({
  item, ri, isOpen, project, estimate, locked, busy, val, setDraft, commit, remove,
  onChanged, onError, onToggle, BD, initialEstimate, catalogOptions, catalogLoading,
  onSelectCatalogOption, pricesVisible,
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
  initialEstimate: boolean;
  catalogOptions: EstimateCatalogOption[];
  catalogLoading: boolean;
  onSelectCatalogOption: (item: EstimateItem, option: EstimateCatalogOption) => void;
  pricesVisible: boolean;
}) {
  const generated = !!item.group_key;

  return (
    <>
      <tr className={`border-b border-surface-100 ${isOpen ? "bg-nicara-gold/5 border-l-[3px] border-l-nicara-gold" : ri % 2 === 0 ? "bg-white" : "bg-surface-50/50"}`}>
        {/* Area */}
        <td className={`px-2 py-1.5 font-semibold text-nicara-dark ${BD}`}>
          <EditableCell locked={locked} value={val(item, "area")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], area: v } }))}
            onCommit={() => commit(item)} placeholder="Room" />
        </td>
        {/* Item — calculated rows carry their furniture's name; hand-added lines are free text */}
        <td className={`px-2 py-1.5 font-semibold text-nicara-dark min-w-[160px] ${BD}`}>
          {initialEstimate && !locked && !generated ? (
            <SearchSelect
              value={val(item, "item")}
              options={catalogOptions}
              getLabel={option => option.label}
              getSublabel={option => option.detail}
              onPick={option => onSelectCatalogOption(item, option)}
              loading={catalogLoading}
              disabled={busy || catalogLoading}
              placeholder="Choose furniture or raw material…"
              className="w-full min-w-[150px] px-2 py-1.5 border border-transparent rounded-lg text-[11px] bg-transparent outline-none focus:border-nicara-gold focus:bg-white cursor-pointer"
            />
          ) : locked || generated ? (
            <div className="px-2 py-1.5 font-semibold text-nicara-dark">{val(item, "item") || "—"}</div>
          ) : (
            <EditableCell locked={locked} value={val(item, "item")}
              onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], item: v } }))}
              onCommit={() => commit(item)} placeholder="Item name" />
          )}
          {item.catalog_item_code && (
            <div className="px-2 text-[9px] text-surface-300 font-mono">{item.catalog_item_code}</div>
          )}
        </td>
        {/* Width ft/in */}
        {(["width_ft", "width_in", "height_ft", "height_in", "depth_ft", "depth_in"] as const).map(dim => (
          <td key={dim} className={`px-2 py-1.5 w-[42px] ${BD}`}>
            <EditableCell locked={locked || generated} value={String(val(item, dim) || "0")} mono type="number"
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
        {/* Brand — generated rows pick a model from the component's raw-material category */}
        <td className={`px-2 py-1.5 min-w-[80px] ${BD}`}>
          {generated && item.raw_material_category && !locked ? (
            <RawMaterialPicker item={item} project={project} estimate={estimate} pricesVisible={pricesVisible}
              onChanged={onChanged} onError={onError} />
          ) : (
          <EditableCell locked={locked} value={val(item, "brand")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], brand: v } }))}
            onCommit={() => commit(item)} placeholder="Brand" />
          )}
        </td>
        {/* Model */}
        <td className={`px-2 py-1.5 min-w-[120px] ${BD}`}>
          <EditableCell locked={locked} value={val(item, "model_name")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], model_name: v } }))}
            onCommit={() => commit(item)} placeholder="Model" />
        </td>
        {/* Application */}
        {!initialEstimate && <td className={`px-2 py-1.5 min-w-[100px] ${BD}`}>
          <EditableCell locked={locked} value={val(item, "application")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], application: v } }))}
            onCommit={() => commit(item)} placeholder="Application" />
        </td>}
        {/* Specifications (auto-generated, read-only) */}
        {!initialEstimate && (
          <td className={`px-2 py-1.5 text-[10px] text-surface-500 min-w-[180px] ${BD}`}>
            {item.specifications_text || "—"}
          </td>
        )}
        {/* Estimate Spec Flag */}
        {!initialEstimate && <td className={`px-2 py-1.5 text-center w-[40px] ${BD}`}>
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
        </td>}
        {/* Qty — generated rows explain their quantity; a typed value is an override */}
        <td className={`px-2 py-1.5 w-[70px] text-right font-mono ${BD} ${item.qty_overridden ? "bg-blue-50" : ""}`}
          title={item.calc_basis || undefined}>
          <EditableCell locked={locked} value={val(item, "qty")} mono type="number"
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], qty: v } }))}
            onCommit={() => commit(item)} />
          {generated && <QtyNote item={item} locked={locked} project={project} estimate={estimate}
            onChanged={onChanged} onError={onError} />}
        </td>
        {/* Unit */}
        <td className={`px-2 py-1.5 w-[55px] ${BD}`}>
          <EditableCell locked={locked} value={val(item, "unit")}
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], unit: v } }))}
            onCommit={() => commit(item)} />
        </td>
        {/* Price (rate) */}
        <td className={`px-2 py-1.5 w-[70px] text-right font-mono ${BD}`}>
          <EditableCell locked={locked || (initialEstimate && !pricesVisible)}
            value={initialEstimate && !pricesVisible ? "—" : val(item, "rate")} mono type="number"
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
          {initialEstimate && !pricesVisible ? "—" : inr(item.cost)}
        </td>
        {/* Margin % */}
        <td className={`px-2 py-1.5 w-[50px] text-right font-mono ${BD}`}>
          <EditableCell locked={locked || (initialEstimate && !pricesVisible)}
            value={initialEstimate && !pricesVisible ? "—" : val(item, "margin_pct")} mono type="number"
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], margin_pct: v } }))}
            onCommit={() => commit(item)} />
        </td>
        {/* Margin Amount (read-only) */}
        <td className={`px-2 py-1.5 text-right font-mono text-surface-600 whitespace-nowrap ${BD}`}>
          {initialEstimate && !pricesVisible ? "—" : inr(item.margin_amount)}
        </td>
        {/* Referral % */}
        <td className={`px-2 py-1.5 w-[50px] text-right font-mono ${BD}`}>
          <EditableCell locked={locked || (initialEstimate && !pricesVisible)}
            value={initialEstimate && !pricesVisible ? "—" : val(item, "referral_pct")} mono type="number"
            onChange={v => setDraft(d => ({ ...d, [item.id]: { ...d[item.id], referral_pct: v } }))}
            onCommit={() => commit(item)} />
        </td>
        {/* Referral Amount (read-only) */}
        <td className={`px-2 py-1.5 text-right font-mono text-surface-600 whitespace-nowrap ${BD}`}>
          {initialEstimate && !pricesVisible ? "—" : inr(item.referral_amount)}
        </td>
        {/* GST % */}
        <td className={`px-2 py-1.5 text-center text-surface-500 w-[45px] ${BD}`}>
          {initialEstimate && !pricesVisible ? "—" : `${parseFloat(item.gst_pct)}%`}
        </td>
        {/* GST Amount (read-only) */}
        <td className={`px-2 py-1.5 text-right font-mono text-surface-500 whitespace-nowrap ${BD}`}>
          {initialEstimate && !pricesVisible ? "—" : inr(item.gst_amount)}
        </td>
        {/* Total Amount (read-only) */}
        <td className={`px-2 py-1.5 text-right font-bold text-nicara-gold font-mono whitespace-nowrap ${BD}`}>
          {initialEstimate && !pricesVisible ? "—" : inr(item.total_amount)}
        </td>
        {/* Flag */}
        {!initialEstimate && <td className={`px-2 py-1.5 text-center w-[40px] ${BD}`}>
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
        </td>}
        {/* Expand toggle */}
        <td className={`px-2 py-1.5 text-center ${BD}`}>
          <button onClick={onToggle} aria-expanded={isOpen}
            aria-label={`${isOpen ? "Hide" : "Show"} material breakdown for ${item.item || "line item"}`}
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
          <td colSpan={initialEstimate ? 26 : 30} className="p-0">
            <ComponentBreakdown
              item={item} project={project} estimate={estimate}
              locked={locked} onChanged={onChanged} onError={onError}
              pricesVisible={!initialEstimate || pricesVisible} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Live material breakdown (bill of materials) ──────────────── */

function ComponentBreakdown({
  item, project, estimate, locked, onChanged, onError, pricesVisible,
}: {
  item: EstimateItem;
  project: Project;
  estimate: Estimate;
  locked: boolean;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  pricesVisible: boolean;
}) {
  const toast = useToast();
  const components = item.components ?? [];
  const generatedMaterial = components.length === 0 && !!item.group_key && item.raw_material_category !== null;
  const breakdownRows = components.length > 0
    ? components.map(component => ({ ...component, stored: component }))
    : generatedMaterial
      ? [{
          id: item.id,
          basic_component: item.specification || item.item || "Material",
          detail: item.application,
          brand: item.brand,
          model: item.model_name,
          qty: item.qty,
          unit: item.unit,
          price: item.rate,
          amount: item.cost,
          stored: null,
        }]
      : [];
  const [editing, setEditing] = useState<EstimateItemComponent | "new" | null>(null);
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

  return (
    <div className="bg-amber-50 border-l-[3px] border-l-nicara-gold px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-[10px] font-bold text-amber-800">
          📋 Material Breakdown — {item.item || "line"}
          {generatedMaterial ? (
            <span className="ml-2 text-amber-600 font-normal">priced from this catalogue material</span>
          ) : components.length > 0 ? (
            <span className="ml-2 text-amber-600 font-normal">
              amount rolls up from these {components.length} component(s)
            </span>
          ) : null}
        </div>
        {!locked && (
          <div className="flex items-center gap-2">
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
            {breakdownRows.map(c => (
              <tr key={c.id} className="border-t border-amber-200">
                <td className="px-2 py-1.5 font-semibold text-nicara-dark">{c.basic_component}</td>
                <td className="px-2 py-1.5 text-surface-600">{c.detail || "—"}</td>
                <td className="px-2 py-1.5 text-surface-600">{c.brand || "—"}</td>
                <td className="px-2 py-1.5 text-surface-600">{c.model || "—"}</td>
                <td className="px-2 py-1.5 font-mono text-right">{parseFloat(c.qty)}</td>
                <td className="px-2 py-1.5">{c.unit || "—"}</td>
                <td className="px-2 py-1.5 font-mono text-right">{pricesVisible ? inr(c.price) : "—"}</td>
                <td className="px-2 py-1.5 font-mono text-right font-semibold text-nicara-dark">{pricesVisible ? inr(c.amount) : "—"}</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {!locked && c.stored && (
                    <>
                      <button onClick={() => setEditing(c.stored)}
                        className="text-amber-700 hover:text-nicara-gold bg-transparent border-none cursor-pointer text-[10px] mr-2">edit</button>
                      <button onClick={() => removeComponent(c.stored.id)} disabled={busy}
                        className="text-red-300 hover:text-red-500 bg-transparent border-none cursor-pointer text-[11px]">✕</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {breakdownRows.length === 0 && (
              <tr className="border-t border-amber-200">
                <td colSpan={9} className="px-3 py-3 text-center text-surface-400 text-[10px] italic">
                  No breakdown yet. Add a basic component to cost this line from its parts.
                  {" "}Until then the line uses qty × rate.
                </td>
              </tr>
            )}
          </tbody>
          {breakdownRows.length > 0 && (
            <tfoot>
              <tr className="bg-amber-100 border-t-2 border-amber-300">
                <td colSpan={7} className="px-2 py-1.5 text-right text-[10px] font-bold text-amber-800">
                  Line Total
                </td>
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
          pricesVisible={pricesVisible}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); toast.success("Saved", "Breakdown updated"); await onChanged(); }} />
      )}
    </div>
  );
}

function ComponentModal({
  component, project, estimate, itemId, pricesVisible, onClose, onSaved,
}: {
  component: EstimateItemComponent | null;
  project: Project;
  estimate: Estimate;
  itemId: number;
  pricesVisible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ComponentInput>(
    component ? { ...component } : { basic_component: "", detail: "", brand: "", model: "", qty: "1", unit: "sft", price: "0" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const materials = useApiData(
    () => libraryApi.items({ is_active: true, page_size: 500 }),
    [],
  );
  const selectedMaterial = materials.data?.results.find(
    material => material.id === form.library_material_item,
  );

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
          <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Raw Material Component</div>
          <SearchSelect
            value={selectedMaterial?.full_display ?? String(form.basic_component ?? "")}
            options={materials.data?.results ?? []}
            getLabel={material => `${material.category_name} — ${material.full_display || material.model_name}`}
            getSublabel={material => pricesVisible
              ? `${material.category_name} · ${material.default_unit} · ${inr(material.default_rate)}`
              : `${material.category_name} · ${material.default_unit}`}
            onPick={material => setForm(previous => ({
              ...previous,
              basic_component: material.category_name || material.model_name,
              detail: material.description,
              brand: material.brand_name,
              model: material.model_name,
              unit: material.default_unit,
              price: material.default_rate,
              library_material_item: material.id,
            }))}
            loading={materials.loading}
            disabled={materials.loading}
            placeholder="Search raw materials…"
          />
          {materials.error && <InlineError message={materials.error} />}
          {errors.basic_component?.[0] && <div className="text-[10px] text-red-500 mt-1">{errors.basic_component[0]}</div>}
        </div>
        <Field label="Detail" value={String(form.detail ?? "")} onChange={v => set("detail", v)} placeholder="18mm" />
        <Field label="Brand" value={String(form.brand ?? "")} onChange={v => set("brand", v)} placeholder="Austin" />
        <Field label="Model" value={String(form.model ?? "")} onChange={v => set("model", v)} placeholder="Lincoln" />
        <Field label="Unit" value={String(form.unit ?? "")} onChange={v => set("unit", v)} placeholder="sft" />
        <Field label="Qty" type="number" value={String(form.qty ?? "0")} onChange={v => set("qty", v)} error={errors.qty?.[0]} />
        <Field label="Price (₹)" type="number"
          value={pricesVisible ? String(form.price ?? "0") : "—"}
          onChange={v => set("price", v)} disabled={!pricesVisible}
          error={errors.price?.[0]} />
      </div>
      <div className="mt-3 text-right text-[12px] text-surface-500">
        Amount: <span className="font-bold text-nicara-dark">{pricesVisible ? inr(String(previewAmount)) : "—"}</span>
      </div>
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

/* ══════════════════════════════════════════════════════════════════
   CALCULATED FURNITURE GROUPS — size, options, recalculation
   ══════════════════════════════════════════════════════════════════ */

const SIZE_IN = "w-[38px] px-1 py-0.5 border border-surface-200 rounded text-[10px] font-mono text-center outline-none focus:border-nicara-gold bg-white";

/** Header above one furniture piece's rows: its size (ft/in) and options; changes recalculate the group. */
function FurnitureGroupHeader({ rows, project, estimate, locked, onChanged, onError, initialEstimate }: {
  rows: EstimateItem[];
  project: Project;
  estimate: Estimate;
  locked: boolean;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  initialEstimate: boolean;
}) {
  const first = rows[0];
  const initial = {
    width_ft: first.width_ft, width_in: first.width_in, height_ft: first.height_ft,
    height_in: first.height_in, depth_ft: first.depth_ft, depth_in: first.depth_in,
  };
  const [size, setSize] = useState(initial);
  const [options, setOptions] = useState<CalcOptions>(first.config ?? {});
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(size) !== JSON.stringify(initial)
    || JSON.stringify(options) !== JSON.stringify(first.config ?? {});
  const subtotal = rows.reduce((s, r) => s + parseFloat(r.total_amount || "0"), 0);
  const overrides = first.config?.overrides ?? {};
  const needsInput = rows.filter(r => r.flag).length;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try { await action(); await onChanged(); }
    catch (e) { onError(e instanceof ApiError ? e.message : "Could not update the furniture."); }
    finally { setBusy(false); }
  };

  const dim = (k: keyof typeof size) => (
    <input className={SIZE_IN} type="number" min={0} value={size[k]} disabled={locked || busy}
      onChange={e => setSize(s => ({ ...s, [k]: parseInt(e.target.value) || 0 }))} />
  );

  return (
    <tr className="bg-surface-50 border-t-2 border-nicara-gold/30">
      <td colSpan={initialEstimate ? 26 : 30} className="px-3 py-1.5">
        <div className="flex items-center gap-3 flex-wrap text-[10px]">
          {!initialEstimate && <span className="text-[11px] font-bold text-nicara-dark flex items-center gap-1.5">
            <Armchair size={12} className="text-nicara-gold" /> {first.item}
          </span>}
          {!initialEstimate && first.furniture_name && first.furniture_name !== first.item && (
            <span className="text-surface-400">{first.furniture_name}</span>
          )}
          {!initialEstimate && first.zone && <span className="text-surface-500">· {first.zone}</span>}
          <span className="flex items-center gap-1 text-surface-500">
            W {dim("width_ft")}′{dim("width_in")}″ · H {dim("height_ft")}′{dim("height_in")}″ · D {dim("depth_ft")}′{dim("depth_in")}″
          </span>
          {!locked && <OptionsControls compact options={options} onChange={setOptions} />}
          {Object.keys(overrides).length > 0 && (
            <span className="text-blue-600" title="Counts typed on the Doors / Drawers / Shelves rows">
              set: {Object.entries(overrides).map(([k, v]) => `${k} ${v}`).join(", ")}
            </span>
          )}
          {needsInput > 0 && <span className="text-amber-600">⚑ {needsInput} row(s) need a quantity</span>}
          {!initialEstimate && <span className="ml-auto font-semibold text-nicara-gold">{inr(String(subtotal))}</span>}
          {!locked && (
            <>
              <button disabled={!dirty || busy}
                onClick={() => run(() => estimatesApi.recalculateGroup(project.id, estimate.id, first.group_key, { ...size, options }))}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border-none cursor-pointer ${dirty
                  ? "bg-nicara-gold text-white" : "bg-surface-100 text-surface-400 cursor-default"}`}>
                <RefreshCw size={10} /> {busy ? "Recalculating…" : "Recalculate"}
              </button>
              <button disabled={busy} title="Remove this furniture's rows"
                onClick={() => run(() => estimatesApi.deleteGroup(project.id, estimate.id, first.group_key))}
                className="bg-transparent border-none text-red-300 cursor-pointer p-0 hover:text-red-500"><Trash2 size={12} /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

/** Under a generated row's qty: typed-over marker with reset, else the rule's calculated value. */
function QtyNote({ item, locked, project, estimate, onChanged, onError }: {
  item: EstimateItem; locked: boolean; project: Project; estimate: Estimate;
  onChanged: () => Promise<void>; onError: (msg: string) => void;
}) {
  const override = !!(item.config?.overrides && item.quantity_rule in item.config.overrides);
  if (!item.qty_overridden && !override) return null;
  const reset = async () => {
    try { await estimatesApi.resetQty(project.id, estimate.id, item.id); await onChanged(); }
    catch (e) { onError(e instanceof ApiError ? e.message : "Could not reset."); }
  };
  return (
    <div className="flex items-center justify-end gap-1 px-2 text-[9px] text-blue-600 whitespace-nowrap">
      {item.qty_overridden ? `calc ${parseFloat(item.calculated_qty ?? "0")}` : "set"}
      {!locked && (
        <button onClick={reset} title="Back to the calculated quantity"
          className="bg-transparent border-none p-0 cursor-pointer text-blue-500 hover:text-nicara-gold"><RotateCcw size={9} /></button>
      )}
    </div>
  );
}

/* Raw materials per category, fetched once per page view. */
const categoryCache = new Map<number, Promise<LibraryItem[]>>();
function categoryItems(id: number) {
  if (!categoryCache.has(id)) {
    categoryCache.set(id, libraryApi.categoryItems(id).then(r => r.results).catch(err => {
      categoryCache.delete(id);
      throw err;
    }));
  }
  return categoryCache.get(id)!;
}

/** Brand / model for a generated row — any model in its component's raw-material category. */
function RawMaterialPicker({ item, project, estimate, pricesVisible, onChanged, onError }: {
  item: EstimateItem; project: Project; estimate: Estimate;
  pricesVisible: boolean;
  onChanged: () => Promise<void>; onError: (msg: string) => void;
}) {
  const [choices, setChoices] = useState<LibraryItem[] | null>(null);
  const load = () => {
    if (choices === null && item.raw_material_category) {
      categoryItems(item.raw_material_category).then(setChoices).catch(() => setChoices([]));
    }
  };
  const label = (m: LibraryItem) => [m.brand_name, m.model_name].filter(Boolean).join(" — ");
  const choose = async (id: string) => {
    if (!id) return;
    try {
      await estimatesApi.updateItem(project.id, estimate.id, item.id, { raw_material: Number(id) });
      await onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not change the brand.");
    }
  };
  return (
    <select value={item.raw_material ? String(item.raw_material) : ""} onFocus={load} onMouseDown={load}
      onChange={e => choose(e.target.value)} title="Brand / model — re-prices the row"
      className="w-full px-1 py-1 border border-transparent rounded-lg text-[11px] bg-transparent outline-none focus:border-nicara-gold focus:bg-white cursor-pointer">
      {(choices ?? []).length === 0 && <option value={item.raw_material ?? ""}>{item.brand || "—"}</option>}
      {(choices ?? []).map(m => (
        <option key={m.id} value={m.id}>
          {pricesVisible ? `${label(m)} (${inr(m.default_rate)})` : label(m)}
        </option>
      ))}
    </select>
  );
}

/** Pick a catalogue furniture, its room/zone, size and options. */
function AddFurnitureModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (body: Parameters<typeof estimatesApi.addFurniture>[2]) => void;
}) {
  const furniture = useApiData(() => catalogApi.furniture(), []);
  const zones = useApiData(() => catalogApi.zones(), []);
  const [furnitureId, setFurnitureId] = useState<number | null>(null);
  const [form, setForm] = useState({ area: "", zone: "", item: "", width: "", height: "", depth: "" });
  const [options, setOptions] = useState<CalcOptions>({});
  const chosen = (furniture.data?.results ?? []).find(f => f.id === furnitureId);
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal open onClose={onClose} size="lg" title="Add Furniture"
      subtitle="Adds the furniture's rows with quantities calculated from its size"
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!furnitureId}
          onClick={() => furnitureId && onAdd({
            furniture_id: furnitureId, area: form.area, zone: form.zone, item: form.item || undefined,
            width: form.width || undefined, height: form.height || undefined, depth: form.depth || undefined, options,
          })}>Add</Btn>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Furniture</div>
          <SearchSelect value={chosen?.name ?? ""} options={(furniture.data?.results ?? []).filter(f => f.is_active)}
            loading={furniture.loading} getLabel={f => f.name} getSublabel={f => f.cabinet_type_display}
            placeholder="Search wardrobe, crockery unit…" onPick={f => setFurnitureId(f.id)}
            className="w-full px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold" />
        </div>
        <Field label="Room / Area" value={form.area} onChange={v => set("area", v)} placeholder="Master Bedroom" />
        <label className="block">
          <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider block mb-1.5">Zone</span>
          <select value={form.zone} onChange={e => set("zone", e.target.value)}
            className="w-full px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white cursor-pointer outline-none focus:border-nicara-gold">
            <option value="">—</option>
            {(zones.data?.results ?? []).map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
          </select>
        </label>
        <div className="col-span-2">
          <Field label="Name on the estimate" value={form.item} onChange={v => set("item", v)}
            placeholder={chosen?.name ?? "Defaults to the furniture name"} />
        </div>
        <Field label="Width" value={form.width} onChange={v => set("width", v)} placeholder={chosen?.default_length || `7'0"`} />
        <Field label="Height" value={form.height} onChange={v => set("height", v)} placeholder={chosen?.default_height || `9'6"`} />
        <Field label="Depth" value={form.depth} onChange={v => set("depth", v)} placeholder={chosen?.default_breadth || `2'0"`} />
        <div className="flex items-end pb-2"><OptionsControls compact options={options} onChange={setOptions} /></div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SMART ESTIMATE GENERATOR — brand/model preferences applied to rows
   ══════════════════════════════════════════════════════════════════ */

const SMART_GROUPS: { key: string; label: string; hint: string }[] = [
  { key: "plywood", label: "Plywood", hint: "Every ply thickness — rows and door / shelf / drawer boards" },
  { key: "hardware", label: "Hardware", hint: "Hinges, channels, handles, knobs, locks" },
  { key: "kitchen_accessories", label: "Kitchen Accessories", hint: "Baskets, trays, organisers" },
  { key: "finishing", label: "Finishing", hint: "Laminate, acrylic, liner, edging" },
];

function SmartEstimateGenerator({
  projectId, estimateId, disabled, onApplied, onSelectionsChanged, onGenerated, onError,
}: {
  projectId: number;
  estimateId: number;
  disabled: boolean;
  onApplied: () => void;
  onSelectionsChanged: () => void;
  onGenerated: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const toast = useToast();
  const options = useApiData(() => libraryApi.smartOptions(), []);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const requiredGroups = SMART_GROUPS.filter(group => (options.data?.[group.key] ?? []).length > 0);
  const picked = Object.entries(chosen).filter(([, id]) => id)
    .map(([group, id]) => ({ group, brand_id: Number(id) }));
  const allRequiredSelected = requiredGroups.length > 0
    && requiredGroups.every(group => !!chosen[group.key]);

  const apply = async () => {
    if (!allRequiredSelected || options.loading) return;
    setApplying(true);
    try {
      const res = await estimatesApi.applySmartBrands(projectId, estimateId, picked);
      if (res.brand_result.unchanged > 0) {
        toast.info("Some rows kept their brand",
          `${res.brand_result.changed} switched; ${res.brand_result.unchanged} kept — the brand has no model in their category`);
      }
      onApplied();
      await onGenerated();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Could not apply the brands.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mb-4 bg-gradient-to-br from-nicara-dark to-[#2a1f18] rounded-2xl overflow-hidden border border-stone-700">
      <div className="px-5 py-3 border-b border-stone-700">
        <div className="text-[14px] font-bold text-white flex items-center gap-2">
          <Brain size={16} /> Smart Estimate Generator
        </div>
        <div className="text-[11px] text-stone-400 mt-0.5">
          Choose a brand per group — every matching row and part switches to that brand&apos;s model in its own
          category and is re-priced from Raw Material. Quantities don&apos;t change.
        </div>
      </div>

      {options.loading && <div className="p-4 text-center text-stone-400 text-[11px]">Loading brands…</div>}
      <div className="grid grid-cols-4 gap-3 p-5">
        {SMART_GROUPS.map(g => {
          const brands = options.data?.[g.key] ?? [];
          return (
            <label key={g.key} className="block">
              <span className="text-[10px] font-bold text-stone-300 uppercase tracking-wider block mb-1">{g.label}</span>
              <select value={chosen[g.key] ?? ""} onChange={e => {
                setChosen(c => ({ ...c, [g.key]: e.target.value }));
                onSelectionsChanged();
              }}
                disabled={brands.length === 0}
                className="w-full px-2 py-2 bg-stone-800 border border-stone-600 rounded-lg text-[11px] text-white outline-none focus:border-nicara-gold cursor-pointer disabled:opacity-50">
                <option value="">Keep current</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id} title={b.categories.join(", ")}>
                    {b.name} ({b.categories.length} {b.categories.length === 1 ? "category" : "categories"})
                  </option>
                ))}
              </select>
              <span className="text-[9px] text-stone-500 mt-1 block">{g.hint}</span>
            </label>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-stone-700 flex items-center justify-between">
        <span className="text-[11px] text-stone-300">
          {options.loading
            ? "Loading available brands…"
            : `${requiredGroups.filter(group => !!chosen[group.key]).length}/${requiredGroups.length} brand groups selected`}
        </span>
        <button onClick={apply} disabled={disabled || applying || options.loading || !allRequiredSelected}
          className="px-6 py-2.5 bg-nicara-gold border-none rounded-xl text-white text-[12px] font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50">
          {applying ? "Applying…" : "Apply to Estimate"}
        </button>
      </div>
      {!options.loading && requiredGroups.length === 0 && (
        <div className="px-5 pb-3 text-[10px] text-amber-300">
          No Smart Estimate brand options are available. Add raw-material brands before applying prices.
        </div>
      )}
    </div>
  );
}
