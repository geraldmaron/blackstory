/**
 * Route-neutral discovery vocabulary: the concepts every surface narrows the archive by, and the
 * pure conversions that keep them meaning the same thing everywhere.
 *
 * WHY THIS IS SHARED. Web's `/records`, web's `/history` fold, the Explore filters, the native
 * Records tab and the native Explore instruments all narrow the same archive by the same five
 * ideas — a query, a record kind, an era, a place, an evidence floor. Each surface had grown its
 * own parser and its own idea of what a valid value was, so a decade typed on the phone and a
 * decade typed on the site could disagree about whether `1935` meant anything.
 *
 * WHAT IS NOT HERE. Route shapes, param names in any particular URL, and which fields a given
 * surface chooses to expose. Web and native keep their own route adapters: Records shows an
 * evidence floor and Explore does not, and that is each surface's call, not this module's.
 */

/** The narrowing concepts every discovery surface shares. Not every surface exposes all five. */
export const DISCOVERY_FIELDS = ['q', 'kind', 'era', 'place', 'evidenceFloor'] as const;
export type DiscoveryField = (typeof DISCOVERY_FIELDS)[number];

/** The longest free-text query any surface accepts. Longer input is truncated, never rejected. */
export const MAX_DISCOVERY_QUERY_LENGTH = 120;

/** Normalize free text: trimmed, collapsed, and bounded. Empty means "no query". */
export function normalizeDiscoveryQuery(raw: string | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_DISCOVERY_QUERY_LENGTH);
}

/** `1930s` is the era bucket label; `1930` is the shape people type and bookmark. */
const DECADE_LABEL_PATTERN = /^(\d{4})s?$/;

/**
 * Normalize a decade to an era bucket label: `1930` and `1930s` both yield `1930s`.
 *
 * Anything else yields undefined, so a junk decade drops out rather than becoming a chip that
 * matches no record. `all` is the explicit "no narrowing" value and is treated as absent.
 *
 * This is the value transform behind every legacy `/history` address on both platforms. It is a
 * transform rather than a plain forward, which is why `/history` keeps a real route on web and a
 * real screen on native instead of a config-level redirect rule.
 */
export function decadeParamToEra(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === 'all') return undefined;
  const match = DECADE_LABEL_PATTERN.exec(trimmed);
  if (!match) return undefined;
  const startYear = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(startYear) || startYear % 10 !== 0) return undefined;
  return `${startYear}s`;
}

/** True when a value means "no narrowing on this field" on any surface. */
export function isUnsetDiscoveryValue(raw: string | undefined): boolean {
  const trimmed = (raw ?? '').trim();
  return trimmed.length === 0 || trimmed === 'all';
}
