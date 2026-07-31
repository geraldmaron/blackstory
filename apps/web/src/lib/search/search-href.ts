/**
 * Maps an incoming `/search` query onto the `/records` URL contract.
 *
 * `/search` cannot be a `next.config.mjs` rule: a config redirect matches on path and can only
 * forward a query string verbatim, and `q` has to survive while the search-only params must not.
 * So the filesystem route runs and calls this, which is also what keeps the hop count at one —
 * `/search?q=tulsa` resolves to `/records?q=tulsa` directly, never via `/history`.
 *
 * Carried: `q`, `kind`, `status`, `era`, `topic` — the vocabulary both surfaces share.
 * Dropped: the `all` sentinel, which means "no constraint" and would render as an active chip;
 * and `offset`, because `/records` pages with `?page=N` at 100 rows and no offset value maps
 * onto a page boundary without silently moving the reader.
 */

/** The filter keys `/search` and `/records` both understand, in canonical URL order. */
export const SEARCH_TO_RECORDS_PARAM_KEYS = ['kind', 'status', 'era', 'topic'] as const;

export type RawSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === 'string') return raw;
  return raw[0];
}

/** Build the one-hop `/records` href for incoming `/search` searchParams. */
export function mapSearchQueryToRecordsHref(raw: RawSearchParams): string {
  const params = new URLSearchParams();
  const q = (firstValue(raw.q) ?? '').trim();
  if (q) params.set('q', q);

  for (const key of SEARCH_TO_RECORDS_PARAM_KEYS) {
    const value = (firstValue(raw[key]) ?? '').trim();
    if (value && value !== 'all') params.set(key, value);
  }

  const qs = params.toString();
  return qs ? `/records?${qs}` : '/records';
}
