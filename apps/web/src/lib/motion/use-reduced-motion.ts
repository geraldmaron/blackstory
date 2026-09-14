/**
 * React-facing, live `prefers-reduced-motion` (repo-92n2.18).
 *
 * A `useSyncExternalStore` wrapper OVER `components/map-stage/reduced-motion-listener.ts`'s
 * imperative listener — never a second `matchMedia(...).addEventListener('change', ...)`. That
 * listener's header explains why: its consumer is imperative code inside a requestAnimationFrame
 * callback and deliberately isn't a hook, so this file is the actual React API components call,
 * and two independent subscriptions to one media query is the duplicate-variant failure this
 * repo's rules forbid.
 *
 * One listener instance is created lazily on first use and shared by every component that calls
 * this hook, so N components asking "is reduced motion on" cost one subscription between them,
 * not N. `MapMomentStage`'s own imperative listener (created directly from
 * `reduced-motion-listener.ts`) stays separate on purpose — re-rendering the whole plate subtree
 * on a preference flip that only needs an animation callback to read a different boolean is
 * exactly what that module's header says a hook must not do.
 */
'use client';

import { useSyncExternalStore } from 'react';
import {
  createReducedMotionListener,
  type ReducedMotionListener,
} from '../../components/map-stage/reduced-motion-listener';

let shared: ReducedMotionListener | undefined;

/** Exported for the singleton-sharing test below; not meant for other call sites. */
export function getSharedReducedMotionListener(): ReducedMotionListener {
  shared ??= createReducedMotionListener();
  return shared;
}

/** Test seam: force a fresh shared listener on the next call. */
export function __resetSharedReducedMotionListenerForTests(): void {
  shared = undefined;
}

/** `useSyncExternalStore`'s three arguments, exported so the wiring is testable without a
 * React renderer — this codebase's convention for a hook this thin (see `use-focus-trap.ts`). */
export function subscribe(onStoreChange: () => void): () => void {
  return getSharedReducedMotionListener().subscribe(onStoreChange);
}

export function getSnapshot(): boolean {
  return getSharedReducedMotionListener().matches();
}

/** Server render assumes no accessibility preference is known, same default the listener uses. */
export function getServerSnapshot(): boolean {
  return false;
}

/**
 * Whether the reader currently prefers reduced motion — live for the session. Enabling the OS
 * preference mid-session re-renders every component that calls this hook without a reload;
 * disabling it does the same.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
