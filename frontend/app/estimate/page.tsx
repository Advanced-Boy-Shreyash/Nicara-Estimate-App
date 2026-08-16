"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EstimateRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="text-center">
        <div className="text-3xl font-black text-nicara-gold tracking-[0.2em] mb-2">NICARA</div>
        <div className="text-[11px] text-surface-400 tracking-widest uppercase">Redirecting…</div>
      </div>
    </div>
  );
}
