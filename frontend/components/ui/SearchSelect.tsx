"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";

/**
 * Searchable dropdown (combobox) with an always-available "+ Add …" action.
 *
 * Pick an existing option or, while searching, create a brand-new one — the
 * add button stays pinned at the end of the list and reflects whatever you have
 * typed. Used for the Item/Unit pickers in Design Requirements and the Initial
 * Estimate so both draw from the same master and can extend it inline.
 *
 * The menu is rendered with `fixed` positioning off the input's bounding box so
 * it is never clipped by a scrolling table container.
 */
export default function SearchSelect<T>({
  value,
  options,
  getLabel,
  getSublabel,
  onPick,
  onCreate,
  placeholder = "Search…",
  addLabel = q => `Add “${q}”`,
  disabled,
  loading,
  className,
  autoFocus,
}: {
  value: string;
  options: T[];
  getLabel: (o: T) => string;
  getSublabel?: (o: T) => string | undefined;
  onPick: (o: T) => void;
  onCreate?: (query: string) => void | Promise<void>;
  placeholder?: string;
  addLabel?: (query: string) => string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim();
  const filtered = q
    ? options.filter(o => getLabel(o).toLowerCase().includes(q.toLowerCase()))
    : options;
  const exact = options.some(o => getLabel(o).toLowerCase() === q.toLowerCase());
  const showAdd = !!onCreate && q.length > 0 && !exact;

  const position = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 240) });
  };

  useLayoutEffect(() => {
    if (open) position();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocMouse = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // Reposition-then-close on scroll/resize keeps the menu from floating away.
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDocMouse);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouse);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const start = () => {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  };

  const pick = (o: T) => {
    onPick(o);
    setOpen(false);
    setQuery("");
  };

  const create = async () => {
    if (!onCreate || !q) return;
    setCreating(true);
    try {
      await onCreate(q);
      setOpen(false);
      setQuery("");
    } finally {
      setCreating(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0) pick(filtered[0]);
      else if (showAdd) create();
    }
  };

  const inputCls =
    className ??
    "w-full px-2 py-1.5 border border-transparent rounded-lg text-[11px] bg-transparent outline-none focus:border-nicara-gold focus:bg-white cursor-text";

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        autoFocus={autoFocus}
        value={open ? query : value}
        placeholder={open ? (value || placeholder) : placeholder}
        onFocus={start}
        onClick={start}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
        onKeyDown={onKeyDown}
        className={inputCls}
      />

      {open && coords && (
        <div
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width, zIndex: 700 }}
          className="bg-white border border-surface-200 rounded-xl shadow-xl overflow-hidden">
          {loading && (
            <div className="px-3 py-3 text-[11px] text-surface-400 flex items-center gap-2">
              <Search size={12} /> Loading…
            </div>
          )}
          {!loading && (
            <div className="max-h-[240px] overflow-y-auto">
              {filtered.map((o, i) => {
                const sub = getSublabel?.(o);
                return (
                  <button key={i} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(o)}
                    className="w-full text-left px-3 py-2 border-b border-surface-50 last:border-0 hover:bg-nicara-gold/5 cursor-pointer bg-white">
                    <div className="text-[12px] font-semibold text-nicara-dark">{getLabel(o)}</div>
                    {sub && <div className="text-[10px] text-surface-400">{sub}</div>}
                  </button>
                );
              })}
              {filtered.length === 0 && !showAdd && (
                <div className="px-3 py-3 text-[11px] text-surface-400 text-center">No matches</div>
              )}
            </div>
          )}
          {showAdd && (
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={create} disabled={creating}
              className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-surface-100 bg-nicara-gold/10 hover:bg-nicara-gold/20 text-nicara-gold text-[12px] font-bold cursor-pointer">
              <Plus size={13} /> {creating ? "Adding…" : addLabel(q)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
