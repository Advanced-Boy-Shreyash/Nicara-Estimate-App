"use client";

import { useEffect, useState } from "react";
import { projectsApi } from "@/lib/api";
import type { Project, ProjectMeta } from "@/lib/apiTypes";
import { useApiData, inr, inrExact } from "@/lib/hooks";
import { ErrorState, Loading, StatusPill } from "@/components/ui/States";
import ClientDetails from "@/components/engagement/ClientDetails";
import DesignRequirements from "@/components/engagement/DesignRequirements";
import DeliverablesTab from "@/components/engagement/DeliverablesTab";
import EstimateTab from "@/components/engagement/EstimateTab";
import BookingFormTab from "@/components/engagement/BookingFormTab";
import { Handshake, Ruler, Hammer, type LucideIcon } from "lucide-react";

type Phase = "engagement" | "design" | "execution";

const PHASE_ICONS: Record<Phase, LucideIcon> = { engagement: Handshake, design: Ruler, execution: Hammer };
const PHASE_TABS = [
  { id: "engagement" as Phase, label: "Initial Engagement" },
  { id: "design" as Phase, label: "Design" },
  { id: "execution" as Phase, label: "Execution" },
];
const ENG_SUBS = [
  { id: "client-basic", label: "Client Details" },
  { id: "design-req", label: "Design Requirements" },
  { id: "fl-mb", label: "FL & Mood Board" },
  { id: "initial-est", label: "Initial Estimate" },
  { id: "booking", label: "Booking Form" },
];
const DES_SUBS = [
  { id: "measurements", label: "Measurements" },
  { id: "3d-model", label: "3D Model" },
  { id: "inter-est", label: "Intermediate Estimate" },
  { id: "renders", label: "Renders" },
  { id: "mat-sel", label: "Material Selections" },
  { id: "final-est", label: "Final Estimate" },
  { id: "final-rend", label: "Final Renders" },
  { id: "work-draw", label: "Working Drawings" },
];
const EXE_SUBS = [
  { id: "exec-stages", label: "Execution Stages" },
  { id: "pay-sched", label: "Payment Schedule" },
  { id: "quality", label: "Quality" },
  { id: "handover", label: "Handover" },
];

