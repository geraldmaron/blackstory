/**
 * Maps legacy `/search` query params onto the unified `/history` URL contract.
 * Preserves keyword + facet filters; drops search-only pagination when unmapped.
 */
import type { RawHistorySearchParams } from './url-state';

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === 'string') return raw;
  return raw[0];
}

/** Build a `/history` href from incoming `/search` searchParams. */
export function mapSearchQueryToHistoryHref(
  raw: RawHistorySearchParams,
): string {
  const params = new URLSearchParams();
  const q = (firstValue(raw.q) ?? '').trim();
  if (q) params.set('q', q);

  for (const key of ['kind', 'status', 'era', 'topic'] as const) {
    const value = (firstValue(raw[key]) ?? '').trim();
    if (value && value !== 'all') params.set(key, value);
  }

  const offset = (firstValue(raw.offset) ?? '').trim();
  if (offset && offset !== '0') params.set('offset', offset);

  const qs = params.toString();
  return qs ? `/history?${qs}` : '/history';
}
