"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/auth/AppShell";
import { useToast } from "@/components/ui/Toast";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import { ApiError, iamApi, projectsApi } from "@/lib/api";
import type { MyPermissions, Project, ProjectListItem, ProjectMeta } from "@/lib/apiTypes";
import { useApiData, inr, inrExact } from "@/lib/hooks";
import { Btn, Field, Select, TextArea } from "@/components/ui/Form";
import { INTERIOR_STYLES } from "@/lib/constants";
import { EmptyState, ErrorState, Loading, StatusPill } from "@/components/ui/States";
import VendorsPage from "@/components/vendors/VendorsPage";
import ItemsPage from "@/components/items/ItemsPage";
import LeadsPage from "@/components/crm/LeadsPage";
import ClientsPage from "@/components/crm/ClientsPage";
import IAMMatrix from "@/components/admin/IAMMatrix";
import ClientDetails from "@/components/engagement/ClientDetails";
import DesignRequirements from "@/components/engagement/DesignRequirements";
import DeliverablesTab from "@/components/engagement/DeliverablesTab";
import EstimateTab from "@/components/engagement/EstimateTab";
import BookingFormTab from "@/components/engagement/BookingFormTab";

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
/**
 * Nav entries carry the IAM module that gates them. An entry with no `module`
 * is always visible; anything else is hidden unless the signed-in user holds
 * at least `view` on that module.
 */
const NAV_SECTIONS = [
  { label: "Main", items: [{ id: "dashboard", icon: "📊", label: "Dashboard", module: "dashboard" }, { id: "projects", icon: "📁", label: "Projects", module: "projects" }] },
  { label: "Tasks", items: [{ id: "tasks-planned", icon: "✅", label: "Planned Tasks", module: "tasks" }, { id: "tasks-unplanned", icon: "⚡", label: "Unplanned Tasks", module: "tasks" }] },
  { label: "Vendors", items: [{ id: "vendors-material", icon: "🏭", label: "Material Suppliers", module: "vendors_material" }, { id: "vendors-contractors", icon: "👷", label: "Contractors", module: "vendors_contract" }] },
  { label: "Customers", items: [{ id: "customers-leads", icon: "🎯", label: "Leads", module: "leads" }, { id: "customers-clients", icon: "👤", label: "Clients", module: "clients" }] },
  { label: "Finance", items: [{ id: "finance-transactions", icon: "💳", label: "Transactions", module: "finance" }, { id: "finance-vendor", icon: "📤", label: "Vendor Finance", module: "finance" }, { id: "finance-client", icon: "📥", label: "Client Finance", module: "finance" }] },
  { label: "Catalogue", items: [{ id: "items-catalogue", icon: "📦", label: "Items", module: "items" }, { id: "library-raw", icon: "🪵", label: "Raw Material", module: "library" }, { id: "library-furniture", icon: "🛋️", label: "Furniture & Furnishings", module: "library" }] },
  { label: "Admin", items: [{ id: "team-users", icon: "👥", label: "Users & Roles", module: "users" }, { id: "iam-permissions", icon: "🔐", label: "User Permissions", module: "iam" }, { id: "stages-lead", icon: "📋", label: "Lead Stages", module: "masters" }, { id: "stages-design", icon: "🎨", label: "Design Stages", module: "masters" }, { id: "site-master", icon: "🏗️", label: "Project Site Master", module: "masters" }] },
];

