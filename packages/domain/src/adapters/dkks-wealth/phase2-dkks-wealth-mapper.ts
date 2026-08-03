/**
 * Maps the curated DKKS "Wealth of Two Nations" benchmark-year fixture into
 * national wealth-gap observation drafts with full provenance. This is a
 * Phase 2 (post-MVP) reference-indicator ingest, modeled on the Phase 1 SCF
 * wealth adapter but not registered in the Phase 1 indicator catalog.
 */
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { StatisticalSeries } from '../../statistics/types.js';
import { asMetricId } from '../../statistics/types.js';
import {
  DKKS_PERCAPITA_WEALTH_BLACK_NATION_METRIC_ID,
  DKKS_PERCAPITA_WEALTH_WHITE_NATION_METRIC_ID,
  DKKS_WEALTH_BOUNDARY_VERSION,
  DKKS_WEALTH_DATASET_VINTAGE,
  DKKS_WEALTH_GAP_SOURCE_URL,
  DKKS_WEALTH_NATION_JURISDICTION_ID,
  DKKS_WEALTH_RATIO_WHITE_BLACK_NATION_METRIC_ID,
  DKKS_WEALTH_SOURCE_DATASET,
} from './constants.js';

export type Phase2DkksWealthIndicatorDefinition = StatisticalSeries & {
  readonly theme: 'wealth';
  readonly externalDataSourceId: string;
  readonly raceEthnicitySlice?: string;
};

export type Phase2DkksWealthObservationDraft = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly raceEthnicitySlice: string | null;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
};

export type DkksWealthGapRow = {
  readonly referenceYear: number;
  readonly blackWealthPc: number;
  readonly whiteWealthPc: number | null;
  readonly wealthRatioWhiteBlack: number | null;
};

function series(
  partial: Omit<Phase2DkksWealthIndicatorDefinition, 'metricId'> & { readonly metricId: string },
): Phase2DkksWealthIndicatorDefinition {
  return {
    ...partial,
    metricId: asMetricId(partial.metricId),
  };
}

export const PHASE2_DKKS_WEALTH_INDICATOR_CATALOG: readonly Phase2DkksWealthIndicatorDefinition[] =
  [
    series({
      metricId: DKKS_PERCAPITA_WEALTH_BLACK_NATION_METRIC_ID,
      metricDefinition:
        'Per-capita household wealth, Black population, national — DKKS (2024) "Wealth of Two Nations" ' +
        'benchmark-year series, 2019 USD.',
      universe: 'Black population',
      unit: 'USD-2019',
      sourceDataset: DKKS_WEALTH_SOURCE_DATASET,
      sourceTable: 'WealthGapFinal18602020.xlsx',
      sourceVariable: 'black_wealth_pc',
      geographyType: 'nation',
      estimateType: 'mean',
      periodType: 'annual',
      theme: 'wealth',
      externalDataSourceId: 'derenoncourt-wealth-of-two-nations',
      raceEthnicitySlice: 'black',
    }),
    series({
      metricId: DKKS_PERCAPITA_WEALTH_WHITE_NATION_METRIC_ID,
      metricDefinition:
        'Per-capita household wealth, white population, national — DKKS (2024) "Wealth of Two Nations" ' +
        "benchmark-year series, 2019 USD. Pre-1950 benchmarks use the authors' nonblack-population proxy " +
        'for white (see paper appendix); denoted nonblack_wealth_pc in the source workbook.',
      universe: 'white (nonblack proxy pre-1950) population',
      unit: 'USD-2019',
      sourceDataset: DKKS_WEALTH_SOURCE_DATASET,
      sourceTable: 'WealthGapFinal18602020.xlsx',
      sourceVariable: 'nonblack_wealth_pc',
      geographyType: 'nation',
      estimateType: 'mean',
      periodType: 'annual',
      theme: 'wealth',
      externalDataSourceId: 'derenoncourt-wealth-of-two-nations',
      raceEthnicitySlice: 'white_nonhispanic',
    }),
    series({
      metricId: DKKS_WEALTH_RATIO_WHITE_BLACK_NATION_METRIC_ID,
      metricDefinition:
        'White-to-Black per-capita wealth ratio, national — DKKS (2024) "Wealth of Two Nations" ' +
        'benchmark-year series (wealthgap_wb).',
      universe: 'white and Black populations',
      unit: 'ratio',
      sourceDataset: DKKS_WEALTH_SOURCE_DATASET,
      sourceTable: 'WealthGapFinal18602020.xlsx',
      sourceVariable: 'wealthgap_wb',
      geographyType: 'nation',
      estimateType: 'ratio',
      periodType: 'annual',
      theme: 'wealth',
      externalDataSourceId: 'derenoncourt-wealth-of-two-nations',
    }),
  ];

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

