"use client";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "ai" | "status" | "role" | "tag" | "gold";
  className?: string;
}

export function AIBadge() {
  return (
    <span className="bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
      ✦ AI
    </span>
  );
}

export function StatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const styles: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-800",
    denied: "bg-red-100 text-red-800",
    pending: "bg-amber-100 text-amber-800",
    Paid: "bg-emerald-100 text-emerald-800",
    Pending: "bg-amber-100 text-amber-800",
    Partial: "bg-amber-100 text-amber-800",
    Ordered: "bg-emerald-50 text-emerald-700",
    Received: "bg-blue-50 text-blue-700",
    Completed: "bg-emerald-100 text-emerald-800",
    "In Progress": "bg-amber-100 text-amber-800",
    "Not Started": "bg-gray-100 text-gray-500",
  };

  const icons: Record<string, string> = {
    approved: "✅",
    denied: "❌",
    pending: "⏳",
    Paid: "✓",
    Completed: "✓",
  };

  const style = styles[status] || "bg-gray-100 text-gray-600";
  const icon = icons[status] || "";

  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1 ${style} ${className}`}
    >
      {icon && <span>{icon}</span>}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function RoleBadge({
  icon,
  label,
  color,
  bg,
}: {
  icon: string;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1"
      style={{ color, background: bg }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export function FactorySiteBadge({ value }: { value: string }) {
  const isFactory = value === "Factory";
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
        isFactory ? "bg-blue-50 text-blue-800" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {value || "—"}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    Procurement: "bg-blue-50 text-blue-800",
    Service: "bg-emerald-50 text-emerald-700",
    "Spec Purpose": "bg-orange-50 text-orange-700",
    "Procurement cum Service": "bg-purple-50 text-purple-700",
  };

  return (
    <span
      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
        styles[type] || "bg-stone-50 text-stone-700"
      }`}
    >
      {type}
    </span>
  );
}

export default function Badge({ children, variant = "tag", className = "" }: BadgeProps) {
  const base = "inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap";
  const variants: Record<string, string> = {
    ai: "bg-blue-50 border border-blue-200 text-blue-800 text-[10px] px-2 py-0.5",
    status: "text-[10px] px-2 py-0.5",
    role: "text-[10px] px-2.5 py-0.5",
    tag: "text-[9px] px-2 py-0.5 bg-nicara-gold/10 text-nicara-gold border border-nicara-gold/20",
    gold: "text-[9px] font-bold bg-nicara-gold/10 text-nicara-gold px-2 py-0.5",
  };

  return (
    <span className={`${base} ${variants[variant]} ${className}`}>{children}</span>
  );
}
