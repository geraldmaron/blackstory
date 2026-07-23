/**
 * Maps curated SCF published-table median net worth by race (1989–2022, 2022 dollars)
 * into Phase 1 national wealth observation drafts with full provenance.
 */
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_INDICATOR_CATALOG } from '../../statistics/phase1-indicator-catalog.js';
import {
  PHASE1_SCF_MEDIAN_WEALTH_BLACK_NATION_METRIC_ID,
  PHASE1_SCF_MEDIAN_WEALTH_WHITE_NATION_METRIC_ID,
  PHASE1_SCF_WEALTH_BOUNDARY_VERSION,
  PHASE1_SCF_WEALTH_DATASET_VINTAGE,
  PHASE1_SCF_WEALTH_NATION_JURISDICTION_ID,
  SCF_FEDS_NOTE_MEDIAN_WEALTH_BY_RACE_URL,
} from './constants.js';

export type Phase1ScfWealthObservationDraft = {
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
};

export type ScfMedianWealthByRaceRow = {
  readonly referenceYear: number;
  readonly blackMedianUsd: number;
  readonly whiteMedianUsd: number;
};

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

function parseUsd(raw: string | undefined, label: string): number {
  if (raw === undefined) {
    throw new Error(`Missing ${label} in SCF wealth fixture row`);
  }
  const trimmed = raw.trim();
  const value = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${label} value "${raw}" in SCF wealth fixture`);
  }
  return Math.round(value);
}

function buildDraft(input: {
  readonly metricId: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly raceEthnicitySlice: string;
  readonly retrievedAt: string;
}): Phase1ScfWealthObservationDraft {
  const metric = metricById(input.metricId);
  const boundaryVersion = PHASE1_SCF_WEALTH_BOUNDARY_VERSION;
  const draft: Phase1ScfWealthObservationDraft = {
    id: observationId(metric.metricId, PHASE1_SCF_WEALTH_NATION_JURISDICTION_ID, input.referencePeriod),
    metricId: metric.metricId,
    jurisdictionId: PHASE1_SCF_WEALTH_NATION_JURISDICTION_ID,
    boundaryVersion,
    referencePeriod: input.referencePeriod,
    datasetVintage: PHASE1_SCF_WEALTH_DATASET_VINTAGE,
    estimate: input.estimate,
    raceEthnicitySlice: input.raceEthnicitySlice,
    source: metric.externalDataSourceId,
    sourceUrl: SCF_FEDS_NOTE_MEDIAN_WEALTH_BY_RACE_URL,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: metric.metricId,
      jurisdictionId: PHASE1_SCF_WEALTH_NATION_JURISDICTION_ID,
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

export function parseScfMedianWealthFixtureCsv(csvText: string): {
  readonly rows: readonly ScfMedianWealthByRaceRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /^year,black_median_usd,white_median_usd/i.test(line));
  if (headerIndex < 0) {
    throw new Error('SCF wealth fixture CSV missing year,black_median_usd,white_median_usd header');
  }

  const rows: ScfMedianWealthByRaceRow[] = [];
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
        blackMedianUsd: parseUsd(cells[1], 'black_median_usd'),
        whiteMedianUsd: parseUsd(cells[2], 'white_median_usd'),
      });
    } catch (error) {
      rejected.push(error instanceof Error ? error.message : String(error));
    }
  }

  rows.sort((a, b) => a.referenceYear - b.referenceYear);
  return { rows, rejected };
}

export function mapScfWealthRowsToObservations(
  rows: readonly ScfMedianWealthByRaceRow[],
  retrievedAt: string,
): readonly Phase1ScfWealthObservationDraft[] {
  const drafts: Phase1ScfWealthObservationDraft[] = [];

  for (const row of rows) {
    const referencePeriod = String(row.referenceYear);
    drafts.push(
      buildDraft({
        metricId: PHASE1_SCF_MEDIAN_WEALTH_BLACK_NATION_METRIC_ID,
        referencePeriod,
        estimate: row.blackMedianUsd,
        raceEthnicitySlice: 'black',
        retrievedAt,
      }),
    );
    drafts.push(
      buildDraft({
        metricId: PHASE1_SCF_MEDIAN_WEALTH_WHITE_NATION_METRIC_ID,
        referencePeriod,
        estimate: row.whiteMedianUsd,
        raceEthnicitySlice: 'white_nonhispanic',
        retrievedAt,
      }),
    );
  }

  return drafts;
}

export function listPhase1ScfWealthIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_INDICATOR_CATALOG.filter(
    (row) =>
      row.metricId === PHASE1_SCF_MEDIAN_WEALTH_BLACK_NATION_METRIC_ID ||
      row.metricId === PHASE1_SCF_MEDIAN_WEALTH_WHITE_NATION_METRIC_ID,
  );
}
