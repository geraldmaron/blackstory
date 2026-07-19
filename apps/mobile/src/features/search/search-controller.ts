/**
 * Framework-free search orchestration (MOB-013 items 2/3/5/8).
 *
 * Deliberately NOT a React hook -- the adversarial requirements here (stale-page races, cursor
 * reuse across a release change, cancellation) are async-ordering problems, not rendering
 * problems, and are far more reliably tested as plain async logic with a fake runtime and
 * manually-controlled promise resolution order than through React Testing Library timers.
 * `useSearch.ts` is the thin hook wrapper that wires this controller's `onChange` callback into
 * React state.
 *
 * Cancellation: EVERY fetch this controller starts (a fresh query OR a load-more page) goes
 * through the SAME `runtime.run` (MOB-009's `createSupersedingRunner`) slot, so a new keystroke
 * cancels an in-flight "load more" exactly as it would cancel an in-flight fresh search, and vice
 * versa -- there is only ever one live request for this controller at a time.
 *
 * Race guard: a monotonic `generation` counter is bumped on every `setQuery`/`loadMore` call.
 * A completing fetch whose captured generation no longer matches the controller's current one is
 * discarded UNCONDITIONALLY, even if it "succeeded" -- this is on top of (not a replacement for)
 * AbortController cancellation, so correctness holds even against a transport/test-double that
 * does not honor abort signals faithfully (MOB-013 item 8's "a slow earlier page response can't
 * overwrite a newer one").
 *
 * Cursor/release-stamp guard: every page this controller accepts is tagged with the client's
 * active release stamp AT THE TIME it was fetched (`cursorStamp`). `/v1/search` responses do not
 * carry a release stamp themselves (searchResponseV1Schema has no such field --
 * verified against packages/public-contracts/src/v1/search.ts and
 * apps/api-public/src/http/handlers.ts's response construction), so this controller supplies one
 * from `ReleaseCache.getActiveStamp()` (the same global stamp `bootstrap-sync.ts` maintains).
 * Before ever sending a stored `cursor` back to the server, `loadMore` re-reads the CURRENT active
 * stamp and compares it to `cursorStamp`; on any mismatch the cursor is never sent -- the
 * controller resets to a fresh page-1 fetch of the same query instead (T5: never reuse a cursor
 * minted under a superseded release, never silently return mismatched data).
 */
import { TransportError, type ReleaseCache } from '@/data';
import { getSearchMode } from './query-normalization';
import type { SearchRuntime } from './search-runtime';
import {
  DEFAULT_SEARCH_PAGE_SIZE,
  RankingSignalLeakError,
  assertNoRankingSignal,
  buildQueryShapeKey,
  buildSearchRequestPath,
  type SearchFacetCountsV1,
  type SearchResponseV1,
  type SearchResultV1,
} from './search-contracts';

export interface SearchFreshness {
  readonly source: 'network' | 'cache';
  readonly fetchedAt: number;
  /** True when served from cache while offline/degraded -- the UI MUST label this, never present
   * it as live (ADR-022 §3/§6, threat-model T7). */
  readonly degraded: boolean;
}

export type SearchControllerState =
  | { readonly kind: 'browse' }
  | { readonly kind: 'loading'; readonly query: string; readonly filterKind?: string }
  | {
      readonly kind: 'results';
      readonly query: string;
      readonly filterKind?: string;
      readonly results: readonly SearchResultV1[];
      readonly facets: SearchFacetCountsV1;
      readonly totalMatched: number;
      readonly hasMore: boolean;
      readonly cursor?: string;
      readonly cursorStamp?: string;
      readonly freshness: SearchFreshness;
      readonly loadingMore: boolean;
      readonly loadMoreError?: string;
    }
  | { readonly kind: 'empty'; readonly query: string; readonly filterKind?: string; readonly degraded: boolean }
  | { readonly kind: 'error'; readonly query: string; readonly filterKind?: string; readonly message: string }
  | { readonly kind: 'offline-empty'; readonly query: string; readonly filterKind?: string };

export interface SearchController {
  getState(): SearchControllerState;
  /** `query` MUST already be normalized + debounced by the caller (useSearch.ts owns that). */
  setQuery(query: string, filterKind: string | undefined): void;
  loadMore(): void;
  retry(): void;
  dispose(): void;
}

class OfflineNoCacheError extends Error {
  constructor(reason: string) {
    super(`offline with no usable cache: ${reason}`);
    this.name = 'OfflineNoCacheError';
  }
}

