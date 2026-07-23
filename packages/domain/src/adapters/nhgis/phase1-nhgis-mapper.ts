/**
 * Maps curated NHGIS / Census decennial county race counts into Phase 1 population-share
 * observation drafts with full provenance. Share = race_count / total_population × 100.
 */
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_NHGIS_INDICATOR_DEFINITIONS } from '../../statistics/phase1-nhgis-indicator-catalog.js';
import {
  NHGIS_CITATION_URL,
  PHASE1_NHGIS_BLACK_POPULATION_SHARE_COUNTY_METRIC_ID,
  PHASE1_NHGIS_BLACK_HOMEOWNERSHIP_RATE_COUNTY_METRIC_ID,
  PHASE1_NHGIS_BOUNDARY_VERSION,
  PHASE1_NHGIS_COOK_JURISDICTION_ID,
  PHASE1_NHGIS_DATASET_VINTAGE,
  PHASE1_NHGIS_DEFAULT_COUNTY_FIPS,
  PHASE1_NHGIS_TENURE_DATASET_VINTAGE,
  PHASE1_NHGIS_TENURE_HOMEOWNERSHIP_DECADES,
  PHASE1_NHGIS_THEME_IMPACT_DECADES,
  PHASE1_NHGIS_WHITE_POPULATION_SHARE_COUNTY_METRIC_ID,
  PHASE1_NHGIS_WHITE_HOMEOWNERSHIP_RATE_COUNTY_METRIC_ID,
} from './constants.js';

export type Phase1NhgisObservationDraft = {
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
  readonly totalPopulation?: number;
  readonly raceCount?: number;
  readonly ownerOccupied?: number;
  readonly occupiedUnits?: number;
};

export type NhgisCookRacePopulationShareRow = {
  readonly decade: number;
  readonly countyFips: string;
  readonly totalPopulation: number;
  readonly whiteCount: number;
  readonly blackCount: number;
  readonly sourceUrl: string;
};

export type NhgisCookTenureHomeownershipRow = {
  readonly decade: number;
  readonly countyFips: string;
  readonly ownerOccupiedWhite: number;
  readonly occupiedWhite: number;
  readonly ownerOccupiedBlack: number;
  readonly occupiedBlack: number;
  readonly sourceUrl: string;
};

