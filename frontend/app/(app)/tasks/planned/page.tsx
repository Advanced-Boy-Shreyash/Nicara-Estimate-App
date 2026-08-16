"use client";
import { EmptyState } from "@/components/ui/States";
export default function PlannedTasksRoute() {
  return (<div className="p-6 px-8 animate-fade-in"><h1 className="text-xl font-bold text-nicara-dark mb-2">Planned Tasks</h1><p className="text-[12px] text-surface-500 mb-5">View and manage scheduled tasks</p><EmptyState icon="📋" title="Planned Tasks" hint="This module is under development." /></div>);
}
