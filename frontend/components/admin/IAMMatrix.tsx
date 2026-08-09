"use client";

import { useMemo, useState } from "react";
import { ApiError, iamApi } from "@/lib/api";
import type {
  ModuleRegistry, PermissionLevel, PermissionMatrixRow,
} from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import { Btn } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading } from "@/components/ui/States";

const LEVEL_STYLES: Record<PermissionLevel, string> = {
  none: "bg-surface-100 text-surface-400 border-surface-200",
  view: "bg-blue-50 text-blue-700 border-blue-200",
  edit: "bg-amber-50 text-amber-700 border-amber-200",
  full: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const LEVELS: PermissionLevel[] = ["none", "view", "edit", "full"];

/**
 * Module access matrix — one row per user, one column per module.
 *
 * Only an admin, or someone granted full access to the `iam` module, can
 * reach this; the backend enforces the same rule on every write.
 */
export default function IAMMatrix() {
  const toast = useToast();
  const [edits, setEdits] = useState<Record<string, PermissionLevel>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const registry = useApiData<ModuleRegistry>(() => iamApi.modules(), []);
  const matrix = useApiData<PermissionMatrixRow[]>(() => iamApi.matrix(), []);

  const groups = registry.data?.groups ?? [];
  const rows = useMemo(() => matrix.data ?? [], [matrix.data]);
  const visibleGroups = expanded ? groups.filter(g => g.group === expanded) : groups;

  const key = (userId: number, moduleId: string) => `${userId}:${moduleId}`;

  const levelFor = (row: PermissionMatrixRow, moduleId: string): PermissionLevel =>
    edits[key(row.user.id, moduleId)] ?? row.permissions[moduleId] ?? "none";

  const cycle = (row: PermissionMatrixRow, moduleId: string) => {
    if (row.is_admin) return; // admins implicitly hold everything
    const current = levelFor(row, moduleId);
    const next = LEVELS[(LEVELS.indexOf(current) + 1) % LEVELS.length];
    setEdits(e => ({ ...e, [key(row.user.id, moduleId)]: next }));
  };

  const dirtyCount = Object.keys(edits).length;

  const save = async () => {
    setSaving(true);
    setBanner("");
    try {
      const payload = Object.entries(edits).map(([composite, level]) => {
        const [userId, moduleId] = composite.split(":");
        return { user_id: userId, page_id: moduleId, level };
      });
      const res = await iamApi.save(payload);
      setEdits({});
      await matrix.reload();
      toast.success("Permissions saved", res.detail);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not save permissions.";
      setBanner(msg);
      toast.error("Save failed", msg);
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = async (row: PermissionMatrixRow) => {
    setSaving(true);
    setBanner("");
    try {
      const res = await iamApi.applyTemplate(row.user.id, row.user.role);
      await matrix.reload();
      setEdits({});
      toast.success("Template applied", res.detail);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not apply the template.";
      setBanner(msg);
      toast.error("Failed", msg);
    } finally {
      setSaving(false);
    }
  };

  if (registry.loading || matrix.loading) return <div className="p-6 px-8"><Loading /></div>;

  if (matrix.error) {
    const forbidden = matrix.error.toLowerCase().includes("permission")
      || matrix.error.toLowerCase().includes("administrator");
    return (
      <div className="p-6 px-8">
        {forbidden ? (
          <EmptyState icon="🔐" title="IAM is restricted"
            hint="Only an administrator, or a user granted full access to the IAM module, can configure permissions." />
        ) : (
          <ErrorState message={matrix.error} onRetry={matrix.reload} />
        )}
      </div>
    );
  }

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0">User Permissions (IAM)</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">
            Click a cell to cycle No Access → View → Edit → Full. The API enforces
            these on every request, not just the screens.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <button onClick={() => setEdits({})}
              className="text-[12px] text-surface-500 bg-transparent border-none cursor-pointer hover:underline">
              Discard
            </button>
          )}
          <Btn onClick={save} disabled={saving || dirtyCount === 0}>
            {saving ? "Saving…" : dirtyCount > 0 ? `Save ${dirtyCount} change(s)` : "No Changes"}
          </Btn>
        </div>
      </div>

      {banner && <InlineError message={banner} />}

      {/* Legend + group filter */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          {LEVELS.map(level => (
            <span key={level}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg border capitalize ${LEVEL_STYLES[level]}`}>
              {level === "none" ? "No Access" : level}
            </span>
          ))}
        </div>
        <div className="flex-1" />
        <select value={expanded ?? ""} onChange={e => setExpanded(e.target.value || null)}
          className="px-3 py-2 border border-surface-200 rounded-xl text-[12px] bg-white cursor-pointer outline-none focus:border-nicara-gold">
          <option value="">All module groups</option>
          {groups.map(g => <option key={g.group} value={g.group}>{g.group}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="👥" title="No users yet"
          hint="Invite a team member from Users & Roles, then set their access here." />
      ) : (
        <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-[12px]">
              <thead>
                <tr className="bg-nicara-dark">
                  <th className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider sticky left-0 bg-nicara-dark z-10 min-w-[200px]">
                    User
                  </th>
                  {visibleGroups.flatMap(group =>
                    group.modules.map(module => (
                      <th key={module.id} title={`${group.group} · ${module.label}`}
                        className="px-2 py-2.5 text-surface-300 font-semibold text-[9px] uppercase tracking-wider whitespace-nowrap min-w-[76px]">
                        <div className="text-[13px] mb-0.5">{module.icon}</div>
                        {module.label.split(" ")[0]}
                      </th>
                    ))
                  )}
                  <th className="px-3 py-2.5 text-surface-300 text-[10px] uppercase tracking-wider">Template</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.user.id} className="border-b border-surface-100 hover:bg-surface-50">
                    <td className="px-3 py-2.5 sticky left-0 bg-white z-10 border-r border-surface-100">
                      <div className="font-semibold text-nicara-dark">{row.user.full_name}</div>
                      <div className="text-[10px] text-surface-400">{row.user.email}</div>
                      <div className="text-[9px] text-nicara-gold font-bold uppercase tracking-wider mt-0.5">
                        {row.user.role}{row.is_admin && " · all access"}
                      </div>
                    </td>
                    {visibleGroups.flatMap(group =>
                      group.modules.map(module => {
                        const level = levelFor(row, module.id);
                        const changed = key(row.user.id, module.id) in edits;
                        return (
                          <td key={module.id} className="px-1.5 py-2 text-center">
                            <button
                              onClick={() => cycle(row, module.id)}
                              disabled={row.is_admin}
                              title={row.is_admin
                                ? "Admins hold every module implicitly"
                                : `${module.label}: ${level}`}
                              className={`w-full px-1.5 py-1 rounded-lg text-[9px] font-bold border capitalize transition-all ${
                                LEVEL_STYLES[level]
                              } ${row.is_admin ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:brightness-95"} ${
                                changed ? "ring-2 ring-nicara-gold" : ""
                              }`}>
                              {level === "none" ? "—" : level}
                            </button>
                          </td>
                        );
                      })
                    )}
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => applyTemplate(row)} disabled={saving || row.is_admin}
                        title={`Reset to the ${row.user.role} template`}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border-none ${
                          row.is_admin
                            ? "bg-surface-100 text-surface-300 cursor-not-allowed"
                            : "bg-surface-100 text-surface-600 cursor-pointer hover:bg-surface-200"
                        }`}>
                        Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-surface-400 mt-3">
        Admin rows are locked — an administrator always holds every module.
        &ldquo;Reset&rdquo; re-applies the default template for that user&apos;s role.
      </p>
    </div>
  );
}
