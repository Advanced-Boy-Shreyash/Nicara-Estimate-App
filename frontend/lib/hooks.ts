"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Run an async fetcher on mount and whenever `deps` change.
 *
 * `deps` is what decides when to refetch — the fetcher itself is deliberately
 * not a dependency, because callers pass an inline arrow that would otherwise
 * change identity on every render.
 *
 * `reload()` re-runs it; call that after any mutation so the screen shows what
 * the server actually stored rather than what we hoped it stored.
 */
export function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = []
): AsyncState<T> & { reload: () => Promise<void>; setData: (d: T) => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null, loading: true, error: null,
  });

  // Guards against setting state on an unmounted component.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Collapse the caller's deps into one primitive so the dependency array is
  // a literal — the React Compiler cannot reason about a dynamic list.
  // Callers pass primitives (ids, search strings), which serialise cleanly.
  const depKey = JSON.stringify(deps);

  const run = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcher();
      if (alive.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (!alive.current) return;
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      setState({ data: null, loading: false, error: message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depKey stands in for the caller's deps; fetcher is captured per-run
  }, [depKey]);

  // A fetch hook has to flip to `loading` the moment its inputs change, which
  // is a synchronous setState inside the effect by definition.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- inherent to fetch-on-deps-change
  useEffect(() => { void run(); }, [run]);

  const setData = useCallback((data: T) => {
    setState({ data, loading: false, error: null });
  }, []);

  return { ...state, reload: run, setData };
}

/** Format a rupee amount from the string the API returns. */
export function inr(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  if (Number.isNaN(n)) return "₹0";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/** Same, but keeps paise — for totals where the rounding matters. */
export function inrExact(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  if (Number.isNaN(n)) return "₹0.00";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
