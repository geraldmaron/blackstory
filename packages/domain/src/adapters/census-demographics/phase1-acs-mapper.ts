/**
 * Maps parsed ACS 5-year rows into Phase 1 statistical observation drafts for
 * bb_reference.statistical_observations. Pure functions — fetch lives in
 * ./fetch-phase1-acs.ts and packages/firebase/scripts/ingest-phase1-acs.ts.
 */
import { ACS_PROGRAM_HOMEPAGE_URL } from './acs-url-builder.js';
import type { AcsProfileRow, AcsVintage } from './acs-types.js';
import {
  phase1AcsDatasetVintageLabel,
  phase1AcsReferencePeriod,
} from './phase1-acs-variables.js';
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_INDICATOR_CATALOG } from '../../statistics/phase1-indicator-catalog.js';

export type Phase1AcsGeography = 'county' | 'state';

export type Phase1AcsObservationDraft = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly marginOfError?: number;
  readonly numerator?: number;
  readonly denominator?: number;
  readonly raceEthnicitySlice?: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
};

type ParsedAcsRow = {
  readonly geography: Phase1AcsGeography;
  readonly stateFips: string;
  readonly countyFips?: string;
  readonly name: string;
  readonly values: Readonly<Record<string, number>>;
  readonly suppressed: readonly string[];
};

function roundPct(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundUsd(value: number): number {
  return Math.round(value);
}

function pct(numerator: number, denominator: number): number | undefined {
  if (denominator <= 0) return undefined;
  return roundPct((numerator / denominator) * 100);
}

function getValue(row: ParsedAcsRow, field: string): number | undefined {
  if (row.suppressed.includes(field)) return undefined;
  return row.values[field];
}

function countyJurisdictionId(stateFips: string, countyFips: string): string {
  return `county:${stateFips}${countyFips}`;
}

function stateJurisdictionId(stateFips: string): string {
  return `state:${stateFips}`;
}

function boundaryVersion(geography: Phase1AcsGeography): string {
  return geography === 'county' ? 'county-2020' : 'state-2020';
}

function observationId(
  metricId: string,
  jurisdictionId: string,
  referencePeriod: string,
): string {
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

function buildDraft(input: {
  readonly metric: Phase1IndicatorDefinition;
  readonly jurisdictionId: string;
  readonly geography: Phase1AcsGeography;
  readonly vintage: AcsVintage;
  readonly retrievedAt: string;
  readonly estimate: number;
  readonly marginOfError?: number;
  readonly numerator?: number;
  readonly denominator?: number;
}): Phase1AcsObservationDraft {
  const referencePeriod = phase1AcsReferencePeriod(input.vintage);
  const boundary = boundaryVersion(input.geography);
  const draft: Phase1AcsObservationDraft = {
    id: observationId(input.metric.metricId, input.jurisdictionId, referencePeriod),
    metricId: input.metric.metricId,
    jurisdictionId: input.jurisdictionId,
    boundaryVersion: boundary,
    referencePeriod,
    datasetVintage: phase1AcsDatasetVintageLabel(input.vintage),
    estimate: input.estimate,
    source: input.metric.externalDataSourceId,
    sourceUrl: ACS_PROGRAM_HOMEPAGE_URL,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: input.metric.metricId,
      jurisdictionId: input.jurisdictionId,
      referencePeriod,
      estimate: input.estimate,
      boundaryVersion: boundary,
    }),
    ...(input.marginOfError !== undefined ? { marginOfError: input.marginOfError } : {}),
    ...(input.numerator !== undefined ? { numerator: input.numerator } : {}),
    ...(input.denominator !== undefined ? { denominator: input.denominator } : {}),
    ...(input.metric.raceEthnicitySlice
      ? { raceEthnicitySlice: input.metric.raceEthnicitySlice }
      : {}),
  };
  assertPublishedStatisticProvenance(draft);
  return draft;
}

function metricById(metricId: string): Phase1IndicatorDefinition {
  const metric = PHASE1_INDICATOR_CATALOG.find((row) => row.metricId === metricId);
  if (!metric) {
    throw new Error(`Unknown Phase 1 metric: ${metricId}`);
  }
  return metric;
}

