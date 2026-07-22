/**
 * Live fetch for Phase 1 Eviction Lab county filing-rate observations from the analysis CSV.
 */
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import { EVICTION_LAB_COUNTY_PROPRIETARY_VALID_CSV_URL } from './constants.js';
import {
  filterPhase1EvictionRowsByStates,
  mapPhase1EvictionRowsToObservations,
  parsePhase1EvictionCountyCsv,
  type Phase1EvictionObservationDraft,
} from './phase1-eviction-mapper.js';

export type Phase1EvictionFetchResult = {
  readonly observations: readonly Phase1EvictionObservationDraft[];
  readonly rejected: readonly string[];
  readonly rowsParsed: number;
  readonly rowsObserved: number;
  readonly sourceUrl: string;
};

type FetchOptions = {
  readonly fetchImpl?: FetchLike;
  readonly csvText?: string;
  readonly retrievedAt?: string;
};

export async function fetchPhase1EvictionCountyObservations(
  stateFipsList: readonly string[],
  options: FetchOptions = {},
): Promise<Phase1EvictionFetchResult> {
  if (stateFipsList.length === 0) {
    throw new Error('stateFipsList must not be empty for bounded county fetch');
  }
  for (const stateFips of stateFipsList) {
    if (!/^\d{2}$/.test(stateFips)) {
      throw new Error(`stateFips must be 2 digits, got "${stateFips}"`);
    }
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const csvText =
    options.csvText ??
    (await (async () => {
      const response = await fetchImpl(EVICTION_LAB_COUNTY_PROPRIETARY_VALID_CSV_URL);
      if (!response.ok) {
        throw new Error(
          `Eviction Lab county CSV fetch failed (${response.status}) from ${EVICTION_LAB_COUNTY_PROPRIETARY_VALID_CSV_URL}`,
        );
      }
      return response.text();
    })());

  const parsed = parsePhase1EvictionCountyCsv(csvText);
  const bounded = filterPhase1EvictionRowsByStates(parsed.rows, stateFipsList);
  const observations = mapPhase1EvictionRowsToObservations(bounded, retrievedAt);

  return {
    observations,
    rejected: parsed.rejected,
    rowsParsed: parsed.rows.length + parsed.rejected.length,
    rowsObserved: bounded.length,
    sourceUrl: EVICTION_LAB_COUNTY_PROPRIETARY_VALID_CSV_URL,
  };
}
