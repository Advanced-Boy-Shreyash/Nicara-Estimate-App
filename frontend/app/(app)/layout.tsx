"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { ProjectProvider, useActiveProject } from "@/lib/projectContext";
import Sidebar from "@/components/app/Sidebar";
import Avatar from "@/components/ui/Avatar";

const BREADCRUMB_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "Projects",
  "/tasks/planned": "Planned Tasks",
  "/tasks/unplanned": "Unplanned Tasks",
  "/vendors/suppliers": "Material Suppliers",
  "/vendors/contractors": "Contractors",
  "/customers/leads": "Leads",
  "/customers/clients": "Clients",
  "/finance/transactions": "Transactions",
  "/finance/vendor": "Vendor Finance",
  "/finance/client": "Client Finance",
  "/catalog": "Furniture Catalogue",
  "/items": "Items",
  "/library/raw-material": "Raw Material",
  "/library/furniture": "Furniture & Furnishings",
  "/admin/users": "Users & Roles",
  "/admin/permissions": "User Permissions",
  "/admin/lead-stages": "Lead Stages",
  "/admin/design-stages": "Design Stages",
  "/admin/site-master": "Project Site Master",
};

function Topbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { activeProject } = useActiveProject();

  let label = activeProject
    ? activeProject.name
    : BREADCRUMB_LABELS[pathname] || "NICARA";

  if (!activeProject && pathname.startsWith("/project/")) label = "Project";
  if (!activeProject && pathname.startsWith("/lead/")) label = "Lead";

  return (
    <div className="bg-white border-b border-surface-200 px-6 py-2.5 flex justify-between items-center no-print sticky top-0 z-30">
      <div className="flex items-center gap-2 text-[12px] text-surface-400">
        <span className="text-nicara-gold font-bold">NICARA</span>
        <span>›</span>
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3">
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
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && !isAuthenticated) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="text-3xl font-black text-nicara-gold tracking-[0.2em] mb-2">NICARA</div>
          <div className="text-[11px] text-surface-400 tracking-widest uppercase">Redirecting…</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="text-3xl font-black text-nicara-gold tracking-[0.2em] mb-2">NICARA</div>
          <div className="text-[11px] text-surface-400 tracking-widest uppercase">Loading…</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <ProjectProvider>
        <div className="flex min-h-screen bg-[#f0eeeb]">
          <Sidebar />
          <div className="flex-1 overflow-auto">
            <Topbar />
            {children}
          </div>
        </div>
      </ProjectProvider>
    </AuthGate>
  );
}

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppLayout>{children}</AppLayout>
      </ToastProvider>
    </AuthProvider>
  );
}
