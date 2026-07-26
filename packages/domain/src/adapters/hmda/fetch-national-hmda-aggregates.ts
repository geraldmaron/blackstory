/**
 * Live fetch for national HMDA aggregate denial-rate observations via FFIEC
 * Data Browser /view/aggregations (never loan-level CSV).
 * Conventional home-purchase, first-lien, owner-occupied, 1–4 unit.
 */
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import {
  HMDA_DATA_BROWSER_AGGREGATIONS_API_URL,
  HMDA_DATA_BROWSER_HOMEPAGE_URL,
  PHASE1_HMDA_NATION_YEARS,
} from './constants.js';
import {
  mapHmdaNationCountsToObservations,
  parseHmdaNationAggregationResponse,
  type HmdaAggregationsResponse,
  type Phase1HmdaObservationDraft,
} from './phase1-hmda-mapper.js';

export type Phase1NationHmdaFetchResult = {
  readonly observations: readonly Phase1HmdaObservationDraft[];
  readonly rejected: readonly string[];
  readonly yearsFetched: readonly number[];
  readonly sourceUrl: string;
};

type FetchOptions = {
  readonly fetchImpl?: FetchLike;
  readonly years?: readonly number[];
  readonly aggregationPayloads?: ReadonlyMap<number, HmdaAggregationsResponse>;
  readonly retrievedAt?: string;
};

function buildNationAggregationsUrl(years: readonly number[]): string {
  const yearsParam = years.join(',');
  return (
    `${HMDA_DATA_BROWSER_AGGREGATIONS_API_URL}?years=${yearsParam}` +
    '&actions_taken=1,2,3&races=White,Black%20or%20African%20American'
  );
}

function assertYears(years: readonly number[]): void {
  if (years.length === 0) {
    throw new Error('years must not be empty for national fetch');
  }
  for (const year of years) {
    if (!Number.isInteger(year) || year < 2007 || year > 2100) {
      throw new Error(`Invalid HMDA activity year: ${year}`);
    }
  }
}

async function fetchAggregationForYear(
  year: number,
  fetchImpl: FetchLike,
): Promise<HmdaAggregationsResponse> {
  const url = buildNationAggregationsUrl([year]);
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`HMDA national aggregations fetch failed (${response.status}) from ${url}`);
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

/**
 * Live FFIEC responses omit `years` per slice; stamp request context before parsing.
 */
function normalizeHmdaAggregationPayloadForNationYear(
  payload: HmdaAggregationsResponse,
  year: number,
): HmdaAggregationsResponse {
  const yearStr = String(year);
  return {
    ...payload,
    parameters: {
      ...(payload.parameters ?? {}),
      years: yearStr,
      year: yearStr,
    },
    aggregations: payload.aggregations.map((slice) => ({
      ...slice,
      actions_taken: String(slice.actions_taken),
      ...(slice.activity_year ? {} : { activity_year: yearStr }),
    })),
  };
}

export async function fetchPhase1NationHmdaObservations(
  options: FetchOptions = {},
): Promise<Phase1NationHmdaFetchResult> {
  const years = options.years ?? [...PHASE1_HMDA_NATION_YEARS];
  assertYears(years);

  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const rejected: string[] = [];
  const allRows: ReturnType<typeof parseHmdaNationAggregationResponse>['rows'][number][] = [];

  if (options.aggregationPayloads) {
    for (const year of years) {
      const payload = options.aggregationPayloads.get(year);
      if (!payload) {
        rejected.push(`missing fixture payload for year=${year}`);
        continue;
      }
      const parsed = parseHmdaNationAggregationResponse(filterPayloadByYear(payload, year));
      rejected.push(...parsed.rejected);
      allRows.push(...parsed.rows);
    }
  } else {
    for (const year of years) {
      try {
        const payload = await fetchAggregationForYear(year, fetchImpl);
        const normalized = normalizeHmdaAggregationPayloadForNationYear(payload, year);
        const parsed = parseHmdaNationAggregationResponse(normalized);
        rejected.push(...parsed.rejected);
        allRows.push(...parsed.rows);
      } catch (error) {
        rejected.push(`fetch error for year=${year}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const sourceUrl = buildNationAggregationsUrl(years);
  const observations = mapHmdaNationCountsToObservations(allRows, retrievedAt);

  return {
    observations,
    rejected,
    yearsFetched: [...new Set(allRows.map((r) => r.referenceYear))].sort(),
    sourceUrl,
  };
}
