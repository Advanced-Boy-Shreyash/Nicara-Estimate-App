"use client";

import { useRef, useState } from "react";
import { ApiError, deliverablesApi } from "@/lib/api";
import type { Deliverable, DeliverableType, Project } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Field, TextArea } from "@/components/ui/Form";
import { ErrorState, Loading } from "@/components/ui/States";

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  draft: { badge: "bg-surface-100 border-surface-200 text-surface-600", label: "Draft" },
  pending: { badge: "bg-amber-50 border-amber-200 text-amber-700", label: "Pending" },
  approved: { badge: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "Approved" },
  revision: { badge: "bg-red-50 border-red-200 text-red-700", label: "Revision Required" },
};

const FL_ACCEPT = ".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.dxf,.dwg";
const MB_ACCEPT = ".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.gif";

const AUTOCAD_EXTS = [".dxf", ".dwg"];
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];

interface FileEntry {
  url: string;
  name: string;
  size: string;
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function extOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function isImage(name: string) {
  return IMAGE_EXTS.includes(extOf(name));
}

function isAutocadFile(name: string) {
  return AUTOCAD_EXTS.includes(extOf(name));
}

/**
 * Initial Engagement > FL & Mood Board.
 * Stacked layout: Furniture Layout on top, Mood Board below.
 * Each section has versions with View / Download / Upload / Approve / Reject + AutoCAD support.
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
      <div className="space-y-6">
        {types.map(({ type, title }) => (
          <VersionSection
            key={type}
            projectId={project.id}
            reload={reload}
            toast={toast}
            deliverableType={type}
            title={title}
            versions={all.filter(d => d.type === type)}
            acceptTypes={type === "furniture_layout" ? FL_ACCEPT : MB_ACCEPT}
            onAdd={() => setAdding(type)}
            onStatusChange={async (id, status) => {
              try {
                if (status === "pending") {
                  await deliverablesApi.submit(project.id, id);
                } else if (status === "approved") {
                  await deliverablesApi.approve(project.id, id, "Approved by the project reviewer.");
                } else if (status === "revision") {
                  await deliverablesApi.requestRevision(project.id, id, "Please revise and resubmit for review.");
                }
                toast.success("Updated", `Marked as ${status}`);
                void reload();
              } catch (error) {
                toast.error("Failed", error instanceof Error ? error.message : "Could not update the status");
              }
            }}
            onDelete={async (id, name) => {
              try {
                await deliverablesApi.delete(project.id, id);
                toast.info("Removed", name);
                void reload();
              } catch (error) {
                toast.error("Failed", error instanceof Error ? error.message : "Could not remove this version");
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
          acceptTypes={adding === "furniture_layout" ? FL_ACCEPT : MB_ACCEPT}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            toast.success("Added", "New version recorded");
            void reload();
          }}
        />
      )}

      {/* File viewer modal */}
      {viewingFile && (
        <Modal open onClose={() => setViewingFile(null)} size="lg"
          title={viewingFile.name}
          footer={
            <>
              <a href={viewingFile.url} download={viewingFile.name}
                className="px-4 py-2 bg-surface-50 border border-surface-200 rounded-xl text-[12px] font-semibold text-nicara-dark no-underline hover:bg-surface-100">
                Download
              </a>
              <Btn variant="ghost" onClick={() => setViewingFile(null)}>Close</Btn>
            </>
          }>
          <div className="flex items-center justify-center min-h-[300px]">
            {isImage(viewingFile.name) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewingFile.url} alt={viewingFile.name} className="max-w-full max-h-[70vh] rounded-xl" />
            ) : extOf(viewingFile.name) === ".pdf" ? (
              <iframe title={viewingFile.name} src={viewingFile.url} className="w-full h-[70vh] rounded-xl border-0" />
            ) : (
              <div className="text-center text-surface-400">
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

/* ── Version Section ── */

function VersionSection({
  projectId, reload, toast, deliverableType, title, versions, acceptTypes, onAdd, onStatusChange, onDelete, onViewFile,
}: {
  projectId: number;
  reload: () => Promise<void>;
  toast: ReturnType<typeof useToast>;
  deliverableType: DeliverableType;
  title: string;
  versions: Deliverable[];
  acceptTypes: string;
  onAdd: () => void;
  onStatusChange: (id: number, status: Deliverable["status"]) => void;
  onDelete: (id: number, name: string) => void;
  onViewFile: (url: string, name: string) => void;
}) {
  const handleFileUpload = async (files: FileList) => {
    if (files.length === 0) return;
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("type", deliverableType);
        form.append("file", file);
        form.append("status", "draft");
        await deliverablesApi.upload(projectId, form);
      }
      await reload();
      toast.success("Uploaded", "The file was saved as a new version.");
    } catch (error) {
      toast.error("Upload failed", error instanceof Error ? error.message : "Could not upload the file.");
    }
  };

  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-3.5 border-b border-surface-100 bg-nicara-dark">
        <div>
          <div className="text-[13px] font-bold text-white">{title}</div>
          <div className="text-[10px] text-stone-400">{versions.length} version(s) uploaded</div>
        </div>
        <div className="flex items-center gap-2">
          <button title="Send via Email"
            className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-[11px] text-white font-semibold cursor-pointer hover:bg-white/20 transition-colors">
            Email
          </button>
          <button onClick={onAdd}
            className="px-3.5 py-1.5 bg-nicara-gold border-none rounded-lg text-[11px] font-bold text-white cursor-pointer hover:opacity-90 transition-opacity">
            + Add Version
          </button>
        </div>
      </div>

      {/* Version cards */}
      <div className="p-4 space-y-3">
        {versions.map(v => {
          const uploadedFiles = v.file_url ? [{
            url: v.file_url,
            name: v.file_name || `Version ${v.version_no}`,
            size: v.file_size_display,
          }] : [];
          return (
            <VersionCard key={v.id} v={v} uploadedFiles={uploadedFiles}
              acceptTypes={acceptTypes}
              onStatusChange={onStatusChange} onDelete={onDelete} onViewFile={onViewFile}
              onFileUpload={handleFileUpload}
              title={title} />
          );
        })}
        {versions.length === 0 && (
          <div className="text-center py-10 text-surface-400 text-[12px]">
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

/* ── Version Card — with View/Download/Upload/Approve/Reject per file ── */

function VersionCard({ v, uploadedFiles, acceptTypes, onStatusChange, onDelete, onViewFile, onFileUpload, title }: {
  v: Deliverable;
  uploadedFiles: FileEntry[];
  acceptTypes: string;
  onStatusChange: (id: number, status: Deliverable["status"]) => void;
  onDelete: (id: number, name: string) => void;
  onViewFile: (url: string, name: string) => void;
  onFileUpload: (files: FileList) => void;
  title: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const s = STATUS_STYLES[v.status] || STATUS_STYLES.pending;
  const isLocked = v.status === "approved" || v.status === "revision";

  // Combine initial file (from creation) with uploaded files
  const allFiles = uploadedFiles;
  const hasAutocadFile = allFiles.some(f => isAutocadFile(f.name));

  return (
    <div className={`border rounded-xl overflow-hidden transition-all hover:shadow-sm ${isLocked ? "border-surface-200 bg-surface-50/30" : "border-surface-200"}`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-50/80">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[13px] font-bold text-nicara-dark">{v.version}</div>
            <div className="text-[10px] text-surface-400 flex items-center gap-1.5">
              <span>{v.date}</span>
              {v.uploaded_by_name && <><span>·</span><span>by {v.uploaded_by_name}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && (
            <span className="px-2 py-0.5 bg-surface-100 border border-surface-200 rounded text-[9px] font-bold text-surface-500 uppercase tracking-wide">
              Locked
            </span>
          )}
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${s.badge}`}>
            {s.label}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 py-3 space-y-2.5">
        {v.remarks && (
          <div className="text-[11px] text-surface-500 bg-surface-50 rounded-lg px-3 py-2">{v.remarks}</div>
        )}

        {/* File list — each file with separate View/Download/AutoCAD */}
        {allFiles.length > 0 && (
          <div className="space-y-1.5">
            {allFiles.map((f, idx) => (
              <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-surface-100 rounded-lg">
                <span className="text-[11px] font-semibold text-nicara-dark max-w-[200px] truncate flex-1">{f.name}</span>
                <span className="text-[9px] text-surface-400">{f.size}</span>
                {/* View */}
                <button onClick={() => onViewFile(f.url, f.name)}
                  className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-[10px] font-semibold text-blue-600 cursor-pointer hover:bg-blue-100">
                  View
                </button>
                {/* Download */}
                <a href={f.url} download={f.name}
                  className="px-2 py-1 bg-surface-50 border border-surface-200 rounded text-[10px] font-semibold text-surface-600 no-underline hover:bg-surface-100">
                  Download
                </a>
                {/* AutoCAD — only for DXF/DWG files */}
                {isAutocadFile(f.name) && (
                  <a href={`autocad://${f.url}`} title="Open in AutoCAD"
                    className="px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[10px] font-semibold text-amber-700 no-underline hover:bg-amber-100">
                    Open in AutoCAD
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* No files yet — show original file_name if present */}
        {allFiles.length === 0 && v.file_name && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-surface-200 rounded-lg">
            <span className="text-[11px] font-semibold text-nicara-dark max-w-[200px] truncate">{v.file_name}</span>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-surface-100">
          <input type="file" ref={fileInputRef} accept={acceptTypes} multiple className="hidden"
            onChange={e => { if (e.target.files && e.target.files.length > 0) onFileUpload(e.target.files); }} />

          {/* Upload — disabled when locked */}
          {!isLocked && (
            <button onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 bg-surface-50 border border-dashed border-surface-300 rounded-lg text-[10px] font-semibold text-surface-500 cursor-pointer hover:border-nicara-gold hover:text-nicara-gold">
              Upload Files
            </button>
          )}

          {/* Per-version AutoCAD — only if there are autocad files */}
          {hasAutocadFile && (
            <a href="autocad://" title="Launch AutoCAD"
              className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-semibold text-amber-700 no-underline hover:bg-amber-100">
              Launch AutoCAD
            </a>
          )}

          <div className="flex-1" />

          {/* Approve / Reject — hidden when locked */}
          {!isLocked && v.status === "draft" && (
            <button onClick={() => onStatusChange(v.id, "pending")}
              className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700 cursor-pointer hover:bg-amber-100">
              Submit for Review
            </button>
          )}

          {!isLocked && v.status === "pending" && (
            <>
              <button onClick={() => onStatusChange(v.id, "approved")}
                className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-700 cursor-pointer hover:bg-emerald-100">
                Approve
              </button>
              <button onClick={() => onStatusChange(v.id, "revision")}
                className="px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[10px] font-bold text-red-600 cursor-pointer hover:bg-red-100">
                Reject
              </button>
            </>
          )}

          {/* Email */}
          <button title="Send via Email"
            className="px-2 py-1.5 bg-surface-50 border border-surface-200 rounded-lg text-[10px] text-surface-500 cursor-pointer hover:bg-surface-100 font-semibold">
            Email
          </button>

          {/* Delete */}
          {!isLocked && (
            <button onClick={() => onDelete(v.id, `${title} ${v.version}`)} title="Remove"
              className="px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-400 cursor-pointer hover:bg-red-100 hover:text-red-600 font-semibold">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Add Version Modal ── */

function AddVersionModal({
  projectId, type, title, acceptTypes, onClose, onSaved,
}: {
  projectId: number;
  type: DeliverableType;
  title: string;
  acceptTypes: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [version, setVersion] = useState("Ver 1");
  const [fileName, setFileName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const save = async () => {
    if (!version.trim()) { setBanner("Give the version a name, e.g. Ver 1."); return; }
    setSaving(true);
    setBanner("");
    try {
      if (selectedFiles.length) {
        for (const [index, file] of selectedFiles.entries()) {
          const form = new FormData();
          form.append("type", type);
          form.append("version", selectedFiles.length === 1 ? version : `${version} (${index + 1})`);
          form.append("status", "draft");
          form.append("remarks", remarks);
          form.append("date", date);
          form.append("file", file);
          await deliverablesApi.upload(projectId, form);
        }
      } else {
        await deliverablesApi.create(projectId, {
          type, version, file_name: fileName, status: "draft", remarks, date,
        });
      }

      onSaved();
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : "Could not save.");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="sm" title={`Add ${title} Version`}
      subtitle="Upload files and record the version details."
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving ? "Saving\u2026" : "Add Version"}</Btn>
        </>
      }>
      {banner && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">{banner}</div>
      )}
      <div className="space-y-3">
        <Field label="Version" value={version} onChange={setVersion} required placeholder="Ver 1" />
        <Field label="Date" type="date" value={date} onChange={setDate} />

        {/* Multi-file upload area */}
        <div>
          <div className="text-[11px] font-semibold text-surface-600 mb-1.5">File Upload</div>
          <label className="flex items-center justify-center gap-2 px-4 py-4 bg-surface-50 border-2 border-dashed border-surface-300 rounded-xl text-[12px] text-surface-500 cursor-pointer hover:border-nicara-gold hover:text-nicara-gold hover:bg-nicara-gold/5 transition-colors">
            {selectedFiles.length > 0 ? (
              <span className="font-semibold text-nicara-dark">
                {selectedFiles.length} file(s) selected — {selectedFiles.map(f => f.name).join(", ")}
              </span>
            ) : (
              <span>Click to upload — PDF, PPT, Images, DXF, DWG</span>
            )}
            <input type="file" accept={acceptTypes} multiple className="hidden"
              onChange={e => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) {
                  setSelectedFiles(prev => [...prev, ...files]);
                  setFileName(files.map(f => f.name).join(", "));
                }
              }} />
          </label>
          {/* Show selected files */}
          {selectedFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {selectedFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-surface-100 rounded-lg text-[11px]">
                  <span className="font-semibold text-nicara-dark truncate max-w-[200px]">{f.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-surface-400">{fileSize(f.size)}</span>
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-[10px] font-bold">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <TextArea label="Remarks" value={remarks} onChange={setRemarks} rows={2}
          placeholder="Notes about this version" />
      </div>
    </Modal>
  );
}
