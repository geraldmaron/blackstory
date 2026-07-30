/**
 * Great Migration corridors, as documented aggregate streams between origin and destination
 * metros.
 *
 * These are not routes anyone travelled. They are a summary of where a documented migration
 * stream began and ended, drawn as a single arc between two metro centroids. The shape of this
 * module is deliberate: there is no waypoint, path or per-person field, and `granularity` is a
 * literal type, so a caller cannot widen a corridor into an itinerary without changing the type
 * and reading this comment.
 *
 * Every corridor carries the honesty note required by docs/ui/design-direction-v9-atlas.md §6.
 * Any surface that renders a corridor must surface that note.
 */

export type MetroAnchor = {
  /** [longitude, latitude], metro centroid. */
  readonly coordinates: readonly [number, number];
  readonly label: string;
};

export type MigrationCorridor = {
  readonly id: string;
  readonly from: MetroAnchor;
  readonly to: MetroAnchor;
  /** Fixed: corridors summarise streams between metros, never individual journeys. */
  readonly granularity: 'metro-to-metro';
  readonly note: string;
};

/** The single honesty line every corridor carries. */
export const MIGRATION_CORRIDOR_NOTE =
  'Corridors are illustrative of documented migration streams, drawn between origin and destination metros. Not individual paths.';

function corridor(id: string, from: MetroAnchor, to: MetroAnchor): MigrationCorridor {
  return { id, from, to, granularity: 'metro-to-metro', note: MIGRATION_CORRIDOR_NOTE };
}

const NEW_ORLEANS: MetroAnchor = { coordinates: [-90.07, 29.95], label: 'New Orleans, Louisiana' };
const JACKSON: MetroAnchor = { coordinates: [-90.18, 32.3], label: 'Jackson, Mississippi' };
const BIRMINGHAM: MetroAnchor = { coordinates: [-86.8, 33.52], label: 'Birmingham, Alabama' };
const ATLANTA: MetroAnchor = { coordinates: [-84.39, 33.75], label: 'Atlanta, Georgia' };
const HOUSTON: MetroAnchor = { coordinates: [-95.37, 29.76], label: 'Houston, Texas' };
const CHARLESTON: MetroAnchor = {
  coordinates: [-79.93, 32.78],
  label: 'Charleston, South Carolina',
};
const MEMPHIS: MetroAnchor = { coordinates: [-90.05, 35.15], label: 'Memphis, Tennessee' };

const CHICAGO: MetroAnchor = { coordinates: [-87.63, 41.88], label: 'Chicago, Illinois' };
const DETROIT: MetroAnchor = { coordinates: [-83.05, 42.33], label: 'Detroit, Michigan' };
const NEW_YORK: MetroAnchor = { coordinates: [-74.01, 40.71], label: 'New York, New York' };
const LOS_ANGELES: MetroAnchor = {
  coordinates: [-118.24, 34.05],
  label: 'Los Angeles, California',
};
const PHILADELPHIA: MetroAnchor = {
  coordinates: [-75.17, 39.95],
  label: 'Philadelphia, Pennsylvania',
};
const ST_LOUIS: MetroAnchor = { coordinates: [-90.2, 38.63], label: 'St. Louis, Missouri' };

export const MIGRATION_CORRIDORS: readonly MigrationCorridor[] = [
  corridor('new-orleans-chicago', NEW_ORLEANS, CHICAGO),
  corridor('jackson-chicago', JACKSON, CHICAGO),
  corridor('birmingham-detroit', BIRMINGHAM, DETROIT),
  corridor('atlanta-new-york', ATLANTA, NEW_YORK),
  corridor('houston-los-angeles', HOUSTON, LOS_ANGELES),
  corridor('charleston-philadelphia', CHARLESTON, PHILADELPHIA),
  corridor('memphis-st-louis', MEMPHIS, ST_LOUIS),
];

/** Continental US bounding box, used to keep corridor anchors honest. */
export const CONUS_BOUNDS = {
  minLongitude: -125,
  maxLongitude: -66.9,
  minLatitude: 24.4,
  maxLatitude: 49.4,
} as const;
