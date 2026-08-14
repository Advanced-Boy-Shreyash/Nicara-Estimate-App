"use client";

import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

export function SearchableSelect({
  value,
  onChange,
  options,
  onAdd,
  placeholder = "Search or select...",
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  onAdd?: (searchTerm: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.value.toLowerCase().includes(search.toLowerCase())
  );

  const displayValue = options.find(o => o.value === value)?.label || value;

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={open ? search : displayValue}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!open) setOpen(true);
        }}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            setSearch(""); // clear search on click to show all options
          }
        }}
        readOnly={!open} // Only editable when open (to act as search)
      />

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white border border-surface-200 rounded-lg shadow-lg max-h-60 overflow-y-auto flex flex-col">
          {filteredOptions.length > 0 ? (
            <ul className="py-1 m-0 list-none px-0">
              {filteredOptions.map(option => (
                <li
                  key={option.value}
                  className="px-3 py-2 text-[11px] text-nicara-dark cursor-pointer hover:bg-surface-50 hover:text-nicara-gold transition-colors"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-2 text-[11px] text-surface-400 italic">No matches found.</div>
          )}

          {onAdd && (
            <div className="border-t border-surface-100 p-1.5 bg-surface-50 sticky bottom-0">
              <button
                type="button"
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold text-nicara-gold hover:bg-nicara-gold/10 transition-colors cursor-pointer border-none"
                onClick={() => {
                  onAdd(search);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Plus size={12} />
                <span>Add {search ? `"${search}"` : "New"}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
