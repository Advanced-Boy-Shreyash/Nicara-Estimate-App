"use client";
import { useRouter } from "next/navigation";
import ClientsPage from "@/components/crm/ClientsPage";
export default function ClientsRoute() {
  const router = useRouter();
  return <ClientsPage onOpenProject={(id) => router.push(`/project/${id}`)} />;
}
