/**
 * Parser for the U.S. Census Bureau's national county Gazetteer file, transformed into
 * `jurisdictions` collection county docs.
 *
 * SOURCE FORMAT (documented, not fabricated no network access was used to build this
 * parser; format is the Census Bureau's long-published, stable Gazetteer file layout):
 * tab-delimited text, one header row, columns:
 * USPS GEOID ANSICODE NAME ALAND AWATER ALAND_SQMI AWATER_SQMI INTPTLAT INTPTLONG
 * - USPS: 2-letter state/territory postal code.
 * - GEOID: 5-digit county FIPS (2-digit state FIPS + 3-digit county FIPS).
 * - NAME: county/parish/borough/census-area name, e.g. "Autauga County".
 * - ALAND AWATER: land/water area in square meters; ALAND_SQMI AWATER_SQMI in square miles.
 * - INTPTLAT INTPTLONG: the Census-computed internal point (used here as centroid).
 *
 * HOW TO OBTAIN THE REAL FILE (documented for the human operator; do not fabricate a download):
 * https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip
 * (or the current-year equivalent under https://www.census.gov/geographies/reference-files/
 * time-series/geo/gazetteer-files.html "Counties" national file). Unzip to get a single
 * tab-delimited.txt file; pass its text content to `parseGazetteerCountyFile`.
 *
 * BBOX CAVEAT (see docs/adr/ADR-016): the Gazetteer file does NOT include a bounding box —
 * only a centroid (INTPTLAT/INTPTLONG) and land/water area. `approximateCountyBBox` derives a
 * bbox by centering a square (sized to match the county's total area) on that centroid. This
 * is an honest, labeled APPROXIMATION (`bboxSource: 'census-gazetteer-area-approximated'`),
 * not a survey-grade polygon extent — the same "deliberately coarse, never survey-grade"
 * posture `us-geography.ts` already documents for state bboxes. A precise bbox can be
 * backfilled later from Census cartographic boundary shapefiles used for map tiles;
 * recomputing that here would duplicate the tile pipeline.
 */
import type { JurisdictionBBoxDoc } from './schema.js';
import { countyJurisdictionId, stateJurisdictionId, type JurisdictionDoc } from './schema.js';
import { stateInfoByFips } from './us-states-source.js';

export type GazetteerCountyRow = {
  readonly usps: string;
  readonly geoid: string;
  readonly stateFips: string;
  readonly countyFips3: string;
  readonly name: string;
  readonly alandSqMi: number;
  readonly awaterSqMi: number;
  readonly intptlat: number;
  readonly intptlong: number;
};

const EXPECTED_HEADER_COLUMNS = [
  'USPS',
  'GEOID',
  'ANSICODE',
  'NAME',
  'ALAND',
  'AWATER',
  'ALAND_SQMI',
  'AWATER_SQMI',
  'INTPTLAT',
  'INTPTLONG',
];

export type ParseGazetteerResult = {
  readonly rows: readonly GazetteerCountyRow[];
  /** Lines skipped (blank, malformed, or non-numeric fields), with a reason, for audit. */
  readonly rejected: readonly { readonly line: number; readonly reason: string }[];
};

/**
 * Parses raw Gazetteer county file text into rows. Fails closed per-row (a malformed row is
 * rejected with a reason, not silently coerced) but does not throw for the whole file unless
 * the header itself is unrecognized a genuinely different file format should be caught
 * immediately rather than producing thousands of garbage rows.
 */
