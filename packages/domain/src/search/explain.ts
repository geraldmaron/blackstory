/**
 * Human-readable match explanations (BB-049 AC4: results indicate WHY each item matches the query).
 *
 * Explanations are short, factual sentences built only from display-safe text (the matched name,
 * alias, topic, or "summary"). They NEVER contain a numeric score, an evidence/connection count,
 * or a redacted field.
 */
import type { SearchMatchField, SearchableEntityRecord } from './types.js';

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Builds the one-line "why this matched" explanation for a result. `record` is accepted for future
 * enrichment (e.g. incorporating status/era context) and to keep the signature stable; today the
 * explanation is derived from the match field and matched text alone.
 */
export function buildExplanation(
  _record: SearchableEntityRecord,
  matchedOn: SearchMatchField,
  matchedText: string,
  query: string,
): string {
  if (query.trim() === '') {
    return 'Included in the current release.';
  }
  switch (matchedOn) {
    case 'displayName':
      return 'Matched on name.';
    case 'alias':
      return `Matched alias "${matchedText}".`;
    case 'topicTags':
      return `Matched topic: ${capitalize(matchedText)}.`;
    case 'summary':
      return 'Matched in the summary text.';
    default:
      return 'Matched.';
  }
}
