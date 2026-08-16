"use client";
import { EmptyState } from "@/components/ui/States";
export default function VendorFinanceRoute() {
  return (<div className="p-6 px-8 animate-fade-in"><h1 className="text-xl font-bold text-nicara-dark mb-2">Vendor Finance</h1><p className="text-[12px] text-surface-500 mb-5">Manage vendor payments and invoices</p><EmptyState icon="📤" title="Vendor Finance" hint="This module is under development." /></div>);
}
