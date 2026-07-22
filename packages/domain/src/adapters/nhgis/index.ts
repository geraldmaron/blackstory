/**
 * IPUMS NHGIS county race adapter. Historical decennial county race data is fetched via the
 * IPUMS API v2 async EXTRACT workflow (submit → poll → download a CSV zip) and parsed here.
 * A registered `NHGIS_API_KEY` is required (a human gate; see external-data-sources.ts). This
 * module is pure/injectable: the parser takes CSV text, the client takes an injected fetch — no
 * filesystem or unzip (the firebase loader owns download + unzip against Cloud Storage).
 *
 * Verified end-to-end for 1860 (extract → parse → cross-checked vs twps0056 national totals
 * within the expected ~0.3% "population not in any county" residual). Additional decades are
 * added to NHGIS_DECADE_RACE_TABLES as each is verified the same way.
 */
import {
  getNhgisDecadeRaceTable,
  type NhgisCountyRaceExtractResult,
  type NhgisCountyRaceRow,
} from './types.js';

export {
  NHGIS_ADAPTER_ID,
  NHGIS_COUNTY_RACE_SOURCE_ID,
  NHGIS_DECADE_RACE_TABLES,
  getNhgisDecadeRaceTable,
  type NhgisDecadeRaceTable,
  type NhgisRaceCategory,
  type NhgisCountyRaceRow,
  type NhgisCountyRaceExtractRequest,
  type NhgisCountyRaceExtractResult,
} from './types.js';
export {
  NHGIS_CITATION_URL,
  NHGIS_COOK_RACE_POPULATION_SHARE_FIXTURE_FILENAME,
  NHGIS_HOMEPAGE_URL,
  NHGIS_TIME_SERIES_TABLES_URL,
  PHASE1_NHGIS_BLACK_POPULATION_SHARE_COUNTY_METRIC_ID,
  PHASE1_NHGIS_BLACK_HOMEOWNERSHIP_RATE_COUNTY_METRIC_ID,
  PHASE1_NHGIS_BOUNDARY_VERSION,
  PHASE1_NHGIS_COOK_JURISDICTION_ID,
  PHASE1_NHGIS_DATASET_VINTAGE,
  PHASE1_NHGIS_DEFAULT_COUNTY_FIPS,
  PHASE1_NHGIS_ATTRIBUTION_NOTE,
  PHASE1_NHGIS_TENURE_DATASET_VINTAGE,
  PHASE1_NHGIS_TENURE_HOMEOWNERSHIP_DECADES,
  PHASE1_NHGIS_THEME_IMPACT_DECADES,
  PHASE1_NHGIS_WHITE_POPULATION_SHARE_COUNTY_METRIC_ID,
  PHASE1_NHGIS_WHITE_HOMEOWNERSHIP_RATE_COUNTY_METRIC_ID,
} from './constants.js';
export {
  assertNhgisTenureHomeownershipDecadesPresent,
  assertNhgisThemeImpactDecadesPresent,
  listPhase1NhgisIndicators,
  mapNhgisRaceRowsToObservations,
  mapNhgisTenureRowsToObservations,
  parseNhgisCookRacePopulationShareFixtureCsv,
  parseNhgisCookTenureHomeownershipFixtureCsv,
  type NhgisCookRacePopulationShareRow,
  type NhgisCookTenureHomeownershipRow,
  type Phase1NhgisObservationDraft,
} from './phase1-nhgis-mapper.js';
export {
  DEFAULT_FIXTURE_PATH as NHGIS_PHASE1_DEFAULT_FIXTURE_PATH,
  DEFAULT_TENURE_FIXTURE_PATH as NHGIS_PHASE1_DEFAULT_TENURE_FIXTURE_PATH,
  fetchPhase1NhgisObservations,
  type Phase1NhgisFetchResult,
} from './fetch-phase1-nhgis.js';

const IPUMS_API_BASE = 'https://api.ipums.org';
const NHGIS_QUERY = 'collection=nhgis&version=2';

