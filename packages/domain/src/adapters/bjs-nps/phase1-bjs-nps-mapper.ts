/**
 * Maps BJS NPS Appendix table 1 (state prisoner counts by race) plus Census race
 * population denominators into Phase 1 state imprisonment-rate observation drafts.
 */
import { US_STATES } from '../../map/us-geography.js';
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_INDICATOR_CATALOG } from '../../statistics/phase1-indicator-catalog.js';
import {
  BJS_NPS_HOMEPAGE_URL,
  PHASE1_BJS_NPS_DATASET_VINTAGE,
  PHASE1_IMPRISONMENT_RATE_BLACK_STATE_METRIC_ID,
  PHASE1_IMPRISONMENT_RATE_WHITE_STATE_METRIC_ID,
} from './constants.js';

export type Phase1BjsNpsObservationDraft = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly raceEthnicitySlice: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly prisonerCount: number;
  readonly populationDenominator: number;
};

export type BjsNpsStateRaceCounts = {
  readonly stateFips: string;
  readonly stateName: string;
  readonly referenceYear: number;
  readonly blackPrisoners?: number;
  readonly whitePrisoners?: number;
};

export type StateRacePopulation = {
  readonly stateFips: string;
  readonly blackPopulation: number;
  readonly whitePopulation: number;
};

const STATE_NAME_TO_FIPS = new Map(
  US_STATES.map((state) => [normalizeStateName(state.name), state.fips]),
);

function normalizeStateName(raw: string): string {
  return raw
    .replace(/\/.+$/, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

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

function parseCount(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '/' || trimmed === '~' || trimmed === ':') return undefined;
  const digits = trimmed.replace(/,/g, '');
  const value = Number(digits);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function roundRate(value: number): number {
  return Math.round(value);
}

function stateJurisdictionId(stateFips: string): string {
  return `state:${stateFips}`;
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
  const metric = PHASE1_INDICATOR_CATALOG.find((row) => row.metricId === metricId);
  if (!metric) {
    throw new Error(`Unknown Phase 1 metric: ${metricId}`);
  }
  return metric;
}

function inferReferenceYear(csvText: string): number {
  const match = csvText.match(/December 31, (\d{4})/);
  if (!match?.[1]) {
    throw new Error('Could not infer reference year from BJS stat01 CSV header');
  }
  return Number(match[1]);
}

export function parseBjsNpsStat01Csv(csvText: string): {
  readonly rows: readonly BjsNpsStateRaceCounts[];
  readonly referenceYear: number;
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    /^"?Jurisdiction,,Total,White/i.test(line.replace(/^\uFEFF/, '')),
  );
  if (headerIndex < 0) {
    throw new Error('BJS stat01 CSV missing jurisdiction header row');
  }

  const referenceYear = inferReferenceYear(csvText);
  const rows: BjsNpsStateRaceCounts[] = [];
  const rejected: string[] = [];

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    if (/^Note:/i.test(line) || /^Source:/i.test(line) || /^a\//i.test(line)) break;

    const cells = splitCsvLine(line);
    const jurisdiction = (cells[0] || cells[1] || '').trim();
    const stateName = jurisdiction || cells[1]?.trim() || '';
    if (!stateName || /^State$/i.test(stateName) || /^Federal/i.test(stateName)) continue;

    const normalized = normalizeStateName(stateName);
    const stateFips = STATE_NAME_TO_FIPS.get(normalized);
    if (!stateFips) {
      rejected.push(`unknown jurisdiction: ${stateName}`);
      continue;
    }

    const whitePrisoners = parseCount(cells[3]);
    const blackPrisoners = parseCount(cells[4]);
    if (whitePrisoners === undefined && blackPrisoners === undefined) {
      rejected.push(`missing race counts: ${stateName}`);
      continue;
    }

    rows.push({
      stateFips,
      stateName: US_STATES.find((state) => state.fips === stateFips)?.name ?? stateName,
      referenceYear,
      ...(whitePrisoners !== undefined ? { whitePrisoners } : {}),
      ...(blackPrisoners !== undefined ? { blackPrisoners } : {}),
    });
  }

  return { rows, referenceYear, rejected };
}

/** BJS national Black imprisonment rates are typically ~500–2500 per 100k; hard-cap rejects bad denominators. */
const MAX_PLAUSIBLE_IMPRISONMENT_RATE_PER_100K = 5_000;

function imprisonmentRate(prisoners: number, population: number): number | undefined {
  if (population <= 0) return undefined;
  const rate = roundRate((prisoners / population) * 100_000);
  if (rate > MAX_PLAUSIBLE_IMPRISONMENT_RATE_PER_100K) {
    throw new Error(
      `Implausible imprisonment rate ${rate} per 100k ` +
        `(prisoners=${prisoners}, population=${population}). Check race denominators.`,
    );
  }
  return rate;
}

function buildDraft(input: {
  readonly metricId: string;
  readonly stateFips: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly raceEthnicitySlice: string;
  readonly retrievedAt: string;
  readonly prisonerCount: number;
  readonly populationDenominator: number;
}): Phase1BjsNpsObservationDraft {
  const metric = metricById(input.metricId);
  const jurisdictionId = stateJurisdictionId(input.stateFips);
  const boundaryVersion = 'state-2020';
  const draft: Phase1BjsNpsObservationDraft = {
    id: observationId(metric.metricId, jurisdictionId, input.referencePeriod),
    metricId: metric.metricId,
    jurisdictionId,
    boundaryVersion,
    referencePeriod: input.referencePeriod,
    datasetVintage: PHASE1_BJS_NPS_DATASET_VINTAGE,
    estimate: input.estimate,
    raceEthnicitySlice: input.raceEthnicitySlice,
    source: metric.externalDataSourceId,
    sourceUrl: BJS_NPS_HOMEPAGE_URL,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: metric.metricId,
      jurisdictionId,
      referencePeriod: input.referencePeriod,
      estimate: input.estimate,
      boundaryVersion,
    }),
    prisonerCount: input.prisonerCount,
    populationDenominator: input.populationDenominator,
  };
  assertPublishedStatisticProvenance({
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    retrievedAt: draft.retrievedAt,
    contentHash: draft.contentHash,
  });
  return draft;
}

