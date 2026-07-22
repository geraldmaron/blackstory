/**
 * Live fetch for Phase 1 BJS NPS state imprisonment-rate observations.
 */
import { BJS_NPS_HOMEPAGE_URL, BJS_NPS_P23_TABLES_ZIP_URL } from './constants.js';
import { fetchCensusStateRacePopulations } from './fetch-census-state-race-populations.js';
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import {
  mapBjsNpsRowsToObservations,
  parseBjsNpsStat01Csv,
  type Phase1BjsNpsObservationDraft,
} from './phase1-bjs-nps-mapper.js';

export type Phase1BjsNpsFetchResult = {
  readonly observations: readonly Phase1BjsNpsObservationDraft[];
  readonly rejected: readonly string[];
  readonly statesParsed: number;
  readonly referenceYear: number;
  readonly sourceUrl: string;
};

type FetchOptions = {
  readonly fetchImpl?: FetchLike;
  readonly stat01CsvText?: string;
  readonly censusApiKey?: string;
  readonly populations?: Map<string, import('./phase1-bjs-nps-mapper.js').StateRacePopulation>;
  readonly retrievedAt?: string;
};

export async function fetchPhase1BjsNpsObservations(
  options: FetchOptions = {},
): Promise<Phase1BjsNpsFetchResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const stat01CsvText =
    options.stat01CsvText ??
    (await (async () => {
      throw new Error(
        'fetchPhase1BjsNpsObservations requires stat01CsvText; download BJS zip in ingest script',
      );
    })());

  const parsed = parseBjsNpsStat01Csv(stat01CsvText);
  const populations =
    options.populations ??
    (await (async () => {
      const apiKey = options.censusApiKey?.trim();
      if (!apiKey) {
        throw new Error('censusApiKey required to derive state race imprisonment rates');
      }
      return fetchCensusStateRacePopulations({
        referenceYear: parsed.referenceYear,
        apiKey,
        fetchImpl,
      });
    })());

  const observations = mapBjsNpsRowsToObservations(parsed.rows, populations, retrievedAt);

  return {
    observations,
    rejected: parsed.rejected,
    statesParsed: parsed.rows.length,
    referenceYear: parsed.referenceYear,
    sourceUrl: BJS_NPS_HOMEPAGE_URL,
  };
}

export { BJS_NPS_P23_TABLES_ZIP_URL };
