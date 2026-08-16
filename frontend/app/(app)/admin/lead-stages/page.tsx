"use client";
import { EmptyState } from "@/components/ui/States";
export default function LeadStagesRoute() {
  return (<div className="p-6 px-8 animate-fade-in"><h1 className="text-xl font-bold text-nicara-dark mb-2">Lead Stages</h1><p className="text-[12px] text-surface-500 mb-5">Configure lead pipeline stages</p><EmptyState icon="📋" title="Lead Stages" hint="This module is under development." /></div>);
}
