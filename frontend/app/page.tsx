"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("nicara_token");
    if (token) {
      router.replace("/estimate");
    } else {
      router.replace("/login");
    }
    setChecking(false);
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="text-3xl font-black text-nicara-gold tracking-[0.2em] mb-2">NICARA</div>
          <div className="text-[11px] text-surface-400 tracking-widest uppercase">Loading…</div>
        </div>
      </div>
    );
  }

  return null;
}
