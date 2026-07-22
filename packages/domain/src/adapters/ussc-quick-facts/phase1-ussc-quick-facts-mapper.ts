/**
 * Maps curated USSC Quick Facts published-table average sentence cells (crack/powder,
 * FY2013–FY2023) into Phase 1 national justice observation drafts with full provenance.
 */
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_USSC_INDICATOR_DEFINITIONS } from '../../statistics/phase1-ussc-indicator-catalog.js';
import {
  PHASE1_USSC_AVERAGE_SENTENCE_CRACK_NATION_METRIC_ID,
  PHASE1_USSC_AVERAGE_SENTENCE_POWDER_NATION_METRIC_ID,
  PHASE1_USSC_BLACK_SHARE_CRACK_OFFENDERS_NATION_METRIC_ID,
  PHASE1_USSC_BOUNDARY_VERSION,
  PHASE1_USSC_DATASET_VINTAGE,
  PHASE1_USSC_NATION_JURISDICTION_ID,
  USSC_QUICK_FACTS_HOMEPAGE_URL,
} from './constants.js';

export type Phase1UsscQuickFactsObservationDraft = {
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
};

export type UsscQuickFactsDrugRow = {
  readonly fiscalYear: number;
  readonly crackAverageSentenceMonths?: number;
  readonly powderAverageSentenceMonths?: number;
  readonly crackBlackSharePct?: number;
  readonly crackSourceUrl?: string;
  readonly powderSourceUrl?: string;
  readonly blackShareSourceUrl?: string;
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
  const metric = PHASE1_USSC_INDICATOR_DEFINITIONS.find((row) => row.metricId === metricId);
  if (!metric) {
    throw new Error(`Unknown Phase 1 USSC metric: ${metricId}`);
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

function parseOptionalNumber(raw: string | undefined, label: string): number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${label} value "${raw}" in USSC Quick Facts fixture`);
  }
  return value;
}

function parseOptionalUrl(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (!/^https:\/\/www\.ussc\.gov\//.test(trimmed)) {
    throw new Error(`Invalid USSC source URL "${raw}" in fixture`);
  }
  return trimmed;
}

function buildDraft(input: {
  readonly metricId: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly raceEthnicitySlice?: string;
}): Phase1UsscQuickFactsObservationDraft {
  const metric = metricById(input.metricId);
  const boundaryVersion = PHASE1_USSC_BOUNDARY_VERSION;
  const draft: Phase1UsscQuickFactsObservationDraft = {
    id: observationId(metric.metricId, PHASE1_USSC_NATION_JURISDICTION_ID, input.referencePeriod),
    metricId: metric.metricId,
    jurisdictionId: PHASE1_USSC_NATION_JURISDICTION_ID,
    boundaryVersion,
    referencePeriod: input.referencePeriod,
    datasetVintage: PHASE1_USSC_DATASET_VINTAGE,
    estimate: input.estimate,
    source: metric.externalDataSourceId,
    sourceUrl: input.sourceUrl,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: metric.metricId,
      jurisdictionId: PHASE1_USSC_NATION_JURISDICTION_ID,
      referencePeriod: input.referencePeriod,
      estimate: input.estimate,
      boundaryVersion,
    }),
    ...(input.raceEthnicitySlice !== undefined
      ? { raceEthnicitySlice: input.raceEthnicitySlice }
      : {}),
  };
  assertPublishedStatisticProvenance({
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    retrievedAt: draft.retrievedAt,
    contentHash: draft.contentHash,
  });
  return draft;
}

export function parseUsscQuickFactsDrugFixtureCsv(csvText: string): {
  readonly rows: readonly UsscQuickFactsDrugRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    /^fiscal_year,crack_average_sentence_months,powder_average_sentence_months/i.test(line),
  );
  if (headerIndex < 0) {
    throw new Error(
      'USSC Quick Facts fixture CSV missing fiscal_year,crack_average_sentence_months,powder_average_sentence_months header',
    );
  }

  const rows: UsscQuickFactsDrugRow[] = [];
  const rejected: string[] = [];

  for (const line of lines.slice(headerIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const cells = splitCsvLine(trimmed);
    const yearRaw = cells[0]?.trim();
    if (!yearRaw || !/^\d{4}$/.test(yearRaw)) {
      rejected.push(`invalid fiscal_year: ${line}`);
      continue;
    }

    try {
      const crackAverageSentenceMonths = parseOptionalNumber(
        cells[1],
        'crack_average_sentence_months',
      );
      const powderAverageSentenceMonths = parseOptionalNumber(
        cells[2],
        'powder_average_sentence_months',
      );
      const crackBlackSharePct = parseOptionalNumber(cells[3], 'crack_black_share_pct');
      const crackSourceUrl = parseOptionalUrl(cells[4]);
      const powderSourceUrl = parseOptionalUrl(cells[5]);
      const blackShareSourceUrl = parseOptionalUrl(cells[6]);

      const row: UsscQuickFactsDrugRow = {
        fiscalYear: Number(yearRaw),
        ...(crackAverageSentenceMonths !== undefined ? { crackAverageSentenceMonths } : {}),
        ...(powderAverageSentenceMonths !== undefined ? { powderAverageSentenceMonths } : {}),
        ...(crackBlackSharePct !== undefined ? { crackBlackSharePct } : {}),
        ...(crackSourceUrl !== undefined ? { crackSourceUrl } : {}),
        ...(powderSourceUrl !== undefined ? { powderSourceUrl } : {}),
        ...(blackShareSourceUrl !== undefined ? { blackShareSourceUrl } : {}),
      };
      if (
        row.crackAverageSentenceMonths === undefined &&
        row.powderAverageSentenceMonths === undefined &&
        row.crackBlackSharePct === undefined
      ) {
        rejected.push(`no metrics in row: ${line}`);
        continue;
      }
      rows.push(row);
    } catch (error) {
      rejected.push(error instanceof Error ? error.message : String(error));
    }
  }

  rows.sort((a, b) => a.fiscalYear - b.fiscalYear);
  return { rows, rejected };
}

function resolveSourceUrl(row: UsscQuickFactsDrugRow, metric: 'crack' | 'powder' | 'blackShare'): string {
  const specific =
    metric === 'crack'
      ? row.crackSourceUrl
      : metric === 'powder'
        ? row.powderSourceUrl
        : row.blackShareSourceUrl ?? row.crackSourceUrl;
  return specific ?? USSC_QUICK_FACTS_HOMEPAGE_URL;
}

export function mapUsscQuickFactsRowsToObservations(
  rows: readonly UsscQuickFactsDrugRow[],
  retrievedAt: string,
): readonly Phase1UsscQuickFactsObservationDraft[] {
  const drafts: Phase1UsscQuickFactsObservationDraft[] = [];

  for (const row of rows) {
    const referencePeriod = String(row.fiscalYear);

    if (row.crackAverageSentenceMonths !== undefined) {
      drafts.push(
        buildDraft({
          metricId: PHASE1_USSC_AVERAGE_SENTENCE_CRACK_NATION_METRIC_ID,
          referencePeriod,
          estimate: row.crackAverageSentenceMonths,
          sourceUrl: resolveSourceUrl(row, 'crack'),
          retrievedAt,
        }),
      );
    }

    if (row.powderAverageSentenceMonths !== undefined) {
      drafts.push(
        buildDraft({
          metricId: PHASE1_USSC_AVERAGE_SENTENCE_POWDER_NATION_METRIC_ID,
          referencePeriod,
          estimate: row.powderAverageSentenceMonths,
          sourceUrl: resolveSourceUrl(row, 'powder'),
          retrievedAt,
        }),
      );
    }

    if (row.crackBlackSharePct !== undefined) {
      drafts.push(
        buildDraft({
          metricId: PHASE1_USSC_BLACK_SHARE_CRACK_OFFENDERS_NATION_METRIC_ID,
          referencePeriod,
          estimate: row.crackBlackSharePct,
          sourceUrl: resolveSourceUrl(row, 'blackShare'),
          retrievedAt,
          raceEthnicitySlice: 'black',
        }),
      );
    }
  }

  return drafts;
}

export function listPhase1UsscQuickFactsIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_USSC_INDICATOR_DEFINITIONS;
}
