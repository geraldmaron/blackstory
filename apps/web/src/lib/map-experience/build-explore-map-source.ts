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
import { sanitizePublicProseText } from '@repo/domain/editorial';
import {
  buildMapSource,
  type MapCountyAggregate,
  type MapPointFeature,
  type MapSourceEntityInput,
  type MapStateAggregate,
} from '@repo/domain/map/map-source';
import type { GeoPrecisionTier } from '@repo/domain/geography/display-radius';
import type { PublicClaimView, PublicEntityView } from '../../data/public-seed';
import { visitContactClaimsForMap } from '../geography/public-visit-contact';
import { geoAnchorFor as defaultGeoAnchorFor, type EntityGeoAnchor } from './entity-geo';
import { resolveEntityEraBuckets } from './entity-era-facts';
import { geoPrecisionTierForPublicPrecision, resolveDisplayRadiusMeters } from './geo-precision';
import { displayEncodingFor, kindFamilyFor, resolveMapTone } from './kind-encoding';
import { staysOffPublicMap, atlasWalkHref } from '../place/public-place-path';
import { instrumentRecordHref, placeSlugCollisionCounts } from '../place/place-slug';

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
  /**
   * The earliest decade this record is documented in, as a start year (1920 for the 1920s.)
   *
   * Redundant with `eraBuckets` wherever the buckets are carried, and set on its own for the
   * Door's first-paint pins, whose buckets are stripped out of the first document. The Door's
   * decade sweep needs one number per pin and nothing else, and one number is a great deal
   * cheaper on a document that already carries four thousand of them.
   */
  readonly earliestDecade?: number;
  readonly status?: string;
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
  /** Five-family bucket — same grouping as map shade and Kind filter facet. */
  readonly kindFamily: string;
  readonly stateFips?: string;
  readonly statePostalCode?: string;
  readonly stateName?: string;
  /** Public location prose from the release (never a redacted residential exact). */
  readonly locationLabel?: string;
  /** Jurisdiction for composing a fuller visit address line on the sheet. */
  readonly jurisdictionLabel?: string;
  /**
   * Visit-contact claims only (website / phone / hours). Full claim lists stay on the entity
   * page; the map payload keeps this lean subset for RecordSheet / NarrativeCard visit blocks.
   */
  readonly visitClaims?: readonly Pick<
    PublicClaimView,
    'id' | 'predicate' | 'object' | 'citationLabel' | 'citationHref'
  >[];
  readonly livingStatus?: string;
  readonly sensitivityClass?: string;
  /** Door Journey: true only for allowlisted Explore walks, not every `/place/` link. */
  readonly holdingWalk?: true;
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

function enrichFeature(
  feature: MapPointFeature,
  entity: PublicEntityView,
  collisions: ReadonlyMap<string, number>,
): ExploreMapFeature {
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
  const eraBuckets = resolveEntityEraBuckets({
    ...(entity.eraBuckets !== undefined ? { eraBuckets: entity.eraBuckets } : {}),
    ...(entity.era !== undefined ? { era: entity.era } : {}),
    ...(entity.eventWindow !== undefined ? { eventWindow: entity.eventWindow } : {}),
    ...(entity.statusHistory !== undefined ? { statusHistory: entity.statusHistory } : {}),
    claims: entity.claims,
  });

  const href = instrumentRecordHref(entity, collisions);
  const walkHref = atlasWalkHref({
    displayName: entity.displayName,
    kind: entity.kind,
    entityId: entity.id,
  });
  const holdingWalk = walkHref !== undefined && walkHref === href;
  const visitClaims = visitContactClaimsForMap(entity.claims);
  const jurisdiction = entity.jurisdictionLabel.trim();

  return {
    type: 'Feature',
    id: feature.id,
    geometry: feature.geometry,
    properties: {
      entityId: entity.id,
      href,
      kind: feature.properties.kind,
      displayName: feature.properties.displayName,
      oneLineStory: sanitizePublicProseText(entity.summary),
      precision: feature.properties.precision,
      geoPrecisionTier: tier,
      ...(radius.ok ? { radiusMeters: radius.radiusMeters } : {}),
      eraBuckets,
      ...(entity.status !== undefined ? { status: entity.status } : {}),
      // `notabilityLabels` deliberately not carried: nothing on a map surface reads it, and the
      // labels are full rubric sentences repeated per record (1.8 MB across the catalog).
      evidenceCount: entity.claims.length,
      confidenceTier: highestConfidence(entity.claims),
      topicTags: entity.topicTags,
      ...(entity.topicIds !== undefined ? { topicIds: entity.topicIds } : {}),
      ...(mapTone !== undefined ? { mapTone } : {}),
      shade: encoding.shade,
      glyph: encoding.glyph,
      kindFamily: kindFamilyFor(feature.properties.kind),
      ...(feature.properties.stateFips ? { stateFips: feature.properties.stateFips } : {}),
      ...(feature.properties.statePostalCode
        ? { statePostalCode: feature.properties.statePostalCode }
        : {}),
      ...(feature.properties.stateName ? { stateName: feature.properties.stateName } : {}),
      ...(entity.locationLabel.trim().length > 0
        ? { locationLabel: entity.locationLabel.trim() }
        : {}),
      ...(jurisdiction.length > 0 ? { jurisdictionLabel: jurisdiction } : {}),
      ...(visitClaims.length > 0 ? { visitClaims } : {}),
      ...(entity.livingStatus !== undefined ? { livingStatus: entity.livingStatus } : {}),
      ...(entity.sensitivityClass !== undefined
        ? { sensitivityClass: entity.sensitivityClass }
        : {}),
      ...(holdingWalk ? { holdingWalk: true as const } : {}),
    },
  };
}

/**
 * `buildExploreMapSource(entities)` memoised on the catalog array's identity.
 *
 * The live catalog is one array reference for the life of its cross-request cache window (30
 * minutes, see `release-scoped-cache.ts`), and every dynamic request on `/explore`, `/place`,
 * the refine API and the Door was rebuilding the same ~4,100-feature source from it: the same
 * redaction, the same aggregates, the same bytes. Memoising on the array means one build per
 * catalog instance per process, and a retired catalog takes its source with it (WeakMap).
 *
 * Only the default (no-options) build is memoised; an options build is a different result.
 */
const defaultSourceByCatalog = new WeakMap<readonly PublicEntityView[], ExploreMapSource>();

export function exploreMapSourceFor(entities: readonly PublicEntityView[]): ExploreMapSource {
  const hit = defaultSourceByCatalog.get(entities);
  if (hit) return hit;
  const built = buildExploreMapSource(entities);
  defaultSourceByCatalog.set(entities, built);
  return built;
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
    if (staysOffPublicMap(entity)) continue;
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

  const collisions = placeSlugCollisionCounts(entities);
  const features = built.featureCollection.features.map((feature) => {
    const entity = entityById.get(feature.properties.entityId);
    if (!entity) {
      throw new Error(
        `buildExploreMapSource: feature "${feature.id}" has no matching active-release entity`,
      );
    }
    return enrichFeature(feature, entity, collisions);
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
