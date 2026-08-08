"use client";

import { useMemo, useRef, useState } from "react";
import { ApiError, designRequirementsApi } from "@/lib/api";
import type { DesignRequirement, Project } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import { Btn } from "@/components/ui/Form";
import Modal from "@/components/ui/Modal";
import { ErrorState, InlineError, Loading } from "@/components/ui/States";

type Row = Omit<DesignRequirement, "id" | "sort_order"> & { id?: number; designImage?: string };

const BLANK_ROW: Row = {
  room: "", unit: "", length: "", breadth: "", height: "",
  finishing: "", remarks: "", design_required: true,
};

const CELL = "w-full px-2 py-1.5 border border-transparent rounded-lg text-[11px] bg-transparent outline-none focus:border-nicara-gold focus:bg-white";
const TH = "px-2 py-2 text-stone-200 font-semibold text-[10px] text-left whitespace-nowrap border-r border-stone-700";
const BD = "border-r border-surface-200";

/* ── Room definitions with pre-filled sub-items ──────────────── */

const ROOMS: { name: string; icon: string; items: { unit: string; finishing: string }[] }[] = [
  { name: "Foyer", icon: "🚪", items: [
    { unit: "Shoe Rack", finishing: "Laminate" },
    { unit: "Console Unit", finishing: "Laminate" },
    { unit: "False Ceiling", finishing: "Gypsum" },
  ]},
  { name: "Living Room", icon: "🛋️", items: [
    { unit: "TV Console", finishing: "Veneer" },
    { unit: "Wall Panel", finishing: "Veneer" },
    { unit: "Display Unit", finishing: "Laminate" },
    { unit: "False Ceiling", finishing: "Gypsum" },
    { unit: "Painting", finishing: "Paint" },
  ]},
  { name: "Dining Room", icon: "🍽️", items: [
    { unit: "Crockery Unit", finishing: "Laminate" },
    { unit: "Bar Unit", finishing: "Veneer" },
    { unit: "False Ceiling", finishing: "Gypsum" },
  ]},
  { name: "Kitchen", icon: "🍳", items: [
    { unit: "Base Unit", finishing: "Acrylic" },
    { unit: "Wall Unit", finishing: "Acrylic" },
    { unit: "Loft Unit", finishing: "Laminate" },
    { unit: "Tall Unit", finishing: "Acrylic" },
    { unit: "Countertop", finishing: "Granite" },
    { unit: "Backsplash", finishing: "Tile" },
  ]},
  { name: "Master Bedroom", icon: "🛏️", items: [
    { unit: "Wardrobe", finishing: "Laminate" },
    { unit: "Walk-in Closet", finishing: "Laminate" },
    { unit: "Dressing Unit", finishing: "Veneer" },
    { unit: "TV Unit", finishing: "Veneer" },
    { unit: "Bed Back Wall", finishing: "Veneer" },
    { unit: "False Ceiling", finishing: "Gypsum" },
  ]},
  { name: "Bedroom 2", icon: "🛏️", items: [
    { unit: "Wardrobe", finishing: "Laminate" },
    { unit: "Study Table", finishing: "Laminate" },
    { unit: "TV Unit", finishing: "Laminate" },
    { unit: "False Ceiling", finishing: "Gypsum" },
  ]},
  { name: "Bedroom 3", icon: "🛏️", items: [
    { unit: "Wardrobe", finishing: "Laminate" },
    { unit: "Study Table", finishing: "Laminate" },
    { unit: "False Ceiling", finishing: "Gypsum" },
  ]},
  { name: "Master Bathroom", icon: "🚿", items: [
    { unit: "Vanity Unit", finishing: "Acrylic" },
    { unit: "Glass Partition", finishing: "Glass" },
  ]},
  { name: "Common Bathroom", icon: "🚿", items: [
    { unit: "Vanity Unit", finishing: "Laminate" },
    { unit: "Glass Partition", finishing: "Glass" },
  ]},
  { name: "Balcony", icon: "🌿", items: [
    { unit: "Planter Box", finishing: "Paint" },
    { unit: "Railing", finishing: "Glass" },
  ]},
  { name: "Study", icon: "📚", items: [
    { unit: "Study Table", finishing: "Veneer" },
    { unit: "Bookshelf", finishing: "Laminate" },
    { unit: "False Ceiling", finishing: "Gypsum" },
  ]},
  { name: "Pooja Room", icon: "🪔", items: [
    { unit: "Pooja Unit", finishing: "Veneer" },
    { unit: "Backdrop", finishing: "Veneer" },
  ]},
  { name: "Kids Room", icon: "🧸", items: [
    { unit: "Wardrobe", finishing: "Laminate" },
    { unit: "Study Table", finishing: "Laminate" },
    { unit: "Bookshelf", finishing: "Laminate" },
    { unit: "False Ceiling", finishing: "Gypsum" },
  ]},
  { name: "Utility", icon: "🧹", items: [
    { unit: "Storage Unit", finishing: "Laminate" },
    { unit: "Countertop", finishing: "Granite" },
  ]},
  { name: "Bar Unit", icon: "🍸", items: [
    { unit: "Bar Cabinet", finishing: "Veneer" },
    { unit: "Bar Counter", finishing: "Granite" },
    { unit: "Glass Shelf", finishing: "Glass" },
  ]},
  { name: "Home Theatre", icon: "🎬", items: [
    { unit: "TV Console", finishing: "Veneer" },
    { unit: "Acoustic Panel", finishing: "Upholstery" },
    { unit: "False Ceiling", finishing: "Gypsum" },
  ]},
];

