"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useActiveProject } from "@/lib/projectContext";
import Avatar from "@/components/ui/Avatar";
import { iamApi } from "@/lib/api";
import type { MyPermissions } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";
import {
  LayoutDashboard, FolderKanban, ClipboardCheck, Zap,
  Factory, HardHat, Target, UserCircle,
  CreditCard, ArrowUpFromLine, ArrowDownToLine,
  Package, TreePine, Armchair,
  Users, ShieldCheck, List, Palette, Building,
  LibraryBig, type LucideIcon,
} from "lucide-react";

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  "tasks-planned": ClipboardCheck,
  "tasks-unplanned": Zap,
  "vendors-suppliers": Factory,
  "vendors-contractors": HardHat,
  "customers-leads": Target,
  "customers-clients": UserCircle,
  "finance-transactions": CreditCard,
  "finance-vendor": ArrowUpFromLine,
  "finance-client": ArrowDownToLine,
  catalog: LibraryBig,
  items: Package,
  "library-raw": TreePine,
  "library-furniture": Armchair,
  "admin-users": Users,
  "admin-permissions": ShieldCheck,
  "admin-lead-stages": List,
  "admin-design-stages": Palette,
  "admin-site-master": Building,
};

interface NavItem {
  iconKey: string;
  label: string;
  href: string;
  module?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Main",
    items: [
      { iconKey: "dashboard", label: "Dashboard", href: "/dashboard", module: "dashboard" },
      { iconKey: "projects", label: "Projects", href: "/projects", module: "projects" },
    ],
  },
  {
    label: "Tasks",
    items: [
      { iconKey: "tasks-planned", label: "Planned Tasks", href: "/tasks/planned", module: "tasks" },
      { iconKey: "tasks-unplanned", label: "Unplanned Tasks", href: "/tasks/unplanned", module: "tasks" },
    ],
  },
  {
    label: "Vendors",
    items: [
      { iconKey: "vendors-suppliers", label: "Material Suppliers", href: "/vendors/suppliers", module: "vendors_material" },
      { iconKey: "vendors-contractors", label: "Contractors", href: "/vendors/contractors", module: "vendors_contract" },
    ],
  },
  {
    label: "Customers",
    items: [
      { iconKey: "customers-leads", label: "Leads", href: "/customers/leads", module: "leads" },
      { iconKey: "customers-clients", label: "Clients", href: "/customers/clients", module: "clients" },
    ],
  },
  {
    label: "Finance",
    items: [
      { iconKey: "finance-transactions", label: "Transactions", href: "/finance/transactions", module: "finance" },
      { iconKey: "finance-vendor", label: "Vendor Finance", href: "/finance/vendor", module: "finance" },
      { iconKey: "finance-client", label: "Client Finance", href: "/finance/client", module: "finance" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { iconKey: "catalog", label: "Furniture Catalogue", href: "/catalog", module: "catalog" },
      { iconKey: "items", label: "Items", href: "/items", module: "items" },
      { iconKey: "library-raw", label: "Raw Material", href: "/library/raw-material", module: "library" },
      { iconKey: "library-furniture", label: "Furniture & Furnishings", href: "/library/furniture", module: "library" },
    ],
  },
  {
    label: "Admin",
    items: [
      { iconKey: "admin-users", label: "Users & Roles", href: "/admin/users", module: "users" },
      { iconKey: "admin-permissions", label: "User Permissions", href: "/admin/permissions", module: "iam" },
      { iconKey: "admin-lead-stages", label: "Lead Stages", href: "/admin/lead-stages", module: "masters" },
      { iconKey: "admin-design-stages", label: "Design Stages", href: "/admin/design-stages", module: "masters" },
      { iconKey: "admin-site-master", label: "Project Site Master", href: "/admin/site-master", module: "masters" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { activeProject } = useActiveProject();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { data: mine } = useApiData<MyPermissions>(() => iamApi.mine(), []);

  const allowed = (module?: string) => {
    if (!module || !mine) return true;
    if (mine.is_admin) return true;
    const level = mine.permissions[module];
    return !!level && level !== "none";
  };

  const sections = NAV_SECTIONS
    .map(section => ({ ...section, items: section.items.filter(i => allowed(i.module)) }))
    .filter(section => section.items.length > 0);

  const isItemActive = (href: string) => {
    if (activeProject) return false;
    return pathname === href;
  };

  return (
    <div className="w-[230px] min-w-[230px] sidebar-gradient flex flex-col min-h-screen border-r border-nicara-dark-deep no-print">
      <div className="p-5 pb-3 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 rounded-lg bg-nicara-gold flex items-center justify-center text-white text-[11px] font-black">N</div>
          <div>
            <div className="text-[15px] font-extrabold text-nicara-gold tracking-[0.12em]">NICARA</div>
            <div className="text-[9px] text-surface-500 tracking-[0.2em] uppercase">Project OS</div>
          </div>
        </Link>
      </div>

      <div className="px-3 py-3 flex-1 overflow-y-auto scrollbar-thin">
        {sections.map(section => (
          <div key={section.label} className="mb-2">
            <button
              onClick={() => setCollapsed(p => ({ ...p, [section.label]: !p[section.label] }))}
              className="flex items-center justify-between w-full px-2 py-1 bg-transparent border-none cursor-pointer text-left mb-0.5"
            >
              <span className="text-[9px] font-bold text-surface-500 uppercase tracking-[0.15em]">{section.label}</span>
              <span className="text-[10px] text-surface-600">{collapsed[section.label] ? "▸" : "▾"}</span>
            </button>
            {!collapsed[section.label] && section.items.map(item => {
              const Icon = NAV_ICONS[item.iconKey];
              const active = isItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] text-left no-underline sidebar-item ${
                    active ? "sidebar-item-active font-semibold" : "bg-transparent text-surface-400 hover:text-surface-200"
                  }`}
                >
                  {Icon ? <Icon size={14} className="shrink-0 opacity-70" /> : <span className="w-3.5" />}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}

        {activeProject && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-[9px] font-bold text-surface-600 uppercase tracking-[0.12em] px-2 mb-2">Active Project</div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full shrink-0 bg-nicara-gold" />
                <div className="text-[11px] font-semibold text-nicara-gold truncate">{activeProject.name}</div>
              </div>
              <div className="text-[10px] text-surface-500 mb-2 pl-4">{activeProject.project_type} · {activeProject.area}</div>
              <div className="pl-4">
                <div className="flex justify-between text-[10px] text-surface-500 mb-1">
                  <span>Progress</span><span>{activeProject.progress}%</span>
                </div>
                <div className="h-[3px] bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-nicara-gold" style={{ width: activeProject.progress + "%" }} />
                </div>
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
          <button
            onClick={() => void logout()}
            className="opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none text-surface-500 hover:text-red-400 cursor-pointer text-sm p-0"
            title="Logout"
          >⏻</button>
        </div>
      </div>
    </div>
  );
}
