/**
 * Fetches the compact state decennial population index served from `/geo/`. Sibling of
 * `load-county-population-index.ts`, same module-singleton fetch cache and the same
 * bounded-download reasoning: the map client reads one static bundle rather than scanning the
 * published census tables in the browser.
 *
 * The normalizer is not reimplemented here — `parseStatePopulationIndexFile` already lives in
 * `@repo/domain/map/state-population` (the home hero's density channel parses the same file), so
 * this module is only the fetch and the cache around it. The county sibling carries its own
 * parser because the county wire shape has no domain-side equivalent.
 */
import {
  parseStatePopulationIndexFile,
  type StatePopulationIndex,
  type StatePopulationIndexFile,
} from '@repo/domain/map/state-population';

export const STATE_POPULATION_INDEX_PATH = '/geo/state-population-decades.json';

export type { StatePopulationIndexFile };

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
        return parseStatePopulationIndexFile(payload);
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
