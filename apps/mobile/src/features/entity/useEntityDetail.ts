/**
 * Fetch entity details when entityId changes or dependencies become available. Depend on
 * availability rather than dependency-object identity so an inline object cannot trigger an
 * unbounded fetch/render loop. Keep the screen's presentation separate from runtime effects.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEntityDetail, type EntityDataDeps, type EntityFetchResult } from './dataClient';

export type EntityDetailState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly result: Extract<EntityFetchResult, { status: 'ready' }> }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'offline-no-cache' }
  | { readonly kind: 'error'; readonly message: string };

function toState(result: EntityFetchResult): EntityDetailState {
  if (result.status === 'ready') return { kind: 'ready', result };
  if (result.status === 'not-found') return { kind: 'not-found' };
  if (result.status === 'offline-no-cache') return { kind: 'offline-no-cache' };
  return { kind: 'error', message: result.message };
}

export function useEntityDetail(entityId: string | null, deps: EntityDataDeps | undefined) {
  const [state, setState] = useState<EntityDetailState>({ kind: 'loading' });
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  // Always read the LATEST deps at call time, without making the effect below depend on its
  // object identity (see module header). Synced in its OWN effect (never written directly in
  // the render body — React's rules-of-hooks lint correctly flags a same-render ref write as
  // unsafe) that runs on every commit, declared BEFORE the fetch-triggering effect so it
  // always applies first within the same commit.
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });

  const load = useCallback(async () => {
    const currentDeps = depsRef.current;
    if (!entityId || !currentDeps) return;
    setState({ kind: 'loading' });
    try {
      const result = await fetchEntityDetail(entityId, currentDeps);
      if (mounted.current) setState(toState(result));
    } catch {
      // fetchEntityDetail is designed never to throw, but a screen must never crash even if a
      // future change to it regresses that guarantee.
      if (mounted.current) {
        setState({
          kind: 'error',
          message: 'Couldn’t load this record. Check your connection and try again.',
        });
      }
    }
  }, [entityId]);

  const depsAvailable = deps !== undefined;
  useEffect(() => {
    load();
    // Intentionally keyed on `depsAvailable` (a boolean), not `deps` (an object reference) —
    // see module header. `load` itself only changes when `entityId` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, depsAvailable]);

  return { state, retry: load };
}
