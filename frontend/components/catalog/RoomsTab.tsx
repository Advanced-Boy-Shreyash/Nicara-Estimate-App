"use client";

import { useState } from "react";
import { ApiError, catalogApi } from "@/lib/api";
import type { CatalogRoom, CatalogZone } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Field, TextArea } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading } from "@/components/ui/States";

/** Rooms (Kitchen, Master Bedroom) and Zones (East Wall, Island) side by side. */
export default function RoomsTab({ onChange }: { onChange: () => void }) {
  const toast = useToast();
  const rooms = useApiData(() => catalogApi.rooms(), []);
  const zones = useApiData(() => catalogApi.zones(), []);
  const [editRoom, setEditRoom] = useState<CatalogRoom | "new" | null>(null);
  const [editZone, setEditZone] = useState<CatalogZone | "new" | null>(null);

  const roomList = rooms.data?.results ?? [];
  const zoneList = zones.data?.results ?? [];

  return (
    <div className="grid grid-cols-2 gap-5">
      {/* Rooms */}
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-surface-100 bg-nicara-dark">
          <div>
            <div className="text-[13px] font-bold text-white">🏠 Rooms</div>
            <div className="text-[10px] text-stone-400">Room types furniture can belong to</div>
          </div>
          <button onClick={() => setEditRoom("new")}
            className="px-3.5 py-1.5 bg-nicara-gold border-none rounded-lg text-[11px] font-bold text-white cursor-pointer">
            + Add Room
          </button>
        </div>
        <div className="p-3">
          {rooms.loading && <Loading />}
          {rooms.error && <ErrorState message={rooms.error} onRetry={rooms.reload} />}
          {!rooms.loading && roomList.length === 0 && (
            <EmptyState icon="🏠" title="No rooms yet" hint="Add Kitchen, Master Bedroom, …" />
          )}
          {roomList.map(room => (
            <button key={room.id} onClick={() => setEditRoom(room)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer text-left mb-1.5 ${
                room.is_active ? "border-surface-200 hover:border-nicara-gold bg-white" : "border-surface-100 bg-surface-50 opacity-60"
              }`}>
              <div className="flex items-center gap-2.5">
                <span className="text-[16px]">{room.icon}</span>
                <div>
                  <div className="text-[12px] font-semibold text-nicara-dark">{room.name}</div>
                  <div className="text-[10px] text-surface-400 font-mono">{room.code}</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {room.furniture_count} furniture
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Zones */}
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-surface-100 bg-nicara-dark">
          <div>
            <div className="text-[13px] font-bold text-white">📐 Zones</div>
            <div className="text-[10px] text-stone-400">Walls and areas within a room</div>
          </div>
          <button onClick={() => setEditZone("new")}
            className="px-3.5 py-1.5 bg-nicara-gold border-none rounded-lg text-[11px] font-bold text-white cursor-pointer">
            + Add Zone
          </button>
        </div>
        <div className="p-3">
          {zones.loading && <Loading />}
          {zones.error && <ErrorState message={zones.error} onRetry={zones.reload} />}
          {!zones.loading && zoneList.length === 0 && (
            <EmptyState icon="📐" title="No zones yet" hint="Add East Wall, Ceiling, Island, …" />
          )}
          <div className="flex flex-wrap gap-2">
            {zoneList.map(zone => (
              <button key={zone.id} onClick={() => setEditZone(zone)}
                className={`px-3 py-2 rounded-xl border cursor-pointer text-[12px] font-medium ${
                  zone.is_active
                    ? "border-surface-200 hover:border-nicara-gold bg-white text-nicara-dark"
                    : "border-surface-100 bg-surface-50 text-surface-400 opacity-60"
                }`}>
                {zone.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {editRoom && (
        <RoomModal room={editRoom === "new" ? null : editRoom}
          onClose={() => setEditRoom(null)}
          onSaved={msg => { setEditRoom(null); toast.success("Saved", msg); void rooms.reload(); onChange(); }} />
      )}
      {editZone && (
        <ZoneModal zone={editZone === "new" ? null : editZone}
          onClose={() => setEditZone(null)}
          onSaved={msg => { setEditZone(null); toast.success("Saved", msg); void zones.reload(); onChange(); }} />
      )}
    </div>
  );
}

function RoomModal({ room, onClose, onSaved }: {
  room: CatalogRoom | null; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<CatalogRoom>>(
    room ? { ...room } : { name: "", icon: "🏠", description: "", is_active: true });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name?.trim()) { setErrors({ name: ["Name is required."] }); return; }
    setSaving(true); setBanner(""); setErrors({});
    try {
      if (room) { await catalogApi.updateRoom(room.id, form); onSaved(`${form.name} updated`); }
      else { await catalogApi.createRoom(form); onSaved(`${form.name} added`); }
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); }
      else setBanner("Could not save.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!room) return;
    setSaving(true);
    try { await catalogApi.deleteRoom(room.id); onSaved(`${room.name} archived`); }
    catch { setBanner("Could not archive."); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="sm" title={room ? `Edit ${room.name}` : "New Room"}
      footer={<>
        {room && room.is_active && <Btn variant="danger" onClick={remove} disabled={saving}>Archive</Btn>}
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <Field label="Icon" value={form.icon ?? ""} onChange={v => setForm(f => ({ ...f, icon: v }))} />
          <div className="col-span-3">
            <Field label="Room Name" value={form.name ?? ""} onChange={v => setForm(f => ({ ...f, name: v }))}
              required error={errors.name?.[0]} placeholder="Kitchen" />
          </div>
        </div>
        <TextArea label="Description" value={form.description ?? ""}
          onChange={v => setForm(f => ({ ...f, description: v }))} rows={2} />
      </div>
    </Modal>
  );
}

function ZoneModal({ zone, onClose, onSaved }: {
  zone: CatalogZone | null; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(zone?.name ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { setErrors({ name: ["Name is required."] }); return; }
    setSaving(true); setBanner(""); setErrors({});
    try {
      if (zone) { await catalogApi.updateZone(zone.id, { name }); onSaved(`${name} updated`); }
      else { await catalogApi.createZone({ name }); onSaved(`${name} added`); }
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); }
      else setBanner("Could not save.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!zone) return;
    setSaving(true);
    try { await catalogApi.deleteZone(zone.id); onSaved(`${zone.name} archived`); }
    catch { setBanner("Could not archive."); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="sm" title={zone ? `Edit ${zone.name}` : "New Zone"}
      footer={<>
        {zone && zone.is_active && <Btn variant="danger" onClick={remove} disabled={saving}>Archive</Btn>}
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}
      <Field label="Zone Name" value={name} onChange={setName} required error={errors.name?.[0]}
        placeholder="East Wall" />
    </Modal>
  );
}
