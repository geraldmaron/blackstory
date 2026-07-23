/**
 * Maps EPA TRI facility rows into Phase 1 county facility-count observation drafts.
 * Counts distinct reporting facilities by county FIPS and reporting year. Pure functions —
 * network fetch lives in ./fetch-phase1-tri.ts.
 */
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_INDICATOR_CATALOG } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_EJI_TRI_INDICATOR_DEFINITIONS } from '../../statistics/phase1-eji-tri-indicator-catalog.js';
import {
  EPA_TRI_AGGREGATE_STRATEGY_NOTE,
  EPA_TRI_HOMEPAGE_URL,
  PHASE1_TRI_DATASET_VINTAGE,
  PHASE1_TRI_FACILITY_COUNT_COUNTY_METRIC_ID,
} from './constants.js';

export type TriFacilityRow = {
  readonly countyFips: string;
  readonly reportingYear: number;
  readonly facilityId: string;
};

export type Phase1TriObservationDraft = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly facilityCount: number;
  readonly methodologyNote: string;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function countyJurisdictionId(countyFips: string): string {
  return `county:${countyFips}`;
}

function observationId(metricId: string, jurisdictionId: string, referencePeriod: string): string {
  return `obs:${metricId}:${jurisdictionId}:${referencePeriod}`;
}

function contentHash(parts: {
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly boundaryVersion: string;
}): string {
  return sha256Json(parts).digest;
}

function metricById(metricId: string): Phase1IndicatorDefinition {
  const metric =
    PHASE1_INDICATOR_CATALOG.find((row) => row.metricId === metricId) ??
    PHASE1_EJI_TRI_INDICATOR_DEFINITIONS.find((row) => row.metricId === metricId);
  if (!metric) {
    throw new Error(`Unknown Phase 1 metric: ${metricId}`);
  }
  return metric;
}

function pickColumn(header: Map<string, number>, candidates: readonly string[]): string | undefined {
  for (const name of candidates) {
    if (header.has(name)) return name;
  }
  return undefined;
}

function normalizeHeaderName(name: string): string {
  return name.trim().replace(/^\d+\.\s*/, '').toUpperCase();
}

function buildHeaderMap(headerLine: string): Map<string, number> {
  const header = new Map<string, number>();
  for (const [index, rawName] of splitCsvLine(headerLine).entries()) {
    header.set(normalizeHeaderName(rawName), index);
  }
  return header;
}

function cell(header: Map<string, number>, row: readonly string[], column: string): string | undefined {
  const index = header.get(column);
  if (index === undefined) return undefined;
  return row[index]?.trim();
}

function assertValidCountyFips(countyFips: string): void {
  if (!/^\d{5}$/.test(countyFips)) {
    throw new Error(`Invalid county FIPS: ${JSON.stringify(countyFips)}`);
  }
}

function countyFipsFromStateAndCounty(stateAbbr: string, countyFipsSuffix: string): string | undefined {
  const stateMap: Readonly<Record<string, string>> = { IL: '17' };
  const stateFips = stateMap[stateAbbr.toUpperCase()];
  if (!stateFips) return undefined;
  const suffix = countyFipsSuffix.trim();
  if (!/^\d{3}$/.test(suffix)) return undefined;
  return `${stateFips}${suffix}`;
}

const TRI_CSV_COUNTY_FIPS_COLUMNS = [
  'COUNTY_FIPS',
  'STATE_COUNTY_FIPS_CODE',
  'FIPS',
] as const;

const TRI_CSV_FACILITY_ID_COLUMNS = [
  'TRI_FACILITY_ID',
  'TRIFID',
  'FACILITY_ID',
  'TRI_FACILITYID',
] as const;

const TRI_CSV_REPORTING_YEAR_COLUMNS = ['REPORTING_YEAR', 'REPORTING YEAR', 'YEAR'] as const;

