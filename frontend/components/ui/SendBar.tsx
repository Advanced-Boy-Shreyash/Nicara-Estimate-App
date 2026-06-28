"use client";

import { useState, useRef, useEffect } from "react";
import type { EmailTemplate } from "@/lib/types";

interface SendBarProps {
  emails?: (EmailTemplate & { label: string })[];
  phone?: string;
  subject?: string;
  body?: string;
}

export default function SendBar({
  emails = [],
  phone = "",
  subject = "",
  body = "",
}: SendBarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openMail = (subj: string, bod: string) => {
    window.location.href = `mailto:?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(bod)}`;
    setOpen(false);
  };

  const waLink = `https://wa.me/${phone.replace(/\s/g, "")}?text=${encodeURIComponent(subject + "\n\n" + body)}`;

  const iconBtnBase =
    "flex items-center justify-center w-[34px] h-[34px] rounded-lg text-lg shrink-0 cursor-pointer border transition-opacity hover:opacity-75";

  return (
    <div className="flex gap-1.5 items-center relative" ref={ref}>
      {/* Email Button */}
      {emails.length > 0 ? (
        <div className="relative">
          <button
            onClick={() => setOpen((s) => !s)}
            title="Email client"
            className={`${iconBtnBase} ${
              open
                ? "bg-blue-100 border-blue-800"
                : "bg-blue-50 border-blue-200"
            }`}
          >
            ✉️
          </button>
          {open && (
            <div className="absolute right-0 top-10 bg-white border border-nicara-light rounded-xl shadow-2xl z-[200] min-w-[220px] overflow-hidden animate-fade-in">
              <div className="px-3 py-2 text-[10px] font-bold text-stone-400 uppercase tracking-wider border-b border-nicara-light">
                Send Email
              </div>
              {emails.map((e, i) => (
                <button
                  key={i}
                  onClick={() => openMail(e.subject, e.body)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-transparent border-none cursor-pointer text-left hover:bg-nicara-cream transition-colors"
                  style={{
                    borderBottom:
                      i < emails.length - 1
                        ? "1px solid var(--color-nicara-light)"
                        : "none",
                  }}
                >
                  <span className="text-base">✉️</span>
                  <div>
                    <div className="text-xs font-bold text-nicara-dark">
                      {e.label}
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap max-w-[160px]">
                      {e.subject}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <a
          href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
          title="Email client"
          className={`${iconBtnBase} bg-blue-50 border-blue-200 no-underline`}
        >
          ✉️
        </a>
      )}

      {/* WhatsApp */}
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        title="WhatsApp client"
        className={`${iconBtnBase} bg-emerald-50 border-emerald-300 no-underline`}
      >
        💬
      </a>
    </div>
  );
}