export function mapBjsNpsRowsToObservations(
  rows: readonly BjsNpsStateRaceCounts[],
  populations: ReadonlyMap<string, StateRacePopulation>,
  retrievedAt: string,
): readonly Phase1BjsNpsObservationDraft[] {
  const drafts: Phase1BjsNpsObservationDraft[] = [];

  for (const row of rows) {
    const population = populations.get(row.stateFips);
    if (!population) continue;
    const referencePeriod = String(row.referenceYear);

    if (row.blackPrisoners !== undefined) {
      const rate = imprisonmentRate(row.blackPrisoners, population.blackPopulation);
      if (rate !== undefined) {
        drafts.push(
          buildDraft({
            metricId: PHASE1_IMPRISONMENT_RATE_BLACK_STATE_METRIC_ID,
            stateFips: row.stateFips,
            referencePeriod,
            estimate: rate,
            raceEthnicitySlice: 'black',
            retrievedAt,
            prisonerCount: row.blackPrisoners,
            populationDenominator: population.blackPopulation,
          }),
        );
      }
    }

    if (row.whitePrisoners !== undefined) {
      const rate = imprisonmentRate(row.whitePrisoners, population.whitePopulation);
      if (rate !== undefined) {
        drafts.push(
          buildDraft({
            metricId: PHASE1_IMPRISONMENT_RATE_WHITE_STATE_METRIC_ID,
            stateFips: row.stateFips,
            referencePeriod,
            estimate: rate,
            raceEthnicitySlice: 'white',
            retrievedAt,
            prisonerCount: row.whitePrisoners,
            populationDenominator: population.whitePopulation,
          }),
        );
      }
    }
  }

  return drafts;
}

export function listPhase1BjsNpsIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_INDICATOR_CATALOG.filter(
    (row) =>
      row.metricId === PHASE1_IMPRISONMENT_RATE_BLACK_STATE_METRIC_ID ||
      row.metricId === PHASE1_IMPRISONMENT_RATE_WHITE_STATE_METRIC_ID,
  );
}
