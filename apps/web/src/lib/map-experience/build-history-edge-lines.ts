/**
 * Projects evidence-backed History edges onto the Explore map as LineString features
 * between entity geo anchors. Endpoints without anchors are skipped; coincident anchors
 * get a tiny display offset so the segment remains visible.
 */
import type { HistoryEdgeView } from '../history/build-history-graph';
import { geoAnchorFor } from './entity-geo';

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

/** ~400m east at mid-latitudes enough to see a stub when two entities share a campus pin.  */
const COINCIDENT_LNG_NUDGE = 0.004;

export function buildHistoryEdgeLineCollection(
  edges: readonly HistoryEdgeView[],
): HistoryEdgeLineCollection {
  const features: HistoryEdgeLineFeature[] = [];

  for (const edge of edges) {
    const from = geoAnchorFor(edge.fromEntityId);
    const to = geoAnchorFor(edge.toEntityId);
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
