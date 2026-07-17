/**
 * U.S.-only geography reference table for the map data platform (BB-070).
 *
 * Product scope is 50 states + D.C. (no territories) — same scope line used by
 * ADR-008 / BB-050. This module intentionally does NOT vendor county or state
 * polygon boundary data (e.g. Census TIGER shapefiles): that is a real, honest
 * gap documented in docs/adr/ADR-013-map-stack.md rather than something faked
 * here. State attribution below is an approximate bounding-box test, good
 * enough for national-zoom presence/density aggregates — it is not a survey-
 * grade point-in-polygon spatial join and must never be presented as one.
 */

export type UsStateInfo = {
  /** 2-digit Census state FIPS code. */
  readonly fips: string;
  readonly postalCode: string;
  readonly name: string;
  /** [west, south, east, north] in decimal degrees (approximate). */
  readonly bbox: readonly [west: number, south: number, east: number, north: number];
};

/**
 * Approximate bounding boxes for the 50 states + D.C. Deliberately coarse —
 * only used for presence bucketing over already-coarsened public coordinates,
 * never for anything that needs administrative-boundary precision.
 */
export const US_STATES: readonly UsStateInfo[] = [
  { fips: '01', postalCode: 'AL', name: 'Alabama', bbox: [-88.5, 30.1, -84.9, 35.0] },
  { fips: '02', postalCode: 'AK', name: 'Alaska', bbox: [-179.9, 51.0, -129.9, 71.5] },
  { fips: '04', postalCode: 'AZ', name: 'Arizona', bbox: [-114.9, 31.3, -109.0, 37.0] },
  { fips: '05', postalCode: 'AR', name: 'Arkansas', bbox: [-94.7, 33.0, -89.6, 36.5] },
  { fips: '06', postalCode: 'CA', name: 'California', bbox: [-124.5, 32.5, -114.1, 42.0] },
  { fips: '08', postalCode: 'CO', name: 'Colorado', bbox: [-109.1, 37.0, -102.0, 41.0] },
  { fips: '09', postalCode: 'CT', name: 'Connecticut', bbox: [-73.8, 40.95, -71.75, 42.05] },
  { fips: '10', postalCode: 'DE', name: 'Delaware', bbox: [-75.8, 38.4, -75.0, 39.85] },
  { fips: '11', postalCode: 'DC', name: 'District of Columbia', bbox: [-77.12, 38.79, -76.9, 39.0] },
  { fips: '12', postalCode: 'FL', name: 'Florida', bbox: [-87.65, 24.4, -80.0, 31.0] },
  { fips: '13', postalCode: 'GA', name: 'Georgia', bbox: [-85.7, 30.35, -80.8, 35.0] },
  { fips: '15', postalCode: 'HI', name: 'Hawaii', bbox: [-160.3, 18.9, -154.8, 22.3] },
  { fips: '16', postalCode: 'ID', name: 'Idaho', bbox: [-117.3, 41.99, -111.0, 49.0] },
  { fips: '17', postalCode: 'IL', name: 'Illinois', bbox: [-91.55, 36.97, -87.0, 42.51] },
  { fips: '18', postalCode: 'IN', name: 'Indiana', bbox: [-88.1, 37.77, -84.78, 41.76] },
  { fips: '19', postalCode: 'IA', name: 'Iowa', bbox: [-96.64, 40.37, -90.14, 43.5] },
  { fips: '20', postalCode: 'KS', name: 'Kansas', bbox: [-102.1, 36.99, -94.6, 40.0] },
  { fips: '21', postalCode: 'KY', name: 'Kentucky', bbox: [-89.6, 36.5, -81.96, 39.15] },
  { fips: '22', postalCode: 'LA', name: 'Louisiana', bbox: [-94.05, 28.9, -88.75, 33.02] },
  { fips: '23', postalCode: 'ME', name: 'Maine', bbox: [-71.1, 42.95, -66.9, 47.46] },
  { fips: '24', postalCode: 'MD', name: 'Maryland', bbox: [-79.49, 37.9, -75.05, 39.72] },
  { fips: '25', postalCode: 'MA', name: 'Massachusetts', bbox: [-73.51, 41.24, -69.86, 42.89] },
  { fips: '26', postalCode: 'MI', name: 'Michigan', bbox: [-90.42, 41.7, -82.12, 48.31] },
  { fips: '27', postalCode: 'MN', name: 'Minnesota', bbox: [-97.24, 43.5, -89.49, 49.38] },
  { fips: '28', postalCode: 'MS', name: 'Mississippi', bbox: [-91.66, 30.17, -88.1, 35.0] },
  { fips: '29', postalCode: 'MO', name: 'Missouri', bbox: [-95.77, 35.99, -89.1, 40.61] },
  { fips: '30', postalCode: 'MT', name: 'Montana', bbox: [-116.05, 44.36, -104.04, 49.0] },
  { fips: '31', postalCode: 'NE', name: 'Nebraska', bbox: [-104.05, 40.0, -95.31, 43.0] },
  { fips: '32', postalCode: 'NV', name: 'Nevada', bbox: [-120.0, 35.0, -114.04, 42.0] },
  { fips: '33', postalCode: 'NH', name: 'New Hampshire', bbox: [-72.56, 42.7, -70.61, 45.31] },
  { fips: '34', postalCode: 'NJ', name: 'New Jersey', bbox: [-75.56, 38.93, -73.9, 41.36] },
  { fips: '35', postalCode: 'NM', name: 'New Mexico', bbox: [-109.05, 31.33, -103.0, 37.0] },
  { fips: '36', postalCode: 'NY', name: 'New York', bbox: [-79.76, 40.5, -71.85, 45.02] },
  { fips: '37', postalCode: 'NC', name: 'North Carolina', bbox: [-84.32, 33.84, -75.46, 36.59] },
  { fips: '38', postalCode: 'ND', name: 'North Dakota', bbox: [-104.05, 45.94, -96.55, 49.0] },
  { fips: '39', postalCode: 'OH', name: 'Ohio', bbox: [-84.82, 38.4, -80.52, 41.98] },
  { fips: '40', postalCode: 'OK', name: 'Oklahoma', bbox: [-103.0, 33.62, -94.43, 37.0] },
  { fips: '41', postalCode: 'OR', name: 'Oregon', bbox: [-124.57, 41.99, -116.46, 46.29] },
  { fips: '42', postalCode: 'PA', name: 'Pennsylvania', bbox: [-80.52, 39.72, -74.69, 42.27] },
  { fips: '44', postalCode: 'RI', name: 'Rhode Island', bbox: [-71.86, 41.15, -71.12, 42.02] },
  { fips: '45', postalCode: 'SC', name: 'South Carolina', bbox: [-83.35, 32.03, -78.49, 35.22] },
  { fips: '46', postalCode: 'SD', name: 'South Dakota', bbox: [-104.06, 42.48, -96.44, 45.95] },
  { fips: '47', postalCode: 'TN', name: 'Tennessee', bbox: [-90.31, 34.98, -81.65, 36.68] },
  { fips: '48', postalCode: 'TX', name: 'Texas', bbox: [-106.65, 25.84, -93.51, 36.5] },
  { fips: '49', postalCode: 'UT', name: 'Utah', bbox: [-114.05, 36.99, -109.04, 42.0] },
  { fips: '50', postalCode: 'VT', name: 'Vermont', bbox: [-73.44, 42.73, -71.46, 45.02] },
  { fips: '51', postalCode: 'VA', name: 'Virginia', bbox: [-83.68, 36.54, -75.24, 39.47] },
  { fips: '53', postalCode: 'WA', name: 'Washington', bbox: [-124.79, 45.54, -116.92, 49.0] },
  { fips: '54', postalCode: 'WV', name: 'West Virginia', bbox: [-82.65, 37.2, -77.72, 40.64] },
  { fips: '55', postalCode: 'WI', name: 'Wisconsin', bbox: [-92.89, 42.49, -86.8, 47.08] },
  { fips: '56', postalCode: 'WY', name: 'Wyoming', bbox: [-111.06, 40.99, -104.05, 45.01] },
] as const;

