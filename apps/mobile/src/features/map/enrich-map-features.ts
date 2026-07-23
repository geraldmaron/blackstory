/**
 * Denormalizes v6 map encoding fields onto GeoJSON features before MapLibre paint.
 * Live `MapSourceV1` already carries shade/glyph; demo fixtures get them here.
 */
import {
  displayEncodingFor,
  kindFamilyFor,
  resolveMapTone,
  type MapEntityGlyph,
} from './kind-encoding';
import type { MapFeatureCollection, MapPointFeature, MapPointFeatureProperties } from './demoMapSource';

export type EncodedMapPointProperties = MapPointFeatureProperties & {
  readonly shade?: string;
  readonly glyph?: MapEntityGlyph;
  readonly kindFamily?: string;
  readonly mapTone?: string;
  readonly evidenceCount?: number;
  readonly confidenceTier?: string;
  readonly topicTags?: readonly string[];
  readonly topicIds?: readonly string[];
};

function enrichProperties(properties: MapPointFeatureProperties): EncodedMapPointProperties {
  const topicTags = 'topicTags' in properties ? properties.topicTags : undefined;
  const topicIds = 'topicIds' in properties ? properties.topicIds : undefined;
  const mapTone =
    ('mapTone' in properties && typeof properties.mapTone === 'string'
      ? properties.mapTone
      : undefined) ??
    resolveMapTone({
      ...(Array.isArray(topicTags) ? { topicTags } : {}),
      ...(Array.isArray(topicIds) ? { topicIds } : {}),
      displayName: properties.displayName,
    });

  const encoding = displayEncodingFor(properties.kind, mapTone);
  const kindFamily = kindFamilyFor(properties.kind);

  const evidenceCount =
    'evidenceCount' in properties && typeof properties.evidenceCount === 'number'
      ? properties.evidenceCount
      : 0;
  const confidenceTier =
    'confidenceTier' in properties && typeof properties.confidenceTier === 'string'
      ? properties.confidenceTier
      : 'unrated';
  const shade =
    'shade' in properties && typeof properties.shade === 'string' ? properties.shade : encoding.shade;
  const glyph =
    'glyph' in properties && typeof properties.glyph === 'string'
      ? (properties.glyph as MapEntityGlyph)
      : encoding.glyph;

  return {
    ...properties,
    shade,
    glyph,
    kindFamily,
    ...(mapTone ? { mapTone } : {}),
    evidenceCount,
    confidenceTier,
    ...(Array.isArray(topicTags) && topicTags.length > 0 ? { topicTags } : {}),
    ...(Array.isArray(topicIds) && topicIds.length > 0 ? { topicIds } : {}),
  };
}

/** Returns a new collection with encoding properties guaranteed on every feature. */
export function enrichMapFeatureCollection(source: MapFeatureCollection): MapFeatureCollection {
  const features: MapPointFeature[] = source.features.map((feature) => ({
    ...feature,
    properties: enrichProperties(feature.properties),
  }));
  return { type: 'FeatureCollection', features };
}
