"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  children: ReactNode;
  footer?: ReactNode;
}

const SIZES = { sm: "max-w-[440px]", md: "max-w-[600px]", lg: "max-w-[800px]", xl: "max-w-[1000px]", full: "max-w-[95vw]" };

export default function Modal({ open, onClose, title, subtitle, size = "md", children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${SIZES[size]} max-h-[90vh] flex flex-col animate-slide-up`}>
        {/* Header */}
        {title && (
          <div className="flex justify-between items-start px-6 pt-5 pb-3 border-b border-surface-200">
            <div>
              <h2 className="text-[17px] font-bold text-nicara-dark m-0">{title}</h2>
              {subtitle && <p className="text-[12px] text-surface-500 mt-1 m-0">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-surface-700 hover:bg-surface-100 bg-transparent border-none cursor-pointer text-lg">✕</button>
          </div>
        )}
        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="px-6 py-3.5 border-t border-surface-200 flex justify-end gap-2.5">{footer}</div>
        )}
      </div>
    </div>
  );
}
