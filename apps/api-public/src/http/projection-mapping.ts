/** Maps immutable release projections into the public API contract. */
import {
  buildGraphTimeline,
  findUsStateForPoint,
  isUndatedTimelineEntry,
  normalizePublicPrecision,
} from '@repo/domain';
import type { TimelineEventV1 } from '@repo/public-contracts/v1/timeline';
import {
  ENTITY_KINDS,
  entityV1Schema,
  LOCATION_PRECISIONS,
  type EntityV1,
} from '@repo/public-contracts/v1/entity';
import type { ClaimV1 } from '@repo/public-contracts/v1/claim';
import type { PublicClaimProjectionDoc, PublicEntityProjectionDoc } from '@repo/ops-data';

/** Bounds entity-collection fallback reads when no `publicSearchIndex` rows exist for the active
 * release (MOB-004 safety net — not the primary search path). Index-backed search uses the
 * release-scoped query in `./postgres-readers.ts`'s `listPublicSearchIndexDocs`. */
export const MAX_LIVE_SEARCH_SCAN = 500;

const SUPPORTED_KINDS = new Set<string>(ENTITY_KINDS);

/** View claims render a nominal score alongside the level chip; the projection carries only the
 * level (non-numeric public-payload policy), so the score here is the level's register midpoint —
 * a display value, never a stored ranking. Matches `apps/web`'s `NOMINAL_CONFIDENCE_SCORE`. */
const NOMINAL_CONFIDENCE_SCORE: Record<'high' | 'medium' | 'low', number> = {
  high: 0.85,
  medium: 0.6,
  low: 0.4,
};

/** The empty lookup makes every neighbor resolve to its own id — see the module doc: resolving
 * display names would mean reading each related entity's projection per request. */
const NO_NEIGHBOR_LOOKUP: ReadonlyMap<string, { readonly displayName: string }> = new Map();

/**
 * Timeline for the wire DTO, built from the projection's own evidence-backed time records.
 * `atLabel` keeps the display-ready label; `at` is present only when the underlying precision
 * genuinely supports an ISO timestamp, per the `timelineEventV1Schema` contract.
 */
function mapTimeline(projection: PublicEntityProjectionDoc): TimelineEventV1[] {
  return buildGraphTimeline(
    {
      id: projection.id,
      displayName: projection.displayName,
      ...(projection.statusHistory !== undefined
        ? { statusHistory: projection.statusHistory }
        : {}),
      ...(projection.related !== undefined ? { related: projection.related } : {}),
    },
    NO_NEIGHBOR_LOOKUP,
  )
    .filter((entry) => !isUndatedTimelineEntry(entry))
    .map((entry) => ({
      id: entry.id,
      atLabel: entry.time,
      ...(entry.at !== undefined ? { at: entry.at } : {}),
      datePrecision: entry.datePrecision,
      title: entry.title,
      body: entry.body,
    }));
}

/**
 * `EntityV1['locationPrecision']` deliberately stays the 4-tier wire subset (city/neighborhood/
 * campus/institution — see entity.ts's module doc: "never 'address' or 'exact'"). The location
 * precision standard's finer `site`/`address` tiers, and its coarser `state`/`county`, all
 * collapse to `city` here they publish at full tier on the website (`@repo/domain`'s
 * `normalizePublicPrecision` + `apps/web`'s `map-projection.ts`), not over this API contract.
 */
function mapLocationPrecision(precision: string | undefined): EntityV1['locationPrecision'] {
  const normalized = normalizePublicPrecision(precision);
  return (LOCATION_PRECISIONS as readonly string[]).includes(normalized)
    ? (normalized as EntityV1['locationPrecision'])
    : 'city';
}

/**
 * Preserve stored country labels until republish. Coordinate fallback uses overlapping state
 * bounding boxes and cannot reliably replace a broad label near a border. Empty and Unknown
 * labels may use the fallback.
 */
function isUsableStoredJurisdictionLabel(label: string | undefined): boolean {
  const trimmed = label?.trim() ?? '';
  if (trimmed.length === 0) return false;
  return !/^unknown(\s+jurisdiction)?$/iu.test(trimmed);
}

function resolveJurisdictionLabel(projection: PublicEntityProjectionDoc): string {
  const explicit = projection.jurisdictionLabel?.trim();
  if (explicit && isUsableStoredJurisdictionLabel(explicit)) {
    return explicit;
  }
  const lat = projection.location?.lat;
  const lng = projection.location?.lng;
  if (typeof lat === 'number' && typeof lng === 'number') {
    const state = findUsStateForPoint(lat, lng);
    if (state) return state.name;
  }
  return 'Unknown';
}

