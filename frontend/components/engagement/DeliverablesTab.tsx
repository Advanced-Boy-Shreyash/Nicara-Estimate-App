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

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string; badge: string }> = {
  pending: { bg: "bg-amber-50", text: "text-amber-700", icon: "⏳", badge: "bg-amber-100 border-amber-200 text-amber-700" },
  approved: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "✅", badge: "bg-emerald-100 border-emerald-200 text-emerald-700" },
  revision: { bg: "bg-red-50", text: "text-red-700", icon: "↩", badge: "bg-red-100 border-red-200 text-red-700" },
};

const ACCEPT_TYPES = ".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.gif,.dwg,.dxf";

/**
 * Initial Engagement → FL & Mood Board.
 * Stacked layout: Furniture Layout on top, Mood Board below.
 * Each has version cards with View/Download/Upload/Approve/Reject + AutoCAD launch.
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
      {/* ── Stacked: one section below the other ── */}
      <div className="space-y-6">
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

/* ══════════════════════════════════════════════════════════════════
   VERSION SECTION — WholeCode.jsx style with approval + AutoCAD
   ══════════════════════════════════════════════════════════════════ */

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
      {/* ── Header ── */}
      <div className="flex justify-between items-center px-5 py-3.5 border-b border-surface-100 bg-nicara-dark">
        <div className="flex items-center gap-2.5">
          <span className="text-[18px]">{icon}</span>
          <div>
            <div className="text-[13px] font-bold text-white">{title}</div>
            <div className="text-[10px] text-stone-400">{versions.length} version(s) uploaded</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* AutoCAD Launch */}
          <a href="autocad://" title="Launch AutoCAD"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-lg text-[11px] font-semibold text-amber-300 no-underline hover:bg-amber-500/30 transition-colors">
            🚀 Launch AutoCAD
          </a>
          {/* Email icon */}
          <button title="Send via Email"
            className="w-8 h-8 flex items-center justify-center bg-white/10 border border-white/20 rounded-lg text-white text-[14px] cursor-pointer hover:bg-white/20 transition-colors">
            ✉️
          </button>
          {/* Add version */}
          <button onClick={onAdd}
            className="flex items-center gap-1 px-3.5 py-1.5 bg-nicara-gold border-none rounded-lg text-[11px] font-bold text-white cursor-pointer hover:opacity-90 transition-opacity">
            + Add Version
          </button>
        </div>
      </div>

      {/* ── Version cards ── */}
      <div className="p-4 space-y-3">
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
          <div className="text-center py-10 text-surface-400 text-[12px]">
            <div className="text-3xl mb-3">{icon}</div>
            <div className="text-[14px] font-bold text-nicara-dark mb-1">No versions uploaded yet</div>
            <div className="text-[11px] text-surface-400 mb-3">Upload your first {title.toLowerCase()} version to get started.</div>
            <button onClick={onAdd}
              className="px-5 py-2 bg-nicara-gold border-none rounded-xl text-white text-[12px] font-bold cursor-pointer hover:opacity-90">
              + Upload First Version
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Version card with View/Download/Upload/Approve/Reject ── */

function VersionCard({ v, s, uploadedFile, onStatusChange, onDelete, onViewFile, onFileUpload, title }: {
  v: Deliverable;
  s: { bg: string; text: string; icon: string; badge: string };
  uploadedFile?: { url: string; name: string; size: string };
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number, name: string) => void;
  onViewFile: (url: string, name: string) => void;
  onFileUpload: (id: number, file: File) => void;
  title: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`border border-surface-200 rounded-xl overflow-hidden transition-all hover:shadow-sm`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-50/80">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[14px] shrink-0 border ${s.badge}`}>
            {s.icon}
          </div>
          <div>
            <div className="text-[13px] font-bold text-nicara-dark">{v.version}</div>
            <div className="text-[10px] text-surface-400 flex items-center gap-1.5">
              <span>{v.date}</span>
              {v.uploaded_by_name && <><span>·</span><span>by {v.uploaded_by_name}</span></>}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${s.badge}`}>
          {v.status === "approved" ? "✅ Approved" : v.status === "revision" ? "↩ Revision" : "⏳ Pending"}
        </span>
      </div>

      {/* Card body — remarks + file + actions */}
      <div className="px-4 py-3 space-y-2.5">
        {v.remarks && (
          <div className="text-[11px] text-surface-500 bg-surface-50 rounded-lg px-3 py-2">{v.remarks}</div>
        )}

        {/* File section */}
        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" ref={fileInputRef} accept={ACCEPT_TYPES} className="hidden"
            onChange={e => { if (e.target.files?.[0]) onFileUpload(v.id, e.target.files[0]); }} />

          {uploadedFile ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-surface-200 rounded-lg">
              <span className="text-[11px]">📎</span>
              <span className="text-[11px] font-semibold text-nicara-dark max-w-[150px] truncate">{uploadedFile.name}</span>
              <span className="text-[9px] text-surface-400">{uploadedFile.size}</span>
            </div>
          ) : v.file_name ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-surface-200 rounded-lg">
              <span className="text-[11px]">📎</span>
              <span className="text-[11px] font-semibold text-nicara-dark max-w-[150px] truncate">{v.file_name}</span>
            </div>
          ) : null}
        </div>

        {/* Action buttons — View, Download, Upload, Approve, Reject, Email, Delete */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-surface-100">
          {/* View */}
          {uploadedFile && (
            <button onClick={() => onViewFile(uploadedFile.url, uploadedFile.name)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-[10px] font-semibold text-blue-600 cursor-pointer hover:bg-blue-100">
              👁 View
            </button>
          )}
          {/* Download */}
          {uploadedFile && (
            <a href={uploadedFile.url} download={uploadedFile.name}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-50 border border-surface-200 rounded-lg text-[10px] font-semibold text-surface-600 no-underline hover:bg-surface-100">
              ⬇ Download
            </a>
          )}
          {/* Upload */}
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-50 border border-dashed border-surface-300 rounded-lg text-[10px] font-semibold text-surface-500 cursor-pointer hover:border-nicara-gold hover:text-nicara-gold">
            📤 Upload
          </button>

          <div className="flex-1" />

          {/* Approve */}
          {v.status !== "approved" && (
            <button onClick={() => onStatusChange(v.id, "approved")}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-700 cursor-pointer hover:bg-emerald-100">
              ✅ Approve
            </button>
          )}
          {/* Reject */}
          {v.status !== "revision" && (
            <button onClick={() => onStatusChange(v.id, "revision")}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[10px] font-bold text-red-600 cursor-pointer hover:bg-red-100">
              ✕ Reject
            </button>
          )}
          {/* Email */}
          <button title="Send via Email"
            className="w-7 h-7 flex items-center justify-center bg-surface-50 border border-surface-200 rounded-lg text-[12px] text-surface-500 cursor-pointer hover:bg-surface-100">
            ✉️
          </button>
          {/* Delete */}
          <button onClick={() => onDelete(v.id, `${title} ${v.version}`)} title="Remove"
            className="w-7 h-7 flex items-center justify-center bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-400 cursor-pointer hover:bg-red-100 hover:text-red-600">
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add version modal ── */

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
