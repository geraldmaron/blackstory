/**
 * Builds the `/explore` map + list dataset from the active release (seed catalog until live
 * projections are wired — same posture as `../../data/public-seed.ts`). Reuses the
 * redaction-injected `buildMapSource` plus era and precision helpers from `@repo/domain`.
 * This module adds no redaction of its own; it only enriches already-redacted map features with
 * fields the map/list UI needs (name, era, one-line story, evidence count, confidence, and
 * precision-radius affordances).
 *
 * Jurisdiction area polygons: `buildJurisdictionAreaFeatures` is implemented and tested but has
 * no live caller yet — the active release has no law/area-condition entity kinds. When those
 * exist, map each record’s resolved jurisdiction bbox into `AreaRecordInput`. Area records must
 * render as polygon geometry, never as a point.
 */
import { redactLocationForPublic } from '@repo/security/redaction';
import { sanitizePublicProseText } from '@repo/domain';
import {
  buildMapSource,
  type MapCountyAggregate,
  type MapPointFeature,
  type MapSourceEntityInput,
  type MapStateAggregate,
} from '@repo/domain/map/map-source';
import type { GeoPrecisionTier } from '@repo/domain/geography/display-radius';
import type { PublicClaimView, PublicEntityView } from '../../data/public-seed';
import { geoAnchorFor as defaultGeoAnchorFor, type EntityGeoAnchor } from './entity-geo';
import { geoPrecisionTierForPublicPrecision, resolveDisplayRadiusMeters } from './geo-precision';
import { displayEncodingFor, resolveMapTone } from './kind-encoding';

export type ConfidenceTier = 'high' | 'medium' | 'low' | 'unrated';

/** Highest confidence tier among an entity's accepted claims a transparency affordance about
 * how strongly evidenced the record is, never a numeric score (ranking-signal ban). */
export function highestConfidence(claims: readonly PublicClaimView[]): ConfidenceTier {
  if (claims.some((claim) => claim.confidenceLevel === 'high')) return 'high';
  if (claims.some((claim) => claim.confidenceLevel === 'medium')) return 'medium';
  if (claims.some((claim) => claim.confidenceLevel === 'low')) return 'low';
  return 'unrated';
}

export type ExploreMapFeatureProperties = {
  readonly entityId: string;
  readonly href: string;
  readonly kind: string;
  readonly displayName: string;
  readonly oneLineStory: string;
  readonly precision: string;
  readonly geoPrecisionTier: GeoPrecisionTier;
  readonly radiusMeters?: number;
  readonly eraBuckets: readonly string[];
  readonly status?: string;
  readonly notabilityLabels: readonly string[];
  /** Count of this record's own already-publicly-enumerated accepted claims (see the entity
   * page's "Accepted claims" section) a transparency affordance, not a hidden ranking input. */
  readonly evidenceCount: number;
  readonly confidenceTier: ConfidenceTier;
  /** @deprecated Superseded by `topicIds` (the related workstream); kept for the facet builder's
   * fallback path. */
  readonly topicTags: readonly string[];
  /** Controlled historical-theme ids (the related workstream) — the ONLY field
   * `buildExploreFacetOptions` should treat as authoritative for the theme facet. */
  readonly topicIds?: readonly string[];
  /** Semantic tone override from topics (massacre / plantation / epicenter). */
  readonly mapTone?: string;
  /**
   * Denormalized kind/tone shade from `displayEncodingFor` — the same hex KindBadge paints.
   * Carried on the feature so MapLibre circle layers can `['get', 'shade']` without re-deriving
   * the encoding table at paint time (and so HTML hit-targets can match the GL fill).
   */
  readonly shade: string;
  /** Denormalized glyph identity from `displayEncodingFor` (WCAG non-color channel). */
  readonly glyph: string;
  readonly stateFips?: string;
  readonly statePostalCode?: string;
  readonly stateName?: string;
  /** Public location prose from the release (never a redacted residential exact). */
  readonly locationLabel?: string;
};

export type ExploreMapFeature = {
  readonly type: 'Feature';
  readonly id: string;
  readonly geometry: {
    readonly type: 'Point';
    readonly coordinates: readonly [lng: number, lat: number];
  };
  readonly properties: ExploreMapFeatureProperties;
};

