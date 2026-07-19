/**
 * Fetches the compact county decennial population index served from `/geo/`. Production
 * data lives in Firestore `censusCountyDecades` (public read); this static bundle is the
 * map client's bounded download — regenerate from Admin SDK export, never full-scan Firestore
 * in the browser (~9k docs × 3 decades).
 */
import {
  CENSUS_POPULATION_DECADES,
  isCensusPopulationDecade,
  type CensusPopulationDecade,
  type CountyPopulationIndex,
  type CountyPopulationRecord,
} from '@repo/domain/map/county-population';

export const COUNTY_POPULATION_INDEX_PATH = '/geo/county-population-decades.json';

export type CountyPopulationIndexFile = {
  readonly vintages?: readonly string[];
  readonly counties?: Readonly<
    Record<
      string,
      Readonly<Partial<Record<string, { readonly total?: number; readonly black?: number }>>>
    >
  >;
};

let indexPromise: Promise<CountyPopulationIndex | undefined> | undefined;

function parseRecord(raw: { readonly total?: number; readonly black?: number } | undefined): CountyPopulationRecord | undefined {
  if (!raw || typeof raw.total !== 'number' || typeof raw.black !== 'number') return undefined;
  if (raw.total < 0 || raw.black < 0) return undefined;
  return { totalPopulation: raw.total, blackPopulation: raw.black };
}

export function parseCountyPopulationIndexFile(payload: CountyPopulationIndexFile): CountyPopulationIndex {
  const vintages = (payload.vintages ?? CENSUS_POPULATION_DECADES).filter(isCensusPopulationDecade);
  const counties: Record<string, Partial<Record<CensusPopulationDecade, CountyPopulationRecord>>> = {};
  for (const [fips5, byDecade] of Object.entries(payload.counties ?? {})) {
    const decadeMap: Partial<Record<CensusPopulationDecade, CountyPopulationRecord>> = {};
    for (const [decadeRaw, counts] of Object.entries(byDecade ?? {})) {
      if (!isCensusPopulationDecade(decadeRaw)) continue;
      const record = parseRecord(counts);
      if (record) decadeMap[decadeRaw] = record;
    }
    if (Object.keys(decadeMap).length > 0) {
      counties[fips5] = decadeMap;
    }
  }
  return { vintages, counties };
}

export async function fetchCountyPopulationIndex(
  fetchImpl: typeof fetch = fetch,
): Promise<CountyPopulationIndex | undefined> {
  if (!indexPromise) {
    indexPromise = fetchImpl(COUNTY_POPULATION_INDEX_PATH)
      .then(async (response) => {
        if (!response.ok) {
          indexPromise = undefined;
          return undefined;
        }
        const payload = (await response.json()) as CountyPopulationIndexFile;
        return parseCountyPopulationIndexFile(payload);
      })
      .catch(() => {
        indexPromise = undefined;
        return undefined;
      });
  }
  return indexPromise;
}

/** Test/dev helper — resets the module singleton fetch cache. */
export function resetCountyPopulationIndexCacheForTests(): void {
  indexPromise = undefined;
}