/** Fail-closed guard — mirrors census-demographics' caller-supplied key pattern. */
export function assertNhgisApiKeyConfigured(apiKey: string | undefined): asserts apiKey is string {
  if (!apiKey?.trim()) {
    throw new Error('NHGIS_API_KEY required');
  }
}

/** Quote-aware split of one CSV line (NHGIS quotes string fields; AREANAME may contain commas). */
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

/**
 * NHGIS reserves COUNTYA codes 9900–9999 for special/aggregate areas — notably "multi-county
 * reporting areas" that SUPERSET their constituent counties (e.g. 1790 Virginia). Those rows
 * coexist with the individual county rows, so summing them double-counts; they are excluded.
 * (Confirmed: excluding them fixes 1790 from +42% to −0.5% and changes no other decade.)
 */
const NHGIS_SPECIAL_COUNTY_CODE_MIN = 9900;

export function isNhgisAggregateArea(countyCode: string): boolean {
  const n = Number(countyCode);
  return Number.isInteger(n) && n >= NHGIS_SPECIAL_COUNTY_CODE_MIN;
}

function parseCount(value: string | undefined): number | null {
  const v = (value ?? '').trim();
  if (v === '' || v === '.') return null;
  if (!/^-?\d+$/.test(v)) {
    throw new Error(`NHGIS parse: expected an integer count, got "${value}"`);
  }
  return Number(v);
}

/**
 * Parses an NHGIS county race CSV (fail-closed) into county rows for one decade.
 *
 * NHGIS CSVs carry TWO header lines: line 1 is the column codes (GISJOIN, STATEA, …, AH3001…),
 * line 2 is human-readable descriptions — which is skipped. Throws on header drift or a missing
 * required column so an upstream format change stops the load rather than silently mis-mapping.
 */
export function parseNhgisCountyRaceCsv(csvText: string, decade: string): NhgisCountyRaceRow[] {
  const table = getNhgisDecadeRaceTable(decade);
  if (!table) {
    throw new Error(`NHGIS parse: no registered race table for decade ${decade}`);
  }

  const lines = csvText.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('NHGIS parse: file has no header + description rows');
  }
  const header = splitCsvLine(lines[0]!);
  const index = new Map(header.map((code, i) => [code, i]));

  const required = [
    'GISJOIN',
    'YEAR',
    'STATE',
    'STATEA',
    'COUNTY',
    'COUNTYA',
    ...Object.keys(table.variables),
  ];
  const missing = required.filter((c) => !index.has(c));
  if (missing.length > 0) {
    throw new Error(`NHGIS parse: missing required columns: ${missing.join(', ')}`);
  }

  const at = (cells: string[], code: string): string => cells[index.get(code)!] ?? '';
  const codesFor = (category: string): string[] =>
    Object.keys(table.variables).filter((code) => table.variables[code] === category);
  // A category can map to MULTIPLE variables (e.g. male + female, native + foreign-born) that
  // are summed. A category with no mapped variable in this table stays null.
  const sumCategory = (cells: string[], codes: string[]): number | null => {
    if (codes.length === 0) return null;
    return codes.reduce((total, code) => total + (parseCount(at(cells, code)) ?? 0), 0);
  };
  const whiteCodes = codesFor('white');
  const freeCodes = codesFor('blackFree');
  const enslavedCodes = codesFor('blackEnslaved');
  const blackCodes = codesFor('black');

  const rows: NhgisCountyRaceRow[] = [];
  // Skip line 0 (codes) via header parse above; skip line 1 (descriptions) as the first data pass.
  for (let li = 2; li < lines.length; li += 1) {
    const cells = splitCsvLine(lines[li]!);
    const year = at(cells, 'YEAR').trim();
    if (year !== decade) {
      throw new Error(`NHGIS parse: row YEAR "${year}" does not match requested decade ${decade}`);
    }
    // Drop special/aggregate reporting areas so they don't double-count with their counties.
    if (isNhgisAggregateArea(at(cells, 'COUNTYA').trim())) continue;
    const white = sumCategory(cells, whiteCodes);
    const blackFree = sumCategory(cells, freeCodes);
    const blackEnslaved = sumCategory(cells, enslavedCodes);
    const black = table.hasFreeEnslavedSplit
      ? (blackFree ?? 0) + (blackEnslaved ?? 0)
      : (sumCategory(cells, blackCodes) ?? 0);

    rows.push({
      gisJoin: at(cells, 'GISJOIN').trim(),
      decade,
      stateName: at(cells, 'STATE').trim(),
      stateCode: at(cells, 'STATEA').trim(),
      countyName: at(cells, 'COUNTY').trim(),
      countyCode: at(cells, 'COUNTYA').trim(),
      boundaryVersion: `nhgis-${decade}`,
      white,
      blackFree,
      blackEnslaved,
      black,
    });
  }
  return rows;
}