function mapClaims(claims: readonly PublicClaimProjectionDoc[] | undefined): ClaimV1[] {
  return (claims ?? []).map((claim) => ({
    id: claim.id,
    predicate: claim.predicate,
    object: claim.object,
    confidenceScore: NOMINAL_CONFIDENCE_SCORE[claim.confidenceLevel],
    confidenceLevel: claim.confidenceLevel,
    citation: {
      source: claim.citationSource,
      label: claim.citationLabel,
      ...(claim.citationHref !== undefined ? { href: claim.citationHref } : {}),
    },
    ...(claim.independentLineageCount !== undefined
      ? { independentLineageCount: claim.independentLineageCount }
      : {}),
    ...(claim.claimRole !== undefined ? { claimRole: claim.claimRole } : {}),
  }));
}

/** Maps one public entity projection onto the `EntityV1` wire DTO, or `undefined` when the
 * projection's kind is out of the v1 API's scope or the mapped result fails contract validation
 * (never thrown — both collapse to the same "not available" signal callers already treat
 * identically to unpublished/nonexistent per T3). Exported for direct unit testing. */
export function mapProjectionToEntityV1(
  projection: PublicEntityProjectionDoc,
): EntityV1 | undefined {
  if (!SUPPORTED_KINDS.has(projection.kind)) {
    return undefined;
  }

  const location = projection.location;
  const claims = mapClaims(projection.claims);
  // Match web `mapGeoAnchor`: location with lat/lng is enough; default matchMethod
  // when the projection omitted it (optional on the storage schema).
  const geoAnchor =
    location && typeof location.lat === 'number' && typeof location.lng === 'number'
      ? {
          lat: location.lat,
          lng: location.lng,
          geohash: location.geohash,
          matchMethod: location.matchMethod ?? 'release_projection',
        }
      : undefined;

  const candidate: EntityV1 = {
    id: projection.id,
    kind: projection.kind as EntityV1['kind'],
    displayName: projection.displayName,
    summary: projection.summary,
    topicTags: projection.topicTags ?? [],
    jurisdictionLabel: resolveJurisdictionLabel(projection),
    locationPrecision: mapLocationPrecision(location?.precision),
    locationLabel: projection.locationLabel ?? projection.displayName,
    relevanceExplanation:
      claims.length > 0
        ? 'Included as a documented site in the active public release; each accepted claim below cites its source.'
        : 'No sourced claims have been accepted for this record yet. It is listed because it is part of the active public release, and it will carry its evidence here as research lands.',
    /*
     * Empty, not a note about the publication pipeline. Substituting build-status prose here
     * made every unenriched record render a "Historical context" chapter whose content was a
     * sentence about the release process — the page asserted it had context and then spent a
     * numbered section saying it did not. Empty lets the section collapse and the gap be
     * disclosed once, in the record's own "Still being researched" list.
     */
    historicalContext: projection.historicalContext ?? '',
    recordMaturity: claims.length > 0 ? 'partial_enrichment' : 'projection_stub',
    researchCoverage: projection.researchCoverage ?? (claims.length >= 2 ? 'partial' : 'minimal'),
    claims,
    timeline: mapTimeline(projection),
    revision: {
      releaseId: projection.releaseId,
      generatedAt: projection.generatedAt ?? '',
      recordUpdatedAt: projection.recordUpdatedAt ?? '',
    },
    ...(projection.status !== undefined ? { status: projection.status } : {}),
    ...(projection.eraBuckets !== undefined ? { eraBuckets: [...projection.eraBuckets] } : {}),
    ...(projection.notabilityLabels !== undefined
      ? { notabilityLabels: [...projection.notabilityLabels] }
      : {}),
    ...(projection.sensitivityClass !== undefined
      ? { sensitivityClass: projection.sensitivityClass }
      : {}),
    ...(projection.extendedNarrative !== undefined
      ? { extendedNarrative: projection.extendedNarrative }
      : {}),
    ...(projection.primaryImage !== undefined ? { primaryImage: projection.primaryImage } : {}),
    ...(geoAnchor !== undefined ? { geoAnchor } : {}),
    ...(projection.related !== undefined
      ? {
          related: projection.related.map((entry) => ({
            id: entry.id,
            type: entry.type,
            direction: entry.direction,
            ...(entry.timespan !== undefined ? { timespan: entry.timespan } : {}),
          })),
        }
      : {}),
  };

  const parsed = entityV1Schema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}
