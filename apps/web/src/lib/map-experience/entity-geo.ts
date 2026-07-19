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
import { encodeGeohash } from '@repo/domain/geography/geohash';
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
 *
 * The church and school anchors are honest, low-precision *estimates* from known street-grid
 * geography (research brief, verified 2026-07-17) — `matchMethod: 'manual_research'`, never a
 * rooftop geocode. The Dunbar Alumni Federation has no documented public street address in the
 * sources consulted only that it is a District of Columbia organization (daf-dc.org) its
 * anchor is deliberately the coarsest, most generic Washington, D.C. reference point, matching
 * its `locationPrecision: 'city'` on the entity record never a guessed street address.
 */
const BASE_GEO_ANCHORS: Readonly<Record<string, EntityGeoAnchor>> = {
  // Fifteenth Street Presbyterian Church — Dupont/Sixteenth Street Historic District area.
  ent_15th_st_church_001: anchor(38.9126, -77.0366),
  // Paul Laurence Dunbar High School — New Jersey Avenue NW campus, Truxton Circle/Shaw.
  ent_dunbar_school_001: anchor(38.9098, -77.0143),
  // The 1975 landmark listing occurred at the school's campus (public-seed.ts's summary: the
  // school "was listed on the District of Columbia Inventory of Historic Sites").
  ent_dc_landmark_listing_1975: anchor(38.9098, -77.0143),
  // Dunbar Alumni Federation — no documented street address; a generic, city-level Washington,
  // D.C. reference point, not a claimed office location.
  ent_dunbar_alumni_federation_001: anchor(38.9072, -77.0369),
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
