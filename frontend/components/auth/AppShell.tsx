"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="text-3xl font-black text-nicara-gold tracking-[0.2em] mb-2">NICARA</div>
          <div className="text-[11px] text-surface-400 tracking-widest uppercase">Loading…</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AuthGate>{children}</AuthGate>
      </ToastProvider>
    </AuthProvider>
  );
}
