/**
 * Manual place-search fallback decision ("geocoder failure
 * provides manual place search"). Pure this module never itself calls the search feature; it
 * returns a decision the UI/route layer renders as a link into existing `/search` page
 * (never a second, parallel place-search implementation already owns that).
 */
import type { ManualPlaceSearchFallback, ManualPlaceSearchReason } from './types.js';

const FALLBACK_MESSAGES: Readonly<Record<ManualPlaceSearchReason, string>> = {
  no_match: 'We could not match that address. Try searching by city, county, or state instead.',
  geocoder_unavailable: 'The address lookup service is temporarily unavailable. Search by place instead.',
  geocoder_error: 'Something went wrong looking up that address. Search by place instead.',
  ambiguous_match: 'That address matched more than one place. Search by city, county, or state to narrow it down.',
};

export type BuildManualPlaceSearchFallbackOptions = {
  readonly searchHref?: string;
};

/** Always returns `available: true` manual place search is never itself unavailable. */
export function buildManualPlaceSearchFallback(
  reason: ManualPlaceSearchReason,
  options: BuildManualPlaceSearchFallbackOptions = {},
): ManualPlaceSearchFallback {
  return {
    available: true,
    reason,
    message: FALLBACK_MESSAGES[reason],
    searchHref: options.searchHref ?? '/search',
  };
}
