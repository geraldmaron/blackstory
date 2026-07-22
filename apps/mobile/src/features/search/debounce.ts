/**
 * Debounce primitive for search input (MOB-013 item 1/item 3).
 *
 * A pure, injectable-timer debouncer (same "inject every non-deterministic dependency" discipline
 * as apps/mobile/src/data/transport.ts's sleep/random injection) so rapid-typing behavior is
 * testable with fake timers, not real ones. `useDebouncedValue` is the thin React hook built on
 * top of it for the screen to consume.
 */
import { useEffect, useRef, useState } from 'react';

export interface DebounceTimers {
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
}

const REAL_TIMERS: DebounceTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface Debouncer<T> {
  /** Schedule `value` to be delivered after the debounce window. Superseded calls never fire. */
  schedule(value: T): void;
  /** Cancel any pending scheduled call without delivering it (e.g. on unmount). */
  cancel(): void;
}

/**
 * Creates a debouncer that calls `onFire` with the LAST value passed to `schedule` within any
 * `waitMs` window -- every call to `schedule` before the window elapses cancels the previous
 * pending timer and starts a fresh one (classic trailing-edge debounce), so a burst of rapid
 * keystrokes collapses to exactly one eventual call, never one per keystroke.
 */
export function createDebouncer<T>(
  onFire: (value: T) => void,
  waitMs: number,
  timers: DebounceTimers = REAL_TIMERS,
): Debouncer<T> {
  let handle: unknown = null;

  return {
    schedule(value: T) {
      if (handle !== null) {
        timers.clearTimeout(handle);
      }
      handle = timers.setTimeout(() => {
        handle = null;
        onFire(value);
      }, waitMs);
    },
    cancel() {
      if (handle !== null) {
        timers.clearTimeout(handle);
        handle = null;
      }
    },
  };
}

/**
 * React hook: returns the debounced value of `value`, updating only after `delayMs` of no
 * further change (trailing-edge). Used to gate when a normalized query change is allowed to fire
 * a network request -- rapid typing produces many `value` updates but only the last one, after a
 * quiet period, ever reaches the debounced output.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  const debouncerRef = useRef<Debouncer<T> | null>(null);

  if (debouncerRef.current === null) {
    debouncerRef.current = createDebouncer<T>((v) => setDebounced(v), delayMs);
  }

  useEffect(() => {
    debouncerRef.current?.schedule(value);
  }, [value]);

  useEffect(() => {
    return () => debouncerRef.current?.cancel();
  }, []);

  return debounced;
}