function DataTable({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty: boolean }) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-nicara-dark">
              {headers.map(h => (
                <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {children}
            {empty && <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-surface-400">Nothing recorded yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "text-nicara-dark" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl px-4 py-3">
      <div className="text-[10px] text-surface-400 uppercase tracking-wider">{label}</div>
      <div className={`text-[18px] font-extrabold mt-0.5 ${tone}`}>{value}</div>
    </div>
  );
}

function MeasurementsTab({ project }: { project: Project }) {
  const rows = project.measurements;
  return (
    <DataTable headers={["Room", "Plan", "East", "West", "North", "South", "Other", "Checked By", "Status"]} empty={rows.length === 0}>
      {rows.map(m => (
        <tr key={m.id} className="border-b border-surface-100 hover:bg-surface-50">
          <td className="px-3 py-2.5 font-semibold text-nicara-dark">{m.room}</td>
          <td className="px-3 py-2.5 text-center">{m.plan_verified ? "✓" : "—"}</td>
          {[m.east, m.west, m.north, m.south].map((v, i) => (
            <td key={i} className="px-3 py-2.5 font-mono text-surface-600">{v || "—"}</td>
          ))}
          <td className="px-3 py-2.5 text-[11px] text-surface-500">{m.other_details || "—"}</td>
          <td className="px-3 py-2.5 text-surface-600">{m.proof_checked_by || "—"}</td>
          <td className="px-3 py-2.5"><StatusPill status={m.status} /></td>
        </tr>
      ))}
    </DataTable>
  );
}

function MaterialSelectionsTab({ project }: { project: Project }) {
  const rows = project.material_selections;
  return (
    <DataTable headers={["Category", "Room", "Wall / Area", "Supplier", "Brand", "Catalog", "Item Code", "Price", "Availability"]} empty={rows.length === 0}>
      {rows.map(m => (
        <tr key={m.id} className="border-b border-surface-100 hover:bg-surface-50">
          <td className="px-3 py-2.5 font-semibold text-nicara-dark">{m.category}</td>
          <td className="px-3 py-2.5 text-surface-600">{m.room}</td>
          <td className="px-3 py-2.5 text-surface-600">{m.wall_area}</td>
          <td className="px-3 py-2.5 text-surface-600">{m.supplier_name || "—"}</td>
          <td className="px-3 py-2.5 text-surface-600">{m.brand_name || "—"}</td>
          <td className="px-3 py-2.5 text-surface-600">{m.catalog || "—"}</td>
          <td className="px-3 py-2.5 font-mono text-[10px] text-surface-500">{m.item_code || "—"}</td>
          <td className="px-3 py-2.5 font-semibold text-nicara-dark">{inr(m.supplier_price)}</td>
          <td className="px-3 py-2.5 text-[11px] text-surface-500">{m.availability}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function ExecutionTab({ project }: { project: Project }) {
  const rows = project.execution_stages;
  return (
    <DataTable headers={["Stage", "Vendor", "Start", "End", "Progress", "Status", "Payment", "Payment Status"]} empty={rows.length === 0}>
      {rows.map(s => (
        <tr key={s.id} className="border-b border-surface-100 hover:bg-surface-50">
          <td className="px-3 py-2.5 font-semibold text-nicara-dark">{s.name}</td>
          <td className="px-3 py-2.5 text-surface-600">{s.vendor || "—"}</td>
          <td className="px-3 py-2.5 font-mono text-[11px] text-surface-500">{s.start_date || "—"}</td>
          <td className="px-3 py-2.5 font-mono text-[11px] text-surface-500">{s.end_date || "—"}</td>
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-16 h-[4px] bg-surface-200 rounded-full overflow-hidden"><div className="h-full rounded-full bg-nicara-gold" style={{ width: s.progress + "%" }} /></div>
              <span className="text-[10px] font-bold text-surface-500">{s.progress}%</span>
            </div>
          </td>
          <td className="px-3 py-2.5"><StatusPill status={s.status} /></td>
          <td className="px-3 py-2.5 font-semibold text-nicara-dark">{inr(s.payment)}</td>
          <td className="px-3 py-2.5"><StatusPill status={s.payment_status} /></td>
        </tr>
      ))}
    </DataTable>
  );
}

function PaymentScheduleTab({ project }: { project: Project }) {
  const rows = project.payment_milestones;
  const paid = rows.filter(p => p.status === "paid").reduce((s, p) => s + parseFloat(p.amount), 0);
  const total = rows.reduce((s, p) => s + parseFloat(p.amount), 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Kpi label="Total Scheduled" value={inrExact(total)} />
        <Kpi label="Received" value={inrExact(paid)} tone="text-emerald-600" />
        <Kpi label="Outstanding" value={inrExact(total - paid)} tone="text-amber-600" />
      </div>
      <DataTable headers={["Milestone", "Amount", "Due Date", "Paid Date", "Mode", "Reference", "Status"]} empty={rows.length === 0}>
        {rows.map(p => (
          <tr key={p.id} className="border-b border-surface-100 hover:bg-surface-50">
            <td className="px-3 py-2.5 font-semibold text-nicara-dark">{p.milestone}</td>
            <td className="px-3 py-2.5 font-bold text-nicara-dark">{inr(p.amount)}</td>
            <td className="px-3 py-2.5 font-mono text-[11px] text-surface-500">{p.due_date}</td>
            <td className="px-3 py-2.5 font-mono text-[11px] text-surface-500">{p.paid_date || "—"}</td>
            <td className="px-3 py-2.5 text-surface-600">{p.mode || "—"}</td>
            <td className="px-3 py-2.5 font-mono text-[10px] text-surface-500">{p.reference || "—"}</td>
            <td className="px-3 py-2.5"><StatusPill status={p.status} /></td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

function QualityTab({ project }: { project: Project }) {
  const rows = project.quality_checks;
  return (
    <DataTable headers={["Area", "Check Type", "Date", "Inspector", "Status", "Remarks"]} empty={rows.length === 0}>
      {rows.map(q => (
        <tr key={q.id} className="border-b border-surface-100 hover:bg-surface-50">
          <td className="px-3 py-2.5 font-semibold text-nicara-dark">{q.area}</td>
          <td className="px-3 py-2.5 text-surface-600">{q.check_type}</td>
          <td className="px-3 py-2.5 font-mono text-[11px] text-surface-500">{q.date}</td>
          <td className="px-3 py-2.5 text-surface-600">{q.inspector || "—"}</td>
          <td className="px-3 py-2.5"><StatusPill status={q.status === "pass" ? "approved" : q.status} label={q.status} /></td>
          <td className="px-3 py-2.5 text-[11px] text-surface-500">{q.remarks || "—"}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function HandoverTab({ project }: { project: Project }) {
  const stages = project.execution_stages;
  const done = stages.filter(s => s.status === "completed").length;
  const ready = stages.length > 0 && done === stages.length;
  return (
    <div className="bg-white border border-surface-200 rounded-2xl p-8 text-center">
      <div className="text-5xl mb-3">{ready ? "🎉" : "📋"}</div>
      <h3 className="text-[14px] font-bold text-nicara-dark mb-1">Project Handover</h3>
      <p className="text-[12px] text-surface-400 max-w-md mx-auto mb-4">
        {stages.length === 0
          ? "Execution has not started yet."
          : `${done} of ${stages.length} execution stages completed.${ready ? " Ready for handover." : " Handover pending."}`}
      </p>
      <button disabled={!ready}
        className={`px-5 py-2.5 rounded-xl text-[12px] font-bold border-none ${ready ? "btn-gold cursor-pointer" : "bg-surface-200 text-surface-400 cursor-not-allowed"}`}>
        Generate Handover Report
      </button>
    </div>
  );
}

export default function ProjectDetail({ projectId, meta, onBack, onProject }: {
  projectId: number;
  meta: ProjectMeta | null;
  onBack: () => void;
  onProject: (p: Project | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("engagement");
  const [subTab, setSubTab] = useState("client-basic");
  const { data: project, loading, error, reload, setData } = useApiData(
    () => projectsApi.get(projectId),
    [projectId]
  );

  useEffect(() => {
    if (project) onProject(project);
  }, [project, onProject]);

  useEffect(() => {
    return () => onProject(null);
  }, [onProject]);

  const subs = phase === "engagement" ? ENG_SUBS : phase === "design" ? DES_SUBS : EXE_SUBS;
  const handlePhase = (p: Phase) => {
    setPhase(p);
    setSubTab((p === "engagement" ? ENG_SUBS : p === "design" ? DES_SUBS : EXE_SUBS)[0].id);
  };

  const applyProject = (p: Project) => { setData(p); onProject(p); };

  if (loading) return <Loading label="Loading project…" />;
  if (error || !project) return <div className="p-6"><ErrorState message={error ?? "Not found"} onRetry={reload} /></div>;

  const renderContent = () => {
    switch (subTab) {
      case "client-basic":
        return <ClientDetails project={project} meta={meta} onSaved={applyProject} />;
      case "design-req":
        return <DesignRequirements project={project} />;
      case "fl-mb":
        return <DeliverablesTab project={project} types={[
          { type: "furniture_layout", title: "Furniture Layout", icon: "📐" },
          { type: "mood_board", title: "Mood Board", icon: "🎨" },
        ]} />;
      case "initial-est":
        return <EstimateTab project={project} type="initial" title="Initial Estimate" />;
      case "booking":
        return <BookingFormTab project={project} meta={meta} onConverted={(p) => { applyProject(p); reload(); }} />;
      case "measurements": return <MeasurementsTab project={project} />;
      case "3d-model":
        return <DeliverablesTab project={project} types={[{ type: "model_3d", title: "3D Model Snapshots", icon: "🧊" }]} />;
      case "inter-est":
        return <EstimateTab project={project} type="intermediate" title="Intermediate Estimate" />;
      case "renders":
        return <DeliverablesTab project={project} types={[{ type: "render", title: "Renders", icon: "🖼️" }]} />;
      case "mat-sel": return <MaterialSelectionsTab project={project} />;
      case "final-est":
        return <EstimateTab project={project} type="final" title="Final Estimate" />;
      case "final-rend":
        return <DeliverablesTab project={project} types={[{ type: "final_render", title: "Final Renders", icon: "🖼️" }]} />;
      case "work-draw":
        return <DeliverablesTab project={project} types={[{ type: "working_drawing", title: "Working Drawings", icon: "📐" }]} />;
      case "exec-stages": return <ExecutionTab project={project} />;
      case "pay-sched": return <PaymentScheduleTab project={project} />;
      case "quality": return <QualityTab project={project} />;
      case "handover": return <HandoverTab project={project} />;
      default: return null;
    }
  };

  return (
    <div>
      <div className="bg-white border-b border-surface-200 px-6 pt-3">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-surface-500 cursor-pointer border-none hover:bg-surface-200 text-sm">←</button>
            <div>
              <div className="text-[16px] font-bold text-nicara-dark">{project.name}</div>
              <div className="text-[11px] text-surface-400 mt-0.5">{project.client_name} · {project.property_type} · {project.area || "—"} · {project.city}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={project.stage} label={`${project.stage} phase`} />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-50 rounded-xl">
              <div className="w-16 h-[4px] bg-surface-200 rounded-full overflow-hidden"><div className="h-full rounded-full bg-nicara-gold" style={{ width: project.progress + "%" }} /></div>
              <span className="text-[11px] font-bold text-nicara-dark">{project.progress}%</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1 mb-0">
          {PHASE_TABS
            .filter(t => t.id === "engagement" || project.stage !== "lead")
            .map(t => {
              const PhIcon = PHASE_ICONS[t.id];
              return (
                <button key={t.id} onClick={() => handlePhase(t.id)} className={`flex items-center gap-1.5 px-5 py-2.5 rounded-t-xl text-[12px] font-semibold border-none cursor-pointer transition-all ${phase === t.id ? "bg-nicara-dark text-nicara-gold" : "bg-surface-100 text-surface-500 hover:bg-surface-200"}`}>
                  <PhIcon size={14} />{t.label}
                </button>
              );
            })}
        </div>
        <div className="bg-nicara-dark px-6 py-0 flex overflow-x-auto">
          {subs.map(s => (
            <button key={s.id} onClick={() => setSubTab(s.id)} className={`px-4 py-2.5 bg-transparent border-none text-[11px] cursor-pointer whitespace-nowrap transition-all ${subTab === s.id ? "text-nicara-gold border-b-2 border-nicara-gold font-bold" : "text-surface-400 border-b-2 border-transparent hover:text-surface-200"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5 px-6">{renderContent()}</div>
    </div>
  );
}
