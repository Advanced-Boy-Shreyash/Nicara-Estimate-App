"use client";

import { projectsApi } from "@/lib/api";
import { useApiData, inr } from "@/lib/hooks";
import { ErrorState, Loading, StatusPill } from "@/components/ui/States";

export default function GlobalDashboard() {
  const { data, loading, error, reload } = useApiData(() => projectsApi.dashboard(), []);
  const { data: list } = useApiData(() => projectsApi.list(), []);

  if (loading) return <div className="p-6 px-8"><Loading /></div>;
  if (error || !data) return <div className="p-6 px-8"><ErrorState message={error ?? "No data"} onRetry={reload} /></div>;

  const projects = list?.results ?? [];

  return (
    <div className="p-6 px-8 animate-fade-in">
      <h1 className="text-xl font-bold text-nicara-dark mb-5">Dashboard</h1>
      <div className="grid grid-cols-5 gap-3 mb-5">
        {([
          ["Total Projects", String(data.total_projects), "📁", "#C9A96E"],
          ["Design Phase", String(data.stage_counts.design ?? 0), "🎨", "#7B4FA6"],
          ["Execution", String(data.stage_counts.execution ?? 0), "🏗️", "#F59E0B"],
          ["Received", inr(data.total_paid), "📥", "#2dd4a8"],
          ["Pending", inr(data.total_pending), "📤", "#ef4444"],
        ] as const).map(([l, v, ic, c]) => (
          <div key={l} className="kpi-card">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] text-surface-400 uppercase tracking-wider">{l}</div>
                <div className="text-xl font-extrabold text-nicara-dark mt-1">{v}</div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: c + "15" }}>{ic}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-surface-200 rounded-2xl p-5">
        <h3 className="text-[13px] font-bold text-nicara-dark mb-3">Project Progress</h3>
        {projects.map(p => (
          <div key={p.id} className="flex items-center gap-3 mb-3">
            <span className="text-[11px] font-semibold text-nicara-dark w-40 truncate">{p.name}</span>
            <div className="flex-1 h-3 bg-surface-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-nicara-gold" style={{ width: p.progress + "%" }} /></div>
            <span className="text-[11px] font-bold text-surface-500 w-10 text-right">{p.progress}%</span>
            <StatusPill status={p.stage} />
          </div>
        ))}
        {projects.length === 0 && <div className="text-[12px] text-surface-400 py-4 text-center">No projects yet</div>}
      </div>
      {data.overdue_payments > 0 && (
        <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700 font-medium">
          {data.overdue_payments} payment milestone(s) overdue
        </div>
      )}
    </div>
  );
}
