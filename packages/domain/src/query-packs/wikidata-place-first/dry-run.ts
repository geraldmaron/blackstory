/**
 * Dry-run compiler output for Wikidata place-first portfolio query packs.
 * Produces reviewable SPARQL without live Wikidata Query Service execution.
 */
import {
  ETHNIC_GROUP_ONLY_HARVEST_REJECTION,
  WIKIDATA_PLACE_FIRST_PORTFOLIO_WAVE_BEAD,
} from './constants.js';
import { WIKIDATA_PLACE_FIRST_PACK_SPECS } from './packs.js';
import { compileAllWikidataPlaceFirstQueries } from './sparql-compiler.js';
import type { WikidataPlaceFirstDryRun, WikidataPlaceFirstPackSpec } from './types.js';

export type BuildWikidataPlaceFirstDryRunInput = {
  readonly compiledAt: string;
  readonly packSpecs?: readonly WikidataPlaceFirstPackSpec[];
};

/** Builds fixture-mode dry-run output for portfolio review and tests. */
export function buildWikidataPlaceFirstDryRun(
  input: BuildWikidataPlaceFirstDryRunInput,
): WikidataPlaceFirstDryRun {
  const specs = input.packSpecs ?? WIKIDATA_PLACE_FIRST_PACK_SPECS;
  const queries = compileAllWikidataPlaceFirstQueries(specs);
  return {
    compiledAt: input.compiledAt,
    portfolioWaveBead: WIKIDATA_PLACE_FIRST_PORTFOLIO_WAVE_BEAD,
    rejectionNote: ETHNIC_GROUP_ONLY_HARVEST_REJECTION,
    queries,
  };
}
