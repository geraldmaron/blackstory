/**
 * Wikidata place-first / authority-first portfolio query pack types.
 * Feeds source-portfolio wave one (`repo-tt2u.8`); does not use P172 ethnic-group-only harvest.
 */
import type { QueryPack } from '../types.js';

/** Primary SPARQL strategies allowed for Wikidata portfolio discovery. */
export const WIKIDATA_PLACE_FIRST_STRATEGIES = [
  'person_place_occupation',
  'place_nrhp_linked',
] as const;

export type WikidataPlaceFirstStrategy = (typeof WIKIDATA_PLACE_FIRST_STRATEGIES)[number];

/** Wikidata item anchor for a US state or locality seed. */
export type WikidataPlaceSeed = {
  readonly label: string;
  readonly wikidataId: string;
};

/** Wikidata occupation (P106) anchor paired with geographic seeds. */
export type WikidataOccupationSeed = {
  readonly label: string;
  readonly wikidataId: string;
};

export type WikidataPlaceFirstPackSpec = {
  readonly pack: QueryPack;
  readonly strategy: WikidataPlaceFirstStrategy;
  readonly placeSeeds: readonly WikidataPlaceSeed[];
  readonly occupationSeeds?: readonly WikidataOccupationSeed[];
  /** SPARQL LIMIT clause; defaults to 50 in the compiler. */
  readonly resultLimit?: number;
};

export type CompiledWikidataSparqlQuery = {
  readonly packId: string;
  readonly packVersionId: QueryPack['versionId'];
  readonly strategy: WikidataPlaceFirstStrategy;
  readonly placeSeed: WikidataPlaceSeed;
  readonly occupationSeed?: WikidataOccupationSeed;
  readonly sparql: string;
  readonly fixtureMode: true;
};

export type WikidataPlaceFirstDryRun = {
  readonly compiledAt: string;
  readonly portfolioWaveBead: 'repo-tt2u.8';
  readonly rejectionNote: string;
  readonly queries: readonly CompiledWikidataSparqlQuery[];
};

/** Minimal Wikidata Query Service JSON shape for fixture parsing. */
export type WikidataSparqlBindingValue = {
  readonly type: 'uri' | 'literal';
  readonly value: string;
  readonly 'xml:lang'?: string;
};

export type WikidataSparqlResponse = {
  readonly head: { readonly vars: readonly string[] };
  readonly results: {
    readonly bindings: ReadonlyArray<Record<string, WikidataSparqlBindingValue>>;
  };
};
