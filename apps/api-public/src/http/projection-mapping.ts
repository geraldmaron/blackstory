/**
 * Maps a `PublicEntityProjectionDoc` (the storage-neutral `bb_public` projection shape, shared with
 * `apps/web/src/lib/public-data/map-projection.ts`) onto the public-contracts `EntityV1` wire DTO.
 *
 * This mapping used to live in `./firestore-data-access.ts` alongside the Firestore-specific client
 * plumbing; it moved here when the Firestore read path was removed (repo-348e.3 / ADR-020 cutover)
 * because `./postgres-data-access.ts` — the only remaining live adapter — depends on it too.
 *
 * Mapping a projection onto `EntityV1` is lossy by design, honestly:
 * - `kind` must be in the full public ontology (`ENTITY_KINDS` / ADR-015). A projection whose
 *   `kind` falls outside that set maps to `undefined`, which — same as an unpublished or
 *   nonexistent id — the handler cannot distinguish from a 404 (T3).
 * - Inline `claims` on the projection map through when present; bootstrap-window stubs that carry
 *   only `claimIds` still emit `claims: []`. No per-claim reads are added here.
 * - `timeline` is not carried on the projection — always `[]` until a release-builder field exists
 *   (same as `apps/web`'s `map-projection.ts`).
 * - `related` neighbor entries map straight from the projection's own `related` array (ids/types/
 *   direction/timespan only). `relatedNeighbors`/`continueLearning` (denormalized neighbor display
 *   fields) are deliberately NOT hydrated here: doing so would require reading every related
 *   entity's own projection per request — an N+1 read amplification the bead's adversarial review
 *   explicitly flags as a case to defend against, not introduce.
 * - Fields absent on bootstrap-window stubs (`jurisdictionLabel`, `locationLabel`,
 *   `researchCoverage`, revision timestamps) fall back to the same honest placeholders
 *   `apps/web`'s `map-projection.ts` uses — never fabricated curated content.
 */
import { findUsStateForPoint } from '@repo/domain';
import { ENTITY_KINDS, entityV1Schema, type EntityV1 } from '@repo/public-contracts/v1/entity';
import type { ClaimV1 } from '@repo/public-contracts/v1/claim';
import type { PublicClaimProjectionDoc, PublicEntityProjectionDoc } from '@repo/firebase';

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

function mapLocationPrecision(
  precision: string | undefined,
): EntityV1['locationPrecision'] {
  if (precision === 'neighborhood' || precision === 'campus' || precision === 'institution') {
    return precision;
  }
  return 'city';
}

function isDisplayableJurisdictionLabel(label: string | undefined): boolean {
  const trimmed = label?.trim() ?? '';
  if (trimmed.length === 0) return false;
  return !/^unknown$/iu.test(trimmed);
}

function resolveJurisdictionLabel(projection: PublicEntityProjectionDoc): string {
  const explicit = projection.jurisdictionLabel?.trim();
  if (explicit && isDisplayableJurisdictionLabel(explicit)) {
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
  }));
}

/** Maps one public entity projection onto the `EntityV1` wire DTO, or `undefined` when the
 * projection's kind is out of the v1 API's scope or the mapped result fails contract validation
 * (never thrown — both collapse to the same "not available" signal callers already treat
 * identically to unpublished/nonexistent per T3). Exported for direct unit testing. */
export function mapProjectionToEntityV1(projection: PublicEntityProjectionDoc): EntityV1 | undefined {
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
        : 'This record is served from the live public release projection. Supporting claims and ' +
          'evidence panels may still be sparse until the full publication pipeline lands.',
    historicalContext:
      projection.historicalContext ??
      'Live projection scaffolding — historical framing expands as curated release content is published.',
    recordMaturity: claims.length > 0 ? 'partial_enrichment' : 'projection_stub',
    researchCoverage:
      projection.researchCoverage ?? (claims.length >= 2 ? 'partial' : 'minimal'),
    claims,
    timeline: [],
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
