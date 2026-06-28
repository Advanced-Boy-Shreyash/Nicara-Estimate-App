"use client";

interface ExportBtnProps {
  onClick: () => void;
  label?: string;
}

export default function ExportBtn({
  onClick,
  label = "⬇ Export CSV",
}: ExportBtnProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-nicara-cream border border-nicara-light rounded-lg text-[11px] text-stone-600 cursor-pointer font-semibold hover:bg-nicara-light hover:border-nicara-gold transition-all"
    >
      {label}
    </button>
  );
}