function buildDraft(input: {
  readonly metricId: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly raceEthnicitySlice: string | null;
  readonly retrievedAt: string;
}): Phase2DkksWealthObservationDraft {
  const boundaryVersion = DKKS_WEALTH_BOUNDARY_VERSION;
  const draft: Phase2DkksWealthObservationDraft = {
    id: observationId(input.metricId, DKKS_WEALTH_NATION_JURISDICTION_ID, input.referencePeriod),
    metricId: input.metricId,
    jurisdictionId: DKKS_WEALTH_NATION_JURISDICTION_ID,
    boundaryVersion,
    referencePeriod: input.referencePeriod,
    datasetVintage: DKKS_WEALTH_DATASET_VINTAGE,
    estimate: input.estimate,
    raceEthnicitySlice: input.raceEthnicitySlice,
    source: DKKS_WEALTH_SOURCE_DATASET,
    sourceUrl: DKKS_WEALTH_GAP_SOURCE_URL,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: input.metricId,
      jurisdictionId: DKKS_WEALTH_NATION_JURISDICTION_ID,
      referencePeriod: input.referencePeriod,
      estimate: input.estimate,
      boundaryVersion,
    }),
  };
  assertPublishedStatisticProvenance({
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    retrievedAt: draft.retrievedAt,
    contentHash: draft.contentHash,
  });
  return draft;
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

function parseOptionalNumber(raw: string | undefined, label: string): number | null {
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${label} value "${raw}" in DKKS wealth fixture`);
  }
  return value;
}

function parseRequiredNumber(raw: string | undefined, label: string): number {
  const value = parseOptionalNumber(raw, label);
  if (value === null) {
    throw new Error(`Missing ${label} in DKKS wealth fixture row`);
  }
  return value;
}

export function parseDkksWealthGapFixtureCsv(csvText: string): {
  readonly rows: readonly DkksWealthGapRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    /^year,black_wealth_pc_usd2019,white_wealth_pc_usd2019,wealth_ratio_white_black/i.test(line),
  );
  if (headerIndex < 0) {
    throw new Error(
      'DKKS wealth fixture CSV missing year,black_wealth_pc_usd2019,white_wealth_pc_usd2019,wealth_ratio_white_black header',
    );
  }

  const rows: DkksWealthGapRow[] = [];
  const rejected: string[] = [];

  for (const line of lines.slice(headerIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const cells = splitCsvLine(trimmed);
    const yearRaw = cells[0]?.trim();
    if (!yearRaw || !/^\d{4}$/.test(yearRaw)) {
      rejected.push(`invalid year: ${line}`);
      continue;
    }

    try {
      rows.push({
        referenceYear: Number(yearRaw),
        blackWealthPc: parseRequiredNumber(cells[1], 'black_wealth_pc_usd2019'),
        whiteWealthPc: parseOptionalNumber(cells[2], 'white_wealth_pc_usd2019'),
        wealthRatioWhiteBlack: parseOptionalNumber(cells[3], 'wealth_ratio_white_black'),
      });
    } catch (error) {
      rejected.push(error instanceof Error ? error.message : String(error));
    }
  }

  rows.sort((a, b) => a.referenceYear - b.referenceYear);
  return { rows, rejected };
}

export function mapDkksWealthRowsToObservations(
  rows: readonly DkksWealthGapRow[],
  retrievedAt: string,
): readonly Phase2DkksWealthObservationDraft[] {
  const drafts: Phase2DkksWealthObservationDraft[] = [];

  for (const row of rows) {
    const referencePeriod = String(row.referenceYear);
    drafts.push(
      buildDraft({
        metricId: DKKS_PERCAPITA_WEALTH_BLACK_NATION_METRIC_ID,
        referencePeriod,
        estimate: row.blackWealthPc,
        raceEthnicitySlice: 'black',
        retrievedAt,
      }),
    );
    if (row.whiteWealthPc !== null) {
      drafts.push(
        buildDraft({
          metricId: DKKS_PERCAPITA_WEALTH_WHITE_NATION_METRIC_ID,
          referencePeriod,
          estimate: row.whiteWealthPc,
          raceEthnicitySlice: 'white_nonhispanic',
          retrievedAt,
        }),
      );
    }
    if (row.wealthRatioWhiteBlack !== null) {
      drafts.push(
        buildDraft({
          metricId: DKKS_WEALTH_RATIO_WHITE_BLACK_NATION_METRIC_ID,
          referencePeriod,
          estimate: row.wealthRatioWhiteBlack,
          raceEthnicitySlice: null,
          retrievedAt,
        }),
      );
    }
  }

  return drafts;
}

export function listPhase2DkksWealthIndicators(): readonly Phase2DkksWealthIndicatorDefinition[] {
  return PHASE2_DKKS_WEALTH_INDICATOR_CATALOG;
}