export type ExploreMapFeatureCollection = {
  readonly type: 'FeatureCollection';
  readonly features: readonly ExploreMapFeature[];
};

/** Jurisdiction-scoped area records (laws, area conditions) render as polygon geometry,
 * never as a point — see the module header. */
export type AreaRecordInput = {
  readonly id: string;
  readonly href: string;
  readonly displayName: string;
  readonly kind: string;
  readonly jurisdictionBBox: readonly [west: number, south: number, east: number, north: number];
};

export type JurisdictionAreaFeature = {
  readonly type: 'Feature';
  readonly id: string;
  readonly geometry: {
    readonly type: 'Polygon';
    readonly coordinates: readonly (readonly (readonly [number, number])[])[];
  };
  readonly properties: {
    readonly entityId: string;
    readonly href: string;
    readonly displayName: string;
    readonly kind: string;
  };
};

/** Pure polygon builder for jurisdiction-scoped area records. Coarse (bbox-cornered) polygon
 * geometry only, matching this repo's existing state-bbox-not-survey-grade posture (ADR-013).
 * Callers supply live area records when projection data is available. */
export function buildJurisdictionAreaFeatures(
  records: readonly AreaRecordInput[],
): readonly JurisdictionAreaFeature[] {
  return records.map((record) => {
    const [west, south, east, north] = record.jurisdictionBBox;
    return {
      type: 'Feature',
      id: record.id,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ],
        ],
      },
      properties: {
        entityId: record.id,
        href: record.href,
        displayName: record.displayName,
        kind: record.kind,
      },
    };
  });
}

export type ExploreMapSourceMeta = {
  readonly totalEntities: number;
  readonly totalWithLocation: number;
  readonly totalFeatures: number;
  readonly skippedNoLocation: number;
  readonly skippedRedactedToNothing: number;
  readonly skippedOutsideUsBounds: number;
};

export type ExploreMapSource = {
  readonly schemaVersion: 1;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly featureCollection: ExploreMapFeatureCollection;
  readonly stateAggregates: readonly MapStateAggregate[];
  readonly countyAggregates: readonly MapCountyAggregate[];
  readonly jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly meta: ExploreMapSourceMeta;
};

export type BuildExploreMapSourceOptions = {
  readonly releaseId?: string;
  readonly generatedAt?: string;
  /** Test/DI seam production callers get the real `../../data/public-seed.ts`-scoped table.  */
  readonly geoAnchorFor?: (entityId: string) => EntityGeoAnchor | undefined;
  readonly jurisdictionAreaRecords?: readonly AreaRecordInput[];
};

function toMapSourceInput(entity: PublicEntityView, anchor: EntityGeoAnchor): MapSourceEntityInput {
  return {
    entityId: entity.id,
    kind: entity.kind,
    displayName: entity.displayName,
    // None of the active release's kinds (place/school/event/institution) are `person`; this is
    // inert for them, but explicit rather than omitted so a future person-kind addition to this
    // table can't silently skip the living-person redaction path by relying on an unset default.
    livingStatus: 'unknown',
    // Prefer curated jurisdiction over bbox state attribution (Manhattan must not become NJ).
    ...(entity.jurisdictionLabel.trim().length > 0
      ? { jurisdictionLabel: entity.jurisdictionLabel.trim() }
      : {}),
    location: {
      precision: entity.locationPrecision,
      lat: anchor.lat,
      lng: anchor.lng,
      geohash: anchor.geohash,
      matchMethod: anchor.matchMethod,
      ...(anchor.county ? { county: anchor.county } : {}),
    },
  };
}

