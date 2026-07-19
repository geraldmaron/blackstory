/**
 * Maps Firestore public entity projections onto the web `PublicEntityView` shape.
 * Renders live projection data as-is without enrichment from bundled seed records.
 */

import { type NotabilityCriterion } from '@repo/domain';
import { type PublicEntityView } from '../../data/public-seed';

/**
 * Narrow projection shape used by the web mapper. Declared locally so apps/web
 * does not depend on potentially stale `@repo/firebase` dist `.d.ts` files
 * during typecheck (package exports prefer `types` → `dist`).
 */
export type PublicProjectionInput = {
  readonly id: string;
  readonly releaseId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly nameLower: string;
  readonly summary?: string;
  readonly location?: {
    readonly lat: number;
    readonly lng: number;
    readonly geohash: string;
    readonly precision?: string;
    readonly matchMethod?: string;
  };
  readonly claimIds: readonly string[];
  /** State/city jurisdiction label carried by release projections (national-catalog era);
   * absent on bootstrap-window stubs, where the seed enrichment supplies it instead. */
  readonly jurisdictionLabel?: string;
  readonly locationLabel?: string;
  /** Accepted public claims with citations. Non-numeric by standing policy: the projection
   * carries `confidenceLevel` (the display register), never a raw confidence score. */
  readonly claims?: readonly {
    readonly id: string;
    readonly predicate: string;
    readonly object: string;
    readonly confidenceLevel: 'high' | 'medium' | 'low';
    readonly citationSource: string;
    readonly citationHref?: string;
    readonly citationLabel: string;
    readonly independentLineageCount?: number;
  }[];
  readonly status?: string;
  readonly eraBuckets?: readonly string[];
  readonly notabilityLabels?: readonly string[];
  /** Structured, auditable inclusion basis (the related workstream's release builder). Present on
   * releases built by `buildReleaseEntityArtifacts`; absent on pre-existing bootstrap-window
   * stubs, which carry only the derived `notabilityLabels` above. */
  readonly notabilityBasis?: readonly {
    readonly criterion: NotabilityCriterion;
    readonly note: string;
    readonly evidenceIds: readonly string[];
  }[];
  /** Research-depth signal computed once at release-build time (the related workstream). Absent on
   * pre-existing bootstrap-window stubs. */
  readonly researchCoverage?: 'minimal' | 'partial' | 'substantial';
  /** Real release-build-time timestamps (the related workstream). Absent on pre-existing
   * bootstrap-window stubs, which predate the release builder that populates these. */
  readonly generatedAt?: string;
  readonly recordUpdatedAt?: string;
  readonly sensitivityClass?: string;
  readonly topicTags?: readonly string[];
  readonly historicalContext?: string;
  readonly extendedNarrative?: string;
  readonly primaryImage?: {
    readonly url: string;
    readonly alt: string;
    readonly credit: string;
    readonly rightsStatus: 'public_domain' | 'licensed' | 'fair_use';
    readonly width?: number;
    readonly height?: number;
    readonly objectPath?: string;
  };
  readonly related?: readonly {
    readonly id: string;
    readonly type: string;
    readonly direction: 'outgoing' | 'incoming';
    readonly timespan?: {
      readonly label?: string;
      readonly validFrom?: string;
      readonly validTo?: string | null;
    };
  }[];
};

function locationPrecisionFromProjection(
  precision: string | undefined,
): PublicEntityView['locationPrecision'] {
  if (precision === 'neighborhood' || precision === 'campus' || precision === 'institution') {
    return precision;
  }
  return 'city';
}

/** View claims render a nominal score alongside the level chip; the projection carries only the
 * level (non-numeric public-payload policy), so the score here is the level's register midpoint —
 * a display value, never a stored ranking. */
const NOMINAL_CONFIDENCE_SCORE: Record<'high' | 'medium' | 'low', number> = {
  high: 0.85,
  medium: 0.6,
  low: 0.4,
};

function mapClaims(claims: PublicProjectionInput['claims']): PublicEntityView['claims'] {
  return (claims ?? []).map((claim) => ({
    id: claim.id,
    predicate: claim.predicate,
    object: claim.object,
    confidenceScore: NOMINAL_CONFIDENCE_SCORE[claim.confidenceLevel],
    confidenceLevel: claim.confidenceLevel,
    citationSource: claim.citationSource,
    ...(claim.citationHref !== undefined ? { citationHref: claim.citationHref } : {}),
    citationLabel: claim.citationLabel,
    ...(claim.independentLineageCount !== undefined
      ? { independentLineageCount: claim.independentLineageCount }
      : {}),
  }));
}

