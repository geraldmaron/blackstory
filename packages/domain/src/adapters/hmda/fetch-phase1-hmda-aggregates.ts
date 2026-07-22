/**
 * Live fetch for Phase 1 HMDA county aggregate denial-rate observations via FFIEC
 * Data Browser /view/aggregations (never loan-level CSV).
 */
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import {
  HMDA_COUNTY_AGGREGATIONS_URL_TEMPLATE,
  HMDA_DATA_BROWSER_AGGREGATIONS_API_URL,
  HMDA_DATA_BROWSER_HOMEPAGE_URL,
  PHASE1_HMDA_DEFAULT_COUNTY_FIPS,
  PHASE1_HMDA_DEFAULT_YEARS,
} from './constants.js';
import {
  mapHmdaCountyCountsToObservations,
  parseHmdaCountyAggregationResponse,
  type HmdaAggregationsResponse,
  type Phase1HmdaObservationDraft,
} from './phase1-hmda-mapper.js';

export type Phase1HmdaFetchResult = {
  readonly observations: readonly Phase1HmdaObservationDraft[];
  readonly rejected: readonly string[];
  readonly yearsFetched: readonly number[];
  readonly countyFips: string;
  readonly sourceUrl: string;
};

type FetchOptions = {
  readonly fetchImpl?: FetchLike;
  readonly countyFips?: string;
  readonly years?: readonly number[];
  readonly aggregationPayloads?: ReadonlyMap<number, HmdaAggregationsResponse>;
  readonly retrievedAt?: string;
};

function buildCountyAggregationsUrl(countyFips: string, years: readonly number[]): string {
  const yearsParam = years.join(',');
  return HMDA_COUNTY_AGGREGATIONS_URL_TEMPLATE.replace('{years}', yearsParam).replace(
    '{countyFips}',
    countyFips,
  );
}

function assertCountyFips(countyFips: string): void {
  if (!/^\d{5}$/.test(countyFips)) {
    throw new Error(`countyFips must be 5-digit FIPS, got "${countyFips}"`);
  }
}

function assertYears(years: readonly number[]): void {
  if (years.length === 0) {
    throw new Error('years must not be empty for bounded county fetch');
  }
  for (const year of years) {
    if (!Number.isInteger(year) || year < 2007 || year > 2100) {
      throw new Error(`Invalid HMDA activity year: ${year}`);
    }
  }
}

async function fetchAggregationForYear(
  countyFips: string,
  year: number,
  fetchImpl: FetchLike,
): Promise<HmdaAggregationsResponse> {
  const url = buildCountyAggregationsUrl(countyFips, [year]);
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`HMDA aggregations fetch failed (${response.status}) from ${url}`);
  }
  return (await response.json()) as HmdaAggregationsResponse;
}

function filterPayloadByYear(
  payload: HmdaAggregationsResponse,
  year: number,
): HmdaAggregationsResponse {
  const yearStr = String(year);
  return {
    ...payload,
    parameters: {
      ...(payload.parameters ?? {}),
      years: yearStr,
    },
    aggregations: payload.aggregations.filter((row) => {
      if (row.activity_year) {
        return row.activity_year === yearStr;
      }
      const paramYears = payload.parameters?.years?.split(',') ?? [];
      return paramYears.length === 1 && paramYears[0] === yearStr;
    }),
  };
}

export async function fetchPhase1HmdaCountyObservations(
  options: FetchOptions = {},
): Promise<Phase1HmdaFetchResult> {
  const countyFips = options.countyFips ?? PHASE1_HMDA_DEFAULT_COUNTY_FIPS;
  const years = options.years ?? [...PHASE1_HMDA_DEFAULT_YEARS];
  assertCountyFips(countyFips);
  assertYears(years);

  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const rejected: string[] = [];
  const allRows: ReturnType<typeof parseHmdaCountyAggregationResponse>['rows'][number][] = [];

  if (options.aggregationPayloads) {
    for (const year of years) {
      const payload = options.aggregationPayloads.get(year);
      if (!payload) {
        rejected.push(`missing fixture payload for year=${year}`);
        continue;
      }
      const parsed = parseHmdaCountyAggregationResponse(
        filterPayloadByYear(payload, year),
        countyFips,
      );
      rejected.push(...parsed.rejected);
      allRows.push(...parsed.rows);
    }
  } else {
    for (const year of years) {
      try {
        const payload = await fetchAggregationForYear(countyFips, year, fetchImpl);
        const normalized: HmdaAggregationsResponse = {
          ...payload,
          parameters: {
            ...(payload.parameters ?? {}),
            years: String(year),
            counties: countyFips,
          },
        };
        const parsed = parseHmdaCountyAggregationResponse(normalized, countyFips);
        rejected.push(...parsed.rejected);
        allRows.push(...parsed.rows);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rejected.push(`year=${year} fetch failed: ${message}`);
      }
    }
  }

  const observations = mapHmdaCountyCountsToObservations(allRows, retrievedAt);

  return {
    observations,
    rejected,
    yearsFetched: years,
    countyFips,
    sourceUrl: HMDA_DATA_BROWSER_HOMEPAGE_URL,
  };
}

export {
  buildCountyAggregationsUrl,
  HMDA_DATA_BROWSER_AGGREGATIONS_API_URL,
  HMDA_COUNTY_AGGREGATIONS_URL_TEMPLATE,
};
