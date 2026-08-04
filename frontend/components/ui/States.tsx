"use client";

import type { ReactNode } from "react";

/** Spinner shown while a screen's first fetch is in flight. */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <div className="animate-spin-slow inline-block text-2xl text-nicara-gold">⟳</div>
        <div className="text-[11px] text-surface-400 tracking-widest uppercase mt-2">{label}</div>
      </div>
    </div>
  );
}

/** Failed fetch, with a retry when the caller can re-run it. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
      <div className="text-2xl mb-2">⚠️</div>
      <div className="text-[13px] font-semibold text-red-700 mb-1">Could not load this</div>
      <div className="text-[12px] text-red-600 mb-4 max-w-md mx-auto">{message}</div>
      {onRetry && (
        <button onClick={onRetry}
          className="px-4 py-2 bg-white border border-red-200 rounded-xl text-[12px] font-semibold text-red-700 cursor-pointer hover:bg-red-100">
          Try again
        </button>
      )}
    </div>
  );
}

/** Nothing to show yet. */
export function EmptyState({
  icon = "📭", title, hint, action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl p-10 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-[14px] font-bold text-nicara-dark mb-1">{title}</h3>
      {hint && <p className="text-[12px] text-surface-400 max-w-md mx-auto mb-4">{hint}</p>}
      {action}
    </div>
  );
}

/** Small pill used for statuses across the app. */
export function StatusPill({ status, label }: { status: string; label?: string }) {
  const palette: Record<string, string> = {
    approved: "bg-emerald-50 text-emerald-700",
    signed: "bg-emerald-50 text-emerald-700",
    paid: "bg-emerald-50 text-emerald-700",
    completed: "bg-emerald-50 text-emerald-700",
    sent: "bg-blue-50 text-blue-700",
    "in-progress": "bg-blue-50 text-blue-700",
    design: "bg-purple-50 text-purple-700",
    draft: "bg-surface-100 text-surface-500",
    upcoming: "bg-surface-100 text-surface-500",
    lead: "bg-surface-100 text-surface-500",
    pending: "bg-amber-50 text-amber-700",
    partial: "bg-amber-50 text-amber-700",
    revision: "bg-amber-50 text-amber-700",
    execution: "bg-amber-50 text-amber-700",
    cancelled: "bg-red-50 text-red-700",
    overdue: "bg-red-50 text-red-700",
    delayed: "bg-red-50 text-red-700",
  };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize whitespace-nowrap ${
      palette[status] || "bg-surface-100 text-surface-500"
    }`}>
      {label || status}
    </span>
  );
}

/** Inline banner for a save that failed. */
export function InlineError({ message }: { message: string }) {
  return (
    <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700 font-medium">
      {message}
    </div>
  );
}