/** Parses TRI facility CSV (basic file or curated fixture) into facility rows. */
export function parseTriFacilityCsv(
  csvText: string,
  expectedCountyFips?: readonly string[],
): {
  readonly rows: readonly TriFacilityRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], rejected: ['empty TRI CSV'] };
  }

  const header = buildHeaderMap(lines[0]!);
  const countyColumn = pickColumn(header, TRI_CSV_COUNTY_FIPS_COLUMNS);
  const facilityColumn = pickColumn(header, TRI_CSV_FACILITY_ID_COLUMNS);
  const yearColumn = pickColumn(header, TRI_CSV_REPORTING_YEAR_COLUMNS);
  const stateColumn = header.has('ST') ? 'ST' : header.has('STATE_ABBR') ? 'STATE_ABBR' : undefined;
  const countySuffixColumn = header.has('COUNTY') ? 'COUNTY' : undefined;

  const rejected: string[] = [];
  const rows: TriFacilityRow[] = [];

  if (!facilityColumn) {
    return {
      rows: [],
      rejected: [`missing facility id column (expected one of ${TRI_CSV_FACILITY_ID_COLUMNS.join(', ')})`],
    };
  }
  if (!yearColumn) {
    return {
      rows: [],
      rejected: [
        `missing reporting year column (expected one of ${TRI_CSV_REPORTING_YEAR_COLUMNS.join(', ')})`,
      ],
    };
  }

  const expected = expectedCountyFips ? new Set(expectedCountyFips) : undefined;

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitCsvLine(lines[lineIndex]!);
    const facilityId = cell(header, cells, facilityColumn);
    const reportingYear = parseNumber(cell(header, cells, yearColumn));

    if (!facilityId) {
      rejected.push(`line=${lineIndex + 1} missing facility id`);
      continue;
    }
    if (reportingYear === undefined || !Number.isInteger(reportingYear)) {
      rejected.push(`line=${lineIndex + 1} invalid reporting year for facility=${facilityId}`);
      continue;
    }

    let countyFips = countyColumn ? cell(header, cells, countyColumn) : undefined;
    if (countyFips && /^\d{3}$/.test(countyFips) && stateColumn) {
      const stateAbbr = cell(header, cells, stateColumn);
      if (stateAbbr) {
        countyFips = countyFipsFromStateAndCounty(stateAbbr, countyFips) ?? countyFips;
      }
    }
    if (!countyFips && stateColumn && countySuffixColumn) {
      const stateAbbr = cell(header, cells, stateColumn);
      const countySuffix = cell(header, cells, countySuffixColumn);
      if (stateAbbr && countySuffix && /^\d{3}$/.test(countySuffix)) {
        countyFips = countyFipsFromStateAndCounty(stateAbbr, countySuffix);
      }
    }

    if (!countyFips || !/^\d{5}$/.test(countyFips)) {
      rejected.push(`line=${lineIndex + 1} missing or invalid county FIPS for facility=${facilityId}`);
      continue;
    }
    if (expected && !expected.has(countyFips)) {
      rejected.push(`line=${lineIndex + 1} unexpected county ${countyFips}`);
      continue;
    }

    try {
      assertValidCountyFips(countyFips);
    } catch {
      rejected.push(`line=${lineIndex + 1} invalid county FIPS ${JSON.stringify(countyFips)}`);
      continue;
    }

    rows.push({ countyFips, reportingYear, facilityId });
  }

  return { rows, rejected };
}

/** Counts distinct facilities per county-year. */
export function aggregateTriFacilityCounts(
  rows: readonly TriFacilityRow[],
): ReadonlyMap<string, number> {
  const grouped = new Map<string, Set<string>>();

  for (const row of rows) {
    const key = `${row.countyFips}:${row.reportingYear}`;
    const facilities = grouped.get(key) ?? new Set<string>();
    facilities.add(row.facilityId);
    grouped.set(key, facilities);
  }

  return new Map(
    [...grouped.entries()].map(([key, facilities]) => [key, facilities.size] as const),
  );
}

