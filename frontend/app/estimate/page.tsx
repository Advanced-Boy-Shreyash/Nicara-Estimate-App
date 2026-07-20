"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import Avatar from "@/components/ui/Avatar";
import { SAMPLE_PROJECTS, getProjectTotals } from "@/lib/sampleProjects";
import type {
  FullProject, VersionEntry, EstimateRow, MeasurementRoom,
  MaterialSelectionCategory, ExecutionStage, PaymentEntry, QualityCheck,
  DesignReqRow,
} from "@/lib/sampleProjects";

/* ─── Formatting helpers ─── */
const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");
const STATUS_COLORS: Record<string, string> = {
  Active: "#C9A96E", Completed: "#2dd4a8", "On Hold": "#F59E0B", Cancelled: "#ef4444",
  completed: "#2dd4a8", "in-progress": "#3b82f6", upcoming: "#94a3b8", delayed: "#ef4444",
  pass: "#2dd4a8", fail: "#ef4444", pending: "#F59E0B",
  paid: "#2dd4a8", partial: "#3b82f6", overdue: "#ef4444",
};

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
const NAV_SECTIONS = [
  { label: "Main", items: [{ id: "dashboard", icon: "📊", label: "Dashboard" }, { id: "projects", icon: "📁", label: "Projects" }] },
  { label: "Tasks", items: [{ id: "tasks-planned", icon: "✅", label: "Planned Tasks" }, { id: "tasks-unplanned", icon: "⚡", label: "Unplanned Tasks" }] },
  { label: "Vendors", items: [{ id: "vendors-material", icon: "🏭", label: "Material Suppliers" }, { id: "vendors-contractors", icon: "👷", label: "Contractors" }] },
  { label: "Customers", items: [{ id: "customers-leads", icon: "🎯", label: "Leads" }, { id: "customers-clients", icon: "👤", label: "Clients" }] },
  { label: "Finance", items: [{ id: "finance-transactions", icon: "💳", label: "Transactions" }, { id: "finance-vendor", icon: "📤", label: "Vendor Finance" }, { id: "finance-client", icon: "📥", label: "Client Finance" }] },
  { label: "Material Library", items: [{ id: "library-raw", icon: "🪵", label: "Raw Material" }, { id: "library-furniture", icon: "🛋️", label: "Furniture & Furnishings" }] },
  { label: "Admin", items: [{ id: "team-users", icon: "👥", label: "Users & Roles" }, { id: "stages-lead", icon: "📋", label: "Lead Stages" }, { id: "stages-design", icon: "🎨", label: "Design Stages" }, { id: "site-master", icon: "🏗️", label: "Project Site Master" }] },
];

