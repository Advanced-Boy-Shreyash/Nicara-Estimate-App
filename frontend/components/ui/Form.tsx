"use client";

import type { ReactNode } from "react";

export const INPUT =
  "w-full px-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white text-nicara-dark outline-none focus:border-nicara-gold";
export const LABEL =
  "text-[10px] font-bold text-surface-500 uppercase tracking-wider block mb-1.5";

/** Labelled text/number input. */
export function Field({
  label, value, onChange, type = "text", placeholder, error, required, disabled, hint,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className={LABEL}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className={`${INPUT} ${error ? "border-red-300" : ""} ${disabled ? "bg-surface-50 text-surface-400" : ""}`}
      />
      {hint && !error && <div className="mt-1 text-[10px] text-surface-400">{hint}</div>}
      {error && <div className="mt-1 text-[10px] text-red-600">{error}</div>}
    </div>
  );
}

/** Labelled select. */
export function Select({
  label, value, onChange, options, error, required, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={LABEL}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        className={`${INPUT} cursor-pointer ${error ? "border-red-300" : ""}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <div className="mt-1 text-[10px] text-red-600">{error}</div>}
    </div>
  );
}

/** Labelled multi-line input. */
export function TextArea({
  label, value, onChange, rows = 3, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <textarea
        value={value ?? ""}
        rows={rows}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`${INPUT} resize-y`}
      />
    </div>
  );
}

/** Checkbox with an inline label. */
export function Check({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 accent-nicara-gold cursor-pointer" />
      <span className="text-[12px] text-surface-600">{label}</span>
    </label>
  );
}

/** Titled group of fields inside a form. */
export function FormSection({ title, children, cols = 2 }: { title: string; children: ReactNode; cols?: number }) {
  return (
    <div className="mb-5">
      <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-[0.12em] mb-2.5 pb-1.5 border-b border-surface-100">
        {title}
      </div>
      <div className={`grid gap-3 ${cols === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {children}
      </div>
    </div>
  );
}

/** Primary / secondary buttons used in modal footers. */
export function Btn({
  children, onClick, variant = "primary", disabled, type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: disabled ? "bg-surface-300 text-surface-500 cursor-not-allowed" : "btn-gold cursor-pointer",
    ghost: "bg-surface-100 text-surface-600 hover:bg-surface-200 cursor-pointer",
    danger: "bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`px-4 py-2.5 rounded-xl text-[12px] font-bold border-none ${styles}`}>
      {children}
    </button>
  );
}
