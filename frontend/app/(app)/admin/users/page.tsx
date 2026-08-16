"use client";
import { EmptyState } from "@/components/ui/States";
export default function UsersRoute() {
  return (
    <div className="p-6 px-8 animate-fade-in">
      <h1 className="text-xl font-bold text-nicara-dark mb-2">Users & Roles</h1>
      <p className="text-[12px] text-surface-500 mb-5">Manage team members and their roles</p>
      <EmptyState icon="👥" title="Users & Roles" hint="This module is under development. Use the Permissions page to manage user access." />
    </div>
  );
}
