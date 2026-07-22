/**
 * The core adversarial suite for MOB-013's search orchestration. `search-controller.ts` is
 * intentionally framework-free specifically so these async-ordering tests can control promise
 * resolution order directly, without React Testing Library timers.
 */
import { createSearchController, type SearchControllerState } from '../search-controller';
import { TransportError } from '@/data';
import { buildRuntime, fakeReleaseCache, flushMicrotasks, makeControllableTransport, page } from '../test-support';

function collectStates(): { states: SearchControllerState[]; onChange: (s: SearchControllerState) => void } {
  const states: SearchControllerState[] = [];
  return { states, onChange: (s) => states.push(s) };
}

describe('query threshold gate (MOB-013 item 2 / T3 empty-query enumeration)', () => {
  it('never calls the transport for a query below MIN_QUERY_LENGTH (browse mode)', () => {
    const { transport, calls } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);
    const { states, onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    controller.setQuery('', undefined);
    controller.setQuery('a', undefined); // 1 char, below MIN_QUERY_LENGTH (2)

    expect(calls).toEqual([]);
    expect(states.every((s) => s.kind === 'browse')).toBe(true);
    controller.dispose();
  });

  it('DOES call the transport once the threshold is reached', async () => {
    const { transport, calls, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);
    const { onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    controller.setQuery('ha', undefined);
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
    resolveNext(page());
    await flushMicrotasks();
    controller.dispose();
  });

  it('browse mode offers no request path capable of bulk enumeration: repeated empty-query calls never accumulate any transport call', () => {
    const { transport, calls } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);
    const { onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    for (let i = 0; i < 50; i++) {
      controller.setQuery('', undefined);
    }
    expect(calls).toHaveLength(0);
    controller.dispose();
  });
});

describe('cancellation via MOB-009 createSupersedingRunner (not reimplemented)', () => {
  it('a new setQuery aborts the prior in-flight request', async () => {
    const { transport, calls } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);
    const { states, onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    controller.setQuery('harriet', undefined);
    await flushMicrotasks();
    controller.setQuery('harriet t', undefined); // supersedes the first, in flight
    await flushMicrotasks();

    expect(calls).toHaveLength(2);
    // The superseded first call must never surface as an error state (silently dropped).
    expect(states.some((s) => s.kind === 'error')).toBe(false);
    controller.dispose();
  });
});

describe('stale-page race guard (MOB-013 item 8: a slow earlier response cannot overwrite a newer one)', () => {
  it('drops a stale, out-of-order response even when the transport does NOT honor cancellation', async () => {
    // Non-cooperative: proves the GENERATION counter alone (not abort) prevents the stale
    // response from ever being applied.
    const { transport, calls, resolveCallAt } = makeControllableTransport({ cooperative: false });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);
    const { states, onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    controller.setQuery('first query', undefined); // generation 1, call[0]
    await flushMicrotasks();
    controller.setQuery('second query', undefined); // generation 2, call[1]
    await flushMicrotasks();

    expect(calls).toEqual(['/v1/search?q=first+query&pageSize=20', '/v1/search?q=second+query&pageSize=20']);

    // Resolve OUT OF ORDER: the newer request (call[1]) finishes first...
    resolveCallAt(1, page({ results: [{ ...page().results[0], id: 'ent_second', displayName: 'Second Result' }] }));
    await flushMicrotasks();
    // ...then the STALE first request (call[0]) resolves late.
    resolveCallAt(0, page({ results: [{ ...page().results[0], id: 'ent_first', displayName: 'First Result' }] }));
    await flushMicrotasks();

    const final = states[states.length - 1];
    expect(final.kind).toBe('results');
    if (final.kind === 'results') {
      // The final state must reflect the SECOND (newer) query, never the stale first one.
      expect(final.query).toBe('second query');
      expect(final.results[0].displayName).toBe('Second Result');
    }
    controller.dispose();
  });
});

describe('cursor reuse across a release change (MOB-013 item 8, threat-model T5)', () => {
  it('never sends a cursor minted under a superseded release; resets to a fresh page 1 instead', async () => {
    const { transport, calls, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);
    const { states, onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    controller.setQuery('tubman', undefined);
    await flushMicrotasks();
    resolveNext(page({ hasMore: true, nextCursor: 'cursor-under-r1' }));
    await flushMicrotasks();

    const afterFirstPage = states[states.length - 1];
    expect(afterFirstPage.kind).toBe('results');
    if (afterFirstPage.kind === 'results') {
      expect(afterFirstPage.cursor).toBe('cursor-under-r1');
      expect(afterFirstPage.cursorStamp).toBe('r1');
    }

    // The release advances (e.g. a correction/retraction publishes a new release) BEFORE the
    // user pages further.
    releaseCache.setStamp('r2');

    controller.loadMore();
    await flushMicrotasks();

    // The request that was actually sent must NOT carry the stale cursor.
    const loadMoreCall = calls[calls.length - 1];
    expect(loadMoreCall).not.toContain('cursor=cursor-under-r1');
    expect(loadMoreCall).toContain('q=tubman');

    resolveNext(page({ hasMore: false }));
    await flushMicrotasks();

    const final = states[states.length - 1];
    expect(final.kind).toBe('results');
    if (final.kind === 'results') {
      // Reset to a FRESH page 1 -- results replaced, not appended to the stale page.
      expect(final.results).toHaveLength(1);
      expect(final.cursorStamp).toBe('r2');
    }
    controller.dispose();
  });

  it('sends the cursor normally when the release stamp has NOT changed', async () => {
    const { transport, calls, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);
    const { onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    controller.setQuery('tubman', undefined);
    await flushMicrotasks();
    resolveNext(page({ hasMore: true, nextCursor: 'cursor-under-r1' }));
    await flushMicrotasks();

    controller.loadMore();
    await flushMicrotasks();

    expect(calls[calls.length - 1]).toContain('cursor=cursor-under-r1');
    resolveNext(page({ hasMore: false }));
    await flushMicrotasks();
    controller.dispose();
  });
});

describe('offline / cached-compatible-release fallback (ADR-022 §3, threat-model T7)', () => {
  it('serves a cached page, labeled degraded, when the network fails and a compatible cache entry exists', async () => {
    const { transport, resolveNext, rejectNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);
    const { states, onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    // First, a successful fetch populates the cache under stamp r1.
    controller.setQuery('tubman', undefined);
    await flushMicrotasks();
    resolveNext(page());
    await flushMicrotasks();
    expect(states[states.length - 1].kind).toBe('results');

    // Now the SAME query is re-issued (e.g. user retypes it) and the network fails.
    controller.setQuery('tubman', undefined);
    await flushMicrotasks();
    rejectNext(new TransportError('offline', { kind: 'network', attempts: 4 }));
    await flushMicrotasks();

    const final = states[states.length - 1];
    expect(final.kind).toBe('results');
    if (final.kind === 'results') {
      expect(final.freshness.source).toBe('cache');
      expect(final.freshness.degraded).toBe(true); // MUST be labeled -- never presented as live
    }
    controller.dispose();
  });

  it('shows an explicit offline state (never a live-looking empty/hang) when there is no compatible cache', async () => {
    const { transport, rejectNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache(undefined); // no stamp yet -- first launch, nothing cached
    const { runtime } = buildRuntime(transport, releaseCache);
    const { states, onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    controller.setQuery('nobody has searched this before', undefined);
    await flushMicrotasks();
    rejectNext(new TransportError('offline', { kind: 'network', attempts: 4 }));
    await flushMicrotasks();

    expect(states[states.length - 1].kind).toBe('offline-empty');
    controller.dispose();
  });
});

describe('recent-search recording', () => {
  it('records a term only after a successful, non-empty result -- never on every keystroke or on failure', async () => {
    const { transport, resolveNext, rejectNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime, recentAdds } = buildRuntime(transport, releaseCache);
    const { onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    controller.setQuery('will fail', undefined);
    await flushMicrotasks();
    rejectNext(new TransportError('offline', { kind: 'network', attempts: 4 }));
    await flushMicrotasks();
    expect(recentAdds).toEqual([]);

    controller.setQuery('will succeed', undefined);
    await flushMicrotasks();
    resolveNext(page());
    await flushMicrotasks();
    expect(recentAdds).toEqual(['will succeed']);
    controller.dispose();
  });

  it('does not record an empty-result search', async () => {
    const { transport, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime, recentAdds } = buildRuntime(transport, releaseCache);
    const { states, onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    controller.setQuery('no matches for this', undefined);
    await flushMicrotasks();
    resolveNext(page({ results: [] }));
    await flushMicrotasks();

    expect(states[states.length - 1].kind).toBe('empty');
    expect(recentAdds).toEqual([]);
    controller.dispose();
  });
});

describe('ranking-signal leak propagation into controller state', () => {
  it('surfaces a leaked ranking field as an error state, never as rendered results', async () => {
    const { transport, resolveNext } = makeControllableTransport({ cooperative: true });
    const releaseCache = fakeReleaseCache('r1');
    const { runtime } = buildRuntime(transport, releaseCache);
    const { states, onChange } = collectStates();
    const controller = createSearchController(runtime, onChange);

    controller.setQuery('tubman', undefined);
    await flushMicrotasks();
    resolveNext(page({ results: [{ ...page().results[0], relevanceScore: 0.99 } as never] }));
    await flushMicrotasks();

    expect(states[states.length - 1].kind).toBe('error');
    controller.dispose();
  });
});
