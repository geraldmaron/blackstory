/**
 * Maps Eviction Lab county proprietary-valid CSV rows into Phase 1 statistical observation
 * drafts for bb_reference.statistical_observations. Pure functions — network fetch lives in
 * ./fetch-phase1-eviction.ts and packages/firebase/scripts/ingest-phase1-eviction-lab.ts.
 */
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_INDICATOR_CATALOG } from '../../statistics/phase1-indicator-catalog.js';
import {
  EVICTION_LAB_ATTRIBUTION_NOTE,
  EVICTION_LAB_DATA_FOR_ANALYSIS_URL,
  PHASE1_EVICTION_DATASET_VINTAGE,
  PHASE1_EVICTION_FILING_RATE_METRIC_ID,
} from './constants.js';

export type Phase1EvictionObservationDraft = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly filings?: number;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly coverageType: 'observed';
  readonly attributionNote: string;
};

type ParsedEvictionRow = {
  readonly cofips: string;
  readonly county: string;
  readonly state: string;
  readonly year: number;
  readonly type: string;
  readonly filings?: number;
  readonly filingRate: number;
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

function roundPct(value: number): number {
  return Math.round(value * 10) / 10;
}

function countyFipsFromCofips(cofips: string): string {
  const digits = cofips.replace(/\D/g, '');
  if (!/^\d{1,5}$/.test(digits)) {
    throw new Error(`Invalid cofips: ${JSON.stringify(cofips)}`);
  }
  return digits.padStart(5, '0');
}

function stateFipsFromCountyFips(countyFips: string): string {
  return countyFips.slice(0, 2);
}

function isValidUsStateFips(stateFips: string): boolean {
  const value = Number(stateFips);
  return Number.isInteger(value) && value >= 1 && value <= 56;
}

function assertValidCountyFips(countyFips: string): void {
  if (!/^\d{5}$/.test(countyFips)) {
    throw new Error(`Invalid county FIPS: ${JSON.stringify(countyFips)}`);
  }
  const stateFips = stateFipsFromCountyFips(countyFips);
  if (!isValidUsStateFips(stateFips)) {
    throw new Error(`Invalid state FIPS in county code: ${JSON.stringify(countyFips)}`);
  }
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
  const metric = PHASE1_INDICATOR_CATALOG.find((row) => row.metricId === metricId);
  if (!metric) {
    throw new Error(`Unknown Phase 1 metric: ${metricId}`);
  }
  return metric;
}

function buildDraft(input: {
  readonly row: ParsedEvictionRow;
  readonly retrievedAt: string;
}): Phase1EvictionObservationDraft {
  const metric = metricById(PHASE1_EVICTION_FILING_RATE_METRIC_ID);
  const countyFips = countyFipsFromCofips(input.row.cofips);
  const jurisdictionId = countyJurisdictionId(countyFips);
  const referencePeriod = String(input.row.year);
  const boundaryVersion = 'county-2020';
  const estimate = roundPct(input.row.filingRate);

  const draft: Phase1EvictionObservationDraft = {
    id: observationId(metric.metricId, jurisdictionId, referencePeriod),
    metricId: metric.metricId,
    jurisdictionId,
    boundaryVersion,
    referencePeriod,
    datasetVintage: PHASE1_EVICTION_DATASET_VINTAGE,
    estimate,
    source: metric.externalDataSourceId,
    sourceUrl: EVICTION_LAB_DATA_FOR_ANALYSIS_URL,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: metric.metricId,
      jurisdictionId,
      referencePeriod,
      estimate,
      boundaryVersion,
    }),
    coverageType: 'observed',
    attributionNote: EVICTION_LAB_ATTRIBUTION_NOTE,
    ...(input.row.filings !== undefined ? { filings: input.row.filings } : {}),
  };
  assertPublishedStatisticProvenance(draft);
  return draft;
}

/** Parses one Eviction Lab county proprietary-valid CSV into structured rows. */
export function parsePhase1EvictionCountyCsv(csvText: string): {
  readonly rows: readonly ParsedEvictionRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], rejected: ['csv has no data rows'] };
  }

  const header = splitCsvLine(lines[0]!);
  const columnIndex = (name: string): number => {
    const idx = header.indexOf(name);
    if (idx < 0) {
      throw new Error(`Eviction Lab CSV missing expected column: ${name}`);
    }
    return idx;
  };

  const cofipsIdx = columnIndex('cofips');
  const countyIdx = columnIndex('county');
  const stateIdx = columnIndex('state');
  const yearIdx = columnIndex('year');
  const typeIdx = columnIndex('type');
  const filingsIdx = header.indexOf('filings');
  const filingRateIdx = columnIndex('filing_rate');

  const rows: ParsedEvictionRow[] = [];
  const rejected: string[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const cofips = cells[cofipsIdx]?.trim() ?? '';
    const year = parseNumber(cells[yearIdx]);
    const type = cells[typeIdx]?.trim().toLowerCase() ?? '';
    const filingRate = parseNumber(cells[filingRateIdx]);

    if (!cofips || year === undefined || !Number.isInteger(year)) {
      rejected.push(`bad cofips/year: ${JSON.stringify(line)}`);
      continue;
    }
    if (type !== 'observed') {
      rejected.push(`skipped non-observed row (${type || 'missing type'}): cofips=${cofips} year=${year}`);
      continue;
    }
    if (filingRate === undefined || filingRate < 0) {
      rejected.push(`missing filing_rate: cofips=${cofips} year=${year}`);
      continue;
    }

    try {
      assertValidCountyFips(countyFipsFromCofips(cofips));
    } catch {
      rejected.push(`invalid cofips: ${JSON.stringify(cofips)}`);
      continue;
    }

    const filings = filingsIdx >= 0 ? parseNumber(cells[filingsIdx]) : undefined;
    rows.push({
      cofips,
      county: cells[countyIdx]?.trim() ?? '',
      state: cells[stateIdx]?.trim() ?? '',
      year,
      type,
      filingRate,
      ...(filings !== undefined ? { filings } : {}),
    });
  }

  return { rows, rejected };
}

/** Filters parsed rows to a bounded state FIPS list (2-digit). */
export function filterPhase1EvictionRowsByStates(
  rows: readonly ParsedEvictionRow[],
  stateFipsList: readonly string[],
): readonly ParsedEvictionRow[] {
  const allowed = new Set(stateFipsList);
  return rows.filter((row) => {
    const countyFips = countyFipsFromCofips(row.cofips);
    return allowed.has(stateFipsFromCountyFips(countyFips));
  });
}

/** Converts parsed rows into Phase 1 observation drafts with Eviction Lab attribution. */
export function mapPhase1EvictionRowsToObservations(
  rows: readonly ParsedEvictionRow[],
  retrievedAt: string,
): readonly Phase1EvictionObservationDraft[] {
  return rows.map((row) => buildDraft({ row, retrievedAt }));
}

export function listPhase1EvictionIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_INDICATOR_CATALOG.filter((row) => row.externalDataSourceId === 'eviction-lab');
}
