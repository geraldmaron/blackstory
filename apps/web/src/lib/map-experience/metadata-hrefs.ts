/**
 * Pure helpers that build shareable hrefs for card and page metadata facets
 * (Where, Era, Kind, Evidence anchor). Callers render labels and optional links;
 * this module owns the URL contract only.
 *
 * Client-safe: only import `@repo/domain/map/geography` (pure reference data).
 * Do not import `@repo/domain` or `@repo/domain/entity-status` — those pull
 * `@repo/schemas` constitution loaders (`node:fs` / `node:crypto`) into the
 * Next client graph via NarrativeCard → ExploreMapExperience.
 */
import { findUsStateByPostalCode } from '@repo/domain/map/geography';
import { DEFAULT_EXPLORE_FILTERS } from './filters';
import {
  buildExploreHref,
  defaultExploreOverlayState,
  viewportForState,
  type ExploreViewState,
} from './url-state';

const ACCEPTED_CLAIMS_HASH = 'accepted-claims';

/**
 * Search `status=` tokens mirrored from `@repo/domain` entity-status vocabularies
 * (place-like + law + movement). Kept inline so this module stays browser-safe.
 */
const SEARCH_STATUS_TOKENS = new Set<string>([
  'active',
  'historic',
  'inactive',
  'in_force',
  'amended',
  'repealed',
  'struck_down',
  'enjoined',
]);

function buildDefaultExploreHref(extra: Partial<ExploreViewState> = {}): string {
  return buildExploreHref({
    filters: DEFAULT_EXPLORE_FILTERS,
    ...defaultExploreOverlayState(),
    ...extra,
  });
}

function normalizePostalCode(postalCode: string): string {
  return postalCode.trim().toUpperCase();
}

/** Explore filtered to a USPS state, with camera viewport when known. */
export function exploreHrefForState(postalCode: string): string {
  const normalized = normalizePostalCode(postalCode);
  if (!normalized || !findUsStateByPostalCode(normalized)) {
    return '/explore';
  }

  const viewport = viewportForState(normalized);
  return buildDefaultExploreHref({
    state: normalized,
    ...(viewport ? { viewport } : {}),
  });
}

/** Explore filtered to one era bucket label (e.g. `1860s`). No-op-ish empty → `/explore`. */
export function exploreHrefForEra(eraBucket: string): string {
  const trimmed = eraBucket.trim();
  if (!trimmed) {
    return '/explore';
  }

  return buildExploreHref({
    filters: { ...DEFAULT_EXPLORE_FILTERS, era: trimmed },
    ...defaultExploreOverlayState(),
  });
}

/** Explore filtered to entity kind token (e.g. `place`, `school`). */
export function exploreHrefForKind(kind: string): string {
  const trimmed = kind.trim();
  if (!trimmed) {
    return '/explore';
  }

  return buildExploreHref({
    filters: { ...DEFAULT_EXPLORE_FILTERS, kind: trimmed },
    ...defaultExploreOverlayState(),
  });
}

/**
 * Search filtered by status when the value is a real status filter token;
 * otherwise return undefined (caller renders plain text).
 */
export function searchHrefForStatus(status: string): string | undefined {
  const trimmed = status.trim();
  if (!trimmed || trimmed === 'all' || !SEARCH_STATUS_TOKENS.has(trimmed)) {
    return undefined;
  }

  const params = new URLSearchParams();
  params.set('status', trimmed);
  return `/search?${params.toString()}`;
}

/**
 * Hash link to the accepted-claims section on an entity page.
 * `entityHref` is typically `/entity/{id}` (may already have query).
 * Stable hash: `#accepted-claims`
 */
export function entityEvidenceHref(entityHref: string): string {
  const base = entityHref.split('#')[0] ?? entityHref;
  return `${base}#${ACCEPTED_CLAIMS_HASH}`;
}

/**
 * Label + optional href for era display.
 * - empty buckets → { label: 'Undated', href: undefined }
 * - one bucket → { label, href: exploreHrefForEra(bucket) }
 * - many → { label: `${first} – ${last}`, href: exploreHrefForEra(first) }
 */
export function eraFactLink(eraBuckets: readonly string[]): {
  readonly label: string;
  readonly href?: string;
} {
  const buckets = eraBuckets.map((bucket) => bucket.trim()).filter((bucket) => bucket.length > 0);
  if (buckets.length === 0) {
    return { label: 'Undated' };
  }

  if (buckets.length === 1) {
    const bucket = buckets[0]!;
    return { label: bucket, href: exploreHrefForEra(bucket) };
  }

  const first = buckets[0]!;
  const last = buckets[buckets.length - 1]!;
  return { label: `${first} – ${last}`, href: exploreHrefForEra(first) };
}