export function parseGazetteerCountyFile(text: string): ParseGazetteerResult {
  const lines = text.split(/\r?\n/);
  const rows: GazetteerCountyRow[] = [];
  const rejected: { line: number; reason: string }[] = [];

  let headerSeen = false;
  let columnIndex: Record<string, number> = {};

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    if (!headerSeen) {
      const headerCols = rawLine.split('\t').map((c) => c.trim());
      const missing = EXPECTED_HEADER_COLUMNS.filter((col) => !headerCols.includes(col));
      if (missing.length > 0) {
        throw new Error(
          `parseGazetteerCountyFile: unrecognized Gazetteer header, missing columns: ${missing.join(', ')}`,
        );
      }
      columnIndex = Object.fromEntries(headerCols.map((col, i) => [col, i]));
      headerSeen = true;
      return;
    }

    const cols = rawLine.split('\t');
    const get = (name: string) => {
      const idx = columnIndex[name];
      return idx === undefined ? '' : (cols[idx]?.trim() ?? '');
    };

    const usps = get('USPS');
    const geoid = get('GEOID');
    const name = get('NAME');
    const alandSqMi = Number(get('ALAND_SQMI'));
    const awaterSqMi = Number(get('AWATER_SQMI'));
    const intptlat = Number(get('INTPTLAT'));
    const intptlong = Number(get('INTPTLONG'));

    if (!/^\d{5}$/.test(geoid)) {
      rejected.push({ line: index + 1, reason: `invalid GEOID: "${geoid}"` });
      return;
    }
    if (!usps || !name) {
      rejected.push({ line: index + 1, reason: 'missing USPS or NAME' });
      return;
    }
    if (![alandSqMi, awaterSqMi, intptlat, intptlong].every(Number.isFinite)) {
      rejected.push({ line: index + 1, reason: 'non-numeric area or centroid field' });
      return;
    }
    if (intptlat < -90 || intptlat > 90 || intptlong < -180 || intptlong > 180) {
      rejected.push({ line: index + 1, reason: 'centroid out of range' });
      return;
    }

    rows.push({
      usps,
      geoid,
      stateFips: geoid.slice(0, 2),
      countyFips3: geoid.slice(2),
      name,
      alandSqMi,
      awaterSqMi,
      intptlat,
      intptlong,
    });
  });

  if (!headerSeen) {
    throw new Error('parseGazetteerCountyFile: input had no header row');
  }

  return { rows, rejected };
}

const MILES_PER_DEGREE_LATITUDE = 69.0;
const MILES_PER_DEGREE_LONGITUDE_AT_EQUATOR = 69.172;

/**
 * Approximates a county bbox by centering a square (area = land + water area) on the Census
 * internal point. See the module doc's BBOX CAVEAT this is a labeled approximation, not a
 * polygon-derived extent.
 */
export function approximateCountyBBox(row: GazetteerCountyRow): JurisdictionBBoxDoc {
  const totalAreaSqMi = Math.max(row.alandSqMi + row.awaterSqMi, 0);
  const halfSideMiles = Math.sqrt(totalAreaSqMi) / 2;
  const latRad = (row.intptlat * Math.PI) / 180;
  const halfLatDeg = halfSideMiles / MILES_PER_DEGREE_LATITUDE;
  const lngScale = MILES_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos(latRad);
  const halfLngDeg = halfSideMiles / (lngScale > 1 ? lngScale : MILES_PER_DEGREE_LATITUDE);

  return [
    row.intptlong - halfLngDeg,
    row.intptlat - halfLatDeg,
    row.intptlong + halfLngDeg,
    row.intptlat + halfLatDeg,
  ];
}

export type BuildCountyJurisdictionDocsOptions = {
  readonly now?: () => string;
  readonly sourceVersion?: string;
};

export type BuildCountyDocsResult = {
  readonly docs: readonly JurisdictionDoc[];
  /** Rows outside the 50-states-+-D.C. product scope (territories), skipped per ADR-008. */
  readonly outOfScope: readonly { readonly geoid: string; readonly usps: string }[];
};

/**
 * Transforms parsed Gazetteer rows into `jurisdictions` county docs. Rows whose state FIPS
 * does not match one of the 51 rows in `US_STATES` (i.e. Puerto Rico, Guam, and other
 * territories) are excluded, not stored this repo's product scope is 50 states + D.C., the
 * same scope line ADR-008 already draw, not something this invents.
 */
export function buildCountyJurisdictionDocs(
  rows: readonly GazetteerCountyRow[],
  options: BuildCountyJurisdictionDocsOptions = {},
): BuildCountyDocsResult {
  const now = (options.now ?? (() => new Date().toISOString()))();
  const docs: JurisdictionDoc[] = [];
  const outOfScope: { geoid: string; usps: string }[] = [];

  for (const row of rows) {
    const state = stateInfoByFips(row.stateFips);
    if (!state) {
      outOfScope.push({ geoid: row.geoid, usps: row.usps });
      continue;
    }

    docs.push({
      id: countyJurisdictionId(row.stateFips, row.countyFips3),
      kind: 'county',
      name: row.name,
      parentId: stateJurisdictionId(row.stateFips),
      fipsCode: row.geoid,
      stateFips: row.stateFips,
      bbox: approximateCountyBBox(row),
      bboxSource: 'census-gazetteer-area-approximated',
      centroid: { lat: row.intptlat, lng: row.intptlong },
      sourceDataset: 'census-gazetteer-counties',
      ...(options.sourceVersion ? { sourceVersion: options.sourceVersion } : {}),
      createdAt: now,
      updatedAt: now,
    });
  }

  return { docs, outOfScope };
}