function mapGeoAnchor(
  location: PublicProjectionInput['location'],
): PublicEntityView['geoAnchor'] {
  if (!location) return undefined;
  return {
    lat: location.lat,
    lng: location.lng,
    geohash: location.geohash,
    matchMethod: location.matchMethod ?? 'release_projection',
  };
}

function mapPrimaryImage(
  image: PublicProjectionInput['primaryImage'],
): PublicEntityView['primaryImage'] {
  if (!image) return undefined;
  return {
    url: image.url,
    alt: image.alt,
    credit: image.credit,
    rightsStatus: image.rightsStatus,
    ...(image.width !== undefined ? { width: image.width } : {}),
    ...(image.height !== undefined ? { height: image.height } : {}),
    ...(image.objectPath !== undefined ? { objectPath: image.objectPath } : {}),
  };
}

/**
 * Convert a public projection doc into a page-ready view.
 * Renders live projection data as-is without enrichment from bundled seed records.
 */
export function mapProjectionToPublicEntityView(
  projection: PublicProjectionInput,
): PublicEntityView {
  const summary = projection.summary && projection.summary.trim().length > 0 ? projection.summary : '';
  const topicTags = projection.topicTags && projection.topicTags.length > 0 ? projection.topicTags : [];
  const primaryImage = mapPrimaryImage(projection.primaryImage);
  const geoAnchor = mapGeoAnchor(projection.location);
  const claims = mapClaims(projection.claims);

  const lat = projection.location?.lat;
  const lng = projection.location?.lng;
  const mapPin =
    typeof lat === 'number' && typeof lng === 'number'
      ? {
          x: Math.min(1, Math.max(0, (lng + 125) / 60)),
          y: Math.min(1, Math.max(0, (50 - lat) / 25)),
        }
      : { x: 0.5, y: 0.5 };

  return {
    id: projection.id,
    kind: projection.kind as PublicEntityView['kind'],
    displayName: projection.displayName,
    summary,
    era: projection.eraBuckets?.[0] ?? 'unknown',
    ...(projection.status !== undefined ? { status: projection.status } : {}),
    ...(projection.eraBuckets !== undefined ? { eraBuckets: projection.eraBuckets } : {}),
    notabilityLabels:
      projection.notabilityLabels && projection.notabilityLabels.length > 0
        ? projection.notabilityLabels
        : ['A documented site in the active public release.'],
    ...(projection.notabilityBasis !== undefined
      ? { notabilityBasis: projection.notabilityBasis }
      : {}),
    ...(projection.sensitivityClass !== undefined
      ? { sensitivityClass: projection.sensitivityClass }
      : {}),
    topicTags,
    jurisdictionLabel: projection.jurisdictionLabel ?? 'Unknown',
    locationPrecision: locationPrecisionFromProjection(projection.location?.precision),
    locationLabel: projection.locationLabel ?? projection.displayName,
    relevanceExplanation:
      claims.length > 0
        ? 'Included as a documented site in the active public release; each accepted claim below cites its source.'
        : 'This record is served from the live public release projection. Supporting claims and evidence panels may still be sparse until the full publication pipeline lands.',
    historicalContext:
      projection.historicalContext ??
      'Live projection scaffolding — historical framing expands as curated release content is published.',
    ...(projection.extendedNarrative !== undefined
      ? { extendedNarrative: projection.extendedNarrative }
      : {}),
    ...(primaryImage !== undefined ? { primaryImage } : {}),
    ...(geoAnchor !== undefined ? { geoAnchor } : {}),
    recordMaturity: claims.length > 0 ? 'partial_enrichment' : 'projection_stub',
    // Prefer the release builder's own computed researchCoverage (the related workstream,
    // packages/domain/src/publication/release-builder.ts's computeReleaseResearchCoverage) —
    // it is derived from the real claim count + citation completeness at release-BUILD time.
    // The claims.length heuristic below is only a fallback for bootstrap-window stubs that
    // predate the release builder and never carried this field.
    researchCoverage: projection.researchCoverage ?? (claims.length >= 2 ? 'partial' : 'minimal'),
    mapPin,
    claims,
    timeline: [],
    revision: {
      releaseId: projection.releaseId,
      // Prefer the release builder's real "this release build ran at this instant" timestamps
      // (the related workstream) when present. Bootstrap-window stubs that predate the release builder
      // carry neither field; '' is an honest "unknown", never a fabricated "now".
      generatedAt: projection.generatedAt ?? '',
      recordUpdatedAt: projection.recordUpdatedAt ?? '',
    },
    relatedIds: projection.related?.map((entry) => entry.id) ?? [],
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
}