/** Orchestrates parse over already-downloaded CSV text. */
export function nhgisCountyRaceFromCsv(
  csvText: string,
  decade: string,
): NhgisCountyRaceExtractResult {
  return { request: { decade }, rows: parseNhgisCountyRaceCsv(csvText, decade), rejected: [] };
}

// ---- IPUMS API v2 async extract client (injectable fetch; verified live for 1860) ----

export type NhgisHttpResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
};
export type NhgisFetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<NhgisHttpResponse>;

/** The IPUMS extract definition (POST body) for one decade's county race table. */
export function buildNhgisExtractDefinition(decade: string): Record<string, unknown> {
  const table = getNhgisDecadeRaceTable(decade);
  if (!table) {
    throw new Error(`NHGIS: no registered race table for decade ${decade}`);
  }
  return {
    datasets: { [table.dataset]: { dataTables: [table.dataTable], geogLevels: ['county'] } },
    dataFormat: 'csv_header',
    description: `BlackStory NHGIS county race ${decade} (${table.dataset}/${table.dataTable})`,
  };
}

function authHeaders(apiKey: string, json = false): Record<string, string> {
  return { Authorization: apiKey, ...(json ? { 'Content-Type': 'application/json' } : {}) };
}

export type NhgisExtractHandle = { readonly number: number; readonly status: string };

/** Submits an extract; returns its number + initial status. Requires a configured API key. */
export async function submitNhgisExtract(
  definition: Record<string, unknown>,
  options: { readonly apiKey?: string; readonly fetchImpl: NhgisFetchLike },
): Promise<NhgisExtractHandle> {
  assertNhgisApiKeyConfigured(options.apiKey);
  const res = await options.fetchImpl(`${IPUMS_API_BASE}/extracts?${NHGIS_QUERY}`, {
    method: 'POST',
    headers: authHeaders(options.apiKey, true),
    body: JSON.stringify(definition),
  });
  if (!res.ok) {
    throw new Error(`NHGIS extract submit failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { number?: number; status?: string };
  if (typeof data.number !== 'number') {
    throw new Error('NHGIS extract submit: response missing extract number');
  }
  return { number: data.number, status: data.status ?? 'queued' };
}

export type NhgisExtractStatus = {
  readonly status: string;
  /** Present once completed. */
  readonly tableDataUrl?: string;
};

/** Polls one extract's status; returns the table-data download URL once completed. */
export async function getNhgisExtractStatus(
  extractNumber: number,
  options: { readonly apiKey?: string; readonly fetchImpl: NhgisFetchLike },
): Promise<NhgisExtractStatus> {
  assertNhgisApiKeyConfigured(options.apiKey);
  const res = await options.fetchImpl(
    `${IPUMS_API_BASE}/extracts/${extractNumber}?${NHGIS_QUERY}`,
    {
      headers: authHeaders(options.apiKey),
    },
  );
  if (!res.ok) {
    throw new Error(`NHGIS extract status failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    status?: string;
    downloadLinks?: { tableData?: { url?: string } };
  };
  const tableDataUrl = data.downloadLinks?.tableData?.url;
  return { status: data.status ?? 'unknown', ...(tableDataUrl ? { tableDataUrl } : {}) };
}
