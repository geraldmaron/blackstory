/**
 * Tiny simplified state polygons for unit tests and loader dry-runs. Not survey-grade boundaries;
 * sufficient to prove MA-in-MA passes and Harlem-in-NY tagged NJ fails.
 */

import type { StateBoundary } from './types.js';

/** Boston Common-ish coordinate inside simplified MA. */
export const FIXTURE_POINT_BOSTON_MA = { lat: 42.3601, lng: -71.0589 } as const;

/** Harlem-ish coordinate inside simplified NY. */
export const FIXTURE_POINT_HARLEM_NY = { lat: 40.8116, lng: -73.9465 } as const;

/** Simplified rectangles for MA, NY, NJ (GeoJSON [lng, lat] rings, closed). */
export const FIXTURE_STATE_BOUNDARIES: readonly StateBoundary[] = [
  {
    stateCode: 'MA',
    stateFips: '25',
    name: 'Massachusetts',
    rings: [
      [
        [-73.51, 41.24],
        [-69.86, 41.24],
        [-69.86, 42.89],
        [-73.51, 42.89],
        [-73.51, 41.24],
      ],
    ],
  },
  {
    stateCode: 'NY',
    stateFips: '36',
    name: 'New York',
    rings: [
      [
        [-79.76, 40.5],
        [-71.85, 40.5],
        [-71.85, 45.02],
        [-79.76, 45.02],
        [-79.76, 40.5],
      ],
    ],
  },
  {
    stateCode: 'NJ',
    stateFips: '34',
    name: 'New Jersey',
    rings: [
      [
        [-75.56, 38.93],
        [-73.9, 38.93],
        [-73.9, 40.7],
        [-75.56, 40.7],
        [-75.56, 38.93],
      ],
    ],
  },
] as const;

/**
 * Rows shaped like `bb_reference.jurisdictions` plus GeoJSON in metadata for loader dry-runs.
 * `parent_id` uses the ADR-016 `us` / `us-{stateFips}` id scheme.
 */
export const FIXTURE_STATE_JURISDICTION_ROWS = FIXTURE_STATE_BOUNDARIES.map((boundary) => ({
  id: `us-${boundary.stateFips}`,
  kind: 'state' as const,
  name: boundary.name ?? boundary.stateCode,
  state_fips: boundary.stateFips ?? null,
  county_fips: null,
  parent_id: 'us',
  geohash: null,
  metadata: {
    postalCode: boundary.stateCode,
    geometry: {
      type: 'Polygon' as const,
      coordinates: boundary.rings.map((ring) => [...ring]),
    },
    source: 'fixture',
    sourceVersion: 'geo-integrity-v1',
  },
}));
