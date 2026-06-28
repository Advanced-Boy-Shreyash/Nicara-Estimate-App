"use client";

import { useState } from "react";
import Avatar from "@/components/ui/Avatar";
import InviteUserModal from "@/components/admin/InviteUserModal";
import { useToast } from "@/components/ui/Toast";

interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "active" | "invited" | "disabled";
  lastLogin: string;
  projects: number;
}

const SAMPLE_USERS: ManagedUser[] = [
  { id: 1, name: "Nishanth Kumar",  email: "nishanth@nicara.design", role: "admin",      status: "active",  lastLogin: "2 mins ago", projects: 12 },
  { id: 2, name: "Priya Sharma",    email: "priya@nicara.design",    role: "designer",   status: "active",  lastLogin: "1 hr ago",   projects: 8 },
  { id: 3, name: "Rahul Mehta",     email: "rahul@nicara.design",    role: "designer",   status: "active",  lastLogin: "3 hrs ago",  projects: 5 },
  { id: 4, name: "Ms X",            email: "client@email.com",       role: "client",     status: "active",  lastLogin: "Yesterday",  projects: 1 },
  { id: 5, name: "Vijay Kumar",     email: "vijay@contractor.com",   role: "supervisor", status: "active",  lastLogin: "2 days ago", projects: 3 },
  { id: 6, name: "Ananya Patel",    email: "ananya@newdesigner.com", role: "designer",   status: "invited", lastLogin: "—",          projects: 0 },
];

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  admin: { color: "#C9A96E", bg: "rgba(201,169,110,0.12)" },
  designer: { color: "#7B4FA6", bg: "rgba(123,79,166,0.12)" },
  client: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  supervisor: { color: "#2dd4a8", bg: "rgba(45,212,168,0.12)" },
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>(SAMPLE_USERS);
  const [showInvite, setShowInvite] = useState(false);
  const [fRole, setFRole] = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [search, setSearch] = useState("");
  const toast = useToast();

  const filtered = users.filter(u =>
    (fRole === "All" || u.role === fRole) &&
    (fStatus === "All" || u.status === fStatus) &&
    (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const active = users.filter(u => u.status === "active").length;
  const invited = users.filter(u => u.status === "invited").length;
  const ddCls = "px-3 py-2 border border-surface-200 rounded-xl text-[12px] bg-white outline-none cursor-pointer";

  return (
    <div className="p-6 px-8 animate-fade-in max-w-[1200px] mx-auto">
      <InviteUserModal open={showInvite} onClose={() => setShowInvite(false)} onInvite={(data) => {
        setUsers(p => [...p, { id: Date.now(), name: data.name, email: data.email, role: data.role, status: "invited", lastLogin: "—", projects: 0 }]);
        toast.success("Invitation Sent", `Invite email sent to ${data.email}`);
      }} />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0">User Management</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">Manage team access and invite new users to NICARA Project OS</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="px-5 py-2.5 btn-gold rounded-xl text-[13px] font-bold border-none cursor-pointer flex items-center gap-2">
          📧 Invite User
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[["Total Users", users.length, "👥"], ["Active", active, "🟢"], ["Pending Invites", invited, "📧"], ["Admins", users.filter(u => u.role === "admin").length, "🔑"]].map(([l, v, icon]) => (
          <div key={l as string} className="kpi-card flex items-center gap-3">
            <div className="text-2xl">{icon as string}</div>
            <div>
              <div className="text-[10px] text-surface-400 uppercase tracking-wider">{l as string}</div>
              <div className="text-xl font-extrabold text-nicara-dark">{v as number}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 items-center mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
            className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none" />
        </div>
        <select value={fRole} onChange={e => setFRole(e.target.value)} className={ddCls}>
          {["All", "admin", "designer", "client", "supervisor"].map(r => <option key={r} value={r}>{r === "All" ? "All Roles" : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={ddCls}>
          {["All", "active", "invited", "disabled"].map(s => <option key={s} value={s}>{s === "All" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full table-premium">
          <thead>
            <tr>
              {["User", "Role", "Status", "Last Login", "Projects", "Actions"].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => {
              const rc = ROLE_COLORS[user.role] || ROLE_COLORS.admin;
              return (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} size="sm" />
                      <div>
                        <div className="text-[13px] font-semibold text-nicara-dark">{user.name}</div>
                        <div className="text-[11px] text-surface-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: rc.color, background: rc.bg }} className="text-[11px] font-bold px-2.5 py-1 rounded-full capitalize">{user.role}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className={`status-dot ${user.status === "active" ? "status-dot-active" : user.status === "invited" ? "status-dot-warning" : "status-dot-neutral"}`} />
                      <span className="text-[12px] text-surface-600 capitalize">{user.status}</span>
                    </div>
                  </td>
                  <td><span className="text-[12px] text-surface-500">{user.lastLogin}</span></td>
                  <td><span className="text-[12px] font-semibold text-nicara-dark">{user.projects}</span></td>
                  <td>
                    <div className="flex gap-1.5">
                      <button className="px-2.5 py-1 bg-transparent border border-surface-200 rounded-lg text-[11px] text-surface-500 cursor-pointer hover:bg-surface-100" title="Edit">✏️</button>
                      {user.status === "invited" && (
                        <button onClick={() => toast.info("Invitation Resent", `Re-sent invite to ${user.email}`)}
                          className="px-2.5 py-1 bg-transparent border border-surface-200 rounded-lg text-[11px] text-surface-500 cursor-pointer hover:bg-surface-100" title="Resend invite">📧</button>
                      )}
                      <button onClick={() => {
                        setUsers(p => p.map(u => u.id === user.id ? { ...u, status: u.status === "disabled" ? "active" : "disabled" } : u));
                        toast.info(user.status === "disabled" ? "User Enabled" : "User Disabled", user.name);
                      }}
                        className="px-2.5 py-1 bg-transparent border border-surface-200 rounded-lg text-[11px] text-surface-500 cursor-pointer hover:bg-surface-100" title="Toggle access">
                        {user.status === "disabled" ? "✅" : "🚫"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-surface-400">
            <div className="text-3xl mb-2">👥</div>
            <div className="text-sm font-semibold text-nicara-dark">No users found</div>
          </div>
        )}
      </div>
    </div>
  );
}
