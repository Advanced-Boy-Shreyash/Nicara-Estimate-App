"use client";

import { useState } from "react";

interface InlineCellProps {
  val: string;
  onChange: (v: string) => void;
  width?: string;
  right?: boolean;
  mono?: boolean;
  highlight?: boolean;
}

export default function InlineCell({
  val,
  onChange,
  width = "70px",
  right = false,
  mono = false,
  highlight = false,
}: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(val);

  const commit = () => {
    setEditing(false);
    onChange(v);
  };

  if (editing)
    return (
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setV(val);
            setEditing(false);
          }
        }}
        className={`border-none outline-2 outline-nicara-gold rounded p-0.5 px-1 text-[11px] bg-amber-50 text-nicara-dark ${
          mono ? "font-mono" : ""
        } ${right ? "text-right" : "text-left"} ${highlight ? "font-bold" : ""}`}
        style={{ width }}
      />
    );

  return (
    <span
      onClick={() => {
        setV(val);
        setEditing(true);
      }}
      title="Click to edit"
      className={`cursor-pointer block inline-edit p-0.5 px-1 text-[11px] ${
        mono ? "font-mono" : ""
      } ${right ? "text-right" : "text-left"} ${
        highlight ? "text-nicara-gold font-bold" : "text-stone-600"
      }`}
    >
      {val || "—"}
    </span>
  );
}
