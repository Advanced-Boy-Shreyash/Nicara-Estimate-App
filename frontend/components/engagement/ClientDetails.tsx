"use client";

import { useState } from "react";
import { ApiError, projectsApi } from "@/lib/api";
import type { Project, ProjectMeta } from "@/lib/apiTypes";
import { useToast } from "@/components/ui/Toast";
import { Btn, Field, Select, TextArea } from "@/components/ui/Form";
import { InlineError } from "@/components/ui/States";

/** Initial Engagement → Client Details. Saves straight onto the Project. */
export default function ClientDetails({
  project, meta, onSaved,
}: {
  project: Project;
  meta: ProjectMeta | null;
  onSaved: (p: Project) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Partial<Project>>({ ...project });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Project>(key: K, value: Project[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  };
  const err = (field: string) => errors[field]?.[0];

  const dirty = (Object.keys(form) as (keyof Project)[]).some(
    k => form[k] !== project[k] && typeof form[k] !== "object"
  );

  const save = async () => {
    setSaving(true);
    setBanner("");
    setErrors({});
    try {
      const updated = await projectsApi.update(project.id, {
        client_name: form.client_name,
        client_phone: form.client_phone,
        client_email: form.client_email,
        client_address: form.client_address,
        name: form.name,
        developer: form.developer,
        unit_no: form.unit_no,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        area: form.area,
        budget: form.budget,
        property_type: form.property_type,
        project_type: form.project_type,
        purpose: form.purpose,
        interior_style: form.interior_style,
        stage: form.stage,
        progress: form.progress,
        start_date: form.start_date || null,
        target_date: form.target_date || null,
      });
      onSaved(updated);
      toast.success("Saved", "Client and project details updated");
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.errors);
        setBanner(e.message);
      } else {
        setBanner("Could not save. Is the backend running?");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {banner && <InlineError message={banner} />}

      <div className="grid grid-cols-2 gap-6">
        <Card icon="👤" tone="gold" title="Client Details">
          <Field label="Name" value={form.client_name ?? ""} onChange={v => set("client_name", v)}
            required error={err("client_name")} />
          <Field label="Phone" value={form.client_phone ?? ""} onChange={v => set("client_phone", v)}
            error={err("client_phone")} />
          <Field label="Email" type="email" value={form.client_email ?? ""} onChange={v => set("client_email", v)}
            error={err("client_email")} />
          <TextArea label="Address" value={form.client_address ?? ""} onChange={v => set("client_address", v)} rows={2} />
        </Card>

        <Card icon="🏠" tone="blue" title="Project Details">
          <Field label="Project Name" value={form.name ?? ""} onChange={v => set("name", v)}
            required error={err("name")} />
          <Field label="Developer - Project" value={form.developer ?? ""} onChange={v => set("developer", v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit No" value={form.unit_no ?? ""} onChange={v => set("unit_no", v)} />
            <Field label="Area" value={form.area ?? ""} onChange={v => set("area", v)} placeholder="1,850 sqft" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City" value={form.city ?? ""} onChange={v => set("city", v)} />
            <Field label="State" value={form.state ?? ""} onChange={v => set("state", v)} />
            <Field label="Pincode" value={form.pincode ?? ""} onChange={v => set("pincode", v)} />
          </div>
        </Card>

        <Card icon="🎨" tone="purple" title="Scope & Style">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Property Type" value={form.property_type ?? ""} onChange={v => set("property_type", v)}
              options={meta?.property_types ?? []} />
            <Select label="Project Type" value={form.project_type ?? ""} onChange={v => set("project_type", v)}
              options={meta?.project_types ?? []} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Purpose" value={form.purpose ?? ""} onChange={v => set("purpose", v)}
              options={meta?.purposes ?? []} />
            <Field label="Interior Style" value={form.interior_style ?? ""} onChange={v => set("interior_style", v)} />
          </div>
          <Field label="Budget (₹)" type="number" value={form.budget ?? ""} onChange={v => set("budget", v)}
            error={err("budget")} />
        </Card>

        <Card icon="📅" tone="green" title="Timeline & Stage">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date" type="date" value={form.start_date ?? ""} onChange={v => set("start_date", v)}
              error={err("start_date")} />
            <Field label="Target Date" type="date" value={form.target_date ?? ""} onChange={v => set("target_date", v)}
              error={err("target_date")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Stage" value={form.stage ?? "lead"}
              onChange={v => set("stage", v as Project["stage"])} options={meta?.stages ?? []} />
            <Field label="Progress %" type="number" value={form.progress ?? 0}
              onChange={v => set("progress", Number(v) || 0)} error={err("progress")} />
          </div>
          <div className="text-[11px] text-surface-400 pt-1">
            Owner: {project.design_owner_name || "—"} · Site: {project.site_manager_name || "—"}
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <Btn onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : dirty ? "Save Changes" : "No Changes"}
        </Btn>
        {dirty && !saving && (
          <button onClick={() => { setForm({ ...project }); setErrors({}); setBanner(""); }}
            className="text-[12px] text-surface-500 bg-transparent border-none cursor-pointer hover:underline">
            Discard
          </button>
        )}
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  gold: "bg-nicara-gold/10 text-nicara-gold",
  blue: "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
  green: "bg-emerald-50 text-emerald-600",
};

function Card({
  icon, title, tone, children,
}: {
  icon: string;
  title: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[12px] ${TONES[tone]}`}>{icon}</div>
        <span className="text-[12px] font-bold text-nicara-dark uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
