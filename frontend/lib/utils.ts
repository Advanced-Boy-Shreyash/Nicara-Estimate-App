// ── NICARA Project OS — Utility Functions ───────────────────

/**
 * Format a number as Indian Rupees.
 * e.g. fmt(123456) → "₹1,23,456"
 */
export function fmt(n: number): string {
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/**
 * Calculate GST value for a row.
 */
export function gstValue(amtEx: number, gstPct: number = 18): number {
  return Math.round(amtEx * gstPct / 100);
}

/**
 * Calculate amount inclusive of GST.
 */
export function incGST(amtEx: number, gstPct: number = 18): number {
  return amtEx + gstValue(amtEx, gstPct);
}

/**
 * Simulate a file download (for demo purposes).
 * In production, this would fetch from the Django backend.
 */
export function dlFile(filename: string): void {
  const blob = new Blob(["[File: " + filename + "]"], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export data as a CSV file.
 */
export function exportCSVFile(
  filename: string,
  headers: string,
  rows: string[]
): void {
  const content = [headers, ...rows].join("\n");
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate a random client ID.
 */
export function generateClientId(): string {
  return "CLI-" + Math.floor(10000 + Math.random() * 90000);
}

/**
 * Get current date formatted for display.
 */
export function todayFormatted(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Status style helper — returns Tailwind classes for status badges.
 */
export function getStatusStyle(status: string): {
  bg: string;
  tc: string;
  icon: string;
} {
  switch (status) {
    case "approved":
      return { bg: "bg-emerald-100", tc: "text-emerald-800", icon: "✅" };
    case "denied":
      return { bg: "bg-red-100", tc: "text-red-800", icon: "❌" };
    default:
      return { bg: "bg-amber-100", tc: "text-amber-800", icon: "⏳" };
  }
}

/**
 * Task status color helpers.
 */
export function taskBg(s: string): string {
  if (s === "Completed") return "bg-emerald-100";
  if (s === "In Progress") return "bg-amber-100";
  return "bg-gray-100";
}

export function taskTc(s: string): string {
  if (s === "Completed") return "text-emerald-800";
  if (s === "In Progress") return "text-amber-800";
  return "text-gray-500";
}

/**
 * Paid status badge helper.
 */
export function paidBadgeStyle(status: string): { bg: string; tc: string } {
  switch (status) {
    case "Paid":
      return { bg: "bg-emerald-100", tc: "text-emerald-800" };
    case "Partial":
      return { bg: "bg-amber-100", tc: "text-amber-800" };
    default:
      return { bg: "bg-amber-100", tc: "text-amber-800" };
  }
}

/**
 * Type badge colors for detail breakdown.
 */
export function typeBadgeStyle(type: string): { bg: string; tc: string } {
  switch (type) {
    case "Procurement":
      return { bg: "bg-blue-50", tc: "text-blue-800" };
    case "Service":
      return { bg: "bg-emerald-50", tc: "text-emerald-700" };
    case "Spec Purpose":
      return { bg: "bg-orange-50", tc: "text-orange-700" };
    case "Procurement cum Service":
      return { bg: "bg-purple-50", tc: "text-purple-700" };
    default:
      return { bg: "bg-stone-50", tc: "text-stone-700" };
  }
}
