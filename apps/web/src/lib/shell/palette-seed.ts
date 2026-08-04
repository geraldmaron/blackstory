/**
 * The 404's hand-off to the bar search: turn the path a reader mistyped into a query they can
 * search with, and publish it to the shell.
 *
 * A reader who lands on `/chapters/tulsa-race-masacre` typed something real and got nothing. The
 * path is the best guess anyone has at what they wanted, so the bar's search opens holding it
 * (design-direction-v9-surfaces.md §"/_not-found"). What the bar must never hold is the path
 * verbatim: an arbitrary URL segment rendered into a search field is a reflected-content vector,
 * and `value` on a controlled input is not the only place that text ends up — it goes back out as
 * a `/search/api` query too. `sanitizePaletteSeed` is therefore a whitelist, not an escape: only
 * letters, digits and single spaces survive, and everything else is dropped rather than encoded.
 *
 * The store is module-level rather than a context because the two parties sit in different
 * subtrees — the seed is published by the 404 page inside `ds-shell-body`, and read by the search
 * in the bar above it — and threading a provider through the root layout to connect them would
 * put a client boundary around every room to serve one.
 */

/** Long enough for a real mistyped title, short enough that nothing large is round-tripped. */
const MAX_SEED_LENGTH = 64;

/**
 * A path to words. `/chapters/tulsa-race-massacre` becomes `chapters tulsa race massacre`.
 *
 * Percent-escapes are decoded first so that `%2Fscript` cannot smuggle a separator past the
 * whitelist; a malformed escape sequence throws in `decodeURIComponent`, and that is treated as
 * "no seed at all" rather than as text worth salvaging.
 */
export function sanitizePaletteSeed(rawPath: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return '';
  }

  return (
    decoded
      .replace(/[?#].*$/, '')
      // Anything that is not a letter, digit or space becomes a space: separators (`/`, `-`, `_`)
      // become word breaks, and markup, quotes and control characters simply cease to exist.
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .slice(0, MAX_SEED_LENGTH)
      .trim()
  );
}

type Listener = () => void;

let seed = '';
const listeners = new Set<Listener>();

/** Publishes a seed for the bar search. Pass `''` to clear it. */
export function setPaletteSeed(next: string): void {
  if (next === seed) return;
  seed = next;
  for (const listener of listeners) listener();
}

export function getPaletteSeed(): string {
  return seed;
}

/** Server render has no seed: the 404 that publishes one is a client effect. */
export function getServerPaletteSeed(): string {
  return '';
}

export function subscribeToPaletteSeed(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
