"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { tokenStore } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(tokenStore.access() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="text-center">
        <div className="text-3xl font-black text-nicara-gold tracking-[0.2em] mb-2">NICARA</div>
        <div className="text-[11px] text-surface-400 tracking-widest uppercase">Loading…</div>
      </div>
    </div>
  );
}
