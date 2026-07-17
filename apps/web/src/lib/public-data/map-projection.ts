/**
 * Maps Firestore public entity projections onto the web `PublicEntityView` shape.
 * Projections are thinner than seed fixtures; seed enrichment fills display gaps
 * when the same entity id exists in the bundled catalog.
 */

import { getPublicEntity, type PublicEntityView } from '../../data/public-seed';

/**
 * Narrow projection shape used by the web mapper. Declared locally so apps/web
 * does not depend on potentially stale `@black-book/firebase` dist `.d.ts` files
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
  };
  readonly claimIds: readonly string[];
  readonly status?: string;
  readonly eraBuckets?: readonly string[];
  readonly notabilityLabels?: readonly string[];
  readonly sensitivityClass?: string;
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

/**
 * Convert a public projection doc into a page-ready view.
 * Prefer bundled seed fields when present so UI sections stay populated during
 * the bootstrap window when Firestore only holds projection stubs.
 */
export function mapProjectionToPublicEntityView(
  projection: PublicProjectionInput,
): PublicEntityView {
  const seed = getPublicEntity(projection.id);
  if (seed) {
    return {
      ...seed,
      displayName: projection.displayName,
      summary: projection.summary ?? seed.summary,
      revision: {
        releaseId: projection.releaseId,
        generatedAt: seed.revision.generatedAt,
        recordUpdatedAt: seed.revision.recordUpdatedAt,
      },
      ...(projection.status !== undefined ? { status: projection.status } : {}),
      ...(projection.eraBuckets !== undefined ? { eraBuckets: projection.eraBuckets } : {}),
      ...(projection.notabilityLabels !== undefined
        ? { notabilityLabels: projection.notabilityLabels }
        : {}),
      ...(projection.sensitivityClass !== undefined
        ? { sensitivityClass: projection.sensitivityClass }
        : {}),
      ...(projection.related !== undefined
        ? {
            related: projection.related.map((entry) => ({
              id: entry.id,
              type: entry.type,
              direction: entry.direction,
              ...(entry.timespan !== undefined ? { timespan: entry.timespan } : {}),
            })),
            relatedIds: projection.related.map((entry) => entry.id),
          }
        : {}),
    };
  }

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
    summary: projection.summary ?? '',
    era: projection.eraBuckets?.[0] ?? 'unknown',
    ...(projection.status !== undefined ? { status: projection.status } : {}),
    ...(projection.eraBuckets !== undefined ? { eraBuckets: projection.eraBuckets } : {}),
    ...(projection.notabilityLabels !== undefined
      ? { notabilityLabels: projection.notabilityLabels }
      : {}),
    ...(projection.sensitivityClass !== undefined
      ? { sensitivityClass: projection.sensitivityClass }
      : {}),
    topicTags: [],
    jurisdictionLabel: 'Unknown',
    locationPrecision: locationPrecisionFromProjection(projection.location?.precision),
    locationLabel: projection.displayName,
    relevanceExplanation:
      'This record is served from the live public release projection. Supporting claims and evidence panels may still be sparse until the full publication pipeline lands.',
    historicalContext:
      'Live projection scaffolding — historical framing expands as curated release content is published.',
    recordMaturity: 'projection_stub',
    researchCoverage: 'minimal',
    mapPin,
    claims: [],
    timeline: [],
    revision: {
      releaseId: projection.releaseId,
      generatedAt: new Date().toISOString(),
      recordUpdatedAt: new Date().toISOString(),
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
