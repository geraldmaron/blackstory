/**
 * Maps CDC EJI tract CSV rows into Phase 1 county environmental-burden observation drafts.
 * Rolls tract RPL_EBM percentile ranks up to county via unweighted mean. Pure functions —
 * network fetch lives in ./fetch-phase1-eji.ts.
 */
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_INDICATOR_CATALOG } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_EJI_TRI_INDICATOR_DEFINITIONS } from '../../statistics/phase1-eji-tri-indicator-catalog.js';
import {
  CDC_EJI_COUNTY_ROLLUP_METHOD_NOTE,
  CDC_EJI_DATA_DOWNLOAD_URL,
  CDC_EJI_ENVIRONMENTAL_BURDEN_RANK_COLUMNS,
  CDC_EJI_TRACT_GEOID_COLUMNS,
  PHASE1_EJI_DATASET_VINTAGE,
  PHASE1_EJI_ENVIRONMENTAL_BURDEN_SCORE_COUNTY_METRIC_ID,
} from './constants.js';

export type Phase1EjiObservationDraft = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly tractCount: number;
  readonly methodologyNote: string;
};

type ParsedEjiTractRow = {
  readonly geoid: string;
  readonly countyFips: string;
  readonly environmentalBurdenRank: number;
};

type ParsedEjiCountyRollup = {
  readonly countyFips: string;
  readonly meanEnvironmentalBurdenRank: number;
  readonly tractCount: number;
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

function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function roundIndex(value: number): number {
  return Math.round(value * 10000) / 10000;
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
    PHASE1_EJI_TRI_INDICATOR_DEFINITIONS.find((row) => row.metricId === metricId);
  if (!metric) {
    throw new Error(`Unknown Phase 1 metric: ${metricId}`);
  }
  return metric;
}

function pickColumn(header: Map<string, number>, candidates: readonly string[]): string | undefined {
  for (const name of candidates) {
    if (header.has(name)) return name;
  }
  return undefined;
}

function assertValidCountyFips(countyFips: string): void {
  if (!/^\d{5}$/.test(countyFips)) {
    throw new Error(`Invalid county FIPS: ${JSON.stringify(countyFips)}`);
  }
}

function countyFipsFromGeoid(geoid: string): string | undefined {
  const normalized = geoid.trim();
  if (!/^\d{11}$/.test(normalized)) return undefined;
  return normalized.slice(0, 5);
}

/** Parses EJI tract CSV text into tract-level environmental burden ranks. */
export function parseEjiTractCsv(
  csvText: string,
  expectedCountyFips?: readonly string[],
): {
  readonly rows: readonly ParsedEjiTractRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], rejected: ['empty EJI CSV'] };
  }

  const header = new Map(splitCsvLine(lines[0]!).map((name, index) => [name.trim(), index]));
  const geoidColumn = pickColumn(header, CDC_EJI_TRACT_GEOID_COLUMNS);
  const rankColumn = pickColumn(header, CDC_EJI_ENVIRONMENTAL_BURDEN_RANK_COLUMNS);
  const rejected: string[] = [];
  const rows: ParsedEjiTractRow[] = [];

  if (!geoidColumn) {
    return {
      rows: [],
      rejected: [`missing tract GEOID column (expected one of ${CDC_EJI_TRACT_GEOID_COLUMNS.join(', ')})`],
    };
  }
  if (!rankColumn) {
    return {
      rows: [],
      rejected: [
        `missing environmental burden rank column (expected one of ${CDC_EJI_ENVIRONMENTAL_BURDEN_RANK_COLUMNS.join(', ')})`,
      ],
    };
  }

  const expected = expectedCountyFips ? new Set(expectedCountyFips) : undefined;

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitCsvLine(lines[lineIndex]!);
    const geoid = cells[header.get(geoidColumn)!]?.trim();
    const rankRaw = cells[header.get(rankColumn)!];
    const rank = parseNumber(rankRaw);

    if (!geoid) {
      rejected.push(`line=${lineIndex + 1} missing GEOID`);
      continue;
    }
    const countyFips = countyFipsFromGeoid(geoid);
    if (!countyFips) {
      rejected.push(`line=${lineIndex + 1} invalid GEOID ${JSON.stringify(geoid)}`);
      continue;
    }
    if (expected && !expected.has(countyFips)) {
      rejected.push(`line=${lineIndex + 1} unexpected county ${countyFips}`);
      continue;
    }
    if (rank === undefined || rank < 0 || rank > 1) {
      rejected.push(`line=${lineIndex + 1} invalid RPL_EBM for GEOID=${geoid}`);
      continue;
    }

    try {
      assertValidCountyFips(countyFips);
    } catch {
      rejected.push(`line=${lineIndex + 1} invalid county FIPS ${JSON.stringify(countyFips)}`);
      continue;
    }

    rows.push({
      geoid,
      countyFips,
      environmentalBurdenRank: rank,
    });
  }

  return { rows, rejected };
}

