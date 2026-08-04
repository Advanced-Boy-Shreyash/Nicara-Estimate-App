"use client";

import { useState } from "react";
import { ApiError, deliverablesApi } from "@/lib/api";
import type { Deliverable, DeliverableType, Project } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Field, Select, TextArea } from "@/components/ui/Form";
import { ErrorState, Loading } from "@/components/ui/States";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "revision", label: "Revision Required" },
];

/**
 * Initial Engagement → FL & Mood Board.
 * Two version tables side by side, both backed by the deliverables endpoint.
 */
export default function DeliverablesTab({
  project, types,
}: {
  project: Project;
  types: { type: DeliverableType; title: string; icon: string }[];
}) {
  const toast = useToast();
  const { data, loading, error, reload } = useApiData(
    () => deliverablesApi.list(project.id),
    [project.id]
  );
  const [adding, setAdding] = useState<DeliverableType | null>(null);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const all = data?.results ?? [];

  return (
    <>
      <div className={`grid gap-4 ${types.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {types.map(({ type, title, icon }) => (
          <VersionTable
            key={type}
            title={title}
            icon={icon}
            versions={all.filter(d => d.type === type)}
            onAdd={() => setAdding(type)}
            onStatusChange={async (id, status) => {
              try {
                await deliverablesApi.update(project.id, id, { status: status as Deliverable["status"] });
                toast.success("Updated", `Marked as ${status}`);
                void reload();
              } catch {
                toast.error("Failed", "Could not update the status");
              }
            }}
            onDelete={async (id, name) => {
              try {
                await deliverablesApi.delete(project.id, id);
                toast.info("Removed", name);
                void reload();
              } catch {
                toast.error("Failed", "Could not remove this version");
              }
            }}
          />
        ))}
      </div>

      {adding && (
        <AddVersionModal
          projectId={project.id}
          type={adding}
          title={types.find(t => t.type === adding)?.title ?? "Deliverable"}
          onClose={() => setAdding(null)}
          onSaved={() => { setAdding(null); toast.success("Added", "New version recorded"); void reload(); }}
        />
      )}
    </>
  );
}

function VersionTable({
  title, icon, versions, onAdd, onStatusChange, onDelete,
}: {
  title: string;
  icon: string;
  versions: Deliverable[];
  onAdd: () => void;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number, name: string) => void;
}) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 border-b border-surface-100">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">{icon}</span>
          <span className="text-[12px] font-bold text-nicara-dark uppercase tracking-wider">{title}</span>
          <span className="text-[10px] text-surface-400">({versions.length})</span>
        </div>
        <button onClick={onAdd}
          className="text-[11px] font-semibold text-nicara-gold bg-transparent border-none cursor-pointer hover:underline">
          + Add Version
        </button>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-surface-50">
            {["Date", "Version", "File", "By", "Status", ""].map(h => (
              <th key={h} className="px-3 py-2 text-surface-500 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {versions.map(v => (
            <tr key={v.id} className="border-b border-surface-100 hover:bg-surface-50">
              <td className="px-3 py-2 text-surface-500 whitespace-nowrap">{v.date}</td>
              <td className="px-3 py-2 font-semibold text-nicara-dark whitespace-nowrap">{v.version}</td>
              <td className="px-3 py-2 text-surface-600 max-w-[160px] truncate" title={v.file_name || v.remarks}>
                {v.file_name || v.remarks || "—"}
              </td>
              <td className="px-3 py-2 text-surface-500 whitespace-nowrap">{v.uploaded_by_name || "—"}</td>
              <td className="px-3 py-2">
                <select value={v.status} onChange={e => onStatusChange(v.id, e.target.value)}
                  className="text-[11px] px-2 py-1 rounded-lg border border-surface-200 bg-white cursor-pointer outline-none focus:border-nicara-gold">
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => onDelete(v.id, `${title} ${v.version}`)} title="Remove"
                  className="text-surface-300 hover:text-red-500 bg-transparent border-none cursor-pointer text-[13px]">✕</button>
              </td>
            </tr>
          ))}
          {versions.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-8 text-center text-surface-400 text-[12px]">
              No versions uploaded yet
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddVersionModal({
  projectId, type, title, onClose, onSaved,
}: {
  projectId: number;
  type: DeliverableType;
  title: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [version, setVersion] = useState("Ver 1");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("pending");
  const [remarks, setRemarks] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!version.trim()) { setBanner("Give the version a name, e.g. Ver 1."); return; }
    setSaving(true);
    setBanner("");
    try {
      await deliverablesApi.create(projectId, {
        type, version, file_name: fileName,
        status: status as Deliverable["status"], remarks, date,
      });
      onSaved();
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : "Could not save.");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="sm" title={`Add ${title} Version`}
      subtitle="File upload comes with the storage integration — record the version now."
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Version"}</Btn>
        </>
      }>
      {banner && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">{banner}</div>
      )}
      <div className="space-y-3">
        <Field label="Version" value={version} onChange={setVersion} required placeholder="Ver 1" />
        <Field label="Date" type="date" value={date} onChange={setDate} />
        <Field label="File Name" value={fileName} onChange={setFileName} placeholder="sharma_fl_v1.pdf" />
        <Select label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <TextArea label="Remarks" value={remarks} onChange={setRemarks} rows={2}
          placeholder="Kitchen island position needs change" />
      </div>
    </Modal>
  );
}
