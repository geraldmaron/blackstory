/**
 * Geo-anchor table for the active release's map-eligible entities.
 *
 * The active release (`../../data/public-seed.ts`) does not yet carry structured
 * `EntityLocation` documents with lat/lng — this module is the map-specific stand-in, in the
 * same spirit as `packages/domain/src/map/fixtures.ts` standing in for a live release read.
 * Precision comes from each entity's own `locationPrecision` field (never duplicated here) so
 * this table can never drift from what the entity page itself displays; this file supplies ONLY
 * the coordinate anchor.
 *
 * Scope: only entities present in the active release get an anchor. An entity without one is
 * excluded from the map (not silently placed at a guessed point) — mirrors
 * `buildMapSource` "skippedNoLocation" accounting.
 */
import { encodeGeohash } from '@black-book/domain';
import { NATIONAL_STORY_GEO_ANCHORS } from '../../data/national-story-seed/geo';

export type EntityGeoAnchor = {
  readonly lat: number;
  readonly lng: number;
  readonly geohash: string;
  readonly matchMethod: string;
  readonly county?: { readonly name: string; readonly fipsCode?: string };
};

function anchor(lat: number, lng: number, matchMethod = 'manual_research'): EntityGeoAnchor {
  return { lat, lng, geohash: encodeGeohash(lat, lng), matchMethod };
}

/**
 * Washington, D.C. carries no county subdivision every anchor below sits inside the single
 * District of Columbia jurisdiction (FIPS 11), matching every current seed entity's
 * `jurisdictionLabel`. As the active release grows beyond D.C., new entities get a new row here
 * (or, once projections are live, this whole module retires in favor of a real
 * `EntityLocation` read from the published release).
 */
const BASE_GEO_ANCHORS: Readonly<Record<string, EntityGeoAnchor>> = {
  ent_seed_place_001: anchor(38.9072, -77.0369),
  // Same campus the connected school currently occupies (public-seed.ts's summary: "a documented
  // 1954 commemoration held on the connected school's campus").
  ent_seed_school_001: anchor(38.9101, -77.0147),
  ent_seed_event_001: anchor(38.9101, -77.0147),
  ent_seed_institution_001: anchor(38.9047, -77.0163),
};

export const ENTITY_GEO_ANCHORS: Readonly<Record<string, EntityGeoAnchor>> = {
  ...BASE_GEO_ANCHORS,
  ...Object.fromEntries(
    Object.entries(NATIONAL_STORY_GEO_ANCHORS).map(([id, g]) => [id, anchor(g.lat, g.lng)]),
  ),
};

export function geoAnchorFor(entityId: string): EntityGeoAnchor | undefined {
  return ENTITY_GEO_ANCHORS[entityId];
}
