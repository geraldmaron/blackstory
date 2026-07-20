/**
 * Fetches the compact state decennial Black population index served from `/geo/`. Production
 * data mirrors `censusStateDecades` (twps0056 1790–1990 + modern rollups); the map client
 * loads the bounded static JSON — never Firestore in the browser.
 */
import {
  parseStatePopulationIndexFile,
  type StatePopulationIndex,
  type StatePopulationIndexFile,
} from '@repo/domain/map/state-population';

export const STATE_POPULATION_INDEX_PATH = '/geo/state-population-decades.json';

let indexPromise: Promise<StatePopulationIndex | undefined> | undefined;

export async function fetchStatePopulationIndex(
  fetchImpl: typeof fetch = fetch,
): Promise<StatePopulationIndex | undefined> {
  if (!indexPromise) {
    indexPromise = fetchImpl(STATE_POPULATION_INDEX_PATH)
      .then(async (response) => {
        if (!response.ok) {
          indexPromise = undefined;
          return undefined;
        }
        const payload = (await response.json()) as StatePopulationIndexFile;
        const index = parseStatePopulationIndexFile(payload);
        if (index.vintages.length === 0 || Object.keys(index.states).length === 0) {
          return undefined;
        }
        return index;
      })
      .catch(() => {
        indexPromise = undefined;
        return undefined;
      });
  }
  return indexPromise;
}

/** Test/dev helper — resets the module singleton fetch cache. */
export function resetStatePopulationIndexCacheForTests(): void {
  indexPromise = undefined;
}
