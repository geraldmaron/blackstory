/**
 * Versioned Wikidata place-first / authority-first query pack definitions.
 * Built with the shared query-pack contract (`buildQueryPack`) for discovery-run stamping.
 */
import { buildQueryPack } from '../pack.js';
import type { QueryPack } from '../types.js';
import { WIKIDATA_PLACE_FIRST_ADAPTER_SOURCE_ID } from './constants.js';
import {
  CIVIL_RIGHTS_OCCUPATION_SEEDS,
  US_STATE_PLACE_SEEDS,
} from './seeds.js';
import type { WikidataPlaceFirstPackSpec } from './types.js';

const PACK_CREATED_AT = '2026-07-21T17:34:38.000Z';

function geographicTerms(labels: readonly string[]) {
  return labels.map((text) => ({ text, termClass: 'geographic' as const }));
}

function wikidataSourceTerms(tokens: readonly string[]) {
  return tokens.map((text) => ({
    text,
    termClass: 'source_specific' as const,
    sourceId: WIKIDATA_PLACE_FIRST_ADAPTER_SOURCE_ID,
  }));
}

export const WIKIDATA_PERSON_PLACE_OCCUPATION_PACK: QueryPack = buildQueryPack({
  id: 'qp-wikidata-person-place-occupation',
  displayName: 'Wikidata persons by place + occupation',
  entityKind: 'person',
  theme: 'civil_rights',
  semver: '1.0.0',
  createdAt: PACK_CREATED_AT,
  notes:
    'Place-first portfolio pack: humans with birth/work in a seeded US state and occupation filter. ' +
    'Does not use P172 ethnic group as primary harvest.',
  terms: [
    { text: 'civil rights activist', termClass: 'positive' },
    { text: 'educator', termClass: 'positive' },
    { text: 'minister', termClass: 'positive' },
    ...geographicTerms(US_STATE_PLACE_SEEDS.map((seed) => seed.label)),
    ...wikidataSourceTerms(['P19', 'P937', 'P106', 'P131']),
  ],
});

export const WIKIDATA_PLACE_NRHP_LINKED_PACK: QueryPack = buildQueryPack({
  id: 'qp-wikidata-place-nrhp-linked',
  displayName: 'Wikidata places with NRHP authority link',
  entityKind: 'place',
  theme: 'historical_place',
  semver: '1.0.0',
  createdAt: PACK_CREATED_AT,
  notes:
    'Authority-first portfolio pack: items with NRHP reference number (P649) in seeded US states. ' +
    'NPS registry anchor — not ethnic-group filtering.',
  terms: [
    { text: 'National Register of Historic Places', termClass: 'positive' },
    { text: 'historic district', termClass: 'alias' },
    ...geographicTerms(US_STATE_PLACE_SEEDS.map((seed) => seed.label)),
    ...wikidataSourceTerms(['P649', 'P1435', 'P131']),
  ],
});

export const WIKIDATA_PLACE_FIRST_PACK_SPECS: readonly WikidataPlaceFirstPackSpec[] = [
  {
    pack: WIKIDATA_PERSON_PLACE_OCCUPATION_PACK,
    strategy: 'person_place_occupation',
    placeSeeds: US_STATE_PLACE_SEEDS,
    occupationSeeds: CIVIL_RIGHTS_OCCUPATION_SEEDS,
    resultLimit: 50,
  },
  {
    pack: WIKIDATA_PLACE_NRHP_LINKED_PACK,
    strategy: 'place_nrhp_linked',
    placeSeeds: US_STATE_PLACE_SEEDS,
    resultLimit: 50,
  },
] as const;

export function listWikidataPlaceFirstPackSpecs(): readonly WikidataPlaceFirstPackSpec[] {
  return WIKIDATA_PLACE_FIRST_PACK_SPECS;
}

export function getWikidataPlaceFirstPackSpec(packId: string): WikidataPlaceFirstPackSpec | undefined {
  return WIKIDATA_PLACE_FIRST_PACK_SPECS.find((spec) => spec.pack.id === packId);
}
