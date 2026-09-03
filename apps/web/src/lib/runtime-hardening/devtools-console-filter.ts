/**
 * Dev-only filter for a known React DevTools extension bug.
 *
 * DevTools' `installHook.js` logs "React instrumentation encountered an error: ... We are
 * cleaning up async info that was not on the parent Suspense boundary" whenever a
 * Suspense-boundary route (e.g. `/explore`, via loading.tsx) swaps its content post-mount.
 * The call stack is entirely inside the extension; it only reproduces with the extension
 * installed, and only surfaces because Next's dev overlay promotes every console.error to
 * an on-screen "1 Issue" badge. https://github.com/vercel/next.js/discussions/84973
 *
 * A plain `console.error = wrapped` is not enough: Next's overlay assigns its own
 * interceptor *after* the client instrumentation hook runs, and that interceptor records the
 * issue before delegating. So the filter is installed as an accessor property. Any later
 * assignment lands underneath the filter, and every read (including DevTools' own call) goes
 * through it first.
 */

const KNOWN_BUG_MARKERS = [
  'react instrumentation encountered an error',
  'cleaning up async info that was not on the parent suspense boundary',
] as const;

function argText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  return '';
}

/** True when any console argument carries the DevTools async-boundary bug text. */
export function isKnownDevtoolsBug(args: readonly unknown[]): boolean {
  return args.some((arg) => {
    const lower = argText(arg).toLowerCase();
    return KNOWN_BUG_MARKERS.some((marker) => lower.includes(marker));
  });
}

type ConsoleLike = Pick<Console, 'error'>;

/**
 * Install the filter on `target.error`. Later assignments to `target.error` (Next's overlay,
 * React DevTools, test harnesses) are kept as the inner handler and still run for every
 * message that is not the known bug. Re-entrant calls (a later patch that captured the filter
 * as its "original" and calls back into it) fall through to the native method so the chain
 * cannot recurse.
 */
export function installDevtoolsConsoleFilter(target: ConsoleLike): void {
  const native = target.error;
  let inner: Console['error'] = native;
  let depth = 0;

  const filtered = function error(this: unknown, ...args: unknown[]): void {
    if (isKnownDevtoolsBug(args)) return;
    if (depth > 0) {
      native.apply(target, args);
      return;
    }
    depth += 1;
    try {
      inner.apply(target, args);
    } finally {
      depth -= 1;
    }
  };

  Object.defineProperty(target, 'error', {
    configurable: true,
    enumerable: true,
    get: () => filtered,
    set: (next: unknown) => {
      inner = typeof next === 'function' ? (next as Console['error']) : native;
    },
  });
}
