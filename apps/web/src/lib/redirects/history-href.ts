/**
 * Maps an incoming `/history` query onto the `/records` URL contract.
 *
 * `/history` keeps a filesystem route instead of a `next.config.mjs` rule for one reason: it has
 * to turn `decade` into `era`, and a config redirect can forward a query string but cannot
 * transform a value. A config rule would also match first and leave no later hook, so the route
 * can never be deleted — cached 308s from every other fold point at it.
 *
 * The destination is always `/records`. Resolving to `/records` for some params and to the Atlas
 * for others would mean the same bookmark lands in two different rooms depending on an
 * incidental extra key.
 */

/** `/history` accepts `1930s`; a bare `1930` is the shape people type and bookmark. */
const DECADE_LABEL_PATTERN = /^(\d{4})s?$/;

export type RawHistoryRedirectParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === 'string') return raw;
  return raw[0];
}

/**
 * Normalise a `decade` param to an era bucket label: `1930` and `1930s` both yield `1930s`.
 * Anything else yields undefined, so a junk decade drops out rather than becoming a chip that
 * matches no record.
 */
export function decadeParamToEra(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === 'all') return undefined;
  const match = DECADE_LABEL_PATTERN.exec(trimmed);
  if (!match) return undefined;
  const startYear = Number.parseInt(match[1]!, 10);
  if (startYear % 10 !== 0) return undefined;
  return `${startYear}s`;
}

/** Build the one-hop `/records` href for incoming `/history` searchParams. */
export function mapHistoryQueryToRecordsHref(raw: RawHistoryRedirectParams): string {
  const params = new URLSearchParams();
  const q = (firstValue(raw.q) ?? '').trim();
  if (q) params.set('q', q);

  for (const key of ['kind', 'status', 'topic'] as const) {
    const value = (firstValue(raw[key]) ?? '').trim();
    if (value && value !== 'all') params.set(key, value);
  }

  // An explicit `era` is already in the destination vocabulary, so it wins. Two temporal
  // constraints cannot merge into one param, and dropping the reader's explicit one to honour a
  // derived one would widen the result set they asked to narrow.
  const explicitEra = (firstValue(raw.era) ?? '').trim();
  const era =
    explicitEra && explicitEra !== 'all' ? explicitEra : decadeParamToEra(firstValue(raw.decade));
  if (era) params.set('era', era);

  const qs = params.toString();
  return qs ? `/records?${qs}` : '/records';
}
