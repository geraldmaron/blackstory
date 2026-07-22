/**
 * Maps FFIEC HMDA Data Browser county aggregation JSON into Phase 1 denial-rate
 * observation drafts (derived_race slices + Black–White gap). Pure functions — network
 * fetch lives in ./fetch-phase1-hmda-aggregates.ts.
 */
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_INDICATOR_CATALOG } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_HMDA_INDICATOR_DEFINITIONS } from '../../statistics/phase1-hmda-indicator-catalog.js';
import {
  HMDA_AGGREGATE_STRATEGY_NOTE,
  HMDA_DATA_BROWSER_HOMEPAGE_URL,
  HMDA_DERIVED_RACE_BLACK,
  HMDA_DERIVED_RACE_WHITE,
  HMDA_DENIAL_RATE_ACTIONS_TAKEN,
  PHASE1_HMDA_DATASET_VINTAGE,
  PHASE1_HMDA_DENIAL_RATE_BLACK_COUNTY_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_GAP_BLACK_WHITE_COUNTY_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_WHITE_COUNTY_METRIC_ID,
} from './constants.js';

export type HmdaAggregationSlice = {
  readonly count: number;
  readonly sum?: number;
  readonly actions_taken: string;
  readonly races: string;
  readonly county?: string;
  readonly activity_year?: string;
  readonly state?: string;
};

export type HmdaAggregationsResponse = {
  readonly parameters?: Record<string, string>;
  readonly aggregations: readonly HmdaAggregationSlice[];
  readonly servedFrom?: string;
};

export type Phase1HmdaObservationDraft = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly raceEthnicitySlice?: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly applicationCount?: number;
  readonly denialCount?: number;
  readonly methodologyNote: string;
};

type RaceYearCounts = {
  readonly race: string;
  readonly referenceYear: number;
  readonly countyFips: string;
  readonly applications: number;
  readonly denials: number;
};

function roundPct(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundGap(value: number): number {
  return Math.round(value * 10) / 10;
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
    PHASE1_HMDA_INDICATOR_DEFINITIONS.find((row) => row.metricId === metricId);
  if (!metric) {
    throw new Error(`Unknown Phase 1 metric: ${metricId}`);
  }
  return metric;
}

function inferReferenceYear(
  slice: HmdaAggregationSlice,
  fallbackYear?: number,
): number | undefined {
  const fromSlice = slice.activity_year?.trim();
  if (fromSlice && /^\d{4}$/.test(fromSlice)) {
    return Number(fromSlice);
  }
  return fallbackYear;
}

function parseAggregationYear(parameters?: Record<string, string>): number | undefined {
  const years = parameters?.years?.trim();
  if (!years) return undefined;
  const first = years.split(',')[0]?.trim();
  if (first && /^\d{4}$/.test(first)) {
    return Number(first);
  }
  return undefined;
}

function assertValidCountyFips(countyFips: string): void {
  if (!/^\d{5}$/.test(countyFips)) {
    throw new Error(`Invalid county FIPS: ${JSON.stringify(countyFips)}`);
  }
}

/** Parses one FFIEC aggregations JSON payload into race-year application/denial counts. */
export function parseHmdaCountyAggregationResponse(
  payload: HmdaAggregationsResponse,
  expectedCountyFips?: string,
): {
  readonly rows: readonly RaceYearCounts[];
  readonly rejected: readonly string[];
} {
  const fallbackYear = parseAggregationYear(payload.parameters);
  const fallbackCounty =
    payload.parameters?.counties?.split(',')[0]?.trim() || expectedCountyFips;
  const grouped = new Map<string, RaceYearCounts>();
  const rejected: string[] = [];

  for (const slice of payload.aggregations) {
    const countyFips = slice.county?.trim() || fallbackCounty;
    if (!countyFips) {
      rejected.push(`missing county on aggregation slice races=${slice.races}`);
      continue;
    }
    if (expectedCountyFips && countyFips !== expectedCountyFips) {
      rejected.push(`unexpected county ${countyFips} (expected ${expectedCountyFips})`);
      continue;
    }
    try {
      assertValidCountyFips(countyFips);
    } catch {
      rejected.push(`invalid county FIPS: ${JSON.stringify(countyFips)}`);
      continue;
    }

    const referenceYear = inferReferenceYear(slice, fallbackYear);
    if (referenceYear === undefined) {
      rejected.push(`missing activity_year for county=${countyFips} race=${slice.races}`);
      continue;
    }

    if (
      slice.races !== HMDA_DERIVED_RACE_WHITE &&
      slice.races !== HMDA_DERIVED_RACE_BLACK
    ) {
      rejected.push(`unsupported race slice: ${JSON.stringify(slice.races)}`);
      continue;
    }

    if (!HMDA_DENIAL_RATE_ACTIONS_TAKEN.includes(slice.actions_taken as '1' | '2' | '3')) {
      rejected.push(
        `unsupported actions_taken=${JSON.stringify(slice.actions_taken)} for race=${slice.races}`,
      );
      continue;
    }

    if (!Number.isFinite(slice.count) || slice.count < 0) {
      rejected.push(`invalid count for race=${slice.races} year=${referenceYear}`);
      continue;
    }

    const key = `${countyFips}:${referenceYear}:${slice.races}`;
    const existing = grouped.get(key) ?? {
      race: slice.races,
      referenceYear,
      countyFips,
      applications: 0,
      denials: 0,
    };

    const applications = existing.applications + slice.count;
    const denials = existing.denials + (slice.actions_taken === '3' ? slice.count : 0);
    grouped.set(key, {
      ...existing,
      applications,
      denials,
    });
  }

  return { rows: [...grouped.values()], rejected };
}

function denialRatePct(applications: number, denials: number): number | undefined {
  if (applications <= 0) return undefined;
  return roundPct((denials / applications) * 100);
}

function buildDraft(input: {
  readonly metricId: string;
  readonly countyFips: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly retrievedAt: string;
  readonly raceEthnicitySlice?: string;
  readonly applicationCount?: number;
  readonly denialCount?: number;
}): Phase1HmdaObservationDraft {
  const metric = metricById(input.metricId);
  const jurisdictionId = countyJurisdictionId(input.countyFips);
  const boundaryVersion = 'county-2020';
  const draft: Phase1HmdaObservationDraft = {
    id: observationId(metric.metricId, jurisdictionId, input.referencePeriod),
    metricId: metric.metricId,
    jurisdictionId,
    boundaryVersion,
    referencePeriod: input.referencePeriod,
    datasetVintage: PHASE1_HMDA_DATASET_VINTAGE,
    estimate: input.estimate,
    source: metric.externalDataSourceId,
    sourceUrl: HMDA_DATA_BROWSER_HOMEPAGE_URL,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: metric.metricId,
      jurisdictionId,
      referencePeriod: input.referencePeriod,
      estimate: input.estimate,
      boundaryVersion,
    }),
    methodologyNote: HMDA_AGGREGATE_STRATEGY_NOTE,
    ...(input.raceEthnicitySlice !== undefined ? { raceEthnicitySlice: input.raceEthnicitySlice } : {}),
    ...(input.applicationCount !== undefined ? { applicationCount: input.applicationCount } : {}),
    ...(input.denialCount !== undefined ? { denialCount: input.denialCount } : {}),
  };
  assertPublishedStatisticProvenance({
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    retrievedAt: draft.retrievedAt,
    contentHash: draft.contentHash,
  });
  return draft;
}