function isSupersededAbort(err: unknown): boolean {
  return err instanceof TransportError && err.info.kind === 'aborted';
}

/** Network transport failures AND exhausted-retry HTTP failures both degrade to "try the cache" --
 * from the user's perspective, "can't get fresh results right now" reads the same either way, and
 * ADR-004's degraded-snapshot posture ("entity pages must remain serveable if live APIs are
 * disabled") applies identically to a live outage as to a true offline device. */
function isConnectivityLikeFailure(err: unknown): boolean {
  return err instanceof TransportError && (err.info.kind === 'network' || err.info.kind === 'http');
}

function describeError(err: unknown): string {
  if (err instanceof TransportError) {
    switch (err.info.kind) {
      case 'network':
        return 'Could not reach the server.';
      case 'http':
        return `The server returned an error${err.info.status ? ` (${err.info.status})` : ''}.`;
      case 'too-large':
        return 'The server response was unexpectedly large.';
      case 'parse':
        return 'The server response could not be read.';
      default:
        return 'Something went wrong.';
    }
  }
  if (err instanceof RankingSignalLeakError) {
    return 'The server response could not be read.';
  }
  return 'Something went wrong.';
}

interface FetchedPage {
  readonly results: readonly SearchResultV1[];
  readonly facets: SearchFacetCountsV1;
  readonly totalMatched: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
  readonly stamp?: string;
  readonly freshness: SearchFreshness;
}

function toFetchedPage(
  data: SearchResponseV1,
  stamp: string | undefined,
  freshness: SearchFreshness,
): FetchedPage {
  return {
    results: data.results,
    facets: data.facets,
    totalMatched: data.totalMatched,
    hasMore: data.hasMore,
    nextCursor: data.nextCursor,
    stamp,
    freshness,
  };
}

async function readCachedPage(
  releaseCache: ReleaseCache,
  cacheKey: string,
  activeStamp: string,
  degraded: boolean,
): Promise<FetchedPage | undefined> {
  const cached = await releaseCache.read<SearchResponseV1>('search', cacheKey, {
    activeStamp,
    degraded,
    now: Date.now(),
  });
  if (!cached) return undefined;
  return toFetchedPage(cached.value, activeStamp, cached.freshness);
}

/**
 * Fetches one page (fresh query or `cursor`-continued), enforcing the ranking-signal guarantee,
 * the release-coupled cache write/read, and the offline/cache-fallback behavior. Every call goes
 * through `runtime.run`, so it always occupies the one shared cancellation slot.
 */
async function fetchPage(
  runtime: SearchRuntime,
  params: { readonly query: string; readonly kind?: string; readonly cursor?: string },
): Promise<FetchedPage> {
  const shapeKey = buildQueryShapeKey({ query: params.query, kind: params.kind });
  const cacheKey = `${runtime.hashQueryShape(shapeKey)}${params.cursor ? `:p:${params.cursor}` : ''}`;
  const path = buildSearchRequestPath({
    query: params.query,
    kind: params.kind,
    cursor: params.cursor,
    pageSize: DEFAULT_SEARCH_PAGE_SIZE,
  });

  try {
    const result = await runtime.run((signal) => runtime.transport.readJson<SearchResponseV1>(path, { signal }));
    if (result.kind !== 'ok') {
      // We never send an `If-None-Match` for search requests, so a 304 is not expected on this
      // path; treat it the same as "no fresh data" rather than assuming a shape we didn't ask for.
      throw new OfflineNoCacheError('unexpected not-modified response');
    }

    // Runtime backstop (MOB-013 item 6): verify the ACTUAL parsed payload before anything
    // downstream (cache write, UI mapping) ever sees it, rather than trusting the contract from a
    // distance.
    assertNoRankingSignal(result.data.results as unknown as Record<string, unknown>[]);

    const activeStamp = (await runtime.releaseCache.getActiveStamp()) ?? 'unstamped';
    const fetchedAt = Date.now();
    try {
      await runtime.releaseCache.write('search', cacheKey, result.data, {
        releaseStamp: activeStamp,
        fetchedAt,
        etag: result.etag,
      });
    } catch {
      // Best-effort cache write. A PayloadTooLargeError or NeverCacheViolation must never fail an
      // already-successful live search -- the user still sees fresh results; we simply don't get
      // an offline copy of this particular page.
    }

    return toFetchedPage(result.data, activeStamp, { source: 'network', fetchedAt, degraded: false });
  } catch (err) {
    if (isSupersededAbort(err)) throw err;
    if (err instanceof RankingSignalLeakError) throw err;
    if (!isConnectivityLikeFailure(err) && !(err instanceof OfflineNoCacheError)) throw err;

    const activeStamp = await runtime.releaseCache.getActiveStamp();
    if (!activeStamp) throw new OfflineNoCacheError('no known release stamp yet');
    const cached = await readCachedPage(runtime.releaseCache, cacheKey, activeStamp, true);
    if (!cached) throw new OfflineNoCacheError('no compatible cached page for this query');
    return cached;
  }
}

