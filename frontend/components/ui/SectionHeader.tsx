"use client";

interface SectionHeaderProps {
  title: string;
  className?: string;
}

export default function SectionHeader({ title, className = "" }: SectionHeaderProps) {
  return (
    <div
      className={`
        text-[11px] font-bold text-nicara-gold uppercase tracking-widest
        mb-3 pb-1.5 border-b border-nicara-light
        ${className}
      `}
    >
      {title}
    </div>
  );
}
