"use client";

import { useState } from "react";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { IAM_PAGES, ROLE_TEMPLATES, type PermissionLevel, permissionMeta } from "@/lib/permissions";

/* ── Sample Users ────────────────────────────────────────────── */
const SAMPLE_USERS = [
  { id: 1, name: "Nishanth Kumar", email: "nishanth@nicara.design", role: "admin" },
  { id: 2, name: "Priya Sharma",   email: "priya@nicara.design",   role: "designer" },
  { id: 3, name: "Rahul Mehta",    email: "rahul@nicara.design",   role: "designer" },
  { id: 4, name: "Ms X",           email: "client@email.com",      role: "client" },
  { id: 5, name: "Vijay Kumar",    email: "vijay@contractor.com",  role: "supervisor" },
];

const LEVELS: PermissionLevel[] = ["none", "view", "edit", "full"];

export default function IAMPage() {
  const [perms, setPerms] = useState<Record<number, Record<string, PermissionLevel>>>(() => {
    const map: Record<number, Record<string, PermissionLevel>> = {};
    SAMPLE_USERS.forEach(u => {
      const tpl = ROLE_TEMPLATES.find(r => r.id === u.role);
      map[u.id] = tpl ? { ...tpl.permissions } : {};
    });
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const toast = useToast();

  const setPerm = (userId: number, pageId: string, level: PermissionLevel) => {
    setPerms(p => ({ ...p, [userId]: { ...p[userId], [pageId]: level } }));
  };

  const applyTemplate = (userId: number, roleId: string) => {
    const tpl = ROLE_TEMPLATES.find(r => r.id === roleId);
    if (tpl) setPerms(p => ({ ...p, [userId]: { ...tpl.permissions } }));
    toast.info("Template Applied", `${tpl?.label} preset applied`);
  };

  const savePermissions = () => {
    setSaving(true);
    // PUT /api/iam/permissions/
    setTimeout(() => {
      setSaving(false);
      toast.success("Permissions Saved", "All IAM permissions have been updated");
    }, 1000);
  };

  return (
    <div className="p-6 px-8 animate-fade-in max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0 flex items-center gap-2">🔐 Access Management</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">Configure page-level permissions for each user. Changes apply immediately after saving.</p>
        </div>
        <button onClick={savePermissions} disabled={saving}
          className={`px-6 py-2.5 rounded-xl text-[13px] font-bold border-none cursor-pointer flex items-center gap-2 ${saving ? "bg-surface-200 text-surface-400" : "btn-gold"}`}>
          {saving ? <><span className="animate-spin-slow inline-block">⟳</span> Saving…</> : <>💾 Save Permissions</>}
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {LEVELS.map(level => {
          const m = permissionMeta(level);
          return (
            <div key={level} className="flex items-center gap-1.5 text-[11px]">
              <div style={{ background: m.color }} className="w-2.5 h-2.5 rounded-sm" />
              <span className="text-surface-600 font-medium">{m.label}</span>
            </div>
          );
        })}
        <div className="ml-auto flex gap-2">
          <span className="text-[11px] text-surface-400">Quick Apply:</span>
          {ROLE_TEMPLATES.map(tpl => (
            <button key={tpl.id} disabled={!selectedUser}
              onClick={() => selectedUser && applyTemplate(selectedUser, tpl.id)}
              style={{ color: tpl.color, borderColor: tpl.color + "44" }}
              className={`px-2.5 py-1 bg-transparent border rounded-lg text-[10px] font-bold uppercase tracking-wider ${selectedUser ? "cursor-pointer hover:opacity-80" : "opacity-40 cursor-not-allowed"}`}>
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-nicara-dark">
                <th className="px-4 py-3 text-left text-[10px] text-surface-400 uppercase tracking-wider font-semibold sticky left-0 bg-nicara-dark z-20 min-w-[220px]">
                  User
                </th>
                {IAM_PAGES.map(page => (
                  <th key={page.pageId} className="px-2 py-3 text-center text-[10px] text-surface-400 uppercase tracking-wider font-semibold min-w-[95px]">
                    <div className="text-sm mb-0.5">{page.icon}</div>
                    <div className="leading-tight">{page.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_USERS.map((user, ui) => {
                const userPerms = perms[user.id] || {};
                const isSelected = selectedUser === user.id;
                return (
                  <tr key={user.id}
                    onClick={() => setSelectedUser(isSelected ? null : user.id)}
                    className={`border-b border-surface-100 cursor-pointer transition-colors ${isSelected ? "bg-nicara-gold-light" : ui % 2 === 0 ? "bg-surface-50" : "bg-white"}`}>
                    <td className={`px-4 py-3 sticky left-0 z-10 ${isSelected ? "bg-nicara-gold-light" : ui % 2 === 0 ? "bg-surface-50" : "bg-white"}`}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user.name} size="sm" />
                        <div>
                          <div className="text-[12px] font-semibold text-nicara-dark">{user.name}</div>
                          <div className="text-[10px] text-surface-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    {IAM_PAGES.map(page => {
                      const level = userPerms[page.pageId] || "none";
                      const m = permissionMeta(level);
                      return (
                        <td key={page.pageId} className="px-1.5 py-2 text-center" onClick={e => e.stopPropagation()}>
                          <select
                            value={level}
                            onChange={e => setPerm(user.id, page.pageId, e.target.value as PermissionLevel)}
                            style={{ color: m.color, background: m.bg, borderColor: m.color + "33" }}
                            className="px-2 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer outline-none w-full min-w-[75px]"
                          >
                            {LEVELS.map(l => {
                              const lm = permissionMeta(l);
                              return <option key={l} value={l}>{lm.label}</option>;
                            })}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Panel */}
      <div className="mt-4 bg-nicara-gold-light border border-nicara-gold/15 rounded-xl p-4">
        <div className="text-[10px] text-nicara-gold font-bold uppercase tracking-wider mb-2">How Permissions Work</div>
        <div className="grid grid-cols-4 gap-3">
          {LEVELS.map(level => {
            const m = permissionMeta(level);
            return (
              <div key={level} className="flex gap-2">
                <div style={{ background: m.color }} className="w-3 h-3 rounded-sm shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-bold text-nicara-dark">{m.label}</div>
                  <div className="text-[10px] text-surface-500 mt-0.5">
                    {level === "none" && "User cannot see or access this page"}
                    {level === "view" && "User can view data but cannot make changes"}
                    {level === "edit" && "User can view and modify data"}
                    {level === "full" && "Full access including delete and admin actions"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