function enrichFeature(feature: MapPointFeature, entity: PublicEntityView): ExploreMapFeature {
  const tier = geoPrecisionTierForPublicPrecision(feature.properties.precision);
  const radius = resolveDisplayRadiusMeters(tier, {
    ...(feature.properties.statePostalCode
      ? { statePostalCode: feature.properties.statePostalCode }
      : {}),
  });
  const mapTone = resolveMapTone({
    topicTags: entity.topicTags,
    ...(entity.topicIds !== undefined ? { topicIds: entity.topicIds } : {}),
    displayName: entity.displayName,
  });
  const encoding = displayEncodingFor(feature.properties.kind, mapTone);

  return {
    type: 'Feature',
    id: feature.id,
    geometry: feature.geometry,
    properties: {
      entityId: entity.id,
      href: `/entity/${entity.id}`,
      kind: feature.properties.kind,
      displayName: feature.properties.displayName,
      oneLineStory: sanitizePublicProseText(entity.summary),
      precision: feature.properties.precision,
      geoPrecisionTier: tier,
      ...(radius.ok ? { radiusMeters: radius.radiusMeters } : {}),
      eraBuckets: entity.eraBuckets ?? [],
      ...(entity.status !== undefined ? { status: entity.status } : {}),
      notabilityLabels: entity.notabilityLabels ?? [],
      evidenceCount: entity.claims.length,
      confidenceTier: highestConfidence(entity.claims),
      topicTags: entity.topicTags,
      ...(entity.topicIds !== undefined ? { topicIds: entity.topicIds } : {}),
      ...(mapTone !== undefined ? { mapTone } : {}),
      shade: encoding.shade,
      glyph: encoding.glyph,
      ...(feature.properties.stateFips ? { stateFips: feature.properties.stateFips } : {}),
      ...(feature.properties.statePostalCode
        ? { statePostalCode: feature.properties.statePostalCode }
        : {}),
      ...(feature.properties.stateName ? { stateName: feature.properties.stateName } : {}),
      ...(entity.locationLabel.trim().length > 0
        ? { locationLabel: entity.locationLabel.trim() }
        : {}),
    },
  };
}

/**
 * Builds the full explore map source from the active release. Every coordinate that reaches an
 * `ExploreMapFeature` is still, transitively, the return value of `redactLocationForPublic` (via
 * `buildMapSource`) — this function never reads a raw anchor lat/lng back out for output, only
 * passes it in as `buildMapSource`'s input.
 */
export function buildExploreMapSource(
  entities: readonly PublicEntityView[],
  options: BuildExploreMapSourceOptions = {},
): ExploreMapSource {
  const resolveAnchor = options.geoAnchorFor ?? defaultGeoAnchorFor;
  const releaseId = options.releaseId ?? 'seed-snapshot';
  const generatedAt = options.generatedAt ?? new Date(0).toISOString();

  const entityById = new Map(entities.map((entity) => [entity.id, entity] as const));
  const mapSourceEntities: MapSourceEntityInput[] = [];
  let skippedNoAnchor = 0;

  for (const entity of entities) {
    // Live projections carry their own public-precision anchor; the repo-side table is the
    // fallback for bundled seed fixtures only (see entity-geo.ts's retirement note).
    const anchor = entity.geoAnchor ?? resolveAnchor(entity.id);
    if (!anchor) {
      skippedNoAnchor += 1;
      continue;
    }
    mapSourceEntities.push(toMapSourceInput(entity, anchor));
  }

  const built = buildMapSource({
    releaseId,
    generatedAt,
    entities: mapSourceEntities,
    redactLocation: redactLocationForPublic,
  });

  const features = built.featureCollection.features.map((feature) => {
    const entity = entityById.get(feature.properties.entityId);
    if (!entity) {
      throw new Error(
        `buildExploreMapSource: feature "${feature.id}" has no matching active-release entity`,
      );
    }
    return enrichFeature(feature, entity);
  });

  return {
    schemaVersion: 1,
    releaseId,
    generatedAt,
    featureCollection: { type: 'FeatureCollection', features },
    stateAggregates: built.stateAggregates,
    countyAggregates: built.countyAggregates,
    jurisdictionAreaFeatures: buildJurisdictionAreaFeatures(options.jurisdictionAreaRecords ?? []),
    meta: {
      totalEntities: entities.length,
      totalWithLocation: entities.length - skippedNoAnchor,
      totalFeatures: features.length,
      skippedNoLocation: skippedNoAnchor + built.meta.skippedNoLocation,
      skippedRedactedToNothing: built.meta.skippedRedactedToNothing,
      skippedOutsideUsBounds: built.meta.skippedOutsideUsBounds,
    },
  };
}
