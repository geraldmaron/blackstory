/**
 * SPARQL compiler for Wikidata place-first / authority-first portfolio query packs.
 * Fixture mode only — callers must not execute compiled queries against live endpoints without
 * source-policy approval and campaign budgets.
 */
import { DEFAULT_WIKIDATA_SPARQL_LIMIT } from './constants.js';
import { assertPlaceFirstSparqlValid } from './guards.js';
import {
  assertOccupationSeedValid,
  assertPlaceSeedValid,
} from './seeds.js';
import type {
  CompiledWikidataSparqlQuery,
  WikidataOccupationSeed,
  WikidataPlaceFirstPackSpec,
  WikidataPlaceSeed,
} from './types.js';

function formatWikidataEntity(wikidataId: string): string {
  return `wd:${wikidataId.trim()}`;
}

function labelServiceBlock(): string {
  return 'SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }';
}

export function compilePersonPlaceOccupationSparql(input: {
  readonly placeSeed: WikidataPlaceSeed;
  readonly occupationSeed: WikidataOccupationSeed;
  readonly limit?: number;
}): string {
  assertPlaceSeedValid(input.placeSeed);
  assertOccupationSeedValid(input.occupationSeed);
  const state = formatWikidataEntity(input.placeSeed.wikidataId);
  const occupation = formatWikidataEntity(input.occupationSeed.wikidataId);
  const limit = input.limit ?? DEFAULT_WIKIDATA_SPARQL_LIMIT;

  const sparql = `# person_place_occupation — ${input.placeSeed.label} + ${input.occupationSeed.label}
SELECT ?person ?personLabel ?placeLabel ?occupationLabel WHERE {
  ?person wdt:P31 wd:Q5 .
  ?person wdt:P106 ${occupation} .
  {
    ?person wdt:P19 ?place .
    ?place wdt:P131* ${state} .
  } UNION {
    ?person wdt:P937 ?place .
    ?place wdt:P131* ${state} .
  }
  ${labelServiceBlock}
}
LIMIT ${limit}`;

  assertPlaceFirstSparqlValid(sparql);
  return sparql;
}

export function compilePlaceNrhpLinkedSparql(input: {
  readonly placeSeed: WikidataPlaceSeed;
  readonly limit?: number;
}): string {
  assertPlaceSeedValid(input.placeSeed);
  const state = formatWikidataEntity(input.placeSeed.wikidataId);
  const limit = input.limit ?? DEFAULT_WIKIDATA_SPARQL_LIMIT;

  const sparql = `# place_nrhp_linked — ${input.placeSeed.label}
SELECT ?item ?itemLabel ?nrhpId ?stateLabel WHERE {
  ?item wdt:P649 ?nrhpId .
  ?item wdt:P131* ${state} .
  ${labelServiceBlock}
}
LIMIT ${limit}`;

  assertPlaceFirstSparqlValid(sparql);
  return sparql;
}

export function compileWikidataPlaceFirstQueries(
  spec: WikidataPlaceFirstPackSpec,
): readonly CompiledWikidataSparqlQuery[] {
  const limit = spec.resultLimit ?? DEFAULT_WIKIDATA_SPARQL_LIMIT;
  const compiled: CompiledWikidataSparqlQuery[] = [];

  if (spec.strategy === 'person_place_occupation') {
    const occupations = spec.occupationSeeds ?? [];
    if (occupations.length === 0) {
      throw new Error(
        `Wikidata pack "${spec.pack.id}" requires occupationSeeds for person_place_occupation strategy`,
      );
    }
    for (const placeSeed of spec.placeSeeds) {
      for (const occupationSeed of occupations) {
        const sparql = compilePersonPlaceOccupationSparql({ placeSeed, occupationSeed, limit });
        compiled.push({
          packId: spec.pack.id,
          packVersionId: spec.pack.versionId,
          strategy: spec.strategy,
          placeSeed,
          occupationSeed,
          sparql,
          fixtureMode: true,
        });
      }
    }
    return compiled;
  }

  if (spec.strategy === 'place_nrhp_linked') {
    for (const placeSeed of spec.placeSeeds) {
      const sparql = compilePlaceNrhpLinkedSparql({ placeSeed, limit });
      compiled.push({
        packId: spec.pack.id,
        packVersionId: spec.pack.versionId,
        strategy: spec.strategy,
        placeSeed,
        sparql,
        fixtureMode: true,
      });
    }
    return compiled;
  }

  throw new Error(`Unsupported Wikidata place-first strategy: ${String(spec.strategy)}`);
}

export function compileAllWikidataPlaceFirstQueries(
  specs: readonly WikidataPlaceFirstPackSpec[],
): readonly CompiledWikidataSparqlQuery[] {
  return specs.flatMap((spec) => compileWikidataPlaceFirstQueries(spec));
}
