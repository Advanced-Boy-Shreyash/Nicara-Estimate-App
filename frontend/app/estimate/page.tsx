"use client";

import { useState } from "react";
import { AuthProvider, useAuth, getInitials } from "@/lib/auth";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import Avatar, { AvatarStack } from "@/components/ui/Avatar";
import NewProjectModal from "@/components/admin/NewProjectModal";
import UserManagementPage from "@/components/admin/UserManagementPage";
import IAMPage from "@/components/admin/IAMPage";
import QuotePDFPreview from "@/components/estimate/QuotePDFPreview";
import ComponentLibrary from "@/components/library/ComponentLibrary";
import {
  PROJECTS, TABS, ROLE_CONFIG, STATUS_COLORS,
  SERVICE_VENDORS, PRODUCT_VENDORS, CLIENTS, DESIGNERS,
} from "@/lib/constants";
import type { Project } from "@/lib/types";
import DataTable from "@/components/ui/DataTable";
import ClientRequirements from "@/components/tabs/ClientRequirements";
import FurnitureLayout from "@/components/tabs/FurnitureLayout";
import MoodBoard from "@/components/tabs/MoodBoard";
import InitialEstimate from "@/components/tabs/InitialEstimate";
import Design from "@/components/tabs/Design";
import FinalEstimate from "@/components/tabs/FinalEstimate";
import ProjectManagement from "@/components/tabs/ProjectManagement";
import Handover from "@/components/tabs/Handover";
import Dashboard from "@/components/tabs/Dashboard";

/* ── Sidebar ─────────────────────────────────────────────────── */
const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { id: "projects", icon: "📁", label: "Projects" },
      { id: "dashboard-global", icon: "📊", label: "Dashboard" },
    ],
  },
  {
    label: "Database",
    items: [
      { id: "servicevendors", icon: "🔧", label: "Service Vendors" },
      { id: "productvendors", icon: "📦", label: "Product Vendors" },
      { id: "clients", icon: "👤", label: "Clients" },
      { id: "designers", icon: "🎨", label: "Designers" },
      { id: "library", icon: "📋", label: "Component Library" },
    ],
  },
  {
    label: "Admin",
    items: [
      { id: "users", icon: "👥", label: "User Management" },
      { id: "iam", icon: "🔐", label: "Access Control" },
    ],
  },
];

