// Which table columns this viewer has hidden. A per-viewer preference kept in browser storage, like the column
// widths and row height. Every table that allows hiding reads the same set, so the Hide fields menu and the
// right-click menu on a header stay in step across the Tickets and Meetings tabs. The title is the row's name and
// can't be hidden. Everything on the intake form is a column and starts shown (see AGENTS.md).
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "loopback.hiddenColumns";
/** Columns that are always shown. */
const LOCKED = new Set(["title"]);

function read(): ReadonlySet<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((key): key is string => typeof key === "string" && !LOCKED.has(key)) : []);
  } catch {
    return new Set();
  }
}

let current = read();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

function write(keys: Iterable<string>) {
  current = new Set([...keys].filter((key) => !LOCKED.has(key)));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...current])); } catch { /* storage unavailable */ }
  for (const listener of listeners) listener();
}

export function useHiddenColumns() {
  const hidden = useSyncExternalStore(subscribe, () => current);
  const setHidden = useCallback((keys: Iterable<string>) => write(keys), []);
  const toggle = useCallback((key: string) => write(current.has(key) ? [...current].filter((item) => item !== key) : [...current, key]), []);
  return { hidden, setHidden, toggle, locked: LOCKED };
}