function Sidebar({ view, setView, selectedProject, setSelectedProject }: {
  view: string; setView: (v: string) => void;
  selectedProject: FullProject | null; setSelectedProject: (p: FullProject | null) => void;
}) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <div className="w-[230px] min-w-[230px] sidebar-gradient flex flex-col min-h-screen border-r border-nicara-dark-deep">
      <div className="p-5 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-nicara-gold flex items-center justify-center text-white text-[11px] font-black">N</div>
          <div><div className="text-[15px] font-extrabold text-nicara-gold tracking-[0.12em]">NICARA</div><div className="text-[9px] text-surface-500 tracking-[0.2em] uppercase">Project OS</div></div>
        </div>
      </div>
      <div className="px-3 py-3 flex-1 overflow-y-auto scrollbar-thin">
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="mb-2">
            <button onClick={() => setCollapsed(p => ({ ...p, [section.label]: !p[section.label] }))}
              className="flex items-center justify-between w-full px-2 py-1 bg-transparent border-none cursor-pointer text-left mb-0.5">
              <span className="text-[9px] font-bold text-surface-500 uppercase tracking-[0.15em]">{section.label}</span>
              <span className="text-[10px] text-surface-600">{collapsed[section.label] ? "▸" : "▾"}</span>
            </button>
            {!collapsed[section.label] && section.items.map(item => (
              <button key={item.id} onClick={() => { setView(item.id); setSelectedProject(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] text-left border-none cursor-pointer sidebar-item ${
                  view === item.id && !selectedProject ? "sidebar-item-active font-semibold" : "bg-transparent text-surface-400 hover:text-surface-200"
                }`}>
                <span className="text-[13px] w-4 text-center">{item.icon}</span><span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
        {selectedProject && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-[9px] font-bold text-surface-600 uppercase tracking-[0.12em] px-2 mb-2">Active Project</div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full shrink-0 bg-nicara-gold" />
                <div className="text-[11px] font-semibold text-nicara-gold truncate">{selectedProject.name}</div>
              </div>
              <div className="text-[10px] text-surface-500 mb-2 pl-4">{selectedProject.projectType} · {selectedProject.area}</div>
              <div className="pl-4">
                <div className="flex justify-between text-[10px] text-surface-500 mb-1"><span>Progress</span><span>{selectedProject.progress}%</span></div>
                <div className="h-[3px] bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full bg-nicara-gold" style={{ width: selectedProject.progress + "%" }} /></div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 cursor-pointer group">
          <Avatar name={user ? `${user.firstName} ${user.lastName}` : "User"} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-surface-200 truncate">{user?.firstName} {user?.lastName}</div>
            <div className="text-[9px] text-surface-500 capitalize">{user?.role}</div>
          </div>
          <button onClick={logout} className="opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none text-surface-500 hover:text-red-400 cursor-pointer text-sm p-0" title="Logout">⏻</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROJECTS LIST — 3 tables
   ═══════════════════════════════════════════════════════════════ */
function ProjectsList({ onOpen, onNewLead }: { onOpen: (p: FullProject) => void; onNewLead: () => void }) {
  const [tab, setTab] = useState<"all" | "lead" | "design" | "execution">("all");
  const [search, setSearch] = useState("");
  const leads = SAMPLE_PROJECTS.filter(p => p.stage === "lead");
  const designs = SAMPLE_PROJECTS.filter(p => p.stage === "design");
  const execs = SAMPLE_PROJECTS.filter(p => p.stage === "execution");
  const filter = (list: FullProject[]) => list.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.clientName.toLowerCase().includes(search.toLowerCase()));

  const Tbl = ({ projects, stage }: { projects: FullProject[]; stage: string }) => {
    const f = filter(projects);
    return (
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden mb-5 animate-fade-in">
        <table className="w-full text-[12px]"><thead><tr className="bg-nicara-dark">
          {["S.No", "Customer", "Project", "Status", stage === "execution" ? "Site Manager" : "Design Owner", "Start", "Target"].map(h => (
            <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
          ))}
        </tr></thead><tbody>
          {f.map((p, i) => (
            <tr key={p.id} onClick={() => onOpen(p)} className={`border-b border-surface-100 hover:bg-nicara-gold/5 cursor-pointer transition-colors ${i % 2 === 0 ? "bg-white" : "bg-surface-50/50"}`}>
              <td className="px-3 py-2.5 text-surface-400 font-mono">{i + 1}</td>
              <td className="px-3 py-2.5 font-semibold text-nicara-dark">{p.clientName}</td>
              <td className="px-3 py-2.5"><div className="font-semibold text-nicara-dark">{p.name}</div><div className="text-[10px] text-surface-400">{p.projectType} · {p.area}</div></td>
              <td className="px-3 py-2.5"><span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-nicara-gold/10 text-nicara-gold capitalize">{p.stage}</span></td>
              <td className="px-3 py-2.5 text-surface-600">{stage === "execution" ? p.siteManager : p.designOwner}</td>
              <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{p.startDate}</td>
              <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{p.targetDate}</td>
            </tr>
          ))}
          {f.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">No projects in this stage</td></tr>}
        </tbody></table>
      </div>
    );
  };

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-xl font-bold text-nicara-dark m-0">Projects</h1><p className="text-[12px] text-surface-500 mt-1 m-0">Manage all leads, design & execution projects</p></div>
        <button onClick={onNewLead} className="px-5 py-2.5 btn-gold rounded-xl text-[13px] font-bold border-none cursor-pointer flex items-center gap-2">+ Add Lead</button>
      </div>
      <div className="grid grid-cols-5 gap-3 mb-5">
        {([["Ongoing", SAMPLE_PROJECTS.length, "📁", "#C9A96E"], ["Completed", 0, "✅", "#2dd4a8"], ["Lead", leads.length, "🎯", "#3b82f6"], ["Design", designs.length, "🎨", "#7B4FA6"], ["Execution", execs.length, "🏗️", "#F59E0B"]] as const).map(([l, v, ic, c]) => (
          <div key={l} className="kpi-card"><div className="flex justify-between items-start"><div><div className="text-[10px] text-surface-400 uppercase tracking-wider">{l}</div><div className="text-2xl font-extrabold text-nicara-dark mt-1">{v}</div></div><div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: c + "15" }}>{ic}</div></div></div>
        ))}
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
          {([["all", "All"], ["lead", "Leads"], ["design", "Design"], ["execution", "Execution"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer transition-all ${tab === k ? "bg-white text-nicara-dark shadow-sm" : "bg-transparent text-surface-500"}`}>{l}</button>
          ))}
        </div>
        <div className="relative min-w-[250px]"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none" />
        </div>
      </div>
      {(tab === "all" || tab === "design") && <><div className="flex items-center gap-2 mb-2"><span className="text-[13px]">🎨</span><h2 className="text-[14px] font-bold text-nicara-dark m-0">Design Projects</h2><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{designs.length}</span></div><Tbl projects={designs} stage="design" /></>}
      {(tab === "all" || tab === "execution") && <><div className="flex items-center gap-2 mb-2"><span className="text-[13px]">🏗️</span><h2 className="text-[14px] font-bold text-nicara-dark m-0">Execution Projects</h2><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{execs.length}</span></div><Tbl projects={execs} stage="execution" /></>}
      {(tab === "all" || tab === "lead") && <><div className="flex items-center gap-2 mb-2"><span className="text-[13px]">🎯</span><h2 className="text-[14px] font-bold text-nicara-dark m-0">Lead Projects</h2><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{leads.length}</span></div><Tbl projects={leads} stage="lead" /></>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD LEAD MODAL
   ═══════════════════════════════════════════════════════════════ */
function AddLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  if (!open) return null;
  const IC = "w-full px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold focus:ring-1 focus:ring-nicara-gold/20 transition-all";
  const LC = "text-[10px] font-bold text-surface-500 uppercase tracking-wider block mb-1.5";
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-[550px] max-h-[85vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-surface-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <div><h2 className="text-[16px] font-bold text-nicara-dark m-0">+ Add New Lead</h2><p className="text-[11px] text-surface-400 m-0 mt-0.5">Enter client and project details</p></div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center border-none cursor-pointer text-surface-500 hover:bg-surface-200">✕</button>
        </div>
        <div className="p-6">
          <div className="mb-5"><div className="flex items-center gap-2 mb-3"><div className="w-6 h-6 rounded-md bg-nicara-gold/10 flex items-center justify-center text-nicara-gold text-[12px]">👤</div><span className="text-[12px] font-bold text-nicara-dark uppercase tracking-wider">Client Details</span></div>
            <div className="grid grid-cols-2 gap-3"><div><label className={LC}>Name *</label><input className={IC} placeholder="Client full name" /></div><div><label className={LC}>Phone *</label><input className={IC} placeholder="+91 XXXXX XXXXX" /></div><div className="col-span-2"><label className={LC}>Email</label><input className={IC} type="email" placeholder="client@email.com" /></div><div className="col-span-2"><label className={LC}>Address</label><input className={IC} placeholder="Full address" /></div></div>
          </div>
          <div className="mb-5"><div className="flex items-center gap-2 mb-3"><div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-600 text-[12px]">🏠</div><span className="text-[12px] font-bold text-nicara-dark uppercase tracking-wider">Project Details</span></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={LC}>Developer - Project *</label><select className={IC + " cursor-pointer"}><option value="">Select...</option><option>Prestige Lakeside</option><option>DLF Pinnacle</option><option>Godrej Woodsman</option></select></div>
              <div><label className={LC}>Unit No *</label><input className={IC} placeholder="e.g. D2704" /></div>
              <div><label className={LC}>City *</label><select className={IC + " cursor-pointer"}><option value="">Select...</option><option>Mumbai</option><option>Bangalore</option><option>Pune</option></select></div>
              <div><label className={LC}>State</label><select className={IC + " cursor-pointer"}><option value="">Select...</option><option>Maharashtra</option><option>Karnataka</option></select></div>
              <div><label className={LC}>Pincode</label><input className={IC} placeholder="400001" /></div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-surface-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-5 py-2.5 bg-surface-100 border-none rounded-xl text-[12px] cursor-pointer text-surface-600 font-semibold">Cancel</button>
          <button onClick={() => { toast.success("Lead Created", "New lead added"); onClose(); }} className="px-6 py-2.5 btn-gold rounded-xl text-[13px] font-bold border-none cursor-pointer">Submit</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REUSABLE TAB CONTENT COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

// ── Version Table (used by FL, MB, 3D, Renders, Final Renders, Working Drawings) ──
function VersionTable({ title, icon, versions }: { title: string; icon: string; versions: VersionEntry[] }) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2"><span>{icon}</span><span className="text-[12px] font-bold text-nicara-dark">{title}</span><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-100 text-surface-500 ml-auto">{versions.length} versions</span></div>
      <table className="w-full text-[12px]"><thead><tr className="bg-surface-50">
        {["S.No", "Date", "Version", "Uploaded By", "File", "", "Status", "Remarks"].map(h => (
          <th key={h} className="px-3 py-2 text-surface-400 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead><tbody>
        {versions.map((v, i) => (
          <tr key={v.id} className="border-b border-surface-100 hover:bg-surface-50">
            <td className="px-3 py-2 text-surface-400 font-mono">{i + 1}</td>
            <td className="px-3 py-2 text-surface-600 font-mono text-[11px]">{v.date}</td>
            <td className="px-3 py-2 font-semibold text-nicara-dark">{v.version}</td>
            <td className="px-3 py-2 text-surface-600">{v.uploadedBy}</td>
            <td className="px-3 py-2"><button className="text-[10px] px-2 py-1 bg-blue-50 border-none rounded-lg cursor-pointer text-blue-700 font-semibold">📤 Upload</button></td>
            <td className="px-3 py-2"><button className="text-[10px] px-2 py-1 bg-surface-100 border-none rounded-lg cursor-pointer text-surface-600">📥 {v.fileName.split('.').pop()?.toUpperCase()}</button></td>
            <td className="px-3 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.status === "approved" ? "bg-green-50 text-green-700" : v.status === "revision" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{v.status === "approved" ? "✓ Approved" : v.status === "revision" ? "↻ Revision" : "⏳ Pending"}</span></td>
            <td className="px-3 py-2 text-[11px] text-surface-500 max-w-[200px] truncate">{v.remarks}</td>
          </tr>
        ))}
      </tbody></table>
      <div className="px-3 py-2 border-t border-surface-100 flex gap-2">
        <button className="text-[10px] px-3 py-1.5 bg-surface-100 border-none rounded-lg cursor-pointer text-surface-600 font-semibold hover:bg-surface-200">+ Add Version</button>
        <button className="text-[10px] px-3 py-1.5 bg-nicara-gold/10 border-none rounded-lg cursor-pointer text-nicara-gold font-semibold ml-auto">Send for Approval</button>
      </div>
    </div>
  );
}

// ── Estimate Table (used by Initial, Intermediate, Final) ──
function EstimateTable({ title, rows, showActions }: { title: string; rows: EstimateRow[]; showActions?: boolean }) {
  const totals = getProjectTotals(rows);
  const areas = [...new Set(rows.map(r => r.area))];
  return (
    <div>
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="text-[13px]">📋</span><span className="text-[12px] font-bold text-nicara-dark">{title}</span></div>
          <div className="flex gap-2">
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-surface-100 text-surface-500">{rows.length} items</span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-nicara-gold/10 text-nicara-gold">Total: {fmt(totals.total)}</span>
          </div>
        </div>
        <table className="w-full text-[12px]"><thead><tr className="bg-nicara-dark">
          {["S.No", "Area", "Item", "Description", "L", "B", "H", "Qty", "Unit", "Rate", "Amount", "GST"].map(h => (
            <th key={h} className="px-2 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
          ))}
        </tr></thead><tbody>
          {areas.map(area => {
            const areaRows = rows.filter(r => r.area === area);
            const areaTotal = areaRows.reduce((s, r) => s + r.amount, 0);
            return [
              <tr key={`header-${area}`} className="bg-surface-50 border-b border-surface-100">
                <td colSpan={10} className="px-2 py-2 font-bold text-nicara-dark text-[11px]">{area}</td>
                <td className="px-2 py-2 font-bold text-nicara-dark text-[11px] text-right">{fmt(areaTotal)}</td>
                <td className="px-2 py-2"></td>
              </tr>,
              ...areaRows.map(r => (
                <tr key={r.id} className="border-b border-surface-100 hover:bg-nicara-gold/3">
                  <td className="px-2 py-2 text-surface-400 font-mono">{r.sno}</td>
                  <td className="px-2 py-2 text-surface-500">{r.area}</td>
                  <td className="px-2 py-2 font-semibold text-nicara-dark">{r.item}</td>
                  <td className="px-2 py-2 text-[11px] text-surface-500 max-w-[200px]">{r.description}</td>
                  <td className="px-2 py-2 text-surface-600 font-mono text-[11px]">{r.l}</td>
                  <td className="px-2 py-2 text-surface-600 font-mono text-[11px]">{r.b}</td>
                  <td className="px-2 py-2 text-surface-600 font-mono text-[11px]">{r.h}</td>
                  <td className="px-2 py-2 text-surface-600 font-mono">{r.qty}</td>
                  <td className="px-2 py-2 text-surface-500">{r.unit}</td>
                  <td className="px-2 py-2 text-surface-600 font-mono">{fmt(r.rate)}</td>
                  <td className="px-2 py-2 font-semibold text-nicara-dark font-mono">{fmt(r.amount)}</td>
                  <td className="px-2 py-2 text-surface-500">{r.gstPct}%</td>
                </tr>
              ))
            ];
          })}
          <tr className="bg-nicara-dark"><td colSpan={9}></td><td className="px-2 py-2.5 text-surface-300 font-bold text-[11px]">Subtotal</td><td className="px-2 py-2.5 text-nicara-gold font-bold font-mono">{fmt(totals.subtotal)}</td><td></td></tr>
          <tr className="bg-nicara-dark"><td colSpan={9}></td><td className="px-2 py-2 text-surface-300 font-bold text-[11px]">GST</td><td className="px-2 py-2 text-surface-400 font-mono">{fmt(totals.gst)}</td><td></td></tr>
          <tr className="bg-nicara-dark"><td colSpan={9}></td><td className="px-2 py-2.5 text-nicara-gold font-extrabold text-[12px]">TOTAL</td><td className="px-2 py-2.5 text-nicara-gold font-extrabold font-mono text-[13px]">{fmt(totals.total)}</td><td></td></tr>
        </tbody></table>
      </div>
      {showActions && (
        <div className="flex justify-end gap-2 mt-3">
          <button className="px-4 py-2 bg-surface-100 border-none rounded-xl text-[11px] cursor-pointer text-surface-600 font-semibold">📄 Generate PDF</button>
          <button className="px-4 py-2 bg-nicara-gold/10 border-none rounded-xl text-[11px] cursor-pointer text-nicara-gold font-semibold">✉️ Send for Approval</button>
        </div>
      )}
    </div>
  );
}

// ── Measurements Table ──
function MeasurementsTab({ rooms }: { rooms: MeasurementRoom[] }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2"><span className="text-[13px]">📏</span><span className="text-[12px] font-bold text-nicara-dark">Room Measurements</span></div>
        <div className="flex gap-2">
          <button className="text-[10px] px-3 py-1.5 bg-blue-50 border-none rounded-lg cursor-pointer text-blue-700 font-semibold">📤 Upload AutoCAD</button>
          <button className="text-[10px] px-3 py-1.5 bg-surface-100 border-none rounded-lg cursor-pointer text-surface-600 font-semibold">📤 Upload PDF</button>
        </div>
      </div>
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
        <table className="w-full text-[12px]"><thead><tr className="bg-nicara-dark">
          {["Room", "Plan", "East", "West", "North", "South", "Other Details", "Proof Check By", "Status"].map(h => (
            <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
          ))}
        </tr></thead><tbody>
          {rooms.map(r => (
            <tr key={r.id} className="border-b border-surface-100 hover:bg-surface-50">
              <td className="px-3 py-2.5 font-semibold text-nicara-dark">{r.room}</td>
              <td className="px-3 py-2.5 text-green-600 font-bold">{r.plan}</td>
              <td className="px-3 py-2.5 text-surface-600 font-mono">{r.east}</td>
              <td className="px-3 py-2.5 text-surface-600 font-mono">{r.west}</td>
              <td className="px-3 py-2.5 text-surface-600 font-mono">{r.north}</td>
              <td className="px-3 py-2.5 text-surface-600 font-mono">{r.south}</td>
              <td className="px-3 py-2.5 text-[11px] text-surface-500">{r.other}</td>
              <td className="px-3 py-2.5 text-surface-600">{r.proofCheckedBy}</td>
              <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === "complete" ? "bg-green-50 text-green-700" : r.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{r.status === "complete" ? "✓ Complete" : r.status === "pending" ? "⏳ Pending" : "⚠ Issue"}</span></td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}

// ── Material Selections ──
function MaterialSelectionsTab({ categories }: { categories: MaterialSelectionCategory[] }) {
  const [activeCat, setActiveCat] = useState(categories[0]?.category || "");
  const active = categories.find(c => c.category === activeCat);
  return (
    <div>
      <div className="flex gap-1 bg-surface-100 rounded-xl p-1 mb-4">
        {categories.map(c => (
          <button key={c.category} onClick={() => setActiveCat(c.category)}
            className={`px-4 py-2 rounded-lg text-[11px] font-semibold border-none cursor-pointer transition-all ${activeCat === c.category ? "bg-white text-nicara-dark shadow-sm" : "bg-transparent text-surface-500"}`}>{c.category} <span className="text-[9px] ml-1 opacity-60">({c.items.length})</span></button>
        ))}
      </div>
      {active && (
        <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
          <table className="w-full text-[12px]"><thead><tr className="bg-nicara-dark">
            {["Room", "Wall/Area", "Price Range", "Supplier", "Brand", "Catalog", "Item Code", "Price", "Availability"].map(h => (
              <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
            ))}
          </tr></thead><tbody>
            {active.items.map(item => (
              <tr key={item.id} className="border-b border-surface-100 hover:bg-surface-50">
                <td className="px-3 py-2.5 font-semibold text-nicara-dark">{item.room}</td>
                <td className="px-3 py-2.5 text-surface-600">{item.wall}</td>
                <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{item.priceRange}</td>
                <td className="px-3 py-2.5 text-surface-600">{item.supplierName}</td>
                <td className="px-3 py-2.5 font-semibold text-blue-700">{item.brandName}</td>
                <td className="px-3 py-2.5 text-surface-600">{item.catalog}</td>
                <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{item.itemCode}</td>
                <td className="px-3 py-2.5 font-semibold text-nicara-dark font-mono">{fmt(item.supplierPrice)}</td>
                <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.availability === "In Stock" ? "bg-green-50 text-green-700" : item.availability === "Order" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{item.availability}</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  );
}

// ── Execution Stages ──
function ExecutionTab({ stages }: { stages: ExecutionStage[] }) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2"><span className="text-[13px]">🏗️</span><span className="text-[12px] font-bold text-nicara-dark">Execution Progress</span></div>
      <table className="w-full text-[12px]"><thead><tr className="bg-nicara-dark">
        {["Stage", "Vendor", "Start", "End", "Progress", "Payment", "Pay Status", "Status"].map(h => (
          <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead><tbody>
        {stages.map(s => (
          <tr key={s.id} className="border-b border-surface-100 hover:bg-surface-50">
            <td className="px-3 py-2.5 font-semibold text-nicara-dark">{s.name}</td>
            <td className="px-3 py-2.5 text-surface-600">{s.vendor}</td>
            <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{s.startDate}</td>
            <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{s.endDate}</td>
            <td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="w-16 h-[5px] bg-surface-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: s.progress + "%", background: STATUS_COLORS[s.status] || "#C9A96E" }} /></div><span className="text-[10px] font-bold">{s.progress}%</span></div></td>
            <td className="px-3 py-2.5 font-mono text-surface-600">{fmt(s.payment)}</td>
            <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.paymentStatus === "paid" ? "bg-green-50 text-green-700" : s.paymentStatus === "partial" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{s.paymentStatus === "paid" ? "✓ Paid" : s.paymentStatus === "partial" ? "◐ Partial" : "⏳ Pending"}</span></td>
            <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize`} style={{ background: (STATUS_COLORS[s.status] || "#94a3b8") + "18", color: STATUS_COLORS[s.status] || "#94a3b8" }}>{s.status}</span></td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

// ── Payment Schedule ──
function PaymentScheduleTab({ payments }: { payments: PaymentEntry[] }) {
  const paid = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const total = payments.reduce((s, p) => s + p.amount, 0);
  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {([["Total Value", total, "💰", "#C9A96E"], ["Received", paid, "✅", "#2dd4a8"], ["Pending", total - paid, "⏳", "#F59E0B"], ["Collection %", Math.round(paid / total * 100) + "%", "📊", "#3b82f6"]] as [string, number | string, string, string][]).map(([l, v, ic, c]) => (
          <div key={l} className="kpi-card"><div className="flex justify-between items-start"><div><div className="text-[10px] text-surface-400 uppercase tracking-wider">{l}</div><div className="text-lg font-extrabold text-nicara-dark mt-1">{typeof v === "number" ? fmt(v) : v}</div></div><div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: c + "15" }}>{ic}</div></div></div>
        ))}
      </div>
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
        <table className="w-full text-[12px]"><thead><tr className="bg-nicara-dark">
          {["Milestone", "Amount", "Due Date", "Paid Date", "Mode", "Reference", "Status"].map(h => (
            <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
          ))}
        </tr></thead><tbody>
          {payments.map(p => (
            <tr key={p.id} className="border-b border-surface-100 hover:bg-surface-50">
              <td className="px-3 py-2.5 font-semibold text-nicara-dark">{p.milestone}</td>
              <td className="px-3 py-2.5 font-mono font-semibold text-nicara-dark">{fmt(p.amount)}</td>
              <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{p.dueDate}</td>
              <td className="px-3 py-2.5 text-surface-600 font-mono text-[11px]">{p.paidDate || "—"}</td>
              <td className="px-3 py-2.5 text-surface-600">{p.mode || "—"}</td>
              <td className="px-3 py-2.5 text-[11px] text-surface-500 font-mono">{p.reference || "—"}</td>
              <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize`} style={{ background: (STATUS_COLORS[p.status] || "#94a3b8") + "18", color: STATUS_COLORS[p.status] || "#94a3b8" }}>{p.status}</span></td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}

// ── Quality Checks ──
function QualityTab({ checks }: { checks: QualityCheck[] }) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2"><span className="text-[13px]">🔍</span><span className="text-[12px] font-bold text-nicara-dark">Quality Inspections</span></div>
      <table className="w-full text-[12px]"><thead><tr className="bg-nicara-dark">
        {["Area", "Check Type", "Date", "Inspector", "Status", "Remarks"].map(h => (
          <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead><tbody>
        {checks.map(c => (
          <tr key={c.id} className="border-b border-surface-100 hover:bg-surface-50">
            <td className="px-3 py-2.5 font-semibold text-nicara-dark">{c.area}</td>
            <td className="px-3 py-2.5 text-surface-600">{c.checkType}</td>
            <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{c.date}</td>
            <td className="px-3 py-2.5 text-surface-600">{c.inspector}</td>
            <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize`} style={{ background: (STATUS_COLORS[c.status] || "#F59E0B") + "18", color: STATUS_COLORS[c.status] || "#F59E0B" }}>{c.status}</span></td>
            <td className="px-3 py-2.5 text-[11px] text-surface-500">{c.remarks}</td>
          </tr>
        ))}
        {checks.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-surface-400">No quality checks recorded yet</td></tr>}
      </tbody></table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROJECT DETAIL — Full 3-Phase with real data
   ═══════════════════════════════════════════════════════════════ */
type Phase = "engagement" | "design" | "execution";

const PHASE_TABS = [
  { id: "engagement" as Phase, label: "Initial Engagement", icon: "🎯" },
  { id: "design" as Phase, label: "Design", icon: "🎨" },
  { id: "execution" as Phase, label: "Execution", icon: "🏗️" },
];
const ENG_SUBS = [
  { id: "client-basic", label: "Client Details" }, { id: "design-req", label: "Design Requirements" },
  { id: "fl-mb", label: "FL & Mood Board" }, { id: "initial-est", label: "Initial Estimate" }, { id: "booking", label: "Booking Form" },
];
const DES_SUBS = [
  { id: "measurements", label: "Measurements" }, { id: "3d-model", label: "3D Model" },
  { id: "inter-est", label: "Intermediate Estimate" }, { id: "renders", label: "Renders" },
  { id: "mat-sel", label: "Material Selections" }, { id: "final-est", label: "Final Estimate" },
  { id: "final-rend", label: "Final Renders" }, { id: "work-draw", label: "Working Drawings" },
];
const EXE_SUBS = [
  { id: "exec-stages", label: "Execution Stages" }, { id: "pay-sched", label: "Payment Schedule" },
  { id: "quality", label: "Quality" }, { id: "handover", label: "Handover" },
];

function ProjectDetail({ project, onBack }: { project: FullProject; onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("engagement");
  const [subTab, setSubTab] = useState("client-basic");
  const subs = phase === "engagement" ? ENG_SUBS : phase === "design" ? DES_SUBS : EXE_SUBS;
  const handlePhase = (p: Phase) => { setPhase(p); setSubTab((p === "engagement" ? ENG_SUBS : p === "design" ? DES_SUBS : EXE_SUBS)[0].id); };

  const IC = "w-full px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold";
  const LC = "text-[10px] font-bold text-surface-500 uppercase tracking-wider block mb-1.5";

  const renderContent = () => {
    switch (subTab) {
      case "client-basic": return (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border border-surface-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4"><div className="w-6 h-6 rounded-md bg-nicara-gold/10 flex items-center justify-center text-nicara-gold text-[12px]">👤</div><span className="text-[12px] font-bold text-nicara-dark uppercase tracking-wider">Client Details</span></div>
            <div className="space-y-3">
              <div><label className={LC}>Name</label><input className={IC} defaultValue={project.clientName} /></div>
              <div><label className={LC}>Phone</label><input className={IC} defaultValue={project.clientPhone} /></div>
              <div><label className={LC}>Email</label><input className={IC} defaultValue={project.clientEmail} /></div>
              <div><label className={LC}>Address</label><input className={IC} defaultValue={project.clientAddress} /></div>
            </div>
          </div>
          <div className="bg-white border border-surface-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4"><div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-600 text-[12px]">🏠</div><span className="text-[12px] font-bold text-nicara-dark uppercase tracking-wider">Project Details</span></div>
            <div className="space-y-3">
              <div><label className={LC}>Developer - Project</label><input className={IC} defaultValue={project.developer} /></div>
              <div><label className={LC}>Unit No</label><input className={IC} defaultValue={project.unitNo} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={LC}>City</label><input className={IC} defaultValue={project.city} /></div>
                <div><label className={LC}>State</label><input className={IC} defaultValue={project.state} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={LC}>Budget</label><input className={IC} defaultValue={project.budget} /></div>
                <div><label className={LC}>Area</label><input className={IC} defaultValue={project.area} /></div>
              </div>
            </div>
          </div>
        </div>
      );
      case "design-req": return (
        <div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div><label className={LC}>Type</label><input className={IC} defaultValue={project.type} readOnly /></div>
            <div><label className={LC}>Purpose</label><input className={IC} defaultValue={project.purpose} readOnly /></div>
            <div><label className={LC}>Interior Style</label><input className={IC} defaultValue={project.interiorStyle} readOnly /></div>
            <div><label className={LC}>Total Items</label><input className={IC} defaultValue={project.designRequirements.length + " items"} readOnly /></div>
          </div>
          <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
            <table className="w-full text-[12px]"><thead><tr className="bg-nicara-dark">
              {["S.No", "Room/Area", "Unit Selection", "L", "B", "H", "Finishing", "Remarks", "Design Req."].map(h => (
                <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead><tbody>
              {project.designRequirements.map((r, i) => (
                <tr key={r.id} className="border-b border-surface-100 hover:bg-surface-50">
                  <td className="px-3 py-2 text-surface-400 font-mono">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-nicara-dark">{r.room}</td>
                  <td className="px-3 py-2 font-semibold text-nicara-dark">{r.unit}</td>
                  <td className="px-3 py-2 text-surface-600 font-mono">{r.l}</td>
                  <td className="px-3 py-2 text-surface-600 font-mono">{r.b}</td>
                  <td className="px-3 py-2 text-surface-600 font-mono">{r.h}</td>
                  <td className="px-3 py-2"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-nicara-gold/10 text-nicara-gold">{r.finishing}</span></td>
                  <td className="px-3 py-2 text-[11px] text-surface-500">{r.remarks}</td>
                  <td className="px-3 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.designRequired ? "bg-green-50 text-green-700" : "bg-surface-100 text-surface-400"}`}>{r.designRequired ? "✓ Yes" : "— No"}</span></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      );
      case "fl-mb": return (
        <div className="grid grid-cols-2 gap-4">
          <VersionTable title="Furniture Layout" icon="📐" versions={project.furnitureLayouts} />
          <VersionTable title="Mood Board" icon="🎨" versions={project.moodBoards} />
        </div>
      );
      case "initial-est": return <EstimateTable title="Initial Estimate" rows={project.initialEstimate} showActions />;
      case "booking": return (
        <div className="bg-white border border-surface-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4"><span className="text-[13px]">📝</span><span className="text-[12px] font-bold text-nicara-dark">Booking Form</span></div>
          <div className="grid grid-cols-2 gap-4 text-[12px]">
            <div className="space-y-2 bg-surface-50 rounded-xl p-4">
              <div className="text-[10px] font-bold text-surface-400 uppercase">Client</div>
              <div><strong>Name:</strong> {project.clientName}</div>
              <div><strong>Phone:</strong> {project.clientPhone}</div>
              <div><strong>Email:</strong> {project.clientEmail}</div>
            </div>
            <div className="space-y-2 bg-surface-50 rounded-xl p-4">
              <div className="text-[10px] font-bold text-surface-400 uppercase">Project</div>
              <div><strong>Developer:</strong> {project.developer}</div>
              <div><strong>Unit:</strong> {project.unitNo}</div>
              <div><strong>Budget:</strong> {project.budget}</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2"><button className="px-4 py-2 bg-nicara-gold/10 border-none rounded-xl text-[11px] cursor-pointer text-nicara-gold font-semibold">📄 Generate Booking Form</button><button className="px-4 py-2 bg-blue-50 border-none rounded-xl text-[11px] cursor-pointer text-blue-700 font-semibold">✍️ Digital Sign & Approve</button><button className="px-4 py-2 bg-green-50 border-none rounded-xl text-[11px] cursor-pointer text-green-700 font-semibold">💳 Send Payment Link</button></div>
        </div>
      );
      case "measurements": return <MeasurementsTab rooms={project.measurements} />;
      case "3d-model": return <VersionTable title="3D Model Snapshots" icon="🧊" versions={project.models3d} />;
      case "inter-est": return <EstimateTable title="Intermediate Estimate" rows={project.intermediateEstimate} showActions />;
      case "renders": return <VersionTable title="Renders" icon="🖼️" versions={project.renders} />;
      case "mat-sel": return project.materialSelections.length > 0 ? <MaterialSelectionsTab categories={project.materialSelections} /> : <div className="bg-white border border-surface-200 rounded-2xl p-8 text-center"><div className="text-3xl mb-2">📦</div><p className="text-[12px] text-surface-400">Material selections not yet started</p></div>;
      case "final-est": return project.finalEstimate.length > 0 ? <EstimateTable title="Final Estimate" rows={project.finalEstimate} showActions /> : <div className="bg-white border border-surface-200 rounded-2xl p-8 text-center"><div className="text-3xl mb-2">📋</div><p className="text-[12px] text-surface-400">Final estimate not yet generated</p></div>;
      case "final-rend": return project.finalRenders.length > 0 ? <VersionTable title="Final Renders" icon="🖼️" versions={project.finalRenders} /> : <div className="bg-white border border-surface-200 rounded-2xl p-8 text-center"><div className="text-3xl mb-2">🖼️</div><p className="text-[12px] text-surface-400">Final renders not yet uploaded</p></div>;
      case "work-draw": return project.workingDrawings.length > 0 ? <VersionTable title="Working Drawings" icon="📐" versions={project.workingDrawings} /> : <div className="bg-white border border-surface-200 rounded-2xl p-8 text-center"><div className="text-3xl mb-2">📐</div><p className="text-[12px] text-surface-400">Working drawings not yet uploaded</p></div>;
      case "exec-stages": return project.executionStages.length > 0 ? <ExecutionTab stages={project.executionStages} /> : <div className="bg-white border border-surface-200 rounded-2xl p-8 text-center"><div className="text-3xl mb-2">🏗️</div><p className="text-[12px] text-surface-400">Execution not yet started</p></div>;
      case "pay-sched": return <PaymentScheduleTab payments={project.paymentSchedule} />;
      case "quality": return <QualityTab checks={project.qualityChecks} />;
      case "handover": return (
        <div className="bg-white border border-surface-200 rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">{project.stage === "execution" && project.executionStages.some(s => s.status === "completed") ? "🎉" : "📋"}</div>
          <h3 className="text-[14px] font-bold text-nicara-dark mb-1">Project Handover</h3>
          <p className="text-[12px] text-surface-400 max-w-md mx-auto mb-4">
            {project.stage === "execution" ? `${project.executionStages.filter(s => s.status === "completed").length} of ${project.executionStages.length} execution stages completed. Handover pending.` : "Project has not reached handover stage yet."}
          </p>
          <button className="px-5 py-2.5 btn-gold rounded-xl text-[12px] font-bold border-none cursor-pointer">Generate Handover Report</button>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div>
      <div className="bg-white border-b border-surface-200 px-6 pt-3">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-surface-500 cursor-pointer border-none hover:bg-surface-200 text-sm">←</button>
            <div><div className="text-[16px] font-bold text-nicara-dark">{project.name}</div><div className="text-[11px] text-surface-400 mt-0.5">{project.clientName} · {project.projectType} · {project.area} · {project.city}</div></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-nicara-gold/10 text-nicara-gold capitalize">{project.stage} Phase</span>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-50 rounded-xl"><div className="w-16 h-[4px] bg-surface-200 rounded-full overflow-hidden"><div className="h-full rounded-full bg-nicara-gold" style={{ width: project.progress + "%" }} /></div><span className="text-[11px] font-bold text-nicara-dark">{project.progress}%</span></div>
          </div>
        </div>
        <div className="flex gap-1 mb-0">
          {PHASE_TABS.map(t => (
            <button key={t.id} onClick={() => handlePhase(t.id)} className={`px-5 py-2.5 rounded-t-xl text-[12px] font-semibold border-none cursor-pointer transition-all ${phase === t.id ? "bg-nicara-dark text-nicara-gold" : "bg-surface-100 text-surface-500 hover:bg-surface-200"}`}>{t.icon} {t.label}</button>
          ))}
        </div>
      </div>
      <div className="bg-nicara-dark px-6 py-0 flex overflow-x-auto">
        {subs.map(s => (
          <button key={s.id} onClick={() => setSubTab(s.id)} className={`px-4 py-2.5 bg-transparent border-none text-[11px] cursor-pointer whitespace-nowrap transition-all ${subTab === s.id ? "text-nicara-gold border-b-2 border-nicara-gold font-bold" : "text-surface-400 border-b-2 border-transparent hover:text-surface-200"}`}>{s.label}</button>
        ))}
      </div>
      <div className="p-5 px-6">{renderContent()}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function GlobalDashboard() {
  const totalBudget = SAMPLE_PROJECTS.reduce((s, p) => s + parseInt(p.budget.replace(/[₹,]/g, "")), 0);
  const paid = SAMPLE_PROJECTS.flatMap(p => p.paymentSchedule).filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  return (
    <div className="p-6 px-8 animate-fade-in">
      <h1 className="text-xl font-bold text-nicara-dark mb-5">Dashboard</h1>
      <div className="grid grid-cols-5 gap-3 mb-5">
        {([["Total Projects", SAMPLE_PROJECTS.length, "📁", "#C9A96E"], ["Design Phase", SAMPLE_PROJECTS.filter(p => p.stage === "design").length, "🎨", "#7B4FA6"], ["Execution", SAMPLE_PROJECTS.filter(p => p.stage === "execution").length, "🏗️", "#F59E0B"], ["Received", fmt(paid), "📥", "#2dd4a8"], ["Pending", fmt(totalBudget - paid), "📤", "#ef4444"]] as [string, number | string, string, string][]).map(([l, v, ic, c]) => (
          <div key={l} className="kpi-card"><div className="flex justify-between items-start"><div><div className="text-[10px] text-surface-400 uppercase tracking-wider">{l}</div><div className="text-xl font-extrabold text-nicara-dark mt-1">{v}</div></div><div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: c + "15" }}>{ic}</div></div></div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-surface-200 rounded-2xl p-5">
          <h3 className="text-[13px] font-bold text-nicara-dark mb-3">Project Progress</h3>
          {SAMPLE_PROJECTS.map(p => (
            <div key={p.id} className="flex items-center gap-3 mb-3">
              <span className="text-[11px] font-semibold text-nicara-dark w-32 truncate">{p.name}</span>
              <div className="flex-1 h-3 bg-surface-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-nicara-gold" style={{ width: p.progress + "%" }} /></div>
              <span className="text-[11px] font-bold text-surface-500 w-10 text-right">{p.progress}%</span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full capitalize bg-surface-50 text-surface-500">{p.stage}</span>
            </div>
          ))}
        </div>
        <div className="bg-white border border-surface-200 rounded-2xl p-5">
          <h3 className="text-[13px] font-bold text-nicara-dark mb-3">Payment Overview</h3>
          {SAMPLE_PROJECTS.map(p => {
            const pPaid = p.paymentSchedule.filter(pm => pm.status === "paid").reduce((s, pm) => s + pm.amount, 0);
            const pTotal = p.paymentSchedule.reduce((s, pm) => s + pm.amount, 0);
            const overdue = p.paymentSchedule.filter(pm => pm.status === "overdue").length;
            return (
              <div key={p.id} className="flex items-center gap-3 mb-3 p-2 rounded-xl bg-surface-50">
                <span className="text-[11px] font-semibold text-nicara-dark w-32 truncate">{p.name}</span>
                <span className="text-[11px] font-mono text-green-700">{fmt(pPaid)}</span>
                <span className="text-surface-300">/</span>
                <span className="text-[11px] font-mono text-surface-500">{fmt(pTotal)}</span>
                {overdue > 0 && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 ml-auto">⚠ {overdue} overdue</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */
function EstimateAppInner() {
  const [view, setView] = useState("projects");
  const [selectedProject, setSelectedProject] = useState<FullProject | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const { user } = useAuth();
  const labels: Record<string, string> = {
    dashboard: "Dashboard", projects: "Projects", "tasks-planned": "Planned Tasks", "tasks-unplanned": "Unplanned Tasks",
    "vendors-material": "Material Suppliers", "vendors-contractors": "Contractors", "customers-leads": "Leads", "customers-clients": "Clients",
    "finance-transactions": "Transactions", "finance-vendor": "Vendor Finance", "finance-client": "Client Finance",
    "library-raw": "Raw Material", "library-furniture": "Furniture & Furnishings", "team-users": "Users & Roles",
    "stages-lead": "Lead Stages", "stages-design": "Design Stages", "site-master": "Project Site Master",
  };

  return (
    <div className="flex min-h-screen bg-[#f0eeeb]">
      <Sidebar view={view} setView={setView} selectedProject={selectedProject} setSelectedProject={setSelectedProject} />
      <div className="flex-1 overflow-auto">
        <div className="bg-white border-b border-surface-200 px-6 py-2.5 flex justify-between items-center no-print sticky top-0 z-30">
          <div className="flex items-center gap-2 text-[12px] text-surface-400"><span className="text-nicara-gold font-bold">NICARA</span><span>›</span><span>{selectedProject ? selectedProject.name : labels[view] || view}</span></div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-sm cursor-pointer hover:bg-surface-200" title="Notifications">🔔</div>
            <div className="flex items-center gap-2 pl-3 border-l border-surface-200"><Avatar name={user ? `${user.firstName} ${user.lastName}` : "User"} size="sm" /><div><div className="text-[11px] font-semibold text-nicara-dark">{user?.firstName}</div><div className="text-[9px] text-surface-400 capitalize">{user?.role}</div></div></div>
          </div>
        </div>
        <AddLeadModal open={showAddLead} onClose={() => setShowAddLead(false)} />
        {view === "dashboard" && <GlobalDashboard />}
        {view === "projects" && !selectedProject && <ProjectsList onOpen={p => { setSelectedProject(p); setView("detail"); }} onNewLead={() => setShowAddLead(true)} />}
        {view === "detail" && selectedProject && <ProjectDetail project={selectedProject} onBack={() => { setView("projects"); setSelectedProject(null); }} />}
        {!["dashboard", "projects", "detail"].includes(view) && !selectedProject && (
          <div className="p-6 px-8 animate-fade-in"><h1 className="text-xl font-bold text-nicara-dark mb-2">{labels[view]}</h1><p className="text-[12px] text-surface-500 mb-5">Under development — will connect to backend API</p><div className="bg-white border border-surface-200 rounded-2xl p-10 text-center"><div className="text-5xl mb-4">🚧</div><h3 className="text-[15px] font-bold text-nicara-dark mb-2">{labels[view]}</h3><p className="text-[12px] text-surface-400 max-w-md mx-auto">Backend endpoints ready at /api/. This page will be connected in the next phase.</p></div></div>
        )}
      </div>
    </div>
  );
}

export default function EstimateApp() {
  return (<AuthProvider><ToastProvider><EstimateAppInner /></ToastProvider></AuthProvider>);
}
