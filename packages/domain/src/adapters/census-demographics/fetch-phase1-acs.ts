/**
 * Live fetch for Phase 1 ACS 5-year indicators — county (bounded by state list) and
 * state-level unemployment. Reuses dictionary assertion from fetch-acs-profiles.ts.
 */
import { CENSUS_DATA_API_BASE_URL } from './url-builder.js';
import type { FetchLike } from './fetch-county-populations.js';
import { assertAcsVariableLabels, loadAcsVariablesDictionary } from './acs-response-parser.js';
import type { AcsVintage } from './acs-types.js';
import {
  mapPhase1AcsRowToObservations,
  parsePhase1AcsResponse,
  type Phase1AcsGeography,
  type Phase1AcsObservationDraft,
} from './phase1-acs-mapper.js';

export type Phase1AcsFetchResult = {
  readonly vintage: AcsVintage;
  readonly geography: Phase1AcsGeography;
  readonly observations: readonly Phase1AcsObservationDraft[];
  readonly rejected: readonly string[];
  readonly rowsParsed: number;
};

type FetchOptions = { readonly apiKey?: string; readonly fetchImpl?: FetchLike };

function variableList(vintage: AcsVintage): string {
  return `NAME,${vintage.variables.map((v) => v.id).join(',')}`;
}

function buildCountyInStatesUrl(
  vintage: AcsVintage,
  stateFipsList: readonly string[],
  apiKey?: string,
): string {
  if (stateFipsList.length === 0) {
    throw new Error('stateFipsList must not be empty for bounded county fetch');
  }
  for (const stateFips of stateFipsList) {
    if (!/^\d{2}$/.test(stateFips)) {
      throw new Error(`stateFips must be 2 digits, got "${stateFips}"`);
    }
  }
  const params = new URLSearchParams({
    get: variableList(vintage),
    for: 'county:*',
    in: `state:${stateFipsList.join(',')}`,
  });
  if (apiKey) params.set('key', apiKey);
  return `${CENSUS_DATA_API_BASE_URL}/${vintage.dataset}?${params.toString()}`;
}

function buildStateUrl(vintage: AcsVintage, apiKey?: string): string {
  const params = new URLSearchParams({
    get: variableList(vintage),
    for: 'state:*',
  });
  if (apiKey) params.set('key', apiKey);
  return `${CENSUS_DATA_API_BASE_URL}/${vintage.dataset}?${params.toString()}`;
}

async function assertVintageDictionary(vintage: AcsVintage, fetchImpl: FetchLike): Promise<void> {
  const variablesJson = await loadAcsVariablesDictionary(vintage, fetchImpl);
  assertAcsVariableLabels(vintage, variablesJson);
}

async function fetchAndMap(
  vintage: AcsVintage,
  url: string,
  geography: Phase1AcsGeography,
  fetchImpl: FetchLike,
  retrievedAt: string,
): Promise<Phase1AcsFetchResult> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`${vintage.dataset}: data fetch failed (${response.status})`);
  }
  const payload = (await response.json()) as readonly (readonly (string | null)[])[];
  const { rows, rejected } = parsePhase1AcsResponse(vintage, payload, geography);
  const observations = rows.flatMap((row) => mapPhase1AcsRowToObservations(row, vintage, retrievedAt));
  return { vintage, geography, observations, rejected, rowsParsed: rows.length };
}

/** Counties in the given states — one request per call (bounded by state list). */
export async function fetchPhase1AcsCountyObservations(
  vintage: AcsVintage,
  stateFipsList: readonly string[],
  options: FetchOptions = {},
): Promise<Phase1AcsFetchResult> {
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  await assertVintageDictionary(vintage, fetchImpl);
  const retrievedAt = new Date().toISOString();
  return fetchAndMap(
    vintage,
    buildCountyInStatesUrl(vintage, stateFipsList, options.apiKey),
    'county',
    fetchImpl,
    retrievedAt,
  );
}

/** All states — one request for state-level Phase 1 metrics (unemployment). */
export async function fetchPhase1AcsStateObservations(
  vintage: AcsVintage,
  options: FetchOptions = {},
): Promise<Phase1AcsFetchResult> {
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  await assertVintageDictionary(vintage, fetchImpl);
  const retrievedAt = new Date().toISOString();
  return fetchAndMap(
    vintage,
    buildStateUrl(vintage, options.apiKey),
    'state',
    fetchImpl,
    retrievedAt,
  );
}

export { buildCountyInStatesUrl, buildStateUrl };
