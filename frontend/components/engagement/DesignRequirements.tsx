"use client";

import { useState } from "react";
import { ApiError, designRequirementsApi } from "@/lib/api";
import type { DesignRequirement, Project } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import { Btn } from "@/components/ui/Form";
import { ErrorState, InlineError, Loading } from "@/components/ui/States";

type Row = Omit<DesignRequirement, "id" | "sort_order"> & { id?: number };

const BLANK_ROW: Row = {
  room: "", unit: "", length: "", breadth: "", height: "",
  finishing: "", remarks: "", design_required: true,
};

const CELL = "w-full px-2 py-1.5 border border-transparent rounded-lg text-[12px] bg-transparent outline-none focus:border-nicara-gold focus:bg-white";

/**
 * Initial Engagement → Design Requirements.
 *
 * The grid is edited as a whole and saved with one bulk PUT, which is how the
 * backend expects it — matches the way a designer fills the table in.
 */
export default function DesignRequirements({ project }: { project: Project }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApiData(
    () => designRequirementsApi.list(project.id),
    [project.id]
  );

  const [rows, setRows] = useState<Row[] | null>(null);
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  // Take a local copy the first time the server data lands.
  const serverRows = data?.results ?? [];
  const working = rows ?? serverRows;
  const dirty = rows !== null;

  const edit = (index: number, key: keyof Row, value: string | boolean) => {
    setRows(current => {
      const next = [...(current ?? serverRows)];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const addRow = () => setRows([...(rows ?? serverRows), { ...BLANK_ROW }]);

  const removeRow = (index: number) =>
    setRows((rows ?? serverRows).filter((_, i) => i !== index));

  const save = async () => {
    const payload = working
      .filter(r => r.room.trim() || r.unit.trim())
      .map(r => ({
        room: r.room, unit: r.unit, length: r.length, breadth: r.breadth,
        height: r.height, finishing: r.finishing, remarks: r.remarks,
        design_required: r.design_required,
      }));

    setSaving(true);
    setBanner("");
    try {
      await designRequirementsApi.saveAll(project.id, payload);
      setRows(null);
      await reload();
      toast.success("Saved", `${payload.length} requirement row(s) stored`);
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : "Could not save the grid.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !dirty) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      {banner && <InlineError message={banner} />}

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Summary label="Type" value={project.project_type || "—"} />
        <Summary label="Purpose" value={project.purpose || "—"} />
        <Summary label="Interior Style" value={project.interior_style || "—"} />
        <Summary label="Total Rows" value={`${working.length} item(s)`} />
      </div>

      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-nicara-dark">
                {["S.No", "Room/Area", "Unit Selection", "L", "B", "H", "Finishing", "Remarks", "Design Req.", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {working.map((row, i) => (
                <tr key={row.id ?? `new-${i}`} className="border-b border-surface-100 hover:bg-surface-50">
                  <td className="px-3 py-1.5 text-surface-400 font-mono">{i + 1}</td>
                  <td className="px-2 py-1.5"><input className={CELL} value={row.room}
                    onChange={e => edit(i, "room", e.target.value)} placeholder="Master Bedroom" /></td>
                  <td className="px-2 py-1.5"><input className={CELL} value={row.unit}
                    onChange={e => edit(i, "unit", e.target.value)} placeholder="Wardrobe" /></td>
                  <td className="px-2 py-1.5 w-[80px]"><input className={`${CELL} font-mono`} value={row.length}
                    onChange={e => edit(i, "length", e.target.value)} placeholder={`8'0"`} /></td>
                  <td className="px-2 py-1.5 w-[80px]"><input className={`${CELL} font-mono`} value={row.breadth}
                    onChange={e => edit(i, "breadth", e.target.value)} placeholder={`2'0"`} /></td>
                  <td className="px-2 py-1.5 w-[80px]"><input className={`${CELL} font-mono`} value={row.height}
                    onChange={e => edit(i, "height", e.target.value)} placeholder={`8'0"`} /></td>
                  <td className="px-2 py-1.5"><input className={CELL} value={row.finishing}
                    onChange={e => edit(i, "finishing", e.target.value)} placeholder="Laminate" /></td>
                  <td className="px-2 py-1.5"><input className={CELL} value={row.remarks}
                    onChange={e => edit(i, "remarks", e.target.value)} placeholder="—" /></td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox" checked={row.design_required}
                      onChange={e => edit(i, "design_required", e.target.checked)}
                      className="w-4 h-4 accent-nicara-gold cursor-pointer" />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button onClick={() => removeRow(i)} title="Remove row"
                      className="text-surface-300 hover:text-red-500 bg-transparent border-none cursor-pointer text-[13px]">✕</button>
                  </td>
                </tr>
              ))}
              {working.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-surface-400">
                  No requirements yet — add the first row below.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2.5 border-t border-surface-100 bg-surface-50">
          <button onClick={addRow}
            className="text-[12px] font-semibold text-nicara-gold bg-transparent border-none cursor-pointer hover:underline">
            + Add Row
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <Btn onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : dirty ? "Save Requirements" : "No Changes"}
        </Btn>
        {dirty && !saving && (
          <button onClick={() => { setRows(null); setBanner(""); }}
            className="text-[12px] text-surface-500 bg-transparent border-none cursor-pointer hover:underline">
            Discard
          </button>
        )}
        {dirty && <span className="text-[11px] text-amber-600">Unsaved changes</span>}
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-surface-200 rounded-xl px-3.5 py-2.5">
      <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">{label}</div>
      <div className="text-[13px] font-semibold text-nicara-dark mt-0.5">{value}</div>
    </div>
  );
}
