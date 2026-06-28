"use client";

import { useState } from "react";

interface ModeOption {
  id: string;
  icon: string;
  label: string;
  desc: string;
}

interface ModeSelectorProps {
  tab: string;
  onSelect: (mode: string) => void;
}

const modes: ModeOption[] = [
  {
    id: "ai",
    icon: "✦",
    label: "AI Assisted",
    desc: "AI generates from project data",
  },
  {
    id: "manual",
    icon: "✏️",
    label: "Manual Entry",
    desc: "Enter all details manually",
  },
];

export default function ModeSelector({ tab, onSelect }: ModeSelectorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[260px] gap-5 animate-fade-in">
      <div className="text-center">
        <div className="text-base font-bold text-nicara-dark mb-1">{tab}</div>
        <div className="text-xs text-stone-500">
          How would you like to proceed?
        </div>
      </div>
      <div className="flex gap-4">
        {modes.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className={`
              w-[155px] py-5 px-3.5 border-2 rounded-2xl cursor-pointer text-center
              transition-all duration-200 hover:scale-[1.02]
              ${
                b.id === "ai"
                  ? "bg-blue-50 border-blue-200 hover:border-blue-800"
                  : "bg-nicara-cream border-nicara-light hover:border-nicara-gold"
              }
            `}
          >
            <div className="text-[26px] mb-2">{b.icon}</div>
            <div
              className={`text-[13px] font-bold mb-1 ${
                b.id === "ai" ? "text-blue-800" : "text-nicara-dark"
              }`}
            >
              {b.label}
            </div>
            <div className="text-[11px] text-gray-500 leading-relaxed">
              {b.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── AI Loader ─────────────────────────────────────────────────
export function AILoader({
  lines,
  onDone,
}: {
  lines: string[];
  onDone?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const run = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      onDone?.();
    }, 2000);
  };

  if (done) return null;

  return (
    <div className="text-center py-5 animate-fade-in">
      <div className="bg-blue-50 border border-blue-200 border-l-4 border-l-blue-800 rounded-xl p-3.5 px-4.5 mb-3.5 text-left">
        <div className="text-xs font-bold text-blue-800 mb-2">
          ✦ AI INTEGRATION
        </div>
        {lines.map((l, i) => (
          <div key={i} className="text-xs text-blue-800 leading-7">
            {l}
          </div>
        ))}
      </div>
      {!loading ? (
        <button
          onClick={run}
          className="px-6 py-2.5 bg-blue-800 border-none rounded-xl text-white text-[13px] font-bold cursor-pointer hover:bg-blue-900 transition-colors"
        >
          ✦ Generate with AI
        </button>
      ) : (
        <div className="text-[13px] text-blue-800 animate-pulse-gold">
          ⟳ Working…
        </div>
      )}
    </div>
  );
}

export function AIDoneBar({ msg }: { msg: string }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 px-3.5 mb-3 text-xs text-blue-800 font-semibold animate-slide-up">
      ✦ {msg}
    </div>
  );
}

export function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-transparent border-none text-stone-400 cursor-pointer text-lg leading-none hover:text-nicara-gold transition-colors p-1"
    >
      ←
    </button>
  );
}