function Sidebar({
  view, setView, selectedProject, setSelectedProject,
}: {
  view: string; setView: (v: string) => void;
  selectedProject: Project | null; setSelectedProject: (p: Project | null) => void;
}) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="w-[230px] min-w-[230px] sidebar-gradient flex flex-col min-h-screen border-r border-nicara-dark-deep">
      {/* Logo */}
      <div className="p-5 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-nicara-gold flex items-center justify-center text-white text-[11px] font-black">N</div>
          <div>
            <div className="text-[15px] font-extrabold text-nicara-gold tracking-[0.12em]">NICARA</div>
            <div className="text-[9px] text-surface-500 tracking-[0.2em] uppercase">Project OS</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-3 py-3 flex-1 overflow-y-auto">
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="mb-3">
            <button onClick={() => setCollapsed(p => ({ ...p, [section.label]: !p[section.label] }))}
              className="flex items-center justify-between w-full px-2 py-1 bg-transparent border-none cursor-pointer text-left mb-1">
              <span className="text-[9px] font-bold text-surface-500 uppercase tracking-[0.15em]">{section.label}</span>
              <span className="text-[10px] text-surface-600">{collapsed[section.label] ? "▸" : "▾"}</span>
            </button>
            {!collapsed[section.label] && section.items.map(item => (
              <button key={item.id} onClick={() => { setView(item.id); setSelectedProject(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-left border-none cursor-pointer sidebar-item ${
                  view === item.id && !selectedProject ? "sidebar-item-active font-semibold" : "bg-transparent text-surface-400 hover:text-surface-200"
                }`}>
                <span className="text-[14px] w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}

        {/* Active Project */}
        {selectedProject && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-[9px] font-bold text-surface-600 uppercase tracking-[0.12em] px-2 mb-2">Active Project</div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[selectedProject.status] || "#C9A96E" }} />
                <div className="text-[12px] font-semibold text-nicara-gold truncate">{selectedProject.name}</div>
              </div>
              <div className="text-[10px] text-surface-500 mb-2 pl-4">{selectedProject.type} · {selectedProject.area}</div>
              <div className="pl-4">
                <div className="flex justify-between text-[10px] text-surface-500 mb-1"><span>Progress</span><span>{selectedProject.progress}%</span></div>
                <div className="h-[3px] bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: selectedProject.progress + "%", background: STATUS_COLORS[selectedProject.status] || "#C9A96E" }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 cursor-pointer group">
          <Avatar name={user ? `${user.firstName} ${user.lastName}` : "User"} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-surface-200 truncate">{user?.firstName} {user?.lastName}</div>
            <div className="text-[9px] text-surface-500 capitalize">{user?.role}</div>
          </div>
          <button onClick={logout} className="opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none text-surface-500 hover:text-red-400 cursor-pointer text-sm p-0" title="Logout">
            ⏻
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Projects List ───────────────────────────────────────────── */
function ProjectsList({ onOpen, onNewProject }: { onOpen: (p: Project) => void; onNewProject: () => void }) {
  const [filterCity, setFilterCity] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");

  const cities = ["All", ...new Set(PROJECTS.map(p => p.city))];
  const statuses = ["All", ...new Set(PROJECTS.map(p => p.status))];

  const filtered = PROJECTS.filter(p =>
    (filterCity === "All" || p.city === filterCity) &&
    (filterStatus === "All" || p.status === filterStatus) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  const ddCls = "px-3 py-2 border border-surface-200 rounded-xl text-[12px] bg-white outline-none cursor-pointer";
  const teamNames = ["Nishanth K", "Priya S", "Rahul M"];

  return (
    <div className="p-6 px-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0">Projects</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">{PROJECTS.length} active projects</p>
        </div>
        <button onClick={onNewProject} className="px-5 py-2.5 btn-gold rounded-xl text-[13px] font-bold border-none cursor-pointer flex items-center gap-2">
          + New Project
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[["Total Projects", PROJECTS.length, "📁", "#C9A96E"], ["In Progress", PROJECTS.filter(p => p.status === "Design" || p.status === "Execution" || p.status === "Initial Estimate").length, "⟳", "#3b82f6"], ["Completed", PROJECTS.filter(p => p.status === "Handover").length, "✓", "#2dd4a8"], ["Avg Progress", Math.round(PROJECTS.reduce((s, p) => s + p.progress, 0) / PROJECTS.length) + "%", "📊", "#7B4FA6"]].map(([l, v, icon, color]) => (
          <div key={l as string} className="kpi-card">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] text-surface-400 uppercase tracking-wider">{l as string}</div>
                <div className="text-2xl font-extrabold text-nicara-dark mt-1">{v as string | number}</div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: (color as string) + "15" }}>{icon as string}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 items-center mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
            className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none" />
        </div>
        <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className={ddCls}>
          {cities.map(c => <option key={c} value={c}>{c === "All" ? "All Cities" : c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={ddCls}>
          {statuses.map(s => <option key={s} value={s}>{s === "All" ? "All Statuses" : s}</option>)}
        </select>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(p => {
          const role = ROLE_CONFIG[p.role];
          const sc = STATUS_COLORS[p.status] || "#C9A96E";
          return (
            <div key={p.id} onClick={() => onOpen(p)}
              className="bg-white border border-surface-200 rounded-2xl p-4 cursor-pointer card-hover relative overflow-hidden group">
              {/* Top accent */}
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${sc}, ${sc}88)` }} />

              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-[14px] font-bold text-nicara-dark">{p.name}</div>
                  <div className="text-[11px] text-surface-400 mt-0.5">{p.type} · {p.area} · {p.location}</div>
                </div>
                <div className="flex gap-1.5">
                  <span style={{ color: role.color, background: role.bg }} className="text-[10px] font-bold px-2 py-0.5 rounded-full">{role.icon} {role.label}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AvatarStack names={teamNames} max={3} />
                  <span style={{ color: sc, background: sc + "15" }} className="text-[10px] font-bold px-2.5 py-1 rounded-full">{p.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-[4px] bg-surface-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: p.progress + "%", background: sc }} />
                  </div>
                  <span className="text-[11px] font-bold text-nicara-dark">{p.progress}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── DB Configs ──────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DB_CONFIGS: Record<string, { title: string; data: any[]; columns: { key: string; label: string; bold?: boolean }[] }> = {
  servicevendors: { title: "Service Vendor Data Bank", data: SERVICE_VENDORS, columns: [{ key: "name", label: "Vendor", bold: true }, { key: "cat", label: "Category" }, { key: "contact", label: "Contact" }, { key: "phone", label: "Phone" }, { key: "projects", label: "Projects" }, { key: "rating", label: "Rating" }] },
  productvendors: { title: "Product Vendor Data Bank", data: PRODUCT_VENDORS, columns: [{ key: "name", label: "Vendor", bold: true }, { key: "cat", label: "Category" }, { key: "contact", label: "Contact" }, { key: "phone", label: "Phone" }, { key: "lead", label: "Lead Time" }, { key: "rating", label: "Rating" }] },
  clients: { title: "Client Database", data: CLIENTS, columns: [{ key: "name", label: "Name", bold: true }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "project", label: "Project" }, { key: "status", label: "Status" }, { key: "budget", label: "Budget" }] },
  designers: { title: "Designer Database", data: DESIGNERS, columns: [{ key: "name", label: "Name", bold: true }, { key: "role", label: "Role" }, { key: "spec", label: "Speciality" }, { key: "projs", label: "Projects" }, { key: "email", label: "Email" }] },
};

/* ── Tab Map ─────────────────────────────────────────────────── */
const TAB_COMPONENTS: Record<string, React.ReactNode> = {
  clientreq: <ClientRequirements />, furniture: <FurnitureLayout />, moodboard: <MoodBoard />,
  initial: <InitialEstimate />, design: <Design />, final: <FinalEstimate />,
  pm: <ProjectManagement />, handover: <Handover />, dashboard: <Dashboard />,
};

/* ── Main App (Inner) ────────────────────────────────────────── */
function EstimateAppInner() {
  const [view, setView] = useState("projects");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState("clientreq");
  const [showNewProject, setShowNewProject] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const { user } = useAuth();
  const toast = useToast();

  const openProject = (p: Project) => {
    setSelectedProject(p);
    setView("detail");
    const allowedTabs = ROLE_CONFIG[p.role].tabs;
    setActiveTab(allowedTabs[0]);
  };

  const currentRole = selectedProject?.role || null;
  const allowedTabs = currentRole ? ROLE_CONFIG[currentRole].tabs : TABS.map(t => t.id);
  const visibleTabs = TABS.filter(t => allowedTabs.includes(t.id));

  return (
    <div className="flex min-h-screen bg-[#f0eeeb]">
      <Sidebar view={view} setView={setView} selectedProject={selectedProject} setSelectedProject={setSelectedProject} />

      <div className="flex-1 overflow-auto">
        {/* Top Header Bar */}
        <div className="bg-white border-b border-surface-200 px-6 py-2.5 flex justify-between items-center no-print sticky top-0 z-30">
          <div className="flex items-center gap-2 text-[12px] text-surface-400">
            <span className="text-nicara-gold font-bold">NICARA</span>
            <span>›</span>
            <span>{selectedProject ? selectedProject.name : view === "users" ? "User Management" : view === "iam" ? "Access Control" : view === "library" ? "Component Library" : "Projects"}</span>
            {selectedProject && activeTab && <><span>›</span><span className="text-nicara-dark font-medium">{TABS.find(t => t.id === activeTab)?.label}</span></>}
          </div>
          <div className="flex items-center gap-3">
            {selectedProject && (
              <button onClick={() => setShowQuote(true)} className="px-3.5 py-1.5 bg-transparent border border-surface-200 rounded-lg text-[11px] text-surface-600 cursor-pointer hover:bg-surface-100 flex items-center gap-1.5 font-medium">
                📄 View Quote
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-sm cursor-pointer hover:bg-surface-200" title="Notifications">🔔</div>
            <div className="flex items-center gap-2 pl-3 border-l border-surface-200">
              <Avatar name={user ? `${user.firstName} ${user.lastName}` : "User"} size="sm" />
              <div>
                <div className="text-[11px] font-semibold text-nicara-dark">{user?.firstName}</div>
                <div className="text-[9px] text-surface-400 capitalize">{user?.role}</div>
              </div>
            </div>
          </div>
        </div>

        {/* New Project Modal */}
        <NewProjectModal open={showNewProject} onClose={() => setShowNewProject(false)} onAdd={data => {
          toast.success("Project Created", `${data.name} has been created successfully`);
        }} />

        {/* Quote Preview */}
        <QuotePDFPreview open={showQuote} onClose={() => setShowQuote(false)} />

        {/* Admin Pages */}
        {view === "users" && <UserManagementPage />}
        {view === "iam" && <IAMPage />}
        {view === "library" && <ComponentLibrary />}

        {/* DB Views */}
        {DB_CONFIGS[view] && <DataTable {...DB_CONFIGS[view]} />}

        {/* Projects list */}
        {view === "projects" && !selectedProject && (
          <ProjectsList onOpen={openProject} onNewProject={() => setShowNewProject(true)} />
        )}

        {/* Global dashboard */}
        {view === "dashboard-global" && !selectedProject && (
          <div className="p-6 px-8"><Dashboard /></div>
        )}

        {/* Project detail */}
        {view === "detail" && selectedProject && (
          <div>
            {/* Project Header + Tab nav */}
            <div className="bg-white border-b border-surface-200 px-6 pt-3">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => { setView("projects"); setSelectedProject(null); }}
                    className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-surface-500 cursor-pointer border-none hover:bg-surface-200 text-sm">←</button>
                  <div>
                    <div className="text-[16px] font-bold text-nicara-dark">{selectedProject.name}</div>
                    <div className="text-[11px] text-surface-400 mt-0.5">{selectedProject.type} · {selectedProject.area} · {selectedProject.location}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <AvatarStack names={["Nishanth K", "Priya S", "Rahul M"]} />
                  <div className="flex items-center gap-2 pl-3 border-l border-surface-200">
                    <div className="w-20 h-[4px] bg-surface-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: selectedProject.progress + "%", background: STATUS_COLORS[selectedProject.status] || "#C9A96E" }} />
                    </div>
                    <span className="text-[12px] font-bold text-nicara-dark">{selectedProject.progress}%</span>
                  </div>
                </div>
              </div>

              {/* Tab nav */}
              <div className="flex overflow-x-auto">
                {visibleTabs.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-2.5 bg-transparent border-none text-[12px] cursor-pointer whitespace-nowrap transition-all ${
                      activeTab === t.id
                        ? "text-nicara-gold border-b-2 border-nicara-gold font-bold"
                        : "text-surface-500 border-b-2 border-transparent hover:text-nicara-dark"
                    }`}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="p-5 px-6">
              {TAB_COMPONENTS[activeTab] || <div className="text-center py-10 text-surface-400">Tab content</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Wrapper with Providers ──────────────────────────────────── */
export default function EstimateApp() {
  return (
    <AuthProvider>
      <ToastProvider>
        <EstimateAppInner />
      </ToastProvider>
    </AuthProvider>
  );
}
