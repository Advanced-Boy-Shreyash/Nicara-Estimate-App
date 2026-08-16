"use client";
import { EmptyState } from "@/components/ui/States";
export default function DesignStagesRoute() {
  return (<div className="p-6 px-8 animate-fade-in"><h1 className="text-xl font-bold text-nicara-dark mb-2">Design Stages</h1><p className="text-[12px] text-surface-500 mb-5">Configure design workflow stages</p><EmptyState icon="🎨" title="Design Stages" hint="This module is under development." /></div>);
}
