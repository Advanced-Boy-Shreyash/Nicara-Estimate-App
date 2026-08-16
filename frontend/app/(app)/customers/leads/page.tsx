"use client";
import { useRouter } from "next/navigation";
import LeadsPage from "@/components/crm/LeadsPage";
export default function LeadsRoute() {
  const router = useRouter();
  return <LeadsPage onOpenProject={(id) => router.push(`/project/${id}`)} />;
}
