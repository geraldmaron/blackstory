'use client';
import { useCallback, useEffect, useState } from 'react';
import type { RecordMeta } from './tag-suggestions';

export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** A small value kept in localStorage. Storage may be blocked, so every access is guarded. */
export function useStoredState<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* Keep the default. */
    }
    // The key is fixed for a mounted studio.
  }, [key]);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* The studio still works for this visit. */
      }
    },
    [key],
  );
  return [value, set];
}

/** The current time, refreshed on an interval so relative times stay honest. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Facets of the published records a story links to, fetched once per distinct set of ids. */
export function useRecordMeta(
  ids: readonly string[],
  getIdToken: () => Promise<string | null>,
): Record<string, RecordMeta> {
  const [meta, setMeta] = useState<Record<string, RecordMeta>>({});
  const key = [...ids].sort().join(',');
  useEffect(() => {
    if (!key) return;
    let canceled = false;
    const timer = setTimeout(async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const response = await fetch(
          `/admin/api/editorial/entities/meta?ids=${encodeURIComponent(key.split(',').slice(0, 100).join(','))}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok || canceled) return;
        const data = (await response.json()) as { items: RecordMeta[] };
        setMeta((previous) => ({
          ...previous,
          ...Object.fromEntries(data.items.map((item) => [item.id, item])),
        }));
      } catch {
        /* Suggestions are optional; the studio works without them. */
      }
    }, 800);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [key, getIdToken]);
  return meta;
}
