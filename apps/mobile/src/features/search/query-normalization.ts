/**
 * Search query normalization (MOB-013 item 1).
 *
 * Vendored/mirrors packages/security/src/query-guardrails.ts's normalizeSearchText and
 * DEFAULT_QUERY_GUARDRAIL_LIMITS -- apps/mobile cannot import @repo/security (own isolated
 * npm lockfile, not in the pnpm workspace graph; see the INTEGRATION GAP note in
 * apps/mobile/src/data/contracts.ts and apps/mobile/src/app/_lib/route-params.ts for the
 * same rationale applied elsewhere in this app). The constants below are kept numerically
 * identical to the server's so the client never sends a shape the server guardrail would reject
 * for a reason the client could have caught first, and the client's own "browse vs query"
 * threshold (MIN_QUERY_LENGTH) matches the server's stated minQueryLength: 2 exactly rather
 * than inventing an unrelated number.
 *
 * WHY 2 CHARACTERS: packages/security/src/query-guardrails.ts's
 * DEFAULT_QUERY_GUARDRAIL_LIMITS.minQueryLength is 2. The web search page does not enforce a
 * client-side minimum itself (apps/web/src/app/search/search-view-model.ts passes an empty
 * string straight through and lets the server guardrail decide), but the guardrail's own
 * documented floor is real and specific, so the mobile client adopts the SAME number rather than
 * a fresh "reasonable default" -- one query threshold, stated once, matching the API contract.
 */

/** Raw-input ceiling enforced at the TextInput itself (maxLength), independent of anything
 * below -- the first defense against a huge paste before any processing runs at all. */
export const MAX_RAW_INPUT_LENGTH = 300;

/** Matches DEFAULT_QUERY_GUARDRAIL_LIMITS.maxQueryLength (packages/security/src/query-guardrails.ts).
 * A normalized query longer than this is truncated (not rejected) -- a user who pastes more text
 * than intended should not lose their whole search, and the server would reject query_too_long
 * for anything past this bound anyway. */
export const MAX_QUERY_LENGTH = 120;

/** Matches DEFAULT_QUERY_GUARDRAIL_LIMITS.minQueryLength. Below this, and with no other
 * constraint active (browse mode has none by construction here -- see getSearchMode), the app
 * shows browse mode instead of issuing a request. */
export const MIN_QUERY_LENGTH = 2;

/** Debounce window before a normalized query change fires a network request (MOB-013 items 1/3). */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Inclusive Unicode code-point ranges stripped before anything else. Written as numeric code
 * points (never as literal characters or regex escapes) so this file has no embedded control
 * bytes or invisible characters of its own:
 *   - 0x0000-0x001F, 0x007F-0x009F: ASCII/Latin-1 control characters.
 *   - 0x200B-0x200F: zero-width space/joiners and directional marks, often used to visually
 *     disguise or split an otherwise-blocked string.
 *   - 0x2028-0x2029: line/paragraph separators.
 *   - 0xFEFF: byte-order mark.
 * This is the same set normalizeSearchText strips server-side, so the client's notion of "the
 * query" and the server's agree after normalization.
 */
const STRIP_CODE_POINT_RANGES: readonly (readonly [number, number])[] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x200b, 0x200f],
  [0x2028, 0x2029],
  [0xfeff, 0xfeff],
];

function isDisguisingCodePoint(code: number): boolean {
  return STRIP_CODE_POINT_RANGES.some(([lo, hi]) => code >= lo && code <= hi);
}

/** Strips the code-point ranges above, iterating by Unicode code point (not UTF-16 code unit) so
 * a surrogate pair is never split apart. */
function stripDisguisingCharacters(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code === undefined || !isDisguisingCodePoint(code)) {
      out += ch;
    }
  }
  return out;
}

/**
 * Normalizes free-text search input for BOTH display and outgoing-request use:
 *   1. Unicode NFKC normalization -- folds compatibility/confusable-adjacent forms (e.g. full-width
 *      Latin letters, various dash/space variants) into a canonical form. This does NOT fully
 *      solve cross-script homoglyph confusables (e.g. Cyrillic vs Latin "a" are different code
 *      points NFKC will not merge) -- that is a much larger, server-side-only concern (fuzzy
 *      matching/entity resolution) explicitly out of scope for client-side input normalization.
 *      What NFKC DOES reliably collapse -- width/compatibility variants of the same character --
 *      is exactly the class of "visually similar but different code point" case a client can fix
 *      cheaply before it ever reaches the network.
 *   2. Strip control/zero-width/separator characters (stripDisguisingCharacters).
 *   3. Trim leading/trailing whitespace.
 *   4. Collapse any run of internal whitespace to a single space.
 *   5. Truncate to MAX_QUERY_LENGTH (huge-paste guard #2, defense in depth alongside the
 *      TextInput's own maxLength).
 *
 * Pure and total: never throws, always returns a string (possibly empty).
 */
export function normalizeSearchQuery(raw: string): string {
  const capped = raw.length > MAX_RAW_INPUT_LENGTH ? raw.slice(0, MAX_RAW_INPUT_LENGTH) : raw;
  const normalized = stripDisguisingCharacters(capped.normalize('NFKC'))
    .trim()
    .replace(/\s+/g, ' ');
  return normalized.length > MAX_QUERY_LENGTH ? normalized.slice(0, MAX_QUERY_LENGTH) : normalized;
}

/**
 * Case-folded form used ONLY for client-side comparison purposes (recent-search de-duplication,
 * "is this the same term I already searched" checks) -- NEVER sent to the server and never used
 * as the display value. toLocaleLowerCase() (not toLowerCase()) so locale-sensitive casing
 * (e.g. Turkish dotless/dotted I) folds the way the user's own device expects.
 */
export function foldForComparison(normalized: string): string {
  return normalized.toLocaleLowerCase();
}

export type SearchMode = 'browse' | 'query';

/**
 * The query-threshold gate (MOB-013 item 2): below MIN_QUERY_LENGTH, the app is in explicit
 * "browse" mode (categories/recent searches, no network call) rather than firing a bounded-but-
 * still-real request for a 0-1 character string. At/above the threshold, it is "query" mode.
 * Pure and total -- never throws, always resolves to one of the two literal modes.
 */
export function getSearchMode(normalizedQuery: string): SearchMode {
  return normalizedQuery.length >= MIN_QUERY_LENGTH ? 'query' : 'browse';
}