function Sidebar({ view, setView, selectedProject, setSelectedProject, allowed }: {
  view: string; setView: (v: string) => void;
  selectedProject: Project | null; setSelectedProject: (p: Project | null) => void;
  allowed: (module?: string) => boolean;
}) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Drop entries the user cannot reach, then drop sections left empty.
  const sections = NAV_SECTIONS
    .map(section => ({ ...section, items: section.items.filter(i => allowed(i.module)) }))
    .filter(section => section.items.length > 0);
  return (
    <div className="w-[230px] min-w-[230px] sidebar-gradient flex flex-col min-h-screen border-r border-nicara-dark-deep">
      <div className="p-5 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-nicara-gold flex items-center justify-center text-white text-[11px] font-black">N</div>
          <div><div className="text-[15px] font-extrabold text-nicara-gold tracking-[0.12em]">NICARA</div><div className="text-[9px] text-surface-500 tracking-[0.2em] uppercase">Project OS</div></div>
        </div>
      </div>
      <div className="px-3 py-3 flex-1 overflow-y-auto scrollbar-thin">
        {sections.map(section => (
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
              <div className="text-[10px] text-surface-500 mb-2 pl-4">{selectedProject.project_type} · {selectedProject.area}</div>
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
          <button onClick={() => void logout()} className="opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none text-surface-500 hover:text-red-400 cursor-pointer text-sm p-0" title="Logout">⏻</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROJECTS LIST — live from /api/projects/
   ═══════════════════════════════════════════════════════════════ */
function ProjectsList({ onOpen, onNewLead }: { onOpen: (id: number) => void; onNewLead: () => void }) {
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

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-xl font-bold text-nicara-dark m-0">Projects</h1><p className="text-[12px] text-surface-500 mt-1 m-0">Manage all leads, design & execution projects</p></div>
        <button onClick={onNewLead} className="px-5 py-2.5 btn-gold rounded-xl text-[13px] font-bold border-none cursor-pointer flex items-center gap-2">+ Add Lead</button>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-5">
        {([["Ongoing", projects.length - completed.length, "📁", "#C9A96E"], ["Completed", completed.length, "✅", "#2dd4a8"], ["Lead", leads.length, "🎯", "#3b82f6"], ["Design", designs.length, "🎨", "#7B4FA6"], ["Execution", execs.length, "🏗️", "#F59E0B"]] as const).map(([l, v, ic, c]) => (
          <div key={l} className="kpi-card"><div className="flex justify-between items-start"><div><div className="text-[10px] text-surface-400 uppercase tracking-wider">{l}</div><div className="text-2xl font-extrabold text-nicara-dark mt-1">{v}</div></div><div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: c + "15" }}>{ic}</div></div></div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
          {([["ongoing", "Ongoing"], ["completed", "Completed"], ["all", "All"], ["lead", "Leads"], ["design", "Design"], ["execution", "Execution"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-[12px] font-semibold border-none cursor-pointer transition-all ${tab === k ? "bg-white text-nicara-dark shadow-sm" : "bg-transparent text-surface-500"}`}>{l} <span className="text-[9px] ml-0.5 opacity-50">({k === "ongoing" ? ongoing.length : k === "completed" ? completed.length : k === "all" ? projects.length : k === "lead" ? leads.length : k === "design" ? designs.length : execs.length})</span></button>
          ))}
        </div>
        <div className="relative min-w-[250px]"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold" />
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          {/* Ongoing = all non-completed */}
          {tab === "ongoing" && <><SectionHead icon="📁" title="Ongoing Projects" count={ongoing.length} tone="bg-nicara-gold/10 text-nicara-gold" /><ProjectTable rows={ongoing} stage="all" onOpen={onOpen} /></>}
          {/* Completed */}
          {tab === "completed" && <><SectionHead icon="✅" title="Completed Projects" count={completed.length} tone="bg-green-50 text-green-700" /><ProjectTable rows={completed} stage="completed" onOpen={onOpen} /></>}
          {/* All */}
          {tab === "all" && <><SectionHead icon="📁" title="All Projects" count={projects.length} tone="bg-surface-100 text-surface-600" /><ProjectTable rows={projects} stage="all" onOpen={onOpen} /></>}
          {/* Individual stages */}
          {tab === "lead" && <><SectionHead icon="🎯" title="Lead Projects" count={leads.length} tone="bg-blue-50 text-blue-700" /><ProjectTable rows={leads} stage="lead" onOpen={onOpen} /></>}
          {tab === "design" && <><SectionHead icon="🎨" title="Design Projects" count={designs.length} tone="bg-purple-50 text-purple-700" /><ProjectTable rows={designs} stage="design" onOpen={onOpen} /></>}
          {tab === "execution" && <><SectionHead icon="🏗️" title="Execution Projects" count={execs.length} tone="bg-amber-50 text-amber-700" /><ProjectTable rows={execs} stage="execution" onOpen={onOpen} /></>}
        </>
      )}
    </div>
  );
}

function ProjectTable({ rows, stage, onOpen }: {
  rows: ProjectListItem[]; stage: string; onOpen: (id: number) => void;
}) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden mb-5 animate-fade-in">
      <table className="w-full text-[12px]"><thead><tr className="bg-nicara-dark">
        {["S.No", "Customer", "Project", "Status", stage === "execution" ? "Site Manager" : "Design Owner", "Budget", "Start", "Target"].map(h => (
          <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider">{h}</th>
        ))}
      </tr></thead><tbody>
        {rows.map((p, i) => (
          <tr key={p.id} onClick={() => onOpen(p.id)} className={`border-b border-surface-100 hover:bg-nicara-gold/5 cursor-pointer transition-colors ${i % 2 === 0 ? "bg-white" : "bg-surface-50/50"}`}>
            <td className="px-3 py-2.5 text-surface-400 font-mono">{i + 1}</td>
            <td className="px-3 py-2.5 font-semibold text-nicara-dark">{p.client_name}</td>
            <td className="px-3 py-2.5"><div className="font-semibold text-nicara-dark">{p.name}</div><div className="text-[10px] text-surface-400">{p.property_type} · {p.area || "—"}</div></td>
            <td className="px-3 py-2.5"><StatusPill status={p.stage} /></td>
            <td className="px-3 py-2.5 text-surface-600">{(stage === "execution" ? p.site_manager_name : p.design_owner_name) || "—"}</td>
            <td className="px-3 py-2.5 text-surface-600 font-semibold whitespace-nowrap">{p.budget ? inr(p.budget) : "—"}</td>
            <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{p.start_date || "—"}</td>
            <td className="px-3 py-2.5 text-surface-500 font-mono text-[11px]">{p.target_date || "—"}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-surface-400">No projects in this stage</td></tr>}
      </tbody></table>
    </div>
  );
}

function SectionHead({ icon, title, count, tone }: { icon: string; title: string; count: number; tone: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[13px]">{icon}</span>
      <h2 className="text-[14px] font-bold text-nicara-dark m-0">{title}</h2>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tone}`}>{count}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD LEAD MODAL — creates a real project
   ═══════════════════════════════════════════════════════════════ */

// Client‑ID generator — prefix + random digits + suffix
function generateLeadClientId(prefix: string, suffix: string) {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${num}${suffix}`;
}

// Inline Style Picker for the lead modal
function LeadStylePicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = INTERIOR_STYLES.find(s => s.id === selected);

  return (
    <div>
      {/* Trigger */}
      <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">Style Preference</div>
      <button
        type="button" onClick={() => setOpen(true)}
        className="w-full px-3 py-2 border border-surface-200 rounded-xl text-[12px] bg-white text-left cursor-pointer flex items-center justify-between hover:border-nicara-gold transition-colors"
      >
        <span className="flex items-center gap-2">
          {current && <span className="text-base">{current.emoji}</span>}
          <span className="font-semibold text-nicara-dark">{current?.name || "Select style…"}</span>
        </span>
        <span className="text-surface-400">▼</span>
      </button>
      {/* Selected preview */}
      {current && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl" style={{ background: current.img }}>
          <span className="text-xl">{current.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-white drop-shadow-md">{current.name}</div>
            <div className="text-[9px] text-white/70 truncate drop-shadow-md">{current.desc}</div>
          </div>
          <div className="flex gap-0.5">
            {current.palette.map((c, i) => <div key={i} className="w-3 h-3 rounded-full border border-white/40 shadow-sm" style={{ background: c }} />)}
          </div>
        </div>
      )}

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[600]" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-surface-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <div className="text-[15px] font-bold text-nicara-dark">Select Interior Style</div>
                <div className="text-[11px] text-surface-400 mt-0.5">Choose one — it sets the design direction</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-xl text-surface-400 bg-transparent border-none cursor-pointer hover:text-nicara-gold">✕</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {INTERIOR_STYLES.map(st => {
                const isActive = selected === st.id;
                return (
                  <div key={st.id} onClick={() => { onSelect(st.id); setOpen(false); }}
                    className={`rounded-xl border-2 cursor-pointer overflow-hidden transition-all hover:scale-[1.01] ${isActive ? "border-nicara-gold shadow-lg" : "border-surface-200 hover:border-nicara-gold/50"}`}>
                    <div className="h-16 flex items-center justify-center" style={{ background: st.img }}>
                      <span className="text-3xl drop-shadow-md">{st.emoji}</span>
                    </div>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-bold text-nicara-dark">{st.name}</span>
                        {isActive && <span className="text-[9px] font-bold bg-nicara-gold/15 text-nicara-gold px-1.5 py-0.5 rounded-full">Selected</span>}
                      </div>
                      <div className="text-[10px] text-surface-500 leading-relaxed mb-2">{st.desc}</div>
                      <div className="flex gap-1 mb-1.5">
                        {st.palette.map((c, ci) => <div key={ci} className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: c }} />)}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {st.keywords.map(k => <span key={k} className="text-[8px] bg-surface-50 border border-surface-200 text-surface-500 px-1.5 py-0.5 rounded">{k}</span>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddLeadModal({ open, onClose, meta, onCreated }: {
  open: boolean; onClose: () => void; meta: ProjectMeta | null; onCreated: (id: number) => void;
}) {
  const toast = useToast();
  // Client ID config
  const [clientIdPrefix, setClientIdPrefix] = useState("NIC-");
  const [clientIdSuffix, setClientIdSuffix] = useState("");
  const [clientId, setClientId] = useState(() => generateLeadClientId("NIC-", ""));
  const regenerateId = () => setClientId(generateLeadClientId(clientIdPrefix, clientIdSuffix));

  const [form, setForm] = useState<Partial<Project>>({
    client_name: "", client_phone: "", client_email: "", client_address: "",
    name: "", developer: "", unit_no: "", city: "", state: "", pincode: "",
    area: "", property_type: "3BHK Apartment", project_type: "Residential", purpose: "Self",
    interior_style: "", stage: "lead", budget: "", start_date: null, target_date: null,
  });
  const [carpetArea, setCarpetArea] = useState("");
  const [selfInvestment, setSelfInvestment] = useState("Self");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Project>(k: K, v: Project[K]) => setForm(f => ({ ...f, [k]: v }));
  const err = (field: string) => errors[field]?.[0];

  const IC = "w-full px-3 py-2 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold";
  const LC = "text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1";
  const selectCls = IC + " cursor-pointer";

  const submit = async () => {
    if (!form.client_name?.trim() || !form.name?.trim()) {
      setErrors({
        ...(form.client_name?.trim() ? {} : { client_name: ["Client name is required."] }),
        ...(form.name?.trim() ? {} : { name: ["Project name is required."] }),
      });
      return;
    }
    setSaving(true);
    setBanner("");
    setErrors({});
    try {
      const created = await projectsApi.create({ ...form, budget: form.budget || null });
      toast.success("Lead created", created.name);
      onCreated(created.id);
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); }
      else setBanner("Could not create the lead.");
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open onClose={onClose} size="lg" title="+ Add New Lead" subtitle="Enter client and project details"
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create Lead"}</Btn>
      </>}>
      {banner && <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">{banner}</div>}

      {/* ── Client Section ── */}
      <div className="mb-5">
        <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-[0.12em] mb-2.5 pb-1.5 border-b border-surface-100">Client</div>

        {/* Client ID — auto-generated */}
        <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 mb-3">
          <div className={LC}>Client ID (Auto-Generated)</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1">
              <input
                value={clientIdPrefix} onChange={e => setClientIdPrefix(e.target.value)}
                placeholder="Prefix" className="w-16 px-2 py-1.5 border border-surface-200 rounded-lg text-[11px] outline-none bg-white text-center font-mono"
              />
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[12px] text-emerald-800 font-mono font-bold flex-1 text-center">
                {clientId}
              </div>
              <input
                value={clientIdSuffix} onChange={e => setClientIdSuffix(e.target.value)}
                placeholder="Suffix" className="w-16 px-2 py-1.5 border border-surface-200 rounded-lg text-[11px] outline-none bg-white text-center font-mono"
              />
            </div>
            <button onClick={regenerateId} className="px-3 py-1.5 bg-nicara-gold/10 border-none rounded-lg text-[10px] text-nicara-gold font-bold cursor-pointer whitespace-nowrap">🔄 Regenerate</button>
          </div>
          <div className="text-[9px] text-surface-400 mt-1.5">Customize prefix & suffix, then regenerate. Example: NIC-84321-MUM</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" value={form.client_name ?? ""} onChange={v => set("client_name", v)} required error={err("client_name")} />
          <Field label="Phone" value={form.client_phone ?? ""} onChange={v => set("client_phone", v)} />
          <div className="col-span-2"><Field label="Email" type="email" value={form.client_email ?? ""} onChange={v => set("client_email", v)} error={err("client_email")} /></div>
          <div className="col-span-2"><TextArea label="Address" value={form.client_address ?? ""} onChange={v => set("client_address", v)} rows={2} /></div>
        </div>
      </div>

      {/* ── Project Section ── */}
      <div className="mb-5">
        <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-[0.12em] mb-2.5 pb-1.5 border-b border-surface-100">Project</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Project Name" value={form.name ?? ""} onChange={v => set("name", v)} required error={err("name")} placeholder="Sharma Residence" /></div>
          <Field label="Developer - Project" value={form.developer ?? ""} onChange={v => set("developer", v)} />
          <Field label="Unit No" value={form.unit_no ?? ""} onChange={v => set("unit_no", v)} />
          <Field label="City" value={form.city ?? ""} onChange={v => set("city", v)} />
          <Field label="State" value={form.state ?? ""} onChange={v => set("state", v)} />
          <Field label="Super Area (sqft)" value={form.area ?? ""} onChange={v => set("area", v)} placeholder="1,850 sqft" />
          {/* Carpet Area — local field */}
          <div>
            <div className={LC}>Carpet Area (sqft)</div>
            <input value={carpetArea} onChange={e => setCarpetArea(e.target.value)} placeholder="1,287 sqft" className={IC} />
          </div>
          <Field label="Budget (₹)" type="number" value={form.budget ?? ""} onChange={v => set("budget", v)} error={err("budget")} />
          {/* Start Date */}
          <div>
            <div className={LC}>Start Date</div>
            <input type="date" value={form.start_date ?? ""} onChange={e => set("start_date", e.target.value || null)} className={IC} />
          </div>
          {/* End Date */}
          <div>
            <div className={LC}>End Date</div>
            <input type="date" value={form.target_date ?? ""} onChange={e => set("target_date", e.target.value || null)} className={IC} />
          </div>
        </div>
      </div>

      {/* ── Classification Section ── */}
      <div className="mb-5">
        <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-[0.12em] mb-2.5 pb-1.5 border-b border-surface-100">Classification</div>
        <div className="grid grid-cols-3 gap-3">
          {/* Purpose */}
          <div>
            <div className={LC}>Purpose</div>
            <select value={form.project_type ?? "Residential"} onChange={e => set("project_type", e.target.value)} className={selectCls}>
              {["Residential", "Commercial", "Other"].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {/* Self / Investment */}
          <div>
            <div className={LC}>Self / Investment</div>
            <select value={selfInvestment} onChange={e => setSelfInvestment(e.target.value)} className={selectCls}>
              {["Self", "Investment", "Both"].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {/* Property Type */}
          <div>
            <div className={LC}>Property Type</div>
            <select value={form.property_type ?? "3BHK Apartment"} onChange={e => set("property_type", e.target.value)} className={selectCls}>
              {["1BHK Apartment", "2BHK Apartment", "3BHK Apartment", "4BHK Apartment", "Independent Villa", "Duplex", "Penthouse", "Row House", "Commercial Office", "Commercial Retail"].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Style Preference ── */}
      <div className="mb-2">
        <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-[0.12em] mb-2.5 pb-1.5 border-b border-surface-100">Design Direction</div>
        <LeadStylePicker selected={form.interior_style ?? ""} onSelect={v => set("interior_style", v)} />
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROJECT DETAIL — 3 phases
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

function ProjectDetail({ projectId, meta, onBack, onProject }: {
  projectId: number; meta: ProjectMeta | null; onBack: () => void; onProject: (p: Project | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("engagement");
  const [subTab, setSubTab] = useState("client-basic");
  const { data: project, loading, error, reload, setData } = useApiData(
    () => projectsApi.get(projectId),
    [projectId]
  );

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
      /* ── Initial Engagement ── */
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
        return <BookingFormTab project={project} meta={meta} />;

      /* ── Design ── */
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

      /* ── Execution ── */
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

/* ── Design & Execution read-only tables (from the project payload) ── */

function DataTable({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty: boolean }) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead><tr className="bg-nicara-dark">
            {headers.map(h => <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {children}
            {empty && <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-surface-400">Nothing recorded yet</td></tr>}
          </tbody>
        </table>
      </div>
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
          {([m.east, m.west, m.north, m.south]).map((v, i) => (
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

function Kpi({ label, value, tone = "text-nicara-dark" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl px-4 py-3">
      <div className="text-[10px] text-surface-400 uppercase tracking-wider">{label}</div>
      <div className={`text-[18px] font-extrabold mt-0.5 ${tone}`}>{value}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD — live KPIs
   ═══════════════════════════════════════════════════════════════ */
function GlobalDashboard() {
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
          <div key={l} className="kpi-card"><div className="flex justify-between items-start"><div><div className="text-[10px] text-surface-400 uppercase tracking-wider">{l}</div><div className="text-xl font-extrabold text-nicara-dark mt-1">{v}</div></div><div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: c + "15" }}>{ic}</div></div></div>
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

/* ═══════════════════════════════════════════════════════════════
   APP SHELL
   ═══════════════════════════════════════════════════════════════ */
const LABELS: Record<string, string> = {
  dashboard: "Dashboard", projects: "Projects", "tasks-planned": "Planned Tasks", "tasks-unplanned": "Unplanned Tasks",
  "vendors-material": "Material Suppliers", "vendors-contractors": "Contractors", "customers-leads": "Leads", "customers-clients": "Clients",
  "finance-transactions": "Transactions", "finance-vendor": "Vendor Finance", "finance-client": "Client Finance",
  "items-catalogue": "Items", "library-raw": "Raw Material", "library-furniture": "Furniture & Furnishings",
  "team-users": "Users & Roles", "iam-permissions": "User Permissions",
  "stages-lead": "Lead Stages", "stages-design": "Design Stages", "site-master": "Project Site Master",
};

/** Views that render a real, API-backed screen. */
const LIVE_VIEWS = [
  "dashboard", "projects", "detail",
  "vendors-material", "vendors-contractors", "items-catalogue",
  "customers-leads", "customers-clients", "iam-permissions",
];

function EstimateAppInner() {
  const [view, setView] = useState("projects");
  const [openProjectId, setOpenProjectId] = useState<number | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [listKey, setListKey] = useState(0);
  const { user } = useAuth();
  const { data: meta } = useApiData<ProjectMeta>(() => projectsApi.meta(), []);
  const { data: mine } = useApiData<MyPermissions>(() => iamApi.mine(), []);

  /**
   * Whether the signed-in user may see a module. Until the permission map
   * loads we allow everything — the API is the real gate, so a brief optimistic
   * nav is better than the menu flickering empty on every page load.
   */
  const allowed = (module?: string) => {
    if (!module || !mine) return true;
    if (mine.is_admin) return true;
    const level = mine.permissions[module];
    return !!level && level !== "none";
  };

  const openProject = (id: number) => { setOpenProjectId(id); setView("detail"); };
  const closeProject = () => { setOpenProjectId(null); setActiveProject(null); setView("projects"); setListKey(k => k + 1); };

  return (
    <div className="flex min-h-screen bg-[#f0eeeb]">
      <Sidebar view={view} setView={v => { setView(v); setOpenProjectId(null); }}
        selectedProject={activeProject}
        allowed={allowed}
        setSelectedProject={p => { if (!p) { setOpenProjectId(null); setActiveProject(null); } }} />
      <div className="flex-1 overflow-auto">
        <div className="bg-white border-b border-surface-200 px-6 py-2.5 flex justify-between items-center no-print sticky top-0 z-30">
          <div className="flex items-center gap-2 text-[12px] text-surface-400">
            <span className="text-nicara-gold font-bold">NICARA</span><span>›</span>
            <span>{activeProject ? activeProject.name : LABELS[view] || view}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-sm cursor-pointer hover:bg-surface-200" title="Notifications">🔔</div>
            <div className="flex items-center gap-2 pl-3 border-l border-surface-200">
              <Avatar name={user ? `${user.firstName} ${user.lastName}` : "User"} size="sm" />
              <div><div className="text-[11px] font-semibold text-nicara-dark">{user?.firstName}</div><div className="text-[9px] text-surface-400 capitalize">{user?.role}</div></div>
            </div>
          </div>
        </div>

        <AddLeadModal open={showAddLead} onClose={() => setShowAddLead(false)} meta={meta}
          onCreated={id => { setShowAddLead(false); openProject(id); }} />

        {view === "dashboard" && <GlobalDashboard />}
        {view === "projects" && <ProjectsList key={listKey} onOpen={openProject} onNewLead={() => setShowAddLead(true)} />}
        {view === "detail" && openProjectId !== null && (
          <ProjectDetail projectId={openProjectId} meta={meta} onBack={closeProject} onProject={setActiveProject} />
        )}
        {view === "vendors-material" && <VendorsPage kind="supplier" />}
        {view === "vendors-contractors" && <VendorsPage kind="contractor" />}
        {view === "items-catalogue" && <ItemsPage />}
        {view === "customers-leads" && <LeadsPage onOpenProject={openProject} />}
        {view === "customers-clients" && <ClientsPage onOpenProject={openProject} />}
        {view === "iam-permissions" && <IAMMatrix />}

        {!LIVE_VIEWS.includes(view) && (
          <div className="p-6 px-8 animate-fade-in">
            <h1 className="text-xl font-bold text-nicara-dark mb-2">{LABELS[view]}</h1>
            <p className="text-[12px] text-surface-500 mb-5">Not built yet</p>
            <EmptyState icon="🚧" title={LABELS[view]}
              hint="This screen has no backend module yet. Projects, Items, Suppliers, Contractors, Leads, Clients and Permissions are live." />
          </div>
        )}
      </div>
    </div>
  );
}

export default function EstimateApp() {
  // AppShell supplies AuthProvider + ToastProvider and gates on a live session.
  return (<AppShell><EstimateAppInner /></AppShell>);
}
