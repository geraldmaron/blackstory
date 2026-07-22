/**
 * Shared constants for Wikidata place-first portfolio query packs (WS7 / repo-2ztn.8).
 */
export const WIKIDATA_PLACE_FIRST_PORTFOLIO_WAVE_BEAD = 'repo-tt2u.8' as const;

export const WIKIDATA_PLACE_FIRST_ADAPTER_SOURCE_ID = 'src_wikidata' as const;

export const ETHNIC_GROUP_ONLY_HARVEST_REJECTION =
  'Rejected as primary Wikidata harvest strategy: P172 (ethnic group) alone essentializes identity ' +
  'and bypasses place/authority anchors. Prefer person_place_occupation or place_nrhp_linked query packs. ' +
  'See docs/research/black-history-data-landscape-intake.md §3.2 and docs/research/wikidata-place-first-query-packs.md.';

/** Default SPARQL LIMIT for portfolio dry-runs (fixture mode; no live mass harvest). */
export const DEFAULT_WIKIDATA_SPARQL_LIMIT = 50;
