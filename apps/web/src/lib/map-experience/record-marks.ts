/**
 * What the map draws for a set of records, split by stored precision (`recordMarkFor`).
 *
 * Site, neighborhood and city records are drawn (a dot or a ring) and grouped. County- and
 * state-precision records draw no point at all: a pin would claim a place the archive does not
 * hold. They are counted instead, in one tag per state anchored at the state's label point
 * ("3 statewide · 2 by county").
 *
 * Both splits are memoized on the collection object, because the style is rebuilt on every
 * patch and the catalog runs to thousands of records.
 */
import type { ExploreMapFeature, ExploreMapFeatureCollection } from './build-explore-map-source';
import { recordMarkFor } from './geo-precision';
import { stateLabelPoints } from './state-labels';

export type JurisdictionTagFeature = {
  readonly type: 'Feature';
  readonly geometry: { readonly type: 'Point'; readonly coordinates: readonly [number, number] };
  readonly properties: {
    readonly postalCode: string;
    readonly label: string;
    /** `|id|id|`: a string, so a style filter can test membership with `in`. */
    readonly ids: string;
  };
};

export type JurisdictionTagCollection = {
  readonly type: 'FeatureCollection';
  readonly features: readonly JurisdictionTagFeature[];
};

const drawnCache = new WeakMap<ExploreMapFeatureCollection, ExploreMapFeatureCollection>();
const tagCache = new WeakMap<ExploreMapFeatureCollection, JurisdictionTagCollection>();

function isDrawn(feature: ExploreMapFeature): boolean {
  return recordMarkFor(feature.properties.precision) !== 'none';
}

/** The records that get a point on the map. */
export function drawnRecordCollection(
  collection: ExploreMapFeatureCollection,
): ExploreMapFeatureCollection {
  const cached = drawnCache.get(collection);
  if (cached) return cached;
  const drawn = collection.features.every(isDrawn)
    ? collection
    : { type: 'FeatureCollection' as const, features: collection.features.filter(isDrawn) };
  drawnCache.set(collection, drawn);
  return drawn;
}

function tagLabel(statewide: number, byCounty: number): string {
  return [
    ...(statewide > 0 ? [`${statewide.toLocaleString('en-US')} statewide`] : []),
    ...(byCounty > 0 ? [`${byCounty.toLocaleString('en-US')} by county`] : []),
  ].join(' · ');
}

/** One tag per state that holds county- or state-precision records. */
export function jurisdictionTagCollection(
  collection: ExploreMapFeatureCollection,
): JurisdictionTagCollection {
  const cached = tagCache.get(collection);
  if (cached) return cached;
  const byState = new Map<string, { statewide: number; byCounty: number; ids: string[] }>();
  for (const feature of collection.features) {
    if (isDrawn(feature)) continue;
    const postalCode = feature.properties.statePostalCode;
    if (!postalCode) continue;
    const entry = byState.get(postalCode) ?? { statewide: 0, byCounty: 0, ids: [] };
    if (feature.properties.precision === 'county') entry.byCounty += 1;
    else entry.statewide += 1;
    entry.ids.push(feature.properties.entityId);
    byState.set(postalCode, entry);
  }
  const features: JurisdictionTagFeature[] = [];
  for (const point of stateLabelPoints()) {
    const entry = byState.get(point.postalCode);
    if (!entry) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      properties: {
        postalCode: point.postalCode,
        label: tagLabel(entry.statewide, entry.byCounty),
        ids: `|${entry.ids.join('|')}|`,
      },
    });
  }
  const tags = { type: 'FeatureCollection' as const, features };
  tagCache.set(collection, tags);
  return tags;
}
