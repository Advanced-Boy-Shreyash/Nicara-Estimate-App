"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, leadsApi, crmApi } from "@/lib/api";
import type { CrmMeta, Lead } from "@/lib/apiTypes";
import { useApiData, inr } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Field, Select, TextArea } from "@/components/ui/Form";
import { Loading, ErrorState, InlineError, StatusPill } from "@/components/ui/States";

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

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const leadId = Number(params.id);
  const [editing, setEditing] = useState(false);

  const { data: lead, loading, error, reload } = useApiData<Lead>(
    () => leadsApi.get(leadId),
    [leadId]
  );
  const { data: meta } = useApiData<CrmMeta>(() => crmApi.meta(), []);

  if (!leadId || isNaN(leadId)) { router.replace("/customers/leads"); return null; }
  if (loading) return <div className="p-6"><Loading label="Loading lead…" /></div>;
  if (error || !lead) return <div className="p-6"><ErrorState message={error ?? "Lead not found"} onRetry={reload} /></div>;

  const tone = STAGE_TONE[lead.stage] || "bg-surface-100 text-surface-500";

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/customers/leads")} className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-surface-500 cursor-pointer border-none hover:bg-surface-200 text-sm">←</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-nicara-dark m-0">{lead.name}</h1>
          <p className="text-[12px] text-surface-400 mt-0.5 m-0">{lead.code}</p>
        </div>
        <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${tone}`}>{lead.stage_display}</span>
        <button onClick={() => setEditing(true)} className="px-4 py-2 btn-gold rounded-xl text-[12px] font-bold border-none cursor-pointer">Edit</button>
        {lead.converted_project && (
          <button onClick={() => router.push(`/project/${lead.converted_project}`)} className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[12px] font-bold border-none cursor-pointer">Open Project</button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          <div className="bg-white border border-surface-200 rounded-2xl p-5">
            <h3 className="text-[13px] font-bold text-nicara-dark mb-3">Contact Information</h3>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              {([
                ["Name", lead.name], ["Phone", lead.phone], ["Email", lead.email],
                ["Source", lead.source_display], ["Owner", lead.owner_name], ["Priority", lead.priority],
              ] as const).map(([l, v]) => (
                <div key={l}>
                  <div className="text-[10px] text-surface-400 uppercase tracking-wider mb-0.5">{l}</div>
                  <div className="text-surface-700 font-medium">{v || "—"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-surface-200 rounded-2xl p-5">
            <h3 className="text-[13px] font-bold text-nicara-dark mb-3">Project Details</h3>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              {([
                ["Project Name", lead.project_name], ["Developer", lead.developer],
                ["Unit No", lead.unit_no], ["City", lead.city],
                ["State", lead.state], ["Property Type", lead.property_type],
                ["Area", lead.area], ["Budget", lead.estimated_budget ? inr(lead.estimated_budget) : "—"],
              ] as const).map(([l, v]) => (
                <div key={l}>
                  <div className="text-[10px] text-surface-400 uppercase tracking-wider mb-0.5">{l}</div>
                  <div className="text-surface-700 font-medium">{v || "—"}</div>
                </div>
              ))}
            </div>
          </div>

          {lead.requirement && (
            <div className="bg-white border border-surface-200 rounded-2xl p-5">
              <h3 className="text-[13px] font-bold text-nicara-dark mb-2">Requirement</h3>
              <p className="text-[12px] text-surface-600 leading-relaxed whitespace-pre-wrap m-0">{lead.requirement}</p>
            </div>
          )}

          {lead.stage === "lost" && lead.lost_reason && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <h3 className="text-[13px] font-bold text-red-700 mb-2">Lost Reason</h3>
              <p className="text-[12px] text-red-600 m-0">{lead.lost_reason}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-surface-200 rounded-2xl p-5">
            <h3 className="text-[13px] font-bold text-nicara-dark mb-3">Pipeline</h3>
            <div className="space-y-3 text-[12px]">
              <div>
                <div className="text-[10px] text-surface-400 uppercase tracking-wider mb-0.5">Stage</div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${tone}`}>{lead.stage_display}</span>
              </div>
              <div>
                <div className="text-[10px] text-surface-400 uppercase tracking-wider mb-0.5">Next Follow-up</div>
                <div className="text-surface-700 font-medium font-mono">{lead.next_follow_up || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-surface-400 uppercase tracking-wider mb-0.5">Created</div>
                <div className="text-surface-700 font-medium font-mono text-[11px]">{new Date(lead.created_at).toLocaleDateString("en-IN")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <LeadEditModal lead={lead} meta={meta} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); toast.success("Saved", "Lead updated"); void reload(); }} />
      )}
    </div>
  );
}

function LeadEditModal({ lead, meta, onClose, onSaved }: {
  lead: Lead; meta: CrmMeta | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Lead>>({ ...lead });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setForm(f => ({ ...f, [k]: v }));
  const err = (field: string) => errors[field]?.[0];

  const save = async () => {
    if (!form.name?.trim()) { setErrors({ name: ["Contact name is required."] }); return; }
    setSaving(true); setBanner(""); setErrors({});
    try {
      await leadsApi.update(lead.id, { ...form, estimated_budget: form.estimated_budget || null });
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); }
      else setBanner("Could not save the lead.");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={`Edit ${lead.name}`} subtitle={lead.code}
      footer={<><Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn><Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn></>}>
      {banner && <InlineError message={banner} />}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Contact Name" value={form.name ?? ""} onChange={v => set("name", v)} required error={err("name")} />
        <Field label="Phone" value={form.phone ?? ""} onChange={v => set("phone", v)} />
        <Field label="Email" type="email" value={form.email ?? ""} onChange={v => set("email", v)} error={err("email")} />
        <Select label="Source" value={form.source ?? "other"} onChange={v => set("source", v)} options={meta?.lead_sources ?? []} />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Project Name" value={form.project_name ?? ""} onChange={v => set("project_name", v)} />
        <Field label="Developer" value={form.developer ?? ""} onChange={v => set("developer", v)} />
        <Field label="Unit No" value={form.unit_no ?? ""} onChange={v => set("unit_no", v)} />
        <Field label="Property Type" value={form.property_type ?? ""} onChange={v => set("property_type", v)} placeholder="3BHK Apartment" />
        <Field label="City" value={form.city ?? ""} onChange={v => set("city", v)} />
        <Field label="Area" value={form.area ?? ""} onChange={v => set("area", v)} placeholder="1,850 sqft" />
        <Field label="Estimated Budget (₹)" type="number" value={form.estimated_budget ?? ""} onChange={v => set("estimated_budget", v)} error={err("estimated_budget")} />
        <Field label="Next Follow-up" type="date" value={form.next_follow_up ?? ""} onChange={v => set("next_follow_up", v)} />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Select label="Stage" value={form.stage ?? "new"} onChange={v => set("stage", v)} options={meta?.lead_stages ?? []} />
        <Select label="Priority" value={form.priority ?? "medium"} onChange={v => set("priority", v)} options={meta?.priorities ?? []} />
      </div>
      {form.stage === "lost" && (
        <div className="mb-4"><Field label="Reason for Losing" value={form.lost_reason ?? ""} onChange={v => set("lost_reason", v)} required error={err("lost_reason")} /></div>
      )}
      <TextArea label="Requirement" value={form.requirement ?? ""} onChange={v => set("requirement", v)} rows={3} />
    </Modal>
  );
}
