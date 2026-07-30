/**
 * Projects evidence-backed History edges onto the Explore map as LineString features
 * between entity geo anchors. Endpoints without anchors are skipped; coincident anchors
 * get a tiny display offset so the segment remains visible.
 *
 * Prefer live `PublicEntityView.geoAnchor` via the optional resolver — the seed-only
 * `entity-geo` table covers Dunbar fixtures, not the national catalog.
 */
import type { HistoryEdgeView } from '../history/build-history-graph';
import { geoAnchorFor as defaultGeoAnchorFor, type EntityGeoAnchor } from './entity-geo';

export type HistoryEdgeLineProperties = {
  readonly edgeId: string;
  readonly relationshipType: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly fromDisplayName: string;
  readonly toDisplayName: string;
  readonly sentence: string;
  readonly coincident: boolean;
};

export type HistoryEdgeLineFeature = {
  readonly type: 'Feature';
  readonly geometry: {
    readonly type: 'LineString';
    readonly coordinates: readonly [readonly [number, number], readonly [number, number]];
  };
  readonly properties: HistoryEdgeLineProperties;
};

export type HistoryEdgeLineCollection = {
  readonly type: 'FeatureCollection';
  readonly features: readonly HistoryEdgeLineFeature[];
};

export type BuildHistoryEdgeLineCollectionOptions = {
  /** Resolve lat/lng for an endpoint. Defaults to the seed-only `geoAnchorFor` table. */
  readonly geoAnchorFor?: (entityId: string) => EntityGeoAnchor | undefined;
};

/** ~400m east at mid-latitudes enough to see a stub when two entities share a campus pin.  */
const COINCIDENT_LNG_NUDGE = 0.004;

export function buildHistoryEdgeLineCollection(
  edges: readonly HistoryEdgeView[],
  options: BuildHistoryEdgeLineCollectionOptions = {},
): HistoryEdgeLineCollection {
  // Custom resolvers (live catalog) win; seed table remains the Dunbar fallback.
  const resolveAnchor = (entityId: string): EntityGeoAnchor | undefined =>
    options.geoAnchorFor?.(entityId) ?? defaultGeoAnchorFor(entityId);
  const features: HistoryEdgeLineFeature[] = [];

  for (const edge of edges) {
    const from = resolveAnchor(edge.fromEntityId);
    const to = resolveAnchor(edge.toEntityId);
    if (!from || !to) continue;

    const coincident = from.lat === to.lat && from.lng === to.lng;
    const toLng = coincident ? to.lng + COINCIDENT_LNG_NUDGE : to.lng;

    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [from.lng, from.lat],
          [toLng, to.lat],
        ],
      },
      properties: {
        edgeId: edge.edgeId,
        relationshipType: edge.type,
        fromEntityId: edge.fromEntityId,
        toEntityId: edge.toEntityId,
        fromDisplayName: edge.fromDisplayName,
        toDisplayName: edge.toDisplayName,
        sentence: edge.sentence,
        coincident,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}