function buildDraft(input: {
  readonly countyFips: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly retrievedAt: string;
  readonly facilityCount: number;
}): Phase1TriObservationDraft {
  const metric = metricById(PHASE1_TRI_FACILITY_COUNT_COUNTY_METRIC_ID);
  const jurisdictionId = countyJurisdictionId(input.countyFips);
  const boundaryVersion = 'county-2020';
  const draft: Phase1TriObservationDraft = {
    id: observationId(metric.metricId, jurisdictionId, input.referencePeriod),
    metricId: metric.metricId,
    jurisdictionId,
    boundaryVersion,
    referencePeriod: input.referencePeriod,
    datasetVintage: PHASE1_TRI_DATASET_VINTAGE,
    estimate: input.estimate,
    source: metric.externalDataSourceId,
    sourceUrl: EPA_TRI_HOMEPAGE_URL,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: metric.metricId,
      jurisdictionId,
      referencePeriod: input.referencePeriod,
      estimate: input.estimate,
      boundaryVersion,
    }),
    facilityCount: input.facilityCount,
    methodologyNote: EPA_TRI_AGGREGATE_STRATEGY_NOTE,
  };
  assertPublishedStatisticProvenance({
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    retrievedAt: draft.retrievedAt,
    contentHash: draft.contentHash,
  });
  return draft;
}

/** Converts county-year facility counts into Phase 1 observation drafts. */
export function mapTriFacilityCountsToObservations(
  counts: ReadonlyMap<string, number>,
  retrievedAt: string,
): readonly Phase1TriObservationDraft[] {
  const drafts: Phase1TriObservationDraft[] = [];

  for (const [key, count] of counts.entries()) {
    const [countyFips, yearStr] = key.split(':') as [string, string];
    drafts.push(
      buildDraft({
        countyFips,
        referencePeriod: yearStr,
        estimate: count,
        retrievedAt,
        facilityCount: count,
      }),
    );
  }

  return drafts.sort((a, b) =>
    a.jurisdictionId === b.jurisdictionId
      ? a.referencePeriod.localeCompare(b.referencePeriod)
      : a.jurisdictionId.localeCompare(b.jurisdictionId),
  );
}

export function listPhase1TriIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_EJI_TRI_INDICATOR_DEFINITIONS.filter(
    (row) => row.metricId === PHASE1_TRI_FACILITY_COUNT_COUNTY_METRIC_ID,
  );
}

export function parseTriFacilityJsonPayload(
  payload: readonly Record<string, unknown>[],
  expectedCountyFips?: readonly string[],
): {
  readonly rows: readonly TriFacilityRow[];
  readonly rejected: readonly string[];
} {
  const rejected: string[] = [];
  const rows: TriFacilityRow[] = [];
  const expected = expectedCountyFips ? new Set(expectedCountyFips) : undefined;

  for (let index = 0; index < payload.length; index += 1) {
    const row = payload[index]!;
    const facilityId =
      String(row.tri_facility_id ?? row.TRI_FACILITY_ID ?? row.trifid ?? '').trim() || undefined;
    const countyFips = String(row.state_county_fips_code ?? row.STATE_COUNTY_FIPS_CODE ?? '').trim();
    const reportingYear = parseNumber(String(row.reporting_year ?? row.REPORTING_YEAR ?? ''));

    if (!facilityId) {
      rejected.push(`json index=${index} missing facility id`);
      continue;
    }
    if (!countyFips || !/^\d{5}$/.test(countyFips)) {
      rejected.push(`json index=${index} invalid county FIPS for facility=${facilityId}`);
      continue;
    }
    if (expected && !expected.has(countyFips)) {
      rejected.push(`json index=${index} unexpected county ${countyFips}`);
      continue;
    }
    if (reportingYear === undefined || !Number.isInteger(reportingYear)) {
      rejected.push(`json index=${index} invalid reporting year for facility=${facilityId}`);
      continue;
    }

    rows.push({ countyFips, reportingYear, facilityId });
  }

  return { rows, rejected };
}
