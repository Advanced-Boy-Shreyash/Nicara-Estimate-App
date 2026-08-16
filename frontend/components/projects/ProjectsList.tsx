"use client";

import { useRouter } from "next/navigation";
import { projectsApi } from "@/lib/api";
import type { ProjectListItem } from "@/lib/apiTypes";
import { useApiData, inr } from "@/lib/hooks";
import { EmptyState, ErrorState, Loading, StatusPill } from "@/components/ui/States";
import {
  FolderKanban, FolderOpen, CheckCircle, Crosshair,
  PenTool, Hammer, type LucideIcon,
} from "lucide-react";
import { useState } from "react";

function SectionHead({ icon, title, count, tone }: { icon: React.ReactNode; title: string; count: number; tone: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-surface-400">{icon}</span>
      <h2 className="text-[14px] font-bold text-nicara-dark m-0">{title}</h2>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tone}`}>{count}</span>
    </div>
  );
}

function ProjectTable({ rows, stage, onOpen }: {
  rows: ProjectListItem[]; stage: string; onOpen: (id: number) => void;
}) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden mb-5 animate-fade-in">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-nicara-dark">
            {["S.No", "Customer", "Project", "Status", stage === "execution" ? "Site Manager" : "Design Owner", "Budget", "Start", "Target"].map(h => (
              <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr
              key={p.id}
              onClick={() => onOpen(p.id)}
              className={`border-b border-surface-100 hover:bg-nicara-gold/5 cursor-pointer transition-colors ${i % 2 === 0 ? "bg-white" : "bg-surface-50/50"}`}
            >
              <td className="px-3 py-2.5 text-surface-400 font-mono">{i + 1}</td>
              <td className="px-3 py-2.5 font-semibold text-nicara-dark">{p.client_name}</td>
              <td className="px-3 py-2.5">
                <div className="font-semibold text-nicara-dark">{p.name}</div>
                <div className="text-[10px] text-surface-400">{p.property_type} · {p.area || "—"}</div>
              </td>
              <td className="px-3 py-2.5"><StatusPill status={p.stage} /></td>
              <td className="px-3 py-2.5 text-surface-600">{(stage === "execution" ? p.site_manager_name : p.design_owner_name) || "—"}</td>
              <td className="px-3 py-2.5 text-surface-600 font-semibold whitespace-nowrap">{p.budget ? inr(p.budget) : "—"}</td>
              <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{p.start_date || "—"}</td>
              <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{p.target_date || "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={8} className="px-3 py-8 text-center text-surface-400">No projects in this stage</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ProjectsList({ onNewLead }: { onNewLead: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"ongoing" | "completed" | "all" | "lead" | "design" | "execution">("ongoing");
  const [search, setSearch] = useState("");
  const { data, loading, error, reload } = useApiData(
    () => projectsApi.list({ search: search || undefined }),
    [search]
  );

  const projects = data?.results ?? [];
  const byStage = (stage: string) => projects.filter(p => p.stage === stage);
  const leads = byStage("lead");
  const designs = byStage("design");
  const execs = byStage("execution");
  const completed = byStage("completed");
  const ongoing = projects.filter(p => p.stage !== "completed");

  const openProject = (id: number) => router.push(`/project/${id}`);

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0">Projects</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">Manage all leads, design & execution projects</p>
        </div>
        <button
          onClick={onNewLead}
          className="px-5 py-2.5 btn-gold rounded-xl text-[13px] font-bold border-none cursor-pointer flex items-center gap-2"
        >
          + Add Lead
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-5">
        {([
          ["Ongoing", projects.length - completed.length, FolderOpen, "#C9A96E"],
          ["Completed", completed.length, CheckCircle, "#2dd4a8"],
          ["Lead", leads.length, Crosshair, "#3b82f6"],
          ["Design", designs.length, PenTool, "#7B4FA6"],
          ["Execution", execs.length, Hammer, "#F59E0B"],
        ] as [string, number, LucideIcon, string][]).map(([l, v, Ic, c]) => (
          <div key={l} className="kpi-card">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] text-surface-400 uppercase tracking-wider">{l}</div>
                <div className="text-2xl font-extrabold text-nicara-dark mt-1">{v}</div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c + "15" }}>
                <Ic size={20} style={{ color: c }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
          {([["ongoing", "Ongoing"], ["completed", "Completed"], ["all", "All"], ["lead", "Leads"], ["design", "Design"], ["execution", "Execution"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer transition-all ${
                tab === k ? "bg-white text-nicara-dark shadow-sm" : "bg-transparent text-surface-500"
              }`}
            >
              {l}{" "}
              <span className="text-[9px] ml-0.5 opacity-50">
                ({k === "ongoing" ? ongoing.length : k === "completed" ? completed.length : k === "all" ? projects.length : k === "lead" ? leads.length : k === "design" ? designs.length : execs.length})
              </span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[250px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-[11px] font-bold">Search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold"
          />
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          {tab === "ongoing" && <><SectionHead icon={<FolderOpen size={15} />} title="Ongoing Projects" count={ongoing.length} tone="bg-nicara-gold/10 text-nicara-gold" /><ProjectTable rows={ongoing} stage="all" onOpen={openProject} /></>}
          {tab === "completed" && <><SectionHead icon={<CheckCircle size={15} />} title="Completed Projects" count={completed.length} tone="bg-green-50 text-green-700" /><ProjectTable rows={completed} stage="completed" onOpen={openProject} /></>}
          {tab === "all" && <><SectionHead icon={<FolderKanban size={15} />} title="All Projects" count={projects.length} tone="bg-surface-100 text-surface-600" /><ProjectTable rows={projects} stage="all" onOpen={openProject} /></>}
          {tab === "lead" && <><SectionHead icon={<Crosshair size={15} />} title="Lead Projects" count={leads.length} tone="bg-blue-50 text-blue-700" /><ProjectTable rows={leads} stage="lead" onOpen={openProject} /></>}
          {tab === "design" && <><SectionHead icon={<PenTool size={15} />} title="Design Projects" count={designs.length} tone="bg-purple-50 text-purple-700" /><ProjectTable rows={designs} stage="design" onOpen={openProject} /></>}
          {tab === "execution" && <><SectionHead icon={<Hammer size={15} />} title="Execution Projects" count={execs.length} tone="bg-amber-50 text-amber-700" /><ProjectTable rows={execs} stage="execution" onOpen={openProject} /></>}
        </>
      )}
    </div>
  );
}
