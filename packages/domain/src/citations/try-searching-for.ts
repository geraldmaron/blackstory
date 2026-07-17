/**
 * Deterministic "Try searching for" suggestion built entirely from fields already stored on a
 * citation (source title, author, named entities) — no LLM call, no network call, no randomness.
 * This function is synchronous and pure: same input always produces the same output.
 */
import type { Citation } from './citation.js';

export type TrySearchingForCitationInput = Pick<
  Citation,
  'title' | 'sourceName' | 'authorName' | 'namedEntities'
>;

const MAX_NAMED_ENTITIES = 3;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Builds a search-query string like `Rosewood massacre grand jury report 1923 Florida` from a
 * citation's stored title/author/named-entities. Falls back to the source name when no title is
 * stored. Returns an empty-subject fallback phrase when a citation has none of these fields
 * populated, rather than throwing degraded citations should never crash the reader UI.
 */
export function buildTrySearchingForSubject(citation: TrySearchingForCitationInput): string {
  const parts: string[] = [];
  const title = clean(citation.title) ?? clean(citation.sourceName);
  if (title) parts.push(title);
  const author = clean(citation.authorName);
  if (author) parts.push(author);
  for (const entity of (citation.namedEntities ?? []).slice(0, MAX_NAMED_ENTITIES)) {
    const cleaned = clean(entity);
    if (cleaned) parts.push(cleaned);
  }
  return parts.join(' ').trim();
}

/**
 * Full reader-facing suggestion string, e.g.
 * `Try searching for: "Rosewood massacre grand jury report 1923 Florida"`.
 */
export function buildTrySearchingForSuggestion(citation: TrySearchingForCitationInput): string {
  const subject = buildTrySearchingForSubject(citation);
  if (!subject) {
    return 'Try searching for: the source name and date noted in this citation.';
  }
  return `Try searching for: "${subject}"`;
}