function bboxArea(bbox: UsStateInfo['bbox']): number {
  const [west, south, east, north] = bbox;
  return Math.max(0, east - west) * Math.max(0, north - south);
}

/**
 * States ordered smallest-bbox-first so overlap between a small state (e.g. D.C.,
 * Rhode Island, Delaware) and a larger neighbor resolves to the more specific one.
 */
const STATES_BY_AREA_ASC: readonly UsStateInfo[] = [...US_STATES].sort(
  (a, b) => bboxArea(a.bbox) - bboxArea(b.bbox),
);

/** Overall U.S. bounds (50 states + D.C.) derived from the state table. */
export const US_BOUNDS: readonly [west: number, south: number, east: number, north: number] = [
  Math.min(...US_STATES.map((s) => s.bbox[0])),
  Math.min(...US_STATES.map((s) => s.bbox[1])),
  Math.max(...US_STATES.map((s) => s.bbox[2])),
  Math.max(...US_STATES.map((s) => s.bbox[3])),
];

export function isWithinUsBounds(lat: number, lng: number): boolean {
  const [west, south, east, north] = US_BOUNDS;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

function pointInBbox(lat: number, lng: number, bbox: UsStateInfo['bbox']): boolean {
  const [west, south, east, north] = bbox;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

/**
 * Approximate state attribution for a public (already-coarsened) coordinate.
 * Bounding-box test only — near-border points may resolve to a neighboring
 * state. Sufficient for national/state-zoom presence aggregates; not a
 * substitute for real polygon boundary data (see ADR-013 "known gaps").
 */
export function findUsStateForPoint(lat: number, lng: number): UsStateInfo | undefined {
  for (const state of STATES_BY_AREA_ASC) {
    if (pointInBbox(lat, lng, state.bbox)) {
      return state;
    }
  }
  return undefined;
}

export function findUsStateByPostalCode(postalCode: string): UsStateInfo | undefined {
  const upper = postalCode.toUpperCase();
  return US_STATES.find((s) => s.postalCode === upper);
}
