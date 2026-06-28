"use client";

import { avatarColor } from "@/lib/auth";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  src?: string;
  className?: string;
}

const SIZES = { sm: "w-7 h-7 text-[10px]", md: "w-9 h-9 text-[12px]", lg: "w-12 h-12 text-[15px]" };

export default function Avatar({ name, size = "md", src, className = "" }: AvatarProps) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const bg = avatarColor(name);

  if (src) {
    return (
      <img src={src} alt={name} className={`${SIZES[size]} rounded-full object-cover border-2 border-white shadow-sm ${className}`} />
    );
  }

  return (
    <div
      style={{ background: bg }}
      className={`${SIZES[size]} rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-sm ${className}`}
    >
      {initials}
    </div>
  );
}

/* Stack of overlapping avatars */
export function AvatarStack({ names, max = 3 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - max;
  return (
    <div className="flex items-center">
      {shown.map((n, i) => (
        <div key={n} style={{ marginLeft: i > 0 ? "-8px" : "0", zIndex: max - i }}>
          <Avatar name={n} size="sm" />
        </div>
      ))}
      {extra > 0 && (
        <div style={{ marginLeft: "-8px" }} className="w-7 h-7 rounded-full bg-surface-300 flex items-center justify-center text-[9px] font-bold text-surface-700 border-2 border-white shadow-sm">
          +{extra}
        </div>
      )}
    </div>
  );
}
