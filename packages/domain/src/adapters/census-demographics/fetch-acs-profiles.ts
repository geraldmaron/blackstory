/**
 * Live fetch for ACS 5-year profiles. Same injectable-fetch seam as
 * `./fetch-county-populations.ts`; the variable dictionary is fetched FIRST and every
 * expected id asserted by label/concept — a drifted dataset fails closed before a single
 * estimate is parsed.
 *
 * County: one request covers every county in every state. Tract: the API requires a
 * concrete state per request, so `fetchAcsTractProfiles` takes one state FIPS and callers
 * fan out (52 requests for states + DC + PR) with their own pacing/retry policy.
 */
import type { FetchLike } from './fetch-county-populations.js';
import {
  assertAcsVariableLabels,
  loadAcsVariablesDictionary,
  parseAcsResponse,
} from './acs-response-parser.js';
import type { AcsProfileRow, AcsVintage } from './acs-types.js';
import { buildAcsCountyUrl, buildAcsTractUrl } from './acs-url-builder.js';

export type AcsProfileFetchResult = {
  readonly vintage: AcsVintage;
  readonly rows: readonly AcsProfileRow[];
  readonly rejected: readonly string[];
};

type FetchOptions = { readonly apiKey?: string; readonly fetchImpl?: FetchLike };

async function assertVintageDictionary(vintage: AcsVintage, fetchImpl: FetchLike): Promise<void> {
  const variablesJson = await loadAcsVariablesDictionary(vintage, fetchImpl);
  assertAcsVariableLabels(vintage, variablesJson);
}

async function fetchParsed(
  vintage: AcsVintage,
  url: string,
  geography: 'county' | 'tract',
  fetchImpl: FetchLike,
): Promise<AcsProfileFetchResult> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`${vintage.dataset}: data fetch failed (${response.status})`);
  }
  const payload = (await response.json()) as readonly (readonly (string | null)[])[];
  const { rows, rejected } = parseAcsResponse(vintage, payload, geography);
  return { vintage, rows, rejected };
}

/** Every county in every state, one request. Asserts the variable dictionary first. */
export async function fetchAcsCountyProfiles(
  vintage: AcsVintage,
  options: FetchOptions = {},
): Promise<AcsProfileFetchResult> {
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  await assertVintageDictionary(vintage, fetchImpl);
  return fetchParsed(vintage, buildAcsCountyUrl(vintage, options.apiKey), 'county', fetchImpl);
}

/** Every tract in ONE state. `assertDictionary: false` lets a fan-out caller assert once
 * up front instead of re-downloading the dictionary 52 times. */
export async function fetchAcsTractProfiles(
  vintage: AcsVintage,
  stateFips: string,
  options: FetchOptions & { readonly assertDictionary?: boolean } = {},
): Promise<AcsProfileFetchResult> {
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  if (options.assertDictionary !== false) {
    await assertVintageDictionary(vintage, fetchImpl);
  }
  return fetchParsed(
    vintage,
    buildAcsTractUrl(vintage, stateFips, options.apiKey),
    'tract',
    fetchImpl,
  );
}

/** One dictionary assertion for a whole fan-out run. */
export async function assertAcsVintageDictionary(
  vintage: AcsVintage,
  options: FetchOptions = {},
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  await assertVintageDictionary(vintage, fetchImpl);
}