const FINISHING_OPTIONS = ["Laminate", "Veneer", "Acrylic", "Gypsum", "Upholstery", "Paint", "PU", "Glass", "Granite", "Tile", "HPL"];

/**
 * Initial Engagement → Design Requirements.
 * Room selection chips + grouped table + image upload + AutoCAD integration.
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
  const [fRoom, setFRoom] = useState("All");
  const [fFinishing, setFFinishing] = useState("All");
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const serverRows = data?.results ?? [];
  const working: Row[] = rows ?? serverRows;
  const dirty = rows !== null;

  const uRooms = useMemo(() => ["All", ...Array.from(new Set(working.map(r => r.room).filter(Boolean)))], [working]);
  const uFinishings = useMemo(() => ["All", ...Array.from(new Set(working.map(r => r.finishing).filter(Boolean)))], [working]);

  const filtered = useMemo(() => {
    let result = working;
    if (fRoom !== "All") result = result.filter(r => r.room === fRoom);
    if (fFinishing !== "All") result = result.filter(r => r.finishing === fFinishing);
    return result;
  }, [working, fRoom, fFinishing]);

  // Group by room
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    filtered.forEach(row => {
      const room = row.room || "Uncategorized";
      if (!map.has(room)) map.set(room, []);
      map.get(room)!.push(row);
    });
    return Array.from(map.entries()).map(([room, items]) => ({ room, items }));
  }, [filtered]);

  const roomCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    working.forEach(r => { if (r.room) counts[r.room] = (counts[r.room] || 0) + 1; });
    return counts;
  }, [working]);

  const editByRef = (actualRow: Row, key: keyof Row, value: string | boolean) => {
    const actualIndex = working.indexOf(actualRow);
    if (actualIndex === -1) return;
    setRows(current => {
      const next = [...(current ?? serverRows)];
      next[actualIndex] = { ...next[actualIndex], [key]: value };
      return next;
    });
  };

  const removeByRef = (actualRow: Row) => {
    const actualIndex = working.indexOf(actualRow);
    if (actualIndex === -1) return;
    setRows((rows ?? serverRows).filter((_, i) => i !== actualIndex));
  };

  const addRow = () => setRows([...(rows ?? serverRows), { ...BLANK_ROW }]);

  const addRoomRows = (room: typeof ROOMS[number]) => {
    const newRows: Row[] = room.items.map(item => ({
      ...BLANK_ROW,
      room: room.name,
      unit: item.unit,
      finishing: item.finishing,
    }));
    setRows([...(rows ?? serverRows), ...newRows]);
  };

  const handleImageUpload = (row: Row, file: File) => {
    const url = URL.createObjectURL(file);
    editByRef(row, "designImage" as keyof Row, url);
  };

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

  const ddCls = "px-2.5 py-1.5 border border-surface-200 rounded-lg text-[11px] outline-none bg-white cursor-pointer focus:border-nicara-gold";

  return (
    <div>
      {banner && <InlineError message={banner} />}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <Summary label="Type" value={project.project_type || "—"} />
        <Summary label="Purpose" value={project.purpose || "—"} />
        <Summary label="Interior Style" value={project.interior_style || "—"} />
        <Summary label="Total Rows" value={`${working.length} item(s)`} />
      </div>

      {/* ── Room Selection Chips ── */}
      <div className="bg-white border border-surface-200 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold text-nicara-gold uppercase tracking-wider">Select Rooms</span>
          <span className="text-[10px] text-surface-400">Click a room to add pre-filled rows</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ROOMS.map(room => {
            const count = roomCounts[room.name] || 0;
            return (
              <button key={room.name} onClick={() => addRoomRows(room)}
                className={`group flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold border cursor-pointer transition-all hover:scale-[1.02] ${
                  count > 0
                    ? "bg-nicara-gold/10 border-nicara-gold text-nicara-gold shadow-sm"
                    : "bg-white border-surface-200 text-surface-600 hover:border-nicara-gold/50 hover:bg-nicara-gold/5"
                }`}>
                <span className="text-sm">{room.icon}</span>
                <span>{room.name}</span>
                {count > 0 && (
                  <span className="text-[9px] bg-nicara-gold text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">{count}</span>
                )}
                <span className="text-[9px] text-surface-400 group-hover:text-nicara-gold/70">+{room.items.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex gap-2 flex-wrap mb-3 p-2.5 px-3.5 bg-white border border-surface-200 rounded-xl items-center">
        <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mr-1">Filter:</span>
        <select value={fRoom} onChange={e => setFRoom(e.target.value)} className={ddCls}>
          {uRooms.map(o => <option key={o} value={o}>{o === "All" ? "All Rooms" : o}</option>)}
        </select>
        <select value={fFinishing} onChange={e => setFFinishing(e.target.value)} className={ddCls}>
          {uFinishings.map(o => <option key={o} value={o}>{o === "All" ? "All Finishings" : o}</option>)}
        </select>
        {(fRoom !== "All" || fFinishing !== "All") && (
          <button onClick={() => { setFRoom("All"); setFFinishing("All"); }}
            className="px-2.5 py-1 bg-transparent border border-surface-200 rounded-md text-[11px] text-surface-400 cursor-pointer hover:bg-surface-50">✕ Clear</button>
        )}
        <span className="ml-auto text-[11px] text-surface-400">{filtered.length}/{working.length}</span>
      </div>

      {/* ── Table (grouped by Room like Initial Estimate) ── */}
      <div className="overflow-x-auto border border-surface-200 rounded-xl">
        <table className="w-full text-[11px] min-w-[1000px]">
          <thead>
            <tr className="bg-nicara-dark">
              {["Unit Selection", "L", "B", "H", "Finishing", "Remarks", "Design Ref.", "🗑"].map(h => (
                <th key={h} className={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(group => (
              <RoomGroup
                key={group.room}
                group={group}
                editByRef={editByRef}
                removeByRef={removeByRef}
                onImageUpload={handleImageUpload}
                onViewImage={setViewingImage}
              />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-surface-400">
                {working.length === 0 ? "No requirements yet — select a room above or add a blank row." : "No rows match the current filter."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-2.5 border border-t-0 border-surface-200 rounded-b-xl bg-surface-50 flex items-center gap-3">
        <button onClick={addRow}
          className="text-[12px] font-semibold text-nicara-gold bg-transparent border-none cursor-pointer hover:underline">
          + Add Blank Row
        </button>
        <span className="text-[10px] text-surface-400">or select a room above to add pre-filled rows</span>
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

      {/* ── Image Lightbox Modal ── */}
      {viewingImage && (
        <Modal open onClose={() => setViewingImage(null)} size="lg" title="Design Reference Image"
          footer={<Btn variant="ghost" onClick={() => setViewingImage(null)}>Close</Btn>}>
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewingImage} alt="Design Reference" className="max-w-full max-h-[70vh] rounded-xl" />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Room group with heading row (like Initial Estimate area grouping) ── */

function RoomGroup({ group, editByRef, removeByRef, onImageUpload, onViewImage }: {
  group: { room: string; items: Row[] };
  editByRef: (row: Row, key: keyof Row, value: string | boolean) => void;
  removeByRef: (row: Row) => void;
  onImageUpload: (row: Row, file: File) => void;
  onViewImage: (url: string) => void;
}) {
  const roomDef = ROOMS.find(r => r.name === group.room);
  return (
    <>
      {/* Room heading */}
      <tr className="bg-nicara-gold/10">
        <td colSpan={8} className="px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">{roomDef?.icon || "📁"}</span>
            <span className="text-[11px] font-bold text-nicara-dark uppercase tracking-wider">{group.room}</span>
            <span className="text-[10px] text-surface-400">{group.items.length} item(s)</span>
          </div>
        </td>
      </tr>
      {/* Rows under this room */}
      {group.items.map((row, i) => (
        <DesignRow
          key={row.id ?? `new-${group.room}-${i}`}
          row={row}
          ri={i}
          editByRef={editByRef}
          removeByRef={removeByRef}
          onImageUpload={onImageUpload}
          onViewImage={onViewImage}
        />
      ))}
    </>
  );
}

/* ── Single design requirement row ── */

function DesignRow({ row, ri, editByRef, removeByRef, onImageUpload, onViewImage }: {
  row: Row;
  ri: number;
  editByRef: (row: Row, key: keyof Row, value: string | boolean) => void;
  removeByRef: (row: Row) => void;
  onImageUpload: (row: Row, file: File) => void;
  onViewImage: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <tr className={`border-b border-surface-100 ${ri % 2 === 0 ? "bg-white" : "bg-surface-50/50"}`}>
      {/* Unit Selection */}
      <td className={`px-2 py-1.5 min-w-[140px] ${BD}`}>
        <input className={CELL} value={row.unit}
          onChange={e => editByRef(row, "unit", e.target.value)} placeholder="Wardrobe" />
      </td>
      {/* L B H */}
      <td className={`px-2 py-1.5 w-[60px] ${BD}`}><input className={`${CELL} font-mono`} value={row.length}
        onChange={e => editByRef(row, "length", e.target.value)} placeholder={`8'0"`} /></td>
      <td className={`px-2 py-1.5 w-[60px] ${BD}`}><input className={`${CELL} font-mono`} value={row.breadth}
        onChange={e => editByRef(row, "breadth", e.target.value)} placeholder={`2'0"`} /></td>
      <td className={`px-2 py-1.5 w-[60px] ${BD}`}><input className={`${CELL} font-mono`} value={row.height}
        onChange={e => editByRef(row, "height", e.target.value)} placeholder={`8'0"`} /></td>
      {/* Finishing */}
      <td className={`px-2 py-1.5 min-w-[100px] ${BD}`}>
        <select className={`${CELL} cursor-pointer`} value={row.finishing}
          onChange={e => editByRef(row, "finishing", e.target.value)}>
          <option value="">Select…</option>
          {FINISHING_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </td>
      {/* Remarks */}
      <td className={`px-2 py-1.5 ${BD}`}>
        <input className={CELL} value={row.remarks}
          onChange={e => editByRef(row, "remarks", e.target.value)} placeholder="—" />
      </td>
      {/* Design Ref — Image Upload */}
      <td className={`px-2 py-1.5 ${BD}`}>
        <input type="file" ref={fileRef} accept="image/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) onImageUpload(row, e.target.files[0]); }} />
        {row.designImage ? (
          <div className="flex items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.designImage} alt="Design" className="w-6 h-6 rounded object-cover border border-surface-200" />
            <button onClick={() => onViewImage(row.designImage!)}
              className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[9px] font-semibold text-blue-600 cursor-pointer hover:bg-blue-100">
              👁 View
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            className="px-2 py-1 bg-surface-50 border border-dashed border-surface-300 rounded text-[10px] text-surface-500 cursor-pointer hover:border-nicara-gold hover:text-nicara-gold">
            📷 Upload
          </button>
        )}
      </td>

      {/* Delete */}
      <td className="px-2 py-1.5 text-center">
        <button onClick={() => removeByRef(row)} title="Remove row"
          className="bg-transparent border-none text-red-300 cursor-pointer text-[14px] p-0 hover:text-red-500 transition-colors">🗑</button>
      </td>
    </tr>
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
