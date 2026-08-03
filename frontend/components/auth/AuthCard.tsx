"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** Shared chrome for the standalone auth screens (reset, invite, forgot). */
export default function AuthCard({
  title, subtitle, children, footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-8">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <Link href="/login" className="inline-block no-underline">
            <div className="text-2xl font-black text-nicara-gold tracking-[0.2em]">NICARA</div>
            <div className="text-[10px] text-surface-500 tracking-[0.3em] uppercase">Project OS</div>
          </Link>
        </div>

        <div className="bg-white border border-surface-200 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-nicara-dark">{title}</h2>
          {subtitle && <p className="text-[13px] text-surface-500 mt-1.5 leading-relaxed">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-6 text-center text-[12px] text-surface-500">{footer}</div>}
      </div>
    </div>
  );
}

/** Red error banner used across the auth screens. */
export function AuthError({ message }: { message: string }) {
  return (
    <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 animate-fade-in">
      <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-px">✕</div>
      <div className="text-[12px] text-red-700 font-medium">{message}</div>
    </div>
  );
}

/** Green confirmation banner. */
export function AuthSuccess({ message }: { message: string }) {
  return (
    <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 animate-fade-in">
      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-px">✓</div>
      <div className="text-[12px] text-emerald-800 font-medium">{message}</div>
    </div>
  );
}

/** Labelled text input matching the login form. */
export function AuthField({
  id, label, type = "text", value, onChange, placeholder, error, autoComplete, autoFocus,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        id={id} name={id} type={type} value={value} placeholder={placeholder}
        autoComplete={autoComplete} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-4 py-3 border rounded-xl text-[13px] bg-white text-nicara-dark ${
          error ? "border-red-300" : "border-surface-300"
        }`}
      />
      {error && <div className="mt-1 text-[11px] text-red-600">{error}</div>}
    </div>
  );
}

/** Primary submit button with a busy state. */
export function AuthSubmit({ busy, busyLabel, label }: { busy: boolean; busyLabel: string; label: string }) {
  return (
    <button type="submit" disabled={busy}
      className={`w-full py-3.5 rounded-xl text-[14px] font-bold border-none cursor-pointer flex items-center justify-center gap-2 ${
        busy ? "bg-surface-300 text-surface-500 cursor-not-allowed" : "btn-gold"
      }`}>
      {busy ? <><span className="animate-spin-slow inline-block">⟳</span> {busyLabel}</> : label}
    </button>
  );
}

/** Live checklist mirroring the Django password validators. */
export function PasswordRules({ value }: { value: string }) {
  const rules: [string, boolean][] = [
    ["At least 10 characters", value.length >= 10],
    ["An uppercase letter", /[A-Z]/.test(value)],
    ["A lowercase letter", /[a-z]/.test(value)],
    ["A digit", /[0-9]/.test(value)],
    ["A special character", /[^A-Za-z0-9]/.test(value)],
  ];
  return (
    <ul className="mb-5 -mt-1 grid gap-1 list-none p-0">
      {rules.map(([label, ok]) => (
        <li key={label} className={`text-[11px] flex items-center gap-2 ${ok ? "text-emerald-600" : "text-surface-400"}`}>
          <span className="text-[10px]">{ok ? "✓" : "○"}</span>{label}
        </li>
      ))}
    </ul>
  );
}