/** Parses ACS array-of-arrays payload for county or state geography. */
export function parsePhase1AcsResponse(
  vintage: AcsVintage,
  payload: readonly (readonly (string | null)[])[],
  geography: Phase1AcsGeography,
): { readonly rows: readonly ParsedAcsRow[]; readonly rejected: readonly string[] } {
  if (payload.length < 2) return { rows: [], rejected: ['response has no data rows'] };
  const header = payload[0]!;
  const nameIdx = header.indexOf('NAME');
  const stateIdx = header.indexOf('state');
  const countyIdx = header.indexOf('county');
  const variableIdx = vintage.variables.map((spec) => ({ spec, idx: header.indexOf(spec.id) }));

  const missing = [
    ...(nameIdx < 0 ? ['NAME'] : []),
    ...(stateIdx < 0 ? ['state'] : []),
    ...(geography === 'county' && countyIdx < 0 ? ['county'] : []),
    ...variableIdx.filter(({ idx }) => idx < 0).map(({ spec }) => spec.id),
  ];
  if (missing.length > 0) {
    throw new Error(
      `${vintage.dataset}: response header missing expected columns: ${missing.join(', ')}`,
    );
  }

  const rows: ParsedAcsRow[] = [];
  const rejected: string[] = [];
  for (const row of payload.slice(1)) {
    const stateFips = row[stateIdx] ?? '';
    const countyFips = geography === 'county' ? (row[countyIdx] ?? '') : undefined;
    if (!/^\d{2}$/.test(stateFips)) {
      rejected.push(`bad state FIPS: ${JSON.stringify(row)}`);
      continue;
    }
    if (geography === 'county' && !/^\d{3}$/.test(countyFips ?? '')) {
      rejected.push(`bad county FIPS: ${JSON.stringify(row)}`);
      continue;
    }

    const values: Record<string, number> = {};
    const suppressed: string[] = [];
    let malformed: string | undefined;
    for (const { spec, idx } of variableIdx) {
      const raw = row[idx];
      if (raw === null || raw === undefined || raw === '') {
        suppressed.push(spec.field);
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        malformed = `bad estimate for ${spec.id}: ${JSON.stringify(row)}`;
        break;
      }
      if (value < 0) {
        suppressed.push(spec.field);
        continue;
      }
      values[spec.field] = value;
    }
    if (malformed) {
      rejected.push(malformed);
      continue;
    }

    rows.push({
      geography,
      stateFips,
      ...(countyFips ? { countyFips } : {}),
      name: row[nameIdx] ?? '',
      values,
      suppressed,
    });
  }
  return { rows, rejected };
}