/** Rolls tract-level ranks to county means (unweighted). */
export function rollupEjiTractsToCounties(
  rows: readonly ParsedEjiTractRow[],
): readonly ParsedEjiCountyRollup[] {
  const grouped = new Map<string, { sum: number; count: number }>();

  for (const row of rows) {
    const existing = grouped.get(row.countyFips) ?? { sum: 0, count: 0 };
    grouped.set(row.countyFips, {
      sum: existing.sum + row.environmentalBurdenRank,
      count: existing.count + 1,
    });
  }

  return [...grouped.entries()]
    .map(([countyFips, stats]) => ({
      countyFips,
      meanEnvironmentalBurdenRank: roundIndex(stats.sum / stats.count),
      tractCount: stats.count,
    }))
    .sort((a, b) => a.countyFips.localeCompare(b.countyFips));
}

function buildDraft(input: {
  readonly countyFips: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly retrievedAt: string;
  readonly tractCount: number;
}): Phase1EjiObservationDraft {
  const metric = metricById(PHASE1_EJI_ENVIRONMENTAL_BURDEN_SCORE_COUNTY_METRIC_ID);
  const jurisdictionId = countyJurisdictionId(input.countyFips);
  const boundaryVersion = 'county-2020';
  const draft: Phase1EjiObservationDraft = {
    id: observationId(metric.metricId, jurisdictionId, input.referencePeriod),
    metricId: metric.metricId,
    jurisdictionId,
    boundaryVersion,
    referencePeriod: input.referencePeriod,
    datasetVintage: PHASE1_EJI_DATASET_VINTAGE,
    estimate: input.estimate,
    source: metric.externalDataSourceId,
    sourceUrl: CDC_EJI_DATA_DOWNLOAD_URL,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: metric.metricId,
      jurisdictionId,
      referencePeriod: input.referencePeriod,
      estimate: input.estimate,
      boundaryVersion,
    }),
    tractCount: input.tractCount,
    methodologyNote: CDC_EJI_COUNTY_ROLLUP_METHOD_NOTE,
  };
  assertPublishedStatisticProvenance({
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    retrievedAt: draft.retrievedAt,
    contentHash: draft.contentHash,
  });
  return draft;
}

/** Converts county rollups into Phase 1 observation drafts. */
export function mapEjiCountyRollupsToObservations(
  rollups: readonly ParsedEjiCountyRollup[],
  referencePeriod: string,
  retrievedAt: string,
): readonly Phase1EjiObservationDraft[] {
  return rollups.map((rollup) =>
    buildDraft({
      countyFips: rollup.countyFips,
      referencePeriod,
      estimate: rollup.meanEnvironmentalBurdenRank,
      retrievedAt,
      tractCount: rollup.tractCount,
    }),
  );
}

export function listPhase1EjiIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_EJI_TRI_INDICATOR_DEFINITIONS.filter(
    (row) => row.metricId === PHASE1_EJI_ENVIRONMENTAL_BURDEN_SCORE_COUNTY_METRIC_ID,
  );
}
