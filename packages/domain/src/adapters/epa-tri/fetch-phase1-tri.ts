/**
 * Fixture-backed fetch for Phase 1 EPA TRI county facility-count observations.
 * Loads curated facility CSV or optional Envirofacts JSON — never chemical release heat maps.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import {
  EPA_TRI_FIXTURE_FILENAME,
  EPA_TRI_HOMEPAGE_URL,
  EPA_TRI_IL_FACILITY_API_URL,
  PHASE1_TRI_DEFAULT_COUNTY_FIPS,
  PHASE1_TRI_DEFAULT_REPORTING_YEARS,
} from './constants.js';
import {
  aggregateTriFacilityCounts,
  mapTriFacilityCountsToObservations,
  parseTriFacilityCsv,
  parseTriFacilityJsonPayload,
  type Phase1TriObservationDraft,
} from './phase1-tri-mapper.js';

export type Phase1TriFetchResult = {
  readonly observations: readonly Phase1TriObservationDraft[];
  readonly rejected: readonly string[];
  readonly countyFips: readonly string[];
  readonly reportingYears: readonly number[];
  readonly sourceUrl: string;
  readonly fixturePath?: string;
  readonly mode: 'fixture' | 'live';
};

type FetchOptions = {
  readonly fetchImpl?: FetchLike;
  readonly countyFips?: readonly string[];
  readonly reportingYears?: readonly number[];
  readonly fixtureCsvText?: string;
  readonly fixturePath?: string;
  readonly retrievedAt?: string;
  readonly live?: boolean;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = join(
  __dirname,
  '../../../../firebase/fixtures/reference-indicators',
  EPA_TRI_FIXTURE_FILENAME,
);

function loadFixtureText(options: FetchOptions): { readonly text: string; readonly path: string } {
  if (options.fixtureCsvText !== undefined) {
    return {
      text: options.fixtureCsvText,
      path: options.fixturePath ?? '(inline fixtureCsvText)',
    };
  }
  const fixturePath = options.fixturePath ?? DEFAULT_FIXTURE_PATH;
  return {
    text: readFileSync(fixturePath, 'utf8'),
    path: fixturePath,
  };
}

function assertCountyFipsList(countyFips: readonly string[]): void {
  for (const fips of countyFips) {
    if (!/^\d{5}$/.test(fips)) {
      throw new Error(`countyFips entry must be 5-digit FIPS, got "${fips}"`);
    }
  }
}

function assertReportingYears(years: readonly number[]): void {
  if (years.length === 0) {
    throw new Error('reportingYears must not be empty for bounded county fetch');
  }
  for (const year of years) {
    if (!Number.isInteger(year) || year < 1987 || year > 2100) {
      throw new Error(`Invalid TRI reporting year: ${year}`);
    }
  }
}

async function fetchLiveIllinoisFacilities(fetchImpl: FetchLike): Promise<readonly Record<string, unknown>[]> {
  const response = await fetchImpl(EPA_TRI_IL_FACILITY_API_URL);
  if (!response.ok) {
    throw new Error(`EPA TRI live fetch failed (${response.status}) from ${EPA_TRI_IL_FACILITY_API_URL}`);
  }
  return (await response.json()) as readonly Record<string, unknown>[];
}

export async function fetchPhase1TriCountyObservations(
  options: FetchOptions = {},
): Promise<Phase1TriFetchResult> {
  const countyFips = options.countyFips ?? [...PHASE1_TRI_DEFAULT_COUNTY_FIPS];
  const reportingYears = options.reportingYears ?? [...PHASE1_TRI_DEFAULT_REPORTING_YEARS];
  assertCountyFipsList(countyFips);
  assertReportingYears(reportingYears);

  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const live = options.live === true;
  const yearSet = new Set(reportingYears);

  let rejected: string[] = [];
  let rows: ReturnType<typeof parseTriFacilityCsv>['rows'] = [];
  let fixturePath: string | undefined;
  let mode: 'fixture' | 'live' = 'fixture';

  if (live) {
    const payload = await fetchLiveIllinoisFacilities(fetchImpl);
    const parsed = parseTriFacilityJsonPayload(payload, countyFips);
    rejected = [...parsed.rejected];
    rows = parsed.rows.filter((row) => yearSet.has(row.reportingYear));
    mode = 'live';
  } else {
    const loaded = loadFixtureText(options);
    fixturePath = loaded.path;
    const parsed = parseTriFacilityCsv(loaded.text, countyFips);
    rejected = [...parsed.rejected];
    rows = parsed.rows.filter((row) => yearSet.has(row.reportingYear));
  }

  const counts = aggregateTriFacilityCounts(rows);
  const observations = mapTriFacilityCountsToObservations(counts, retrievedAt);

  return {
    observations,
    rejected,
    countyFips,
    reportingYears,
    sourceUrl: EPA_TRI_HOMEPAGE_URL,
    ...(fixturePath !== undefined ? { fixturePath } : {}),
    mode,
  };
}

export { DEFAULT_FIXTURE_PATH };
