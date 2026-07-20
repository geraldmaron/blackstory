/**
 * Live fetch for one decennial vintage's county populations. Injectable `fetch` (the same
 * seam `../census-geo/fetch-geocode.ts` uses) so tests never touch the network. The variable
 * dictionary is fetched FIRST and our expected ids asserted by label — a drifted dataset
 * fails closed before a single count is parsed.
 */
import { assertVariableLabels, parseCountyPopulationResponse } from './response-parser.js';
import type { CensusDecennialVintage, CountyDecadePopulation } from './types.js';
import { buildCountyPopulationUrl, buildVariablesUrl } from './url-builder.js';

export type FetchLike = (url: string) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  readonly json: () => Promise<unknown>;
}>;

export type CountyPopulationFetchResult = {
  readonly vintage: CensusDecennialVintage;
  readonly rows: readonly CountyDecadePopulation[];
  readonly rejected: readonly string[];
};

export async function fetchCountyPopulations(
  vintage: CensusDecennialVintage,
  options: { readonly apiKey?: string; readonly fetchImpl?: FetchLike } = {},
): Promise<CountyPopulationFetchResult> {
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);

  const variablesResponse = await fetchImpl(buildVariablesUrl(vintage));
  if (!variablesResponse.ok) {
    throw new Error(
      `${vintage.dataset}: variables.json fetch failed (${variablesResponse.status})`,
    );
  }
  assertVariableLabels(
    vintage,
    (await variablesResponse.json()) as Parameters<typeof assertVariableLabels>[1],
  );

  const dataResponse = await fetchImpl(buildCountyPopulationUrl(vintage, options.apiKey));
  if (!dataResponse.ok) {
    throw new Error(`${vintage.dataset}: data fetch failed (${dataResponse.status})`);
  }
  const payload = (await dataResponse.json()) as readonly (readonly string[])[];
  const { rows, rejected } = parseCountyPopulationResponse(vintage, payload);
  return { vintage, rows, rejected };
}
