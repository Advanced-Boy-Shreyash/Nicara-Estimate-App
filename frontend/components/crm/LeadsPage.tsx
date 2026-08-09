"use client";

import { useState } from "react";
import { ApiError, crmApi, leadsApi } from "@/lib/api";
import type { CrmMeta, Lead } from "@/lib/apiTypes";
import { useApiData, inr } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Field, Select, TextArea } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading, StatusPill } from "@/components/ui/States";

const STAGE_TONE: Record<string, string> = {
  new: "bg-surface-100 text-surface-600",
  contacted: "bg-blue-50 text-blue-700",
  furniture_layout: "bg-purple-50 text-purple-700",
  mood_board: "bg-purple-50 text-purple-700",
  initial_estimate: "bg-amber-50 text-amber-700",
  decision: "bg-amber-50 text-amber-700",
  revision: "bg-amber-50 text-amber-700",
  booking: "bg-emerald-50 text-emerald-700",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-50 text-red-700",
};

/** Customers → Leads. The pre-sales pipeline. */
export default function LeadsPage({ onOpenProject }: { onOpenProject?: (id: number) => void }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [editing, setEditing] = useState<Lead | "new" | null>(null);
  const [converting, setConverting] = useState<Lead | null>(null);

  const { data, loading, error, reload } = useApiData(
    () => leadsApi.list({ search: search || undefined, stage: stage || undefined }),
    [search, stage]
  );
  const { data: meta } = useApiData<CrmMeta>(() => crmApi.meta(), []);
  const pipeline = useApiData(() => leadsApi.pipeline(), []);

  const leads = data?.results ?? [];

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0">Leads</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">
            Enquiries moving through the pre-sales pipeline. Won leads convert into a client and a project.
          </p>
        </div>
        <button onClick={() => setEditing("new")}
          className="px-4 py-2.5 btn-gold rounded-xl text-[12px] font-bold border-none cursor-pointer">
          + Add Lead
        </button>
      </div>

      {pipeline.data && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {([
            ["Open Leads", pipeline.data.open, "🎯", "#3b82f6"],
            ["Won", pipeline.data.won, "✅", "#2dd4a8"],
            ["Lost", pipeline.data.lost, "✕", "#ef4444"],
            ["Total", leads.length, "📋", "#C9A96E"],
          ] as const).map(([label, value, icon, colour]) => (
            <div key={label} className="kpi-card">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] text-surface-400 uppercase tracking-wider">{label}</div>
                  <div className="text-2xl font-extrabold text-nicara-dark mt-1">{value}</div>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: colour + "15" }}>{icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-[320px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-surface-400">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, phone, project…"
            className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold" />
        </div>
        <select value={stage} onChange={e => setStage(e.target.value)}
          className="px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white cursor-pointer outline-none focus:border-nicara-gold">
          <option value="">All stages</option>
          {meta?.lead_stages.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span className="text-[11px] text-surface-400">{leads.length} lead(s)</span>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && leads.length === 0 && (
        <EmptyState icon="🎯" title={search || stage ? "No matches" : "No leads yet"}
          hint={search || stage ? "Try a different filter." : "Add your first enquiry to start the pipeline."} />
      )}

      {!loading && !error && leads.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-nicara-dark">
                  {["Code", "Contact", "Project", "City", "Budget", "Source", "Stage", "Owner", "Follow-up", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className="border-b border-surface-100 hover:bg-surface-50">
                    <td className="px-3 py-2.5 font-mono text-[10px] text-surface-400 whitespace-nowrap">{lead.code}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-nicara-dark">{lead.name}</div>
                      <div className="text-[10px] text-surface-400">{lead.phone || lead.email || "—"}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-surface-700">{lead.project_name || "—"}</div>
                      {lead.developer && <div className="text-[10px] text-surface-400">{lead.developer}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-surface-600">{lead.city || "—"}</td>
                    <td className="px-3 py-2.5 font-semibold text-nicara-dark whitespace-nowrap">
                      {lead.estimated_budget ? inr(lead.estimated_budget) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-surface-500">{lead.source_display}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                        STAGE_TONE[lead.stage] || "bg-surface-100 text-surface-500"
                      }`}>
                        {lead.stage_display}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-surface-600">{lead.owner_name || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-surface-500">
                      {lead.next_follow_up || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {lead.converted_project ? (
                        <button onClick={() => onOpenProject?.(lead.converted_project!)}
                          className="px-2.5 py-1 bg-emerald-50 rounded-lg text-[11px] cursor-pointer border-none text-emerald-700 font-semibold">
                          Open Project
                        </button>
                      ) : (
                        <>
                          <button onClick={() => setEditing(lead)}
                            className="px-2.5 py-1 bg-surface-100 rounded-lg text-[11px] cursor-pointer border-none text-surface-600 hover:bg-surface-200 mr-1.5">
                            Edit
                          </button>
                          <button onClick={() => setConverting(lead)}
                            className="px-2.5 py-1 btn-gold rounded-lg text-[11px] cursor-pointer border-none font-semibold">
                            Convert
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <LeadModal lead={editing === "new" ? null : editing} meta={meta}
          onClose={() => setEditing(null)}
          onSaved={msg => { setEditing(null); toast.success("Saved", msg); void reload(); void pipeline.reload(); }} />
      )}

      {converting && (
        <ConvertModal lead={converting}
          onClose={() => setConverting(null)}
          onDone={(msg, projectId) => {
            setConverting(null);
            toast.success("Converted", msg);
            void reload();
            void pipeline.reload();
            onOpenProject?.(projectId);
          }} />
      )}
    </div>
  );
}

function LeadModal({
  lead, meta, onClose, onSaved,
}: {
  lead: Lead | null;
  meta: CrmMeta | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<Partial<Lead>>(
    lead ? { ...lead } : {
      name: "", phone: "", email: "", project_name: "", developer: "", unit_no: "",
      city: "", state: "", property_type: "", area: "", requirement: "",
      estimated_budget: "", stage: "new", source: "other", priority: "medium",
    }
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setForm(f => ({ ...f, [k]: v }));
  const err = (field: string) => errors[field]?.[0];

  const save = async () => {
    if (!form.name?.trim()) { setErrors({ name: ["Contact name is required."] }); return; }
    setSaving(true);
    setBanner("");
    setErrors({});
    try {
      const payload = { ...form, estimated_budget: form.estimated_budget || null };
      if (lead) {
        await leadsApi.update(lead.id, payload);
        onSaved(`${form.name} updated`);
      } else {
        await leadsApi.create(payload);
        onSaved(`${form.name} added to the pipeline`);
      }
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); }
      else setBanner("Could not save the lead.");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg"
      title={lead ? `Edit ${lead.name}` : "New Lead"}
      subtitle={lead ? lead.code : "Capture the enquiry"}
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Contact Name" value={form.name ?? ""} onChange={v => set("name", v)} required error={err("name")} />
        <Field label="Phone" value={form.phone ?? ""} onChange={v => set("phone", v)} />
        <Field label="Email" type="email" value={form.email ?? ""} onChange={v => set("email", v)} error={err("email")} />
        <Select label="Source" value={form.source ?? "other"} onChange={v => set("source", v)}
          options={meta?.lead_sources ?? []} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Project Name" value={form.project_name ?? ""} onChange={v => set("project_name", v)} />
        <Field label="Developer" value={form.developer ?? ""} onChange={v => set("developer", v)} />
        <Field label="Unit No" value={form.unit_no ?? ""} onChange={v => set("unit_no", v)} />
        <Field label="Property Type" value={form.property_type ?? ""} onChange={v => set("property_type", v)}
          placeholder="3BHK Apartment" />
        <Field label="City" value={form.city ?? ""} onChange={v => set("city", v)} />
        <Field label="Area" value={form.area ?? ""} onChange={v => set("area", v)} placeholder="1,850 sqft" />
        <Field label="Estimated Budget (₹)" type="number" value={form.estimated_budget ?? ""}
          onChange={v => set("estimated_budget", v)} error={err("estimated_budget")} />
        <Field label="Next Follow-up" type="date" value={form.next_follow_up ?? ""}
          onChange={v => set("next_follow_up", v)} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Select label="Stage" value={form.stage ?? "new"} onChange={v => set("stage", v)}
          options={meta?.lead_stages ?? []} />
        <Select label="Priority" value={form.priority ?? "medium"} onChange={v => set("priority", v)}
          options={meta?.priorities ?? []} />
      </div>

      {form.stage === "lost" && (
        <div className="mb-4">
          <Field label="Reason for Losing" value={form.lost_reason ?? ""}
            onChange={v => set("lost_reason", v)} required error={err("lost_reason")} />
        </div>
      )}

      <TextArea label="Requirement" value={form.requirement ?? ""} onChange={v => set("requirement", v)} rows={3} />
    </Modal>
  );
}

function ConvertModal({
  lead, onClose, onDone,
}: {
  lead: Lead;
  onClose: () => void;
  onDone: (message: string, projectId: number) => void;
}) {
  const [projectName, setProjectName] = useState(lead.project_name || `${lead.name} Residence`);
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const convert = async () => {
    setSaving(true);
    setBanner("");
    try {
      const res = await leadsApi.convert(lead.id, { project_name: projectName });
      onDone(res.detail, res.project_id);
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : "Could not convert this lead.");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="sm" title="Convert Lead"
      subtitle="Creates a client record and a project, then marks the lead won."
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={convert} disabled={saving}>{saving ? "Converting…" : "Convert to Project"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}
      <div className="bg-surface-50 rounded-xl p-4 mb-4 text-[12px] space-y-1">
        <div><strong>Contact:</strong> {lead.name}</div>
        <div><strong>Phone:</strong> {lead.phone || "—"}</div>
        <div><strong>City:</strong> {lead.city || "—"}</div>
        <div><strong>Budget:</strong> {lead.estimated_budget ? inr(lead.estimated_budget) : "—"}</div>
      </div>
      <Field label="Project Name" value={projectName} onChange={setProjectName} required />
      <p className="text-[11px] text-surface-400 mt-3">
        The new project starts at the Lead stage so you can carry on through Initial Engagement.
      </p>
    </Modal>
  );
}
