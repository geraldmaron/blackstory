/**
 * Maps curated HUD CHAS Cook County cost-burden-by-race fixture rows into
 * Phase 1 observation drafts with full provenance.
 */
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_CHAS_INDICATOR_DEFINITIONS } from '../../statistics/phase1-chas-indicator-catalog.js';
import {
  HUD_CHAS_COOK_CON_PLAN_TABLE20_SOURCE_URL,
  HUD_CHAS_TABLE20_COST_BURDEN_METHOD_NOTE,
  PHASE1_HUD_CHAS_BOUNDARY_VERSION,
  PHASE1_HUD_CHAS_COST_BURDEN_BLACK_COUNTY_METRIC_ID,
  PHASE1_HUD_CHAS_COST_BURDEN_WHITE_COUNTY_METRIC_ID,
  PHASE1_HUD_CHAS_DATASET_VINTAGE,
  PHASE1_HUD_CHAS_DEFAULT_COUNTY_FIPS,
} from './constants.js';

export type Phase1ChasObservationDraft = {
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
  readonly totalHouseholds: number;
  readonly costBurdenGt30Households: number;
  readonly chasTable: string;
  readonly methodologyNote: string;
};

export type ChasCookCostBurdenRow = {
  readonly acsPeriod: string;
  readonly countyFips: string;
  readonly raceSlice: 'black_nonhispanic' | 'white_nonhispanic';
  readonly totalHouseholds: number;
  readonly costBurdenGt30Households: number;
  readonly chasTable: string;
  readonly sourceUrl: string;
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

function roundSharePct(value: number): number {
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
  const metric = PHASE1_CHAS_INDICATOR_DEFINITIONS.find((row) => row.metricId === metricId);
  if (!metric) {
    throw new Error(`Unknown Phase 1 HUD CHAS metric: ${metricId}`);
  }
  return metric;
}

function metricIdForRaceSlice(raceSlice: ChasCookCostBurdenRow['raceSlice']): string {
  if (raceSlice === 'black_nonhispanic') {
    return PHASE1_HUD_CHAS_COST_BURDEN_BLACK_COUNTY_METRIC_ID;
  }
  return PHASE1_HUD_CHAS_COST_BURDEN_WHITE_COUNTY_METRIC_ID;
}

function parseCount(raw: string | undefined, label: string): number {
  if (raw === undefined) {
    throw new Error(`Missing ${label} in HUD CHAS fixture row`);
  }
  const trimmed = raw.trim();
  const value = Number(trimmed.replace(/,/g, ''));
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${label} value "${raw}" in HUD CHAS fixture`);
  }
  return value;
}

function buildDraft(input: {
  readonly row: ChasCookCostBurdenRow;
  readonly retrievedAt: string;
}): Phase1ChasObservationDraft {
  const metricId = metricIdForRaceSlice(input.row.raceSlice);
  const metric = metricById(metricId);
  const jurisdictionId = countyJurisdictionId(input.row.countyFips);
  const referencePeriod = input.row.acsPeriod;
  const boundaryVersion = PHASE1_HUD_CHAS_BOUNDARY_VERSION;
  const estimate = roundSharePct(
    (input.row.costBurdenGt30Households / input.row.totalHouseholds) * 100,
  );

  const draft: Phase1ChasObservationDraft = {
    id: observationId(metric.metricId, jurisdictionId, referencePeriod),
    metricId: metric.metricId,
    jurisdictionId,
    boundaryVersion,
    referencePeriod,
    datasetVintage: PHASE1_HUD_CHAS_DATASET_VINTAGE,
    estimate,
    raceEthnicitySlice: input.row.raceSlice,
    source: metric.externalDataSourceId,
    sourceUrl: input.row.sourceUrl,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: metric.metricId,
      jurisdictionId,
      referencePeriod,
      estimate,
      boundaryVersion,
    }),
    totalHouseholds: input.row.totalHouseholds,
    costBurdenGt30Households: input.row.costBurdenGt30Households,
    chasTable: input.row.chasTable,
    methodologyNote: HUD_CHAS_TABLE20_COST_BURDEN_METHOD_NOTE,
  };
  assertPublishedStatisticProvenance(draft);
  return draft;
}

/** Parses curated Cook CHAS Table 20 cost-burden fixture CSV into structured rows. */
export function parseChasCookCostBurdenFixtureCsv(csvText: string): {
  readonly rows: readonly ChasCookCostBurdenRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    /^acs_period,county_fips,race_slice,total_households,cost_burden_gt30_households/i.test(
      line,
    ),
  );
  if (headerIndex < 0) {
    throw new Error(
      'HUD CHAS fixture CSV missing acs_period,county_fips,race_slice,total_households,cost_burden_gt30_households header',
    );
  }

  const rows: ChasCookCostBurdenRow[] = [];
  const rejected: string[] = [];

  for (const line of lines.slice(headerIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const cells = splitCsvLine(trimmed);
    const acsPeriod = cells[0]?.trim();
    const countyFips = cells[1]?.trim();
    const raceSlice = cells[2]?.trim();
    if (!acsPeriod || !countyFips || !raceSlice) {
      rejected.push(`missing keys: ${line}`);
      continue;
    }
    if (countyFips !== PHASE1_HUD_CHAS_DEFAULT_COUNTY_FIPS) {
      rejected.push(`skipped non-Cook county_fips=${countyFips}`);
      continue;
    }
    if (raceSlice !== 'black_nonhispanic' && raceSlice !== 'white_nonhispanic') {
      rejected.push(`unsupported race_slice=${raceSlice}`);
      continue;
    }

    try {
      rows.push({
        acsPeriod,
        countyFips,
        raceSlice,
        totalHouseholds: parseCount(cells[3], 'total_households'),
        costBurdenGt30Households: parseCount(cells[4], 'cost_burden_gt30_households'),
        chasTable: cells[5]?.trim() || 'Table20',
        sourceUrl: cells[6]?.trim() || HUD_CHAS_COOK_CON_PLAN_TABLE20_SOURCE_URL,
      });
    } catch (error) {
      rejected.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { rows, rejected };
}

export function assertChasCookThemeImpactRowsPresent(rows: readonly ChasCookCostBurdenRow[]): void {
  const slices = new Set(rows.map((row) => row.raceSlice));
  if (!slices.has('black_nonhispanic') || !slices.has('white_nonhispanic')) {
    throw new Error(
      'HUD CHAS Cook fixture must include black_nonhispanic and white_nonhispanic rows',
    );
  }
}

export function mapChasRowsToObservations(
  rows: readonly ChasCookCostBurdenRow[],
  retrievedAt: string,
): readonly Phase1ChasObservationDraft[] {
  return rows.map((row) => buildDraft({ row, retrievedAt }));
}