/** Converts parsed race-year counts into Black, White, and gap observation drafts. */
export function mapHmdaCountyCountsToObservations(
  rows: readonly RaceYearCounts[],
  retrievedAt: string,
): readonly Phase1HmdaObservationDraft[] {
  const byYearCounty = new Map<string, Map<string, RaceYearCounts>>();
  for (const row of rows) {
    const yearKey = `${row.countyFips}:${row.referenceYear}`;
    const raceMap = byYearCounty.get(yearKey) ?? new Map<string, RaceYearCounts>();
    raceMap.set(row.race, row);
    byYearCounty.set(yearKey, raceMap);
  }

  const drafts: Phase1HmdaObservationDraft[] = [];

  for (const [, raceMap] of byYearCounty) {
    const black = raceMap.get(HMDA_DERIVED_RACE_BLACK);
    const white = raceMap.get(HMDA_DERIVED_RACE_WHITE);
    if (!black || !white) continue;

    const referencePeriod = String(black.referenceYear);
    const countyFips = black.countyFips;

    const blackRate = denialRatePct(black.applications, black.denials);
    if (blackRate !== undefined) {
      drafts.push(
        buildDraft({
          metricId: PHASE1_HMDA_DENIAL_RATE_BLACK_COUNTY_METRIC_ID,
          countyFips,
          referencePeriod,
          estimate: blackRate,
          retrievedAt,
          raceEthnicitySlice: 'black',
          applicationCount: black.applications,
          denialCount: black.denials,
        }),
      );
    }

    const whiteRate = denialRatePct(white.applications, white.denials);
    if (whiteRate !== undefined) {
      drafts.push(
        buildDraft({
          metricId: PHASE1_HMDA_DENIAL_RATE_WHITE_COUNTY_METRIC_ID,
          countyFips,
          referencePeriod,
          estimate: whiteRate,
          retrievedAt,
          raceEthnicitySlice: 'white',
          applicationCount: white.applications,
          denialCount: white.denials,
        }),
      );
    }

    if (blackRate !== undefined && whiteRate !== undefined) {
      drafts.push(
        buildDraft({
          metricId: PHASE1_HMDA_DENIAL_RATE_GAP_BLACK_WHITE_COUNTY_METRIC_ID,
          countyFips,
          referencePeriod,
          estimate: roundGap(blackRate - whiteRate),
          retrievedAt,
        }),
      );
    }
  }

  return drafts;
}

export function listPhase1HmdaIndicators(): readonly Phase1IndicatorDefinition[] {
  const fromMain = PHASE1_INDICATOR_CATALOG.filter(
    (row) => row.externalDataSourceId === 'hmda-loan-level',
  );
  return fromMain.length > 0 ? fromMain : PHASE1_HMDA_INDICATOR_DEFINITIONS;
}
