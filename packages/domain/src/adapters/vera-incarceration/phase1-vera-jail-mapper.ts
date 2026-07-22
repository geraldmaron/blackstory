/**
 * Maps Vera Incarceration Trends county CSV rows into Phase 1 jail population rate drafts.
 */
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_INDICATOR_CATALOG } from '../../statistics/phase1-indicator-catalog.js';
import {
  PHASE1_VERA_DATASET_VINTAGE,
  PHASE1_VERA_JAIL_POPULATION_RATE_COUNTY_METRIC_ID,
  VERA_COUNTY_JAIL_RATE_COLUMN,
  VERA_INCARCERATION_ATTRIBUTION_NOTE,
  VERA_INCARCERATION_TRENDS_HOMEPAGE_URL,
} from './constants.js';

export type Phase1VeraJailObservationDraft = {
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
  readonly attributionNote: string;
};

export type VeraCountyJailRow = {
  readonly year: number;
  readonly countyFips: string;
  readonly stateFips: string;
  readonly jailRate: number;
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

function roundRate(value: number): number {
  return Math.round(value * 100) / 100;
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

export function parseVeraCountyJailCsv(csvText: string): {
  readonly rows: readonly VeraCountyJailRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('Vera county CSV is empty');
  }

  const header = splitCsvLine(lines[0]!.replace(/^\uFEFF/, ''));
  const yearIdx = header.indexOf('year');
  const countyFipsIdx = header.indexOf('county_fips');
  const stateFipsIdx = header.indexOf('state_fips');
  const jailRateIdx = header.indexOf(VERA_COUNTY_JAIL_RATE_COLUMN);
  if (yearIdx < 0 || countyFipsIdx < 0 || stateFipsIdx < 0 || jailRateIdx < 0) {
    throw new Error('Vera county CSV missing required columns');
  }

  const rows: VeraCountyJailRow[] = [];
  const rejected: string[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const year = parseNumber(cells[yearIdx]);
    const countyRaw = cells[countyFipsIdx]?.trim() ?? '';
    const stateFips = cells[stateFipsIdx]?.trim().padStart(2, '0') ?? '';
    const jailRate = parseNumber(cells[jailRateIdx]);
    const countyFips = countyRaw.replace(/\D/g, '').padStart(5, '0');

    if (year === undefined || !/^\d{5}$/.test(countyFips) || !/^\d{2}$/.test(stateFips)) {
      rejected.push(`invalid row: ${line.slice(0, 80)}`);
      continue;
    }
    if (jailRate === undefined) continue;

    rows.push({
      year: Math.trunc(year),
      countyFips,
      stateFips,
      jailRate: roundRate(jailRate),
    });
  }

  return { rows, rejected };
}

export function selectVeraCountyJailRows(input: {
  readonly rows: readonly VeraCountyJailRow[];
  readonly referenceYear?: number;
  readonly latestPerCounty?: boolean;
  readonly stateFipsList?: readonly string[];
}): readonly VeraCountyJailRow[] {
  let filtered = input.rows;
  if (input.stateFipsList && input.stateFipsList.length > 0) {
    const allowed = new Set(input.stateFipsList);
    filtered = filtered.filter((row) => allowed.has(row.stateFips));
  }
  if (input.referenceYear !== undefined) {
    return filtered.filter((row) => row.year === input.referenceYear);
  }
  if (input.latestPerCounty) {
    const latest = new Map<string, VeraCountyJailRow>();
    for (const row of filtered) {
      const prior = latest.get(row.countyFips);
      if (!prior || row.year > prior.year) {
        latest.set(row.countyFips, row);
      }
    }
    return [...latest.values()].sort((a, b) => a.countyFips.localeCompare(b.countyFips));
  }
  return filtered;
}

function buildDraft(row: VeraCountyJailRow, retrievedAt: string): Phase1VeraJailObservationDraft {
  const metric = metricById(PHASE1_VERA_JAIL_POPULATION_RATE_COUNTY_METRIC_ID);
  const jurisdictionId = countyJurisdictionId(row.countyFips);
  const referencePeriod = String(row.year);
  const boundaryVersion = 'county-2020';
  const draft: Phase1VeraJailObservationDraft = {
    id: observationId(metric.metricId, jurisdictionId, referencePeriod),
    metricId: metric.metricId,
    jurisdictionId,
    boundaryVersion,
    referencePeriod,
    datasetVintage: PHASE1_VERA_DATASET_VINTAGE,
    estimate: row.jailRate,
    source: metric.externalDataSourceId,
    sourceUrl: VERA_INCARCERATION_TRENDS_HOMEPAGE_URL,
    retrievedAt,
    contentHash: contentHash({
      metricId: metric.metricId,
      jurisdictionId,
      referencePeriod,
      estimate: row.jailRate,
      boundaryVersion,
    }),
    attributionNote: VERA_INCARCERATION_ATTRIBUTION_NOTE,
  };
  assertPublishedStatisticProvenance({
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    retrievedAt: draft.retrievedAt,
    contentHash: draft.contentHash,
  });
  return draft;
}

export function mapVeraCountyJailRowsToObservations(
  rows: readonly VeraCountyJailRow[],
  retrievedAt: string,
): readonly Phase1VeraJailObservationDraft[] {
  return rows.map((row) => buildDraft(row, retrievedAt));
}

export function listPhase1VeraJailIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_INDICATOR_CATALOG.filter(
    (row) => row.metricId === PHASE1_VERA_JAIL_POPULATION_RATE_COUNTY_METRIC_ID,
  );
}
