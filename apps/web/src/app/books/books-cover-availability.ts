/**
 * Which Open Library covers exist, decided on the server so the cover wall never asks the
 * browser for one that 404s (each such request is a console error). A HEAD request to the same
 * `default=false` URL the page would load; a missing cover answers 404.
 *
 * Fails open: a timeout or network error counts as "has a cover", and the image's own onError
 * still swaps in the typeset cover.
 */
import { openLibraryCoverUrl } from './books-cover';

// shortcut: per-process memory, never expires; a cover added upstream shows after a restart or redeploy.
const known = new Map<string, Promise<boolean>>();

async function probe(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
    });
    return response.status !== 404;
  } catch {
    return true;
  }
}

/** The ISBNs among `isbns` whose cover at `size` loads. */
export async function isbnsWithCovers(
  isbns: readonly (string | undefined)[],
  size: 'S' | 'M' | 'L' = 'M',
): Promise<ReadonlySet<string>> {
  const unique = [...new Set(isbns.filter((isbn): isbn is string => !!isbn))];
  const results = await Promise.all(
    unique.map((isbn) => {
      const url = openLibraryCoverUrl(isbn, size);
      let pending = known.get(url);
      if (!pending) {
        pending = probe(url);
        known.set(url, pending);
      }
      return pending;
    }),
  );
  return new Set(unique.filter((_, index) => results[index]));
}
