/**
 * Geo-anchor table for the bundled Dunbar-cluster seed snapshot.
 *
 * Live public projections carry `location` → `PublicEntityView.geoAnchor` via
 * `map-projection.ts`; `buildExploreMapSource` prefers that field and only falls
 * back here for offline seed fixtures. National-catalog coordinates live in
 * Firestore releases (republished from `packages/firebase/fixtures/national-catalog/`).
 *
 * Precision comes from each entity's own `locationPrecision` field (never duplicated
 * here) so this table can never drift from what the entity page itself displays.
 *
 * An entity without a live geoAnchor and without a row here is excluded from the map
 * (not silently placed at a guessed point).
 */
import { encodeGeohash } from '@repo/domain/geography/geohash';

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
 * Washington, D.C. Dunbar-lineage seed anchors only. Church and school pins are
 * honest neighborhood/campus estimates (research brief, verified 2026-07-17) —
 * never rooftop geocodes. Alumni federation is city-level only.
 */
export const ENTITY_GEO_ANCHORS: Readonly<Record<string, EntityGeoAnchor>> = {
  // Fifteenth Street Presbyterian Church — Dupont/Sixteenth Street Historic District area.
  ent_15th_st_church_001: anchor(38.9126, -77.0366),
  // Paul Laurence Dunbar High School — New Jersey Avenue NW campus, Truxton Circle/Shaw.
  ent_dunbar_school_001: anchor(38.9098, -77.0143),
  // The 1975 landmark listing occurred at the school's campus.
  ent_dc_landmark_listing_1975: anchor(38.9098, -77.0143),
  // Dunbar Alumni Federation — no documented street address; city-level D.C. reference.
  ent_dunbar_alumni_federation_001: anchor(38.9072, -77.0369),
};

export function geoAnchorFor(entityId: string): EntityGeoAnchor | undefined {
  return ENTITY_GEO_ANCHORS[entityId];
}
