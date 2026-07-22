/**
 * Live fetch for Phase 1 Vera county jail population rate observations.
 */
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import {
  VERA_INCARCERATION_TRENDS_COUNTY_CSV_URL,
  VERA_INCARCERATION_TRENDS_HOMEPAGE_URL,
} from './constants.js';
import {
  mapVeraCountyJailRowsToObservations,
  parseVeraCountyJailCsv,
  selectVeraCountyJailRows,
  type Phase1VeraJailObservationDraft,
} from './phase1-vera-jail-mapper.js';

export type Phase1VeraJailFetchResult = {
  readonly observations: readonly Phase1VeraJailObservationDraft[];
  readonly rejected: readonly string[];
  readonly rowsParsed: number;
  readonly rowsSelected: number;
  readonly sourceUrl: string;
};

type FetchOptions = {
  readonly fetchImpl?: FetchLike;
  readonly csvText?: string;
  readonly retrievedAt?: string;
  readonly referenceYear?: number;
  readonly latestPerCounty?: boolean;
  readonly stateFipsList?: readonly string[];
};

export async function fetchPhase1VeraJailCountyObservations(
  options: FetchOptions = {},
): Promise<Phase1VeraJailFetchResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const csvText =
    options.csvText ??
    (await (async () => {
      const response = await fetchImpl(VERA_INCARCERATION_TRENDS_COUNTY_CSV_URL);
      if (!response.ok) {
        throw new Error(
          `Vera county CSV fetch failed (${response.status}) from ${VERA_INCARCERATION_TRENDS_COUNTY_CSV_URL}`,
        );
      }
      return response.text();
    })());

  const parsed = parseVeraCountyJailCsv(csvText);
  const selected = selectVeraCountyJailRows({
    rows: parsed.rows,
    ...(options.referenceYear !== undefined ? { referenceYear: options.referenceYear } : {}),
    ...(options.latestPerCounty ? { latestPerCounty: true } : {}),
    ...(options.stateFipsList ? { stateFipsList: options.stateFipsList } : {}),
  });
  const observations = mapVeraCountyJailRowsToObservations(selected, retrievedAt);

  return {
    observations,
    rejected: parsed.rejected,
    rowsParsed: parsed.rows.length,
    rowsSelected: selected.length,
    sourceUrl: VERA_INCARCERATION_TRENDS_HOMEPAGE_URL,
  };
}