function roundSharePct(value: number): number {
  return Math.round(value * 10) / 10;
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

function countyJurisdictionId(countyFips: string): string {
  return `county:${countyFips}`;
}

function metricById(metricId: string): Phase1IndicatorDefinition {
  const metric = PHASE1_NHGIS_INDICATOR_DEFINITIONS.find((row) => row.metricId === metricId);
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

function parseCount(raw: string | undefined, label: string): number {
  if (raw === undefined) {
    throw new Error(`Missing ${label} in NHGIS race population-share fixture row`);
  }
  const trimmed = raw.trim();
  const value = Number(trimmed.replace(/,/g, ''));
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${label} value "${raw}" in NHGIS race population-share fixture`);
  }
  return value;
}

function parseDecade(raw: string | undefined): number | undefined {
  const trimmed = raw?.trim();
  if (!trimmed || !/^\d{4}$/.test(trimmed)) {
    return undefined;
  }
  return Number(trimmed);
}

function populationSharePct(count: number, totalPopulation: number): number {
  if (totalPopulation <= 0) {
    throw new Error('total_population must be positive to derive population share');
  }
  return roundSharePct((count / totalPopulation) * 100);
}

function homeownershipRatePct(ownerOccupied: number, occupiedUnits: number): number {
  if (occupiedUnits <= 0) {
    throw new Error('occupied_units must be positive to derive homeownership rate');
  }
  if (ownerOccupied < 0 || ownerOccupied > occupiedUnits) {
    throw new Error('owner_occupied must be between 0 and occupied_units inclusive');
  }
  return roundSharePct((ownerOccupied / occupiedUnits) * 100);
}

function buildDraft(input: {
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly raceEthnicitySlice: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly datasetVintage: string;
  readonly totalPopulation?: number;
  readonly raceCount?: number;
  readonly ownerOccupied?: number;
  readonly occupiedUnits?: number;
}): Phase1NhgisObservationDraft {
  const metric = metricById(input.metricId);
  const boundaryVersion = PHASE1_NHGIS_BOUNDARY_VERSION;
  const draft: Phase1NhgisObservationDraft = {
    id: observationId(metric.metricId, input.jurisdictionId, input.referencePeriod),
    metricId: metric.metricId,
    jurisdictionId: input.jurisdictionId,
    boundaryVersion,
    referencePeriod: input.referencePeriod,
    datasetVintage: input.datasetVintage,
    estimate: input.estimate,
    raceEthnicitySlice: input.raceEthnicitySlice,
    source: metric.externalDataSourceId,
    sourceUrl: input.sourceUrl,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: metric.metricId,
      jurisdictionId: input.jurisdictionId,
      referencePeriod: input.referencePeriod,
      estimate: input.estimate,
      boundaryVersion,
    }),
    ...(input.totalPopulation !== undefined ? { totalPopulation: input.totalPopulation } : {}),
    ...(input.raceCount !== undefined ? { raceCount: input.raceCount } : {}),
    ...(input.ownerOccupied !== undefined ? { ownerOccupied: input.ownerOccupied } : {}),
    ...(input.occupiedUnits !== undefined ? { occupiedUnits: input.occupiedUnits } : {}),
  };
  assertPublishedStatisticProvenance({
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    retrievedAt: draft.retrievedAt,
    contentHash: draft.contentHash,
  });
  return draft;
}

export function parseNhgisCookRacePopulationShareFixtureCsv(csvText: string): {
  readonly rows: readonly NhgisCookRacePopulationShareRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    /^decade,county_fips,total_population,white_count,black_count/i.test(line),
  );
  if (headerIndex < 0) {
    throw new Error(
      'NHGIS race population-share fixture CSV missing decade,county_fips,total_population,white_count,black_count header',
    );
  }

  const rows: NhgisCookRacePopulationShareRow[] = [];
  const rejected: string[] = [];
  let defaultSourceUrl = NHGIS_CITATION_URL;

  for (const line of lines.slice(0, headerIndex)) {
    const sourceMatch = line.match(/^#\s*source_url:\s*(\S+)/i);
    if (sourceMatch?.[1]) {
      defaultSourceUrl = sourceMatch[1]!.trim();
    }
  }

  for (const line of lines.slice(headerIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const cells = splitCsvLine(trimmed);
    const decade = parseDecade(cells[0]);
    if (decade === undefined) {
      rejected.push(`invalid decade: ${line}`);
      continue;
    }

    const countyFips = cells[1]?.trim() ?? '';
    if (!/^\d{5}$/.test(countyFips)) {
      rejected.push(`invalid county_fips: ${line}`);
      continue;
    }

    const sourceUrlRaw = cells[5]?.trim();
    const sourceUrl =
      sourceUrlRaw && /^https?:\/\//.test(sourceUrlRaw) ? sourceUrlRaw : defaultSourceUrl;

    try {
      rows.push({
        decade,
        countyFips,
        totalPopulation: parseCount(cells[2], 'total_population'),
        whiteCount: parseCount(cells[3], 'white_count'),
        blackCount: parseCount(cells[4], 'black_count'),
        sourceUrl,
      });
    } catch (error) {
      rejected.push(error instanceof Error ? error.message : String(error));
    }
  }

  rows.sort((a, b) => a.decade - b.decade);
  return { rows, rejected };
}

export function mapNhgisRaceRowsToObservations(
  rows: readonly NhgisCookRacePopulationShareRow[],
  retrievedAt: string,
): readonly Phase1NhgisObservationDraft[] {
  const drafts: Phase1NhgisObservationDraft[] = [];

  for (const row of rows) {
    const jurisdictionId = countyJurisdictionId(row.countyFips);
    const referencePeriod = String(row.decade);
    const blackShare = populationSharePct(row.blackCount, row.totalPopulation);
    const whiteShare = populationSharePct(row.whiteCount, row.totalPopulation);

    drafts.push(
      buildDraft({
        metricId: PHASE1_NHGIS_BLACK_POPULATION_SHARE_COUNTY_METRIC_ID,
        jurisdictionId,
        referencePeriod,
        estimate: blackShare,
        raceEthnicitySlice: 'black',
        sourceUrl: row.sourceUrl,
        retrievedAt,
        datasetVintage: PHASE1_NHGIS_DATASET_VINTAGE,
        totalPopulation: row.totalPopulation,
        raceCount: row.blackCount,
      }),
    );
    drafts.push(
      buildDraft({
        metricId: PHASE1_NHGIS_WHITE_POPULATION_SHARE_COUNTY_METRIC_ID,
        jurisdictionId,
        referencePeriod,
        estimate: whiteShare,
        raceEthnicitySlice: 'white',
        sourceUrl: row.sourceUrl,
        retrievedAt,
        datasetVintage: PHASE1_NHGIS_DATASET_VINTAGE,
        totalPopulation: row.totalPopulation,
        raceCount: row.whiteCount,
      }),
    );
  }

  return drafts;
}

export function parseNhgisCookTenureHomeownershipFixtureCsv(csvText: string): {
  readonly rows: readonly NhgisCookTenureHomeownershipRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    /^decade,county_fips,owner_occupied_white,occupied_white,owner_occupied_black,occupied_black/i.test(
      line,
    ),
  );
  if (headerIndex < 0) {
    throw new Error(
      'NHGIS tenure fixture CSV missing decade,county_fips,owner_occupied_white,occupied_white,owner_occupied_black,occupied_black header',
    );
  }

  const rows: NhgisCookTenureHomeownershipRow[] = [];
  const rejected: string[] = [];
  let defaultSourceUrl = NHGIS_CITATION_URL;

  for (const line of lines.slice(0, headerIndex)) {
    const sourceMatch = line.match(/^#\s*source_url:\s*(\S+)/i);
    if (sourceMatch?.[1]) {
      defaultSourceUrl = sourceMatch[1]!.trim();
    }
  }

  for (const line of lines.slice(headerIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const cells = splitCsvLine(trimmed);
    const decade = parseDecade(cells[0]);
    if (decade === undefined) {
      rejected.push(`invalid decade: ${line}`);
      continue;
    }

    const countyFips = cells[1]?.trim() ?? '';
    if (!/^\d{5}$/.test(countyFips)) {
      rejected.push(`invalid county_fips: ${line}`);
      continue;
    }

    const sourceUrlRaw = cells[6]?.trim();
    const sourceUrl =
      sourceUrlRaw && /^https?:\/\//.test(sourceUrlRaw) ? sourceUrlRaw : defaultSourceUrl;

    try {
      const ownerOccupiedWhite = parseCount(cells[2], 'owner_occupied_white');
      const occupiedWhite = parseCount(cells[3], 'occupied_white');
      const ownerOccupiedBlack = parseCount(cells[4], 'owner_occupied_black');
      const occupiedBlack = parseCount(cells[5], 'occupied_black');
      if (ownerOccupiedWhite > occupiedWhite) {
        throw new Error('owner_occupied_white exceeds occupied_white');
      }
      if (ownerOccupiedBlack > occupiedBlack) {
        throw new Error('owner_occupied_black exceeds occupied_black');
      }
      rows.push({
        decade,
        countyFips,
        ownerOccupiedWhite,
        occupiedWhite,
        ownerOccupiedBlack,
        occupiedBlack,
        sourceUrl,
      });
    } catch (error) {
      rejected.push(error instanceof Error ? error.message : String(error));
    }
  }

  rows.sort((a, b) => a.decade - b.decade);
  return { rows, rejected };
}

export function mapNhgisTenureRowsToObservations(
  rows: readonly NhgisCookTenureHomeownershipRow[],
  retrievedAt: string,
): readonly Phase1NhgisObservationDraft[] {
  const drafts: Phase1NhgisObservationDraft[] = [];

  for (const row of rows) {
    const jurisdictionId = countyJurisdictionId(row.countyFips);
    const referencePeriod = String(row.decade);
    const blackRate = homeownershipRatePct(row.ownerOccupiedBlack, row.occupiedBlack);
    const whiteRate = homeownershipRatePct(row.ownerOccupiedWhite, row.occupiedWhite);

    drafts.push(
      buildDraft({
        metricId: PHASE1_NHGIS_BLACK_HOMEOWNERSHIP_RATE_COUNTY_METRIC_ID,
        jurisdictionId,
        referencePeriod,
        estimate: blackRate,
        raceEthnicitySlice: 'black',
        sourceUrl: row.sourceUrl,
        retrievedAt,
        datasetVintage: PHASE1_NHGIS_TENURE_DATASET_VINTAGE,
        ownerOccupied: row.ownerOccupiedBlack,
        occupiedUnits: row.occupiedBlack,
      }),
    );
    drafts.push(
      buildDraft({
        metricId: PHASE1_NHGIS_WHITE_HOMEOWNERSHIP_RATE_COUNTY_METRIC_ID,
        jurisdictionId,
        referencePeriod,
        estimate: whiteRate,
        raceEthnicitySlice: 'white',
        sourceUrl: row.sourceUrl,
        retrievedAt,
        datasetVintage: PHASE1_NHGIS_TENURE_DATASET_VINTAGE,
        ownerOccupied: row.ownerOccupiedWhite,
        occupiedUnits: row.occupiedWhite,
      }),
    );
  }

  return drafts;
}

export function assertNhgisTenureHomeownershipDecadesPresent(
  rows: readonly NhgisCookTenureHomeownershipRow[],
): void {
  const decades = new Set(rows.map((row) => row.decade));
  const missing = PHASE1_NHGIS_TENURE_HOMEOWNERSHIP_DECADES.filter((decade) => !decades.has(decade));
  if (missing.length > 0) {
    throw new Error(
      `NHGIS Cook tenure fixture missing required decades: ${missing.join(', ')} (county ${PHASE1_NHGIS_DEFAULT_COUNTY_FIPS})`,
    );
  }
}

export function listPhase1NhgisIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_NHGIS_INDICATOR_DEFINITIONS;
}

export function assertNhgisThemeImpactDecadesPresent(
  rows: readonly NhgisCookRacePopulationShareRow[],
): void {
  const decades = new Set(rows.map((row) => row.decade));
  const missing = PHASE1_NHGIS_THEME_IMPACT_DECADES.filter((decade) => !decades.has(decade));
  if (missing.length > 0) {
    throw new Error(
      `NHGIS Cook fixture missing required decades: ${missing.join(', ')} (county ${PHASE1_NHGIS_DEFAULT_COUNTY_FIPS})`,
    );
  }
}

export { PHASE1_NHGIS_COOK_JURISDICTION_ID };
