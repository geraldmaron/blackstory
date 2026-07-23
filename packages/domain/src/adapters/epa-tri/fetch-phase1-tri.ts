/**
 * Live- and fixture-backed fetch for Phase 1 EPA TRI county facility-count observations.
 * Joins Illinois facility registry with reporting-form submissions per year, dedupes
 * distinct facilities by county — never chemical release heat maps. Caches Envirofacts
 * JSON under `.cache/phase1-eji-tri/` when live.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import {
  ensurePhase1EjiTriCacheDir,
  phase1EjiTriCachePath,
} from '../phase1-eji-tri-shared/cache-paths.js';
import { readCacheJsonIfPresent, readOrFetchCacheJson } from '../phase1-eji-tri-shared/cache-io.js';
import {
  EPA_TRI_FIXTURE_FILENAME,
  EPA_TRI_HOMEPAGE_URL,
  EPA_TRI_IL_FACILITY_API_URL,
  EPA_TRI_IL_FACILITY_CACHE_FILENAME,
  EPA_TRI_IL_REPORTING_CACHE_FILENAME_TEMPLATE,
  EPA_TRI_IL_REPORTING_FORM_API_URL_TEMPLATE,
  PHASE1_TRI_DEFAULT_COUNTY_FIPS,
  PHASE1_TRI_DEFAULT_REPORTING_YEARS,
} from './constants.js';
import {
  buildTriFacilityCountyMap,
  triRowsFromReportingForms,
} from './live-tri-illinois.js';
import {
  aggregateTriFacilityCounts,
  mapTriFacilityCountsToObservations,
  parseTriFacilityCsv,
  type Phase1TriObservationDraft,
  type TriFacilityRow,
} from './phase1-tri-mapper.js';

export type Phase1TriFetchMode = 'fixture' | 'live' | 'cache';

export type Phase1TriFetchResult = {
  readonly observations: readonly Phase1TriObservationDraft[];
  readonly rejected: readonly string[];
  readonly countyFips: readonly string[];
  readonly reportingYears: readonly number[];
  readonly sourceUrl: string;
  readonly fixturePath?: string;
  readonly cachePaths?: readonly string[];
  readonly mode: Phase1TriFetchMode;
  readonly countyCoverageCount: number;
};

type FetchOptions = {
  readonly fetchImpl?: FetchLike;
  readonly countyFips?: readonly string[];
  readonly reportingYears?: readonly number[];
  readonly fixtureCsvText?: string;
  readonly fixturePath?: string;
  readonly retrievedAt?: string;
  readonly live?: boolean;
  readonly allIllinoisCounties?: boolean;
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

async function fetchJson(url: string, fetchImpl: FetchLike): Promise<readonly Record<string, unknown>[]> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`EPA TRI live fetch failed (${response.status}) from ${url}`);
  }
  return (await response.json()) as readonly Record<string, unknown>[];
}

async function loadCachedJson(
  path: string,
  url: string,
  fetchImpl: FetchLike,
): Promise<readonly Record<string, unknown>[]> {
  return readOrFetchCacheJson(path, () => fetchJson(url, fetchImpl));
}

function reportingCachePath(year: number): string {
  return phase1EjiTriCachePath(
    EPA_TRI_IL_REPORTING_CACHE_FILENAME_TEMPLATE.replace('{year}', String(year)),
  );
}

function resolveCountyFilter(options: FetchOptions): readonly string[] | undefined {
  if (options.allIllinoisCounties === true) {
    return undefined;
  }
  return options.countyFips ?? [...PHASE1_TRI_DEFAULT_COUNTY_FIPS];
}

export async function fetchPhase1TriCountyObservations(
  options: FetchOptions = {},
): Promise<Phase1TriFetchResult> {
  const countyFilterList = resolveCountyFilter(options);
  if (countyFilterList) {
    assertCountyFipsList(countyFilterList);
  }
  const reportingYears = options.reportingYears ?? [...PHASE1_TRI_DEFAULT_REPORTING_YEARS];
  assertReportingYears(reportingYears);

  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const live = options.live === true;

  let rejected: string[] = [];
  let rows: TriFacilityRow[] = [];
  let fixturePath: string | undefined;
  const cachePaths: string[] = [];
  let mode: Phase1TriFetchMode = 'fixture';

  if (live) {
    ensurePhase1EjiTriCacheDir();
    const facilityCachePath = phase1EjiTriCachePath(EPA_TRI_IL_FACILITY_CACHE_FILENAME);
    const facilityPayload = await loadCachedJson(
      facilityCachePath,
      EPA_TRI_IL_FACILITY_API_URL,
      fetchImpl,
    );
    cachePaths.push(facilityCachePath);
    const facilityCountyMap = buildTriFacilityCountyMap(facilityPayload);

    let usedCacheOnly = true;
    for (const reportingYear of reportingYears) {
      const cachePath = reportingCachePath(reportingYear);
      if (readCacheJsonIfPresent(cachePath) === null) {
        usedCacheOnly = false;
      }
      const reportingPayload = await loadCachedJson(
        cachePath,
        EPA_TRI_IL_REPORTING_FORM_API_URL_TEMPLATE.replace('{year}', String(reportingYear)),
        fetchImpl,
      );
      cachePaths.push(cachePath);
      const parsed = triRowsFromReportingForms(
        reportingPayload,
        reportingYear,
        facilityCountyMap,
        countyFilterList,
      );
      rejected = [...rejected, ...parsed.rejected];
      rows = [...rows, ...parsed.rows];
    }
    mode = usedCacheOnly ? 'cache' : 'live';
  } else {
    const loaded = loadFixtureText(options);
    fixturePath = loaded.path;
    const parsed = parseTriFacilityCsv(loaded.text, countyFilterList);
    rejected = [...parsed.rejected];
    rows = parsed.rows.filter((row) => reportingYears.includes(row.reportingYear));
  }

  const counts = aggregateTriFacilityCounts(rows);
  const observations = mapTriFacilityCountsToObservations(counts, retrievedAt);
  const countyFips = [...new Set(rows.map((row) => row.countyFips))].sort();

  return {
    observations,
    rejected,
    countyFips,
    reportingYears,
    sourceUrl: EPA_TRI_HOMEPAGE_URL,
    countyCoverageCount: countyFips.length,
    ...(fixturePath !== undefined ? { fixturePath } : {}),
    ...(cachePaths.length > 0 ? { cachePaths } : {}),
    mode,
  };
}

export { DEFAULT_FIXTURE_PATH };
