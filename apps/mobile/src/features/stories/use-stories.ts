/**
 * Hooks over `story-client.ts`, in the same shape as `useEntityDetail`: a state union the screen
 * renders exhaustively, and a `retry`. Dependencies arrive once from the app runtime.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRuntimeEntityDataDeps } from '@/features/entity/dataClient';
import {
  fetchStory,
  fetchStoryList,
  type StoryDataDeps,
  type StoryFetchResult,
} from './story-client';

export type LoadState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly result: Extract<StoryFetchResult<T>, { status: 'ready' }> }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'offline-no-cache' }
  | { readonly kind: 'error'; readonly message: string };

function toState<T>(result: StoryFetchResult<T>): LoadState<T> {
  if (result.status === 'ready') return { kind: 'ready', result };
  if (result.status === 'not-found') return { kind: 'not-found' };
  if (result.status === 'offline-no-cache') return { kind: 'offline-no-cache' };
  return { kind: 'error', message: result.message };
}

function useRuntimeDeps(): StoryDataDeps | undefined {
  const [deps, setDeps] = useState<StoryDataDeps>();
  useEffect(() => {
    let live = true;
    createRuntimeEntityDataDeps().then(
      (value) => {
        if (live) setDeps(value);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  return deps;
}

function useLoad<T>(key: string, load: (deps: StoryDataDeps) => Promise<StoryFetchResult<T>>) {
  const deps = useRuntimeDeps();
  const [state, setState] = useState<LoadState<T>>({ kind: 'loading' });
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  // The first load starts from the initial `loading` state; only a retry resets it.
  const run = useCallback(async () => {
    if (!deps) return;
    try {
      const result = await loadRef.current(deps);
      if (mounted.current) setState(toState(result));
    } catch {
      if (mounted.current) {
        setState({ kind: 'error', message: 'Couldn’t load this. Check your connection and try again.' });
      }
    }
  }, [deps]);

  useEffect(() => {
    run();
    // Keyed on what is being loaded, not on the loader's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, deps]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    return run();
  }, [run]);

  return { state, retry };
}

export function useStoryList() {
  return useLoad('stories', fetchStoryList);
}

export function useStory(slug: string) {
  return useLoad(`story:${slug}`, (deps) => fetchStory(slug, deps));
}
