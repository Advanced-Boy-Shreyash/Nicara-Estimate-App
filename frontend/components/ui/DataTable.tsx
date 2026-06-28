"use client";

import type { DataColumn } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DataTableProps {
  title: string;
  data: any[];
  columns: DataColumn[];
}

export default function DataTable({ title, data, columns }: DataTableProps) {
  return (
    <div className="p-6 px-7 animate-fade-in">
      <div className="text-[17px] font-bold text-nicara-dark mb-4">{title}</div>
      <div className="overflow-x-auto rounded-xl border border-nicara-light">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="bg-nicara-dark">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="p-2.5 px-3.5 text-stone-200 font-semibold text-left text-[11px] tracking-wide"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, ri) => (
              <tr
                key={ri}
                className={`border-b border-nicara-light transition-colors hover:bg-nicara-gold/5 ${
                  ri % 2 === 0 ? "bg-nicara-cream" : "bg-white"
                }`}
              >
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    className={`p-2.5 px-3.5 text-nicara-dark ${
                      col.bold ? "font-semibold" : ""
                    }`}
                  >
                    {String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
