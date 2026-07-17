/**
 * MediaWiki page and Wikidata entity parsing for API mode (BB-045).
 */
import type {
  MediaWikiPage,
  MediaWikiPageResponse,
  WikidataEntity,
  WikidataEntityResponse,
  WikimediaApiFetch,
} from './types.js';

export function parseMediaWikiPageResponse(raw: unknown): MediaWikiPage {
  if (!raw || typeof raw !== 'object') {
    throw new Error('MediaWiki page response must be an object');
  }
  const response = raw as MediaWikiPageResponse;
  const pages = response.query?.pages;
  if (!pages) {
    throw new Error('MediaWiki page response missing query.pages');
  }
  const page = Object.values(pages)[0];
  if (!page) {
    throw new Error('MediaWiki page response contains no pages');
  }
  return page;
}

export function parseWikidataEntityResponse(raw: unknown, entityId: string): WikidataEntity | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const response = raw as WikidataEntityResponse;
  return response.entities?.[entityId];
}

export function buildApiFetchFromFixtures(input: {
  readonly project: string;
  readonly pageRaw: unknown;
  readonly wikidataRaw?: unknown;
  readonly wikidataId?: string;
  readonly searchHit?: WikimediaApiFetch['searchHit'];
}): WikimediaApiFetch {
  const page = parseMediaWikiPageResponse(input.pageRaw);
  const wikidata =
    input.wikidataRaw && input.wikidataId
      ? parseWikidataEntityResponse(input.wikidataRaw, input.wikidataId)
      : undefined;

  return {
    ingestMode: 'api',
    project: input.project,
    page,
    ...(wikidata !== undefined ? { wikidata } : {}),
    ...(input.searchHit !== undefined ? { searchHit: input.searchHit } : {}),
  };
}
