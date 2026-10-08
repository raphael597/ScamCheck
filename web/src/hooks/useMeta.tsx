import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { AnalysisResult, Meta } from '../lib/types';

const MetaContext = createContext<{ meta: Meta | null; reload: () => void }>({ meta: null, reload: () => {} });

export function MetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const reload = useCallback(() => {
    api
      .meta()
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);
  useEffect(reload, [reload]);
  return <MetaContext.Provider value={{ meta, reload }}>{children}</MetaContext.Provider>;
}

export const useMeta = () => useContext(MetaContext);

export interface HistoryEntry {
  id: string;
  createdAt: string;
  excerpt: string;
  result: AnalysisResult;
}

const HISTORY_KEY = 'scamcheck-history';
const HISTORY_MAX = 8;

function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Past results, stored only in this browser. */
export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(readHistory);
  const persist = (next: HistoryEntry[]) => {
    setEntries(next);
    try {
      if (next.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      else localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* storage full or blocked – history is a convenience only */
    }
  };
  return {
    entries,
    add: (result: AnalysisResult, excerpt: string) =>
      persist([{ id: result.id, createdAt: result.createdAt, excerpt: excerpt.slice(0, 140), result }, ...readHistory().filter((e) => e.id !== result.id)].slice(0, HISTORY_MAX)),
    remove: (id: string) => persist(readHistory().filter((e) => e.id !== id)),
    clear: () => persist([]),
  };
}
