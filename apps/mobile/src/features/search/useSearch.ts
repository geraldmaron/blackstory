/**
 * React wiring for the search feature (MOB-013). Thin: all the async-ordering-sensitive logic
 * (cancellation, race guard, cursor/release-stamp guard, cache fallback) lives in
 * `search-controller.ts`, which this hook merely subscribes to. Owns:
 *   - the raw draft text (component-local state; never persisted, dies with the screen per
 *     ADR-022 §2's "the raw text stays in memory ... and dies with the process"),
 *   - normalization + debounce (`query-normalization.ts` / `debounce.ts`) before the controller
 *     ever sees a query,
 *   - the recent-searches list (SecureStore-backed; `recent-searches.ts`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { foldForComparison, normalizeSearchQuery, SEARCH_DEBOUNCE_MS } from './query-normalization';
import { useDebouncedValue } from './debounce';
import { getSearchRuntime, type SearchRuntime } from './search-runtime';
import { createSearchController, type SearchControllerState } from './search-controller';
import type { RecentSearchEntry } from './recent-searches';

export interface UseSearchOptions {
  readonly initialQuery?: string;
  readonly initialKind?: string;
  /** Test-only injection point -- production code always omits this and gets the lazily-built
   * real runtime from `getSearchRuntime()`. */
  readonly runtime?: SearchRuntime;
}

export interface UseSearchResult {
  readonly draft: string;
  readonly setDraft: (value: string) => void;
  readonly filterKind: string | undefined;
  readonly setFilterKind: (kind: string | undefined) => void;
  readonly state: SearchControllerState;
  readonly loadMore: () => void;
  readonly retry: () => void;
  readonly recentSearches: readonly RecentSearchEntry[];
  readonly selectRecentSearch: (term: string) => void;
  readonly removeRecentSearch: (term: string) => void;
  readonly clearRecentSearches: () => void;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const [draft, setDraft] = useState(() => normalizeSearchQuery(options.initialQuery ?? ''));
  const [filterKind, setFilterKind] = useState<string | undefined>(options.initialKind);
  const [state, setState] = useState<SearchControllerState>({ kind: 'browse' });
  const [recentSearches, setRecentSearches] = useState<readonly RecentSearchEntry[]>([]);

  const normalizedDraft = normalizeSearchQuery(draft);
  const debouncedQuery = useDebouncedValue(normalizedDraft, SEARCH_DEBOUNCE_MS);

  // The resolved runtime lives in STATE (not a plain ref) specifically so its arrival re-runs the
  // query-driving effect below via React's own dependency tracking -- a ref mutation alone does
  // not trigger a re-render/effect re-run, which would otherwise silently drop the very first
  // query (e.g. a deep-linked `q`) if it arrived before the runtime finished resolving.
  const [runtime, setRuntimeState] = useState<SearchRuntime | null>(options.runtime ?? null);
  const controllerRef = useRef<ReturnType<typeof createSearchController> | null>(null);
  const mountedRef = useRef(true);

  // Lazily resolve the runtime once, then load the initial recent-searches list. Deliberately
  // runs ONCE on mount, not whenever `runtime` changes: it is the one effect that sets
  // `runtime` state (via `setRuntimeState`), so depending on `runtime` here would re-run itself
  // every time it fires. Reading the current `runtime` value at the top is only a seed check for
  // the test-injection path (`options.runtime`) -- it is intentionally not a reactive dependency.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      const resolved = runtime ?? (await getSearchRuntime());
      if (cancelled) return;
      setRuntimeState(resolved);
      const list = await resolved.recentSearches.list();
      if (!cancelled) setRecentSearches(list);
    })().catch(() => {
      // Runtime construction failure (e.g. SQLite unavailable in a hostile environment) degrades
      // to browse mode with no recent searches, never a crash.
    });
    return () => {
      cancelled = true;
      mountedRef.current = false;
      controllerRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drive the controller from the debounced, normalized query + current filter, once a runtime
  // exists.
  useEffect(() => {
    if (!runtime) return;
    if (!controllerRef.current) {
      controllerRef.current = createSearchController(
        runtime,
        (next) => {
          if (mountedRef.current) setState(next);
        },
        (list) => {
          // A successful query just recorded its term; reflect the refreshed list immediately so
          // the recent-searches strip is current even after the user clears the field.
          if (mountedRef.current) setRecentSearches(list);
        },
      );
    }
    controllerRef.current.setQuery(debouncedQuery, filterKind);
  }, [runtime, debouncedQuery, filterKind]);

  const loadMore = useCallback(() => controllerRef.current?.loadMore(), []);
  const retry = useCallback(() => controllerRef.current?.retry(), []);

  const selectRecentSearch = useCallback((term: string) => {
    setDraft(term);
  }, []);

  const removeRecentSearch = useCallback(
    (term: string) => {
      if (!runtime) return;
      void runtime.recentSearches.remove(term).then((list) => {
        if (mountedRef.current) setRecentSearches(list);
      });
    },
    [runtime],
  );

  const clearRecentSearches = useCallback(() => {
    if (!runtime) return;
    void runtime.recentSearches.clear().then(() => {
      if (mountedRef.current) setRecentSearches([]);
    });
  }, [runtime]);

  return useMemo(
    () => ({
      draft,
      setDraft,
      filterKind,
      setFilterKind,
      state,
      loadMore,
      retry,
      recentSearches,
      selectRecentSearch,
      removeRecentSearch,
      clearRecentSearches,
    }),
    [draft, filterKind, state, loadMore, retry, recentSearches, selectRecentSearch, removeRecentSearch, clearRecentSearches],
  );
}

/** Exposed for tests that want to assert de-duplication behavior against the recent-searches list
 * without reaching into the hook's internals. */
export { foldForComparison };
