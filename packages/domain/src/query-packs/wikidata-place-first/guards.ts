/**
 * Guards rejecting ethnic-group-only (P172) Wikidata harvest as a primary strategy.
 * Place-first / authority-first anchors (P19, P937, P131, P649, P1435) are required.
 */
import { ETHNIC_GROUP_ONLY_HARVEST_REJECTION } from './constants.js';

export { ETHNIC_GROUP_ONLY_HARVEST_REJECTION };

const NORMALIZE_RE = /\s+/g;

/** Wikidata properties that anchor place-first or authority-first portfolio queries. */
export const PLACE_OR_AUTHORITY_ANCHOR_PROPERTIES = [
  'P19',
  'P937',
  'P131',
  'P649',
  'P1435',
] as const;

function normalizeSparql(sparql: string): string {
  return sparql.replace(NORMALIZE_RE, ' ').trim().toLowerCase();
}

function usesEthnicGroupProperty(normalized: string): boolean {
  return /\bwdt:p172\b/u.test(normalized) || /\bp172\b/u.test(normalized);
}

function hasPlaceOrAuthorityAnchor(normalized: string): boolean {
  return PLACE_OR_AUTHORITY_ANCHOR_PROPERTIES.some((property) =>
    new RegExp(`\\b${property.toLowerCase()}\\b`, 'u').test(normalized),
  );
}

/**
 * Throws when SPARQL would harvest primarily via P172 ethnic group without a place or
 * authority anchor. Matches the WS7 intake rejection in `black-history-data-landscape-intake.md`.
 */
export function assertPlaceFirstSparqlValid(sparql: string): void {
  const normalized = normalizeSparql(sparql);
  if (!usesEthnicGroupProperty(normalized)) {
    return;
  }
  if (hasPlaceOrAuthorityAnchor(normalized)) {
    return;
  }
  throw new Error(ETHNIC_GROUP_ONLY_HARVEST_REJECTION);
}

/** Returns false for ethnic-group-only SPARQL; true when absent or properly anchored. */
export function isPlaceFirstSparqlValid(sparql: string): boolean {
  try {
    assertPlaceFirstSparqlValid(sparql);
    return true;
  } catch {
    return false;
  }
}

/** Example rejected pattern documented for portfolio reviewers — never compiled by this module. */
export const REJECTED_ETHNIC_GROUP_ONLY_SPARQL_EXAMPLE = `# REJECTED — ethnic-group-only primary harvest (P172 without place/authority anchor)
SELECT ?person ?personLabel WHERE {
  ?person wdt:P31 wd:Q5 .
  ?person wdt:P172 wd:Q49085 .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 500`;
