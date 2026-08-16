"use client";
import { EmptyState } from "@/components/ui/States";
export default function UnplannedTasksRoute() {
  return (<div className="p-6 px-8 animate-fade-in"><h1 className="text-xl font-bold text-nicara-dark mb-2">Unplanned Tasks</h1><p className="text-[12px] text-surface-500 mb-5">Track ad-hoc tasks</p><EmptyState icon="⚡" title="Unplanned Tasks" hint="This module is under development." /></div>);
}