/** Converts one parsed ACS row into zero or more Phase 1 observation drafts. */
export function mapPhase1AcsRowToObservations(
  row: ParsedAcsRow,
  vintage: AcsVintage,
  retrievedAt: string,
): readonly Phase1AcsObservationDraft[] {
  const jurisdictionId =
    row.geography === 'county'
      ? countyJurisdictionId(row.stateFips, row.countyFips!)
      : stateJurisdictionId(row.stateFips);

  const drafts: Phase1AcsObservationDraft[] = [];

  if (row.geography === 'county') {
    const raceUniverse = getValue(row, 'raceUniverse');
    const blackPopulation = getValue(row, 'blackPopulation');
    const blackShare =
      raceUniverse !== undefined && blackPopulation !== undefined
        ? pct(blackPopulation, raceUniverse)
        : undefined;
    if (blackShare !== undefined) {
      drafts.push(
        buildDraft({
          metric: metricById('acs-black-population-share-county'),
          jurisdictionId,
          geography: row.geography,
          vintage,
          retrievedAt,
          estimate: blackShare,
          ...(blackPopulation !== undefined ? { numerator: blackPopulation } : {}),
          ...(raceUniverse !== undefined ? { denominator: raceUniverse } : {}),
        }),
      );
    }

    const medianBlack = getValue(row, 'medianHouseholdIncomeBlack');
    if (medianBlack !== undefined) {
      drafts.push(
        buildDraft({
          metric: metricById('acs-median-hh-income-black-county'),
          jurisdictionId,
          geography: row.geography,
          vintage,
          retrievedAt,
          estimate: roundUsd(medianBlack),
          ...(getValue(row, 'medianHouseholdIncomeBlackMoe') !== undefined
            ? { marginOfError: getValue(row, 'medianHouseholdIncomeBlackMoe')! }
            : {}),
        }),
      );
    }

    const medianWhite = getValue(row, 'medianHouseholdIncomeWhite');
    if (medianWhite !== undefined) {
      drafts.push(
        buildDraft({
          metric: metricById('acs-median-hh-income-white-county'),
          jurisdictionId,
          geography: row.geography,
          vintage,
          retrievedAt,
          estimate: roundUsd(medianWhite),
          ...(getValue(row, 'medianHouseholdIncomeWhiteMoe') !== undefined
            ? { marginOfError: getValue(row, 'medianHouseholdIncomeWhiteMoe')! }
            : {}),
        }),
      );
    }

    const povertyRate = pct(
      getValue(row, 'povertyCount') ?? 0,
      getValue(row, 'povertyUniverse') ?? 0,
    );
    if (
      povertyRate !== undefined &&
      getValue(row, 'povertyCount') !== undefined &&
      getValue(row, 'povertyUniverse') !== undefined
    ) {
      drafts.push(
        buildDraft({
          metric: metricById('acs-poverty-rate-black-county'),
          jurisdictionId,
          geography: row.geography,
          vintage,
          retrievedAt,
          estimate: povertyRate,
          ...(getValue(row, 'povertyCount') !== undefined
            ? { numerator: getValue(row, 'povertyCount')! }
            : {}),
          ...(getValue(row, 'povertyUniverse') !== undefined
            ? { denominator: getValue(row, 'povertyUniverse')! }
            : {}),
        }),
      );
    }

    const homeownershipRate = pct(
      getValue(row, 'ownerOccupiedBlack') ?? 0,
      getValue(row, 'tenureUniverseBlack') ?? 0,
    );
    if (
      homeownershipRate !== undefined &&
      getValue(row, 'ownerOccupiedBlack') !== undefined &&
      getValue(row, 'tenureUniverseBlack') !== undefined
    ) {
      drafts.push(
        buildDraft({
          metric: metricById('acs-homeownership-rate-black-county'),
          jurisdictionId,
          geography: row.geography,
          vintage,
          retrievedAt,
          estimate: homeownershipRate,
          ...(getValue(row, 'ownerOccupiedBlack') !== undefined
            ? { numerator: getValue(row, 'ownerOccupiedBlack')! }
            : {}),
          ...(getValue(row, 'tenureUniverseBlack') !== undefined
            ? { denominator: getValue(row, 'tenureUniverseBlack')! }
            : {}),
        }),
      );
    }

    const baNumerator =
      (getValue(row, 'baPlusMaleBlack') ?? 0) + (getValue(row, 'baPlusFemaleBlack') ?? 0);
    const baDenominator = getValue(row, 'educationUniverse25PlusBlack');
    const baRate =
      baDenominator !== undefined &&
      getValue(row, 'baPlusMaleBlack') !== undefined &&
      getValue(row, 'baPlusFemaleBlack') !== undefined
        ? pct(baNumerator, baDenominator)
        : undefined;
    if (baRate !== undefined) {
      drafts.push(
        buildDraft({
          metric: metricById('acs-ba-attainment-black-county'),
          jurisdictionId,
          geography: row.geography,
          vintage,
          retrievedAt,
          estimate: baRate,
          numerator: baNumerator,
          ...(baDenominator !== undefined ? { denominator: baDenominator } : {}),
        }),
      );
    }
  }

  if (row.geography === 'state') {
    const employed =
      (getValue(row, 'employedMaleBlack1664') ?? 0) +
      (getValue(row, 'employedFemaleBlack1664') ?? 0);
    const unemployed =
      (getValue(row, 'unemployedMaleBlack1664') ?? 0) +
      (getValue(row, 'unemployedFemaleBlack1664') ?? 0);
    const laborForce = employed + unemployed;
    const unemploymentRate =
      laborForce > 0 &&
      getValue(row, 'employedMaleBlack1664') !== undefined &&
      getValue(row, 'employedFemaleBlack1664') !== undefined &&
      getValue(row, 'unemployedMaleBlack1664') !== undefined &&
      getValue(row, 'unemployedFemaleBlack1664') !== undefined
        ? pct(unemployed, laborForce)
        : undefined;
    if (unemploymentRate !== undefined) {
      drafts.push(
        buildDraft({
          metric: metricById('acs-unemployment-black-state'),
          jurisdictionId,
          geography: row.geography,
          vintage,
          retrievedAt,
          estimate: unemploymentRate,
          numerator: unemployed,
          denominator: laborForce,
        }),
      );
    }
  }

  return drafts;
}

/** Adapter from generic ACS profile rows (county fetch) to parsed Phase 1 rows. */
export function acsProfileRowToPhase1Row(row: AcsProfileRow): ParsedAcsRow {
  return {
    geography: 'county',
    stateFips: row.stateFips,
    countyFips: row.countyFips,
    name: row.name,
    values: row.values,
    suppressed: row.suppressed,
  };
}

export function listPhase1AcsIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_INDICATOR_CATALOG.filter((row) => row.externalDataSourceId === 'acs-census-api');
}
