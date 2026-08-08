"use client";

import { useRef, useState } from "react";
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

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: "⏳" },
  approved: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: "✅" },
  revision: { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: "↩" },
};

const ACCEPT_TYPES = ".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.gif,.dwg,.dxf";

/**
 * Initial Engagement → FL & Mood Board.
 * Card-based version list with file upload, download, and view.
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
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string } | null>(null);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const all = data?.results ?? [];

  return (
    <>
      <div className={`grid gap-4 ${types.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {types.map(({ type, title, icon }) => (
          <VersionSection
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
            onViewFile={(url, name) => setViewingFile({ url, name })}
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

      {/* File viewer modal */}
      {viewingFile && (
        <Modal open onClose={() => setViewingFile(null)} size="lg"
          title={`📄 ${viewingFile.name}`}
          footer={
            <>
              <a href={viewingFile.url} download={viewingFile.name}
                className="px-4 py-2 bg-surface-50 border border-surface-200 rounded-xl text-[12px] font-semibold text-nicara-dark no-underline hover:bg-surface-100">
                ⬇ Download
              </a>
              <Btn variant="ghost" onClick={() => setViewingFile(null)}>Close</Btn>
            </>
          }>
          <div className="flex items-center justify-center min-h-[300px]">
            {viewingFile.url.match(/\.(png|jpg|jpeg|gif)$/i) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewingFile.url} alt={viewingFile.name} className="max-w-full max-h-[70vh] rounded-xl" />
            ) : (
              <div className="text-center text-surface-400">
                <div className="text-4xl mb-3">📄</div>
                <div className="text-[13px] font-semibold text-nicara-dark mb-1">{viewingFile.name}</div>
                <div className="text-[11px]">Preview not available for this file type. Use the download button.</div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

/* ── Card-based version section (master-branch style) ── */

function VersionSection({
  title, icon, versions, onAdd, onStatusChange, onDelete, onViewFile,
}: {
  title: string;
  icon: string;
  versions: Deliverable[];
  onAdd: () => void;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number, name: string) => void;
  onViewFile: (url: string, name: string) => void;
}) {
  // Local file map for uploaded files (client-side only)
  const [fileMap, setFileMap] = useState<Record<number, { url: string; name: string; size: string }>>({});

  const handleFileUpload = (id: number, file: File) => {
    const url = URL.createObjectURL(file);
    const size = file.size < 1024 ? `${file.size} B`
      : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / 1048576).toFixed(1)} MB`;
    setFileMap(prev => ({ ...prev, [id]: { url, name: file.name, size } }));
  };

  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-surface-100 bg-surface-50/50">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">{icon}</span>
          <span className="text-[12px] font-bold text-nicara-dark uppercase tracking-wider">{title}</span>
          <span className="text-[10px] bg-surface-100 text-surface-500 px-2 py-0.5 rounded-full font-semibold">{versions.length}</span>
        </div>
        <button onClick={onAdd}
          className="flex items-center gap-1 px-3 py-1.5 bg-nicara-gold/10 border border-nicara-gold/30 rounded-lg text-[11px] font-semibold text-nicara-gold cursor-pointer hover:bg-nicara-gold/20">
          + Add Version
        </button>
      </div>

      {/* Version cards */}
      <div className="p-3 space-y-2.5">
        {versions.map(v => {
          const s = STATUS_STYLES[v.status] || STATUS_STYLES.pending;
          const uploadedFile = fileMap[v.id];
          return (
            <VersionCard key={v.id} v={v} s={s} uploadedFile={uploadedFile}
              onStatusChange={onStatusChange} onDelete={onDelete} onViewFile={onViewFile}
              onFileUpload={handleFileUpload} title={title} />
          );
        })}
        {versions.length === 0 && (
          <div className="text-center py-8 text-surface-400 text-[12px]">
            <div className="text-2xl mb-2">{icon}</div>
            No versions uploaded yet. Click <strong>+ Add Version</strong> to get started.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Single version card ── */

function VersionCard({ v, s, uploadedFile, onStatusChange, onDelete, onViewFile, onFileUpload, title }: {
  v: Deliverable;
  s: { bg: string; text: string; icon: string };
  uploadedFile?: { url: string; name: string; size: string };
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number, name: string) => void;
  onViewFile: (url: string, name: string) => void;
  onFileUpload: (id: number, file: File) => void;
  title: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`border ${s.bg} rounded-xl p-3 transition-all hover:shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${s.bg} ${s.text}`}>
            {s.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold text-nicara-dark">{v.version}</div>
            <div className="text-[10px] text-surface-400 flex items-center gap-2">
              <span>{v.date}</span>
              {v.uploaded_by_name && <span>· by {v.uploaded_by_name}</span>}
            </div>
            {v.remarks && <div className="text-[10px] text-surface-500 mt-0.5 truncate">{v.remarks}</div>}
          </div>
        </div>

        {/* Status select */}
        <select value={v.status} onChange={e => onStatusChange(v.id, e.target.value)}
          className={`text-[10px] px-2 py-1 rounded-lg border ${s.bg} ${s.text} font-semibold cursor-pointer outline-none`}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button onClick={() => onDelete(v.id, `${title} ${v.version}`)} title="Remove"
          className="text-surface-300 hover:text-red-500 bg-transparent border-none cursor-pointer text-[14px] p-0">🗑</button>
      </div>

      {/* File section */}
      <div className="mt-2 pt-2 border-t border-surface-100 flex items-center gap-2 flex-wrap">
        {/* Upload button */}
        <input type="file" ref={fileInputRef} accept={ACCEPT_TYPES} className="hidden"
          onChange={e => { if (e.target.files?.[0]) onFileUpload(v.id, e.target.files[0]); }} />

        {uploadedFile ? (
          <>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-surface-200 rounded-lg">
              <span className="text-[10px]">📎</span>
              <span className="text-[10px] font-semibold text-nicara-dark max-w-[120px] truncate">{uploadedFile.name}</span>
              <span className="text-[9px] text-surface-400">{uploadedFile.size}</span>
            </div>
            <button onClick={() => onViewFile(uploadedFile.url, uploadedFile.name)}
              className="px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg text-[10px] font-semibold text-blue-600 cursor-pointer hover:bg-blue-100">
              👁 View
            </button>
            <a href={uploadedFile.url} download={uploadedFile.name}
              className="px-2 py-1 bg-surface-50 border border-surface-200 rounded-lg text-[10px] font-semibold text-surface-600 cursor-pointer hover:bg-surface-100 no-underline">
              ⬇ Download
            </a>
          </>
        ) : (
          <>
            {v.file_name ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-surface-200 rounded-lg">
                <span className="text-[10px]">📎</span>
                <span className="text-[10px] font-semibold text-nicara-dark max-w-[120px] truncate">{v.file_name}</span>
              </div>
            ) : null}
            <button onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 bg-surface-50 border border-dashed border-surface-300 rounded-lg text-[10px] font-semibold text-surface-500 cursor-pointer hover:border-nicara-gold hover:text-nicara-gold">
              📤 Upload File
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Add version modal (with file upload) ── */

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const save = async () => {
    if (!version.trim()) { setBanner("Give the version a name, e.g. Ver 1."); return; }
    setSaving(true);
    setBanner("");
    try {
      await deliverablesApi.create(projectId, {
        type, version, file_name: fileName || selectedFile?.name || "",
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
      subtitle="Upload a file and record the version details."
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

        {/* File upload area */}
        <div>
          <div className="text-[11px] font-semibold text-surface-600 mb-1.5">File Upload</div>
          <label className="flex items-center justify-center gap-2 px-4 py-4 bg-surface-50 border-2 border-dashed border-surface-300 rounded-xl text-[12px] text-surface-500 cursor-pointer hover:border-nicara-gold hover:text-nicara-gold hover:bg-nicara-gold/5 transition-colors">
            {selectedFile ? (
              <span className="font-semibold text-nicara-dark">📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            ) : (
              <span>📤 Click to upload — PDF, Excel, Images, DWG</span>
            )}
            <input type="file" accept={ACCEPT_TYPES} className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  setSelectedFile(file);
                  setFileName(file.name);
                }
              }} />
          </label>
        </div>

        <Field label="File Name" value={fileName} onChange={setFileName} placeholder="sharma_fl_v1.pdf" />
        <Select label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <TextArea label="Remarks" value={remarks} onChange={setRemarks} rows={2}
          placeholder="Kitchen island position needs change" />
      </div>
    </Modal>
  );
}
