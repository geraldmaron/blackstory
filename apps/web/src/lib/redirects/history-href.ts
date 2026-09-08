/**
 * Maps an incoming `/history` query onto the `/records` URL contract.
 *
 * `/history` keeps a filesystem route instead of a `next.config.mjs` rule for one reason: it has
 * to turn `decade` into `era`, and a config redirect can forward a query string but cannot
 * transform a value. A config rule would also match first and leave no later hook, so the route
 * can never be deleted — cached 308s from every other fold point at it.
 *
 * The destination is always `/records`. Resolving to `/records` for some params and to Explore
 * for others would mean the same bookmark lands in two different rooms depending on an
 * incidental extra key.
 */

import { decadeParamToEra } from '@repo/public-contracts/discovery';

import { historyKindToRecordsKind } from '../history/filters';

export type RawHistoryRedirectParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === 'string') return raw;
  return raw[0];
}

/**
 * The decade-to-era transform, from the shared discovery vocabulary.
 *
 * Re-exported rather than reimplemented: the native `/history` screen performs the same hop, and
 * two copies of "what counts as a valid decade" is how a link shared from the phone and the same
 * link opened on the site end up on different views.
 */
export { decadeParamToEra };

/** Build the one-hop `/records` href for incoming `/history` searchParams. */
export function mapHistoryQueryToRecordsHref(raw: RawHistoryRedirectParams): string {
  const params = new URLSearchParams();
  const q = (firstValue(raw.q) ?? '').trim();
  if (q) params.set('q', q);

  for (const key of ['kind', 'status', 'topic'] as const) {
    const value = (firstValue(raw[key]) ?? '').trim();
    if (!value || value === 'all') continue;
    if (key === 'kind') {
      params.set('kind', historyKindToRecordsKind(value));
      continue;
    }
    params.set(key, value);
  }

  // An explicit `era` is already in the destination vocabulary, so it wins. Two temporal
  // constraints cannot merge into one param, and dropping the reader's explicit one to honor a
  // derived one would widen the result set they asked to narrow.
  const explicitEra = (firstValue(raw.era) ?? '').trim();
  const era =
    explicitEra && explicitEra !== 'all' ? explicitEra : decadeParamToEra(firstValue(raw.decade));
  if (era) params.set('era', era);

  const qs = params.toString();
  return qs ? `/records?${qs}` : '/records';
}
