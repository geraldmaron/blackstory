/**
 * Parse fixture Wikidata Query Service JSON responses for portfolio tests.
 */
import type { WikidataSparqlResponse } from './types.js';

export function parseWikidataSparqlFixture(raw: unknown): WikidataSparqlResponse {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Wikidata SPARQL fixture must be an object');
  }
  const fixture = raw as WikidataSparqlResponse;
  if (!Array.isArray(fixture.head?.vars)) {
    throw new Error('Wikidata SPARQL fixture missing head.vars');
  }
  if (!Array.isArray(fixture.results?.bindings)) {
    throw new Error('Wikidata SPARQL fixture missing results.bindings');
  }
  return fixture;
}