export function createSearchController(
  runtime: SearchRuntime,
  onChange: (state: SearchControllerState) => void,
): SearchController {
  let state: SearchControllerState = { kind: 'browse' };
  let generation = 0;
  let disposed = false;

  function setState(next: SearchControllerState): void {
    state = next;
    if (!disposed) onChange(state);
  }

  function bumpGeneration(): number {
    generation += 1;
    return generation;
  }

  function isCurrent(gen: number): boolean {
    return !disposed && gen === generation;
  }

  async function runFreshQuery(query: string, filterKind: string | undefined, gen: number): Promise<void> {
    try {
      const page = await fetchPage(runtime, { query, kind: filterKind });
      if (!isCurrent(gen)) return; // superseded by a newer call -- discard even a "successful" result
      if (page.results.length === 0) {
        setState({ kind: 'empty', query, filterKind, degraded: page.freshness.degraded });
        return;
      }
      setState({
        kind: 'results',
        query,
        filterKind,
        results: page.results,
        facets: page.facets,
        totalMatched: page.totalMatched,
        hasMore: page.hasMore,
        cursor: page.nextCursor,
        cursorStamp: page.stamp,
        freshness: page.freshness,
        loadingMore: false,
      });
      // Record the term only on a real, successful, non-empty result -- never on every keystroke,
      // never on an error/offline outcome.
      void runtime.recentSearches.add(query).catch(() => {});
    } catch (err) {
      if (!isCurrent(gen)) return;
      if (isSupersededAbort(err)) return; // intentional supersession, not a user-facing failure
      if (err instanceof OfflineNoCacheError) {
        setState({ kind: 'offline-empty', query, filterKind });
      } else {
        setState({ kind: 'error', query, filterKind, message: describeError(err) });
      }
    }
  }

  function setQuery(query: string, filterKind: string | undefined): void {
    const gen = bumpGeneration(); // always bump: cancels whatever (search or load-more) was in flight
    if (getSearchMode(query) === 'browse') {
      setState({ kind: 'browse' });
      return;
    }
    setState({ kind: 'loading', query, filterKind });
    void runFreshQuery(query, filterKind, gen);
  }

  function loadMore(): void {
    if (state.kind !== 'results' || state.loadingMore || !state.hasMore || !state.cursor) return;
    const current = state;
    const gen = bumpGeneration();
    setState({ ...current, loadingMore: true, loadMoreError: undefined });

    void (async () => {
      try {
        const currentStamp = await runtime.releaseCache.getActiveStamp();
        if (!isCurrent(gen)) return;

        if (!currentStamp || currentStamp !== current.cursorStamp) {
          // T5: the release advanced (or we never had a stamp) since this cursor was minted.
          // Never send it -- reset to a fresh page 1 for the same query/filter instead.
          await runFreshQuery(current.query, current.filterKind, gen);
          return;
        }

        const page = await fetchPage(runtime, {
          query: current.query,
          kind: current.filterKind,
          cursor: current.cursor,
        });
        if (!isCurrent(gen)) return;
        setState({
          kind: 'results',
          query: current.query,
          filterKind: current.filterKind,
          results: [...current.results, ...page.results],
          facets: page.facets,
          totalMatched: page.totalMatched,
          hasMore: page.hasMore,
          cursor: page.nextCursor,
          cursorStamp: page.stamp,
          freshness: page.freshness,
          loadingMore: false,
        });
      } catch (err) {
        if (!isCurrent(gen)) return;
        if (isSupersededAbort(err)) return;
        if (state.kind === 'results') {
          setState({ ...state, loadingMore: false, loadMoreError: describeError(err) });
        }
      }
    })();
  }

  function retry(): void {
    if (state.kind === 'error' || state.kind === 'offline-empty' || state.kind === 'empty') {
      setQuery(state.query, state.filterKind);
    } else if (state.kind === 'results' && state.loadMoreError) {
      loadMore();
    }
  }

  return {
    getState: () => state,
    setQuery,
    loadMore,
    retry,
    dispose() {
      disposed = true;
    },
  };
}
