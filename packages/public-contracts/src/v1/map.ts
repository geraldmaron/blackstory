/**
 * Public map feature shape (GeoJSON point) — extracted from
 * `apps/web/src/lib/map-experience/build-explore-map-source.ts`'s `ExploreMapFeature` /
 * `ExploreMapFeatureProperties`, the dataset the web `/explore` map already renders and the
 * mobile MapLibre Native surface (MOB-011/MOB-012) targets per ADR-020 §2.
 *
 * `evidenceCount` is carried over deliberately: the source comment documents it as "count of this
 * record's own already-publicly-enumerated accepted claims ... a transparency affordance, not a
 * hidden ranking input" — it is the same number a client could derive by counting
 * `EntityV1.claims`, just denormalized onto the map feature so the map layer doesn't need the
 * full entity payload. This is explicitly NOT the banned "raw notability/relevance ranking
 * signal": `relatedCount`/`claimCount` (the actual server-internal ranking inputs used by
 * `packages/domain/src/search/types.ts`'s `SearchableEntityRecord`) have no field here at all.
 */
import { z } from 'zod';
import { boundedArray, idString, nonEmptyText } from '../internal/primitives.js';

export const GEO_PRECISION_TIERS = ['exact', 'block', 'neighborhood', 'city', 'unknown'] as const;
export const geoPrecisionTierSchema = z.enum(GEO_PRECISION_TIERS);
export type GeoPrecisionTierV1 = (typeof GEO_PRECISION_TIERS)[number];

export const CONFIDENCE_TIERS = ['high', 'medium', 'low', 'unrated'] as const;
export const confidenceTierSchema = z.enum(CONFIDENCE_TIERS);
export type ConfidenceTierV1 = (typeof CONFIDENCE_TIERS)[number];

export const mapFeaturePropertiesV1Schema = z
  .object({
    entityId: idString(200),
    href: z.string().max(500),
    kind: nonEmptyText(100),
    displayName: nonEmptyText(300),
    oneLineStory: z.string().max(500),
    precision: nonEmptyText(50),
    geoPrecisionTier: geoPrecisionTierSchema,
    radiusMeters: z.number().min(0).max(1_000_000).optional(),
    eraBuckets: boundedArray(z.string().max(20), 200),
    status: z.string().max(100).optional(),
    notabilityLabels: boundedArray(z.string().max(300), 100),
    /** Public evidence-count transparency affordance — see module doc. Never a ranking score. */
    evidenceCount: z.number().int().min(0).max(100_000),
    confidenceTier: confidenceTierSchema,
    topicTags: boundedArray(z.string().max(100), 200),
    topicIds: boundedArray(z.string().max(100), 200).optional(),
    mapTone: z.string().max(100).optional(),
    shade: nonEmptyText(20),
    glyph: nonEmptyText(50),
    stateFips: z.string().max(10).optional(),
    statePostalCode: z.string().max(4).optional(),
    stateName: z.string().max(100).optional(),
  });

export type MapFeaturePropertiesV1 = z.infer<typeof mapFeaturePropertiesV1Schema>;

const pointGeometryV1Schema = z
  .object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  });

export const mapFeatureV1Schema = z
  .object({
    type: z.literal('Feature'),
    id: idString(200),
    geometry: pointGeometryV1Schema,
    properties: mapFeaturePropertiesV1Schema,
  });

export type MapFeatureV1 = z.infer<typeof mapFeatureV1Schema>;

export const mapSourceV1Schema = z
  .object({
    releaseId: idString(200),
    features: boundedArray(mapFeatureV1Schema, 20_000),
  });

export type MapSourceV1 = z.infer<typeof mapSourceV1Schema>;
