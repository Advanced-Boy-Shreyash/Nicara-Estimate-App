/* ── IAM Permission System ──────────────────────────────────── */

export type PermissionLevel = "none" | "view" | "edit" | "full";

export interface PagePermission {
  pageId: string;
  label: string;
  icon: string;
  level: PermissionLevel;
}

export interface RoleTemplate {
  id: string;
  label: string;
  color: string;
  permissions: Record<string, PermissionLevel>;
}

/* All manageable pages/features */
export const IAM_PAGES: Omit<PagePermission, "level">[] = [
  { pageId: "clientreq",  label: "Client Requirements", icon: "📋" },
  { pageId: "furniture",  label: "Furniture Layout",     icon: "🛋️" },
  { pageId: "moodboard",  label: "Mood Board",          icon: "🎨" },
  { pageId: "initial",    label: "Initial Estimate",    icon: "📊" },
  { pageId: "design",     label: "Design",              icon: "✏️" },
  { pageId: "final",      label: "Final Estimate",      icon: "📝" },
  { pageId: "pm",         label: "Project Management",  icon: "⚙️" },
  { pageId: "handover",   label: "Handover",            icon: "🏠" },
  { pageId: "dashboard",  label: "Dashboard",           icon: "📈" },
  { pageId: "iam",        label: "IAM Settings",        icon: "🔐" },
  { pageId: "users",      label: "User Management",     icon: "👥" },
];

/* Default role templates */
export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "admin",
    label: "Admin",
    color: "#C9A96E",
    permissions: Object.fromEntries(IAM_PAGES.map(p => [p.pageId, "full" as PermissionLevel])),
  },
  {
    id: "designer",
    label: "Designer",
    color: "#7B4FA6",
    permissions: {
      clientreq: "view", furniture: "full", moodboard: "full", initial: "edit",
      design: "full", final: "view", pm: "view", handover: "view",
      dashboard: "view", iam: "none", users: "none",
    },
  },
  {
    id: "client",
    label: "Client",
    color: "#3b82f6",
    permissions: {
      clientreq: "view", furniture: "view", moodboard: "view", initial: "view",
      design: "view", final: "view", pm: "none", handover: "view",
      dashboard: "none", iam: "none", users: "none",
    },
  },
  {
    id: "supervisor",
    label: "Site Supervisor",
    color: "#2dd4a8",
    permissions: {
      clientreq: "none", furniture: "view", moodboard: "none", initial: "view",
      design: "view", final: "view", pm: "full", handover: "full",
      dashboard: "view", iam: "none", users: "none",
    },
  },
];

/* Check if a user/role has permission */
export function hasPermission(
  permissions: Record<string, PermissionLevel>,
  pageId: string,
  requiredLevel: PermissionLevel = "view"
): boolean {
  const level = permissions[pageId] || "none";
  const hierarchy: PermissionLevel[] = ["none", "view", "edit", "full"];
  return hierarchy.indexOf(level) >= hierarchy.indexOf(requiredLevel);
}

/* Get permission label and color */
export function permissionMeta(level: PermissionLevel): { label: string; color: string; bg: string } {
  switch (level) {
    case "full": return { label: "Full Access", color: "#2dd4a8", bg: "rgba(45,212,168,0.12)" };
    case "edit": return { label: "Edit",        color: "#C9A96E", bg: "rgba(201,169,110,0.12)" };
    case "view": return { label: "View Only",   color: "#3b82f6", bg: "rgba(59,130,246,0.12)" };
    default:     return { label: "No Access",   color: "#a8a29e", bg: "rgba(168,162,158,0.08)" };
  }
}
