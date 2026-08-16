"use client";
import { EmptyState } from "@/components/ui/States";
export default function TransactionsRoute() {
  return (<div className="p-6 px-8 animate-fade-in"><h1 className="text-xl font-bold text-nicara-dark mb-2">Transactions</h1><p className="text-[12px] text-surface-500 mb-5">View all financial transactions</p><EmptyState icon="💳" title="Transactions" hint="This module is under development." /></div>);
}
