"use client";
import { EmptyState } from "@/components/ui/States";
export default function RawMaterialRoute() {
  return (<div className="p-6 px-8 animate-fade-in"><h1 className="text-xl font-bold text-nicara-dark mb-2">Raw Material</h1><p className="text-[12px] text-surface-500 mb-5">Component library for raw materials</p><EmptyState icon="🪵" title="Raw Material" hint="This module is under development." /></div>);
}
