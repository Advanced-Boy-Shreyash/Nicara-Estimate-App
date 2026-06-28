"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {}, success: () => {}, error: () => {}, info: () => {},
});

export const useToast = () => useContext(ToastContext);

const ICONS: Record<ToastType, string> = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
const COLORS: Record<ToastType, { border: string; bg: string; icon: string }> = {
  success: { border: "#2dd4a8", bg: "#ecfdf5", icon: "#059669" },
  error:   { border: "#ef4444", bg: "#fef2f2", icon: "#dc2626" },
  info:    { border: "#3b82f6", bg: "#eff6ff", icon: "#2563eb" },
  warning: { border: "#f59e0b", bg: "#fffbeb", icon: "#d97706" },
};

function ToastItem({ t, onRemove }: { t: Toast; onRemove: () => void }) {
  const c = COLORS[t.type];
  const dur = t.duration || 4000;

  useEffect(() => {
    const timer = setTimeout(onRemove, dur);
    return () => clearTimeout(timer);
  }, [dur, onRemove]);

  return (
    <div
      style={{ borderLeft: `4px solid ${c.border}`, background: c.bg }}
      className="min-w-[320px] max-w-[420px] rounded-xl px-4 py-3 shadow-lg flex gap-3 items-start"
    >
      <div
        style={{ background: c.border, color: "white" }}
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
      >
        {ICONS[t.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-nicara-dark">{t.title}</div>
        {t.message && <div className="text-[12px] text-surface-500 mt-0.5">{t.message}</div>}
        <div className="mt-2 h-[2px] bg-surface-200 rounded-full overflow-hidden">
          <div style={{ background: c.border, animationDuration: `${dur}ms` }} className="h-full animate-[progress-shrink_linear_forwards]" />
        </div>
      </div>
      <button onClick={onRemove} className="text-surface-400 hover:text-surface-600 text-sm bg-transparent border-none cursor-pointer p-0 mt-0.5">✕</button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let idRef = 0;

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    const id = ++idRef;
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ctx: ToastContextType = {
    toast: addToast,
    success: (t, m) => addToast("success", t, m),
    error: (t, m) => addToast("error", t, m),
    info: (t, m) => addToast("info", t, m),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5">
        {toasts.map(t => (
          <div key={t.id} style={{ animation: "toast-in 0.3s ease-out" }}>
            <ToastItem t={t} onRemove={() => remove(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
