/**
 * Deterministic, auditable text-relevance ranking.
 *
 * Ranking is a stable, explainable tier system never an opaque score. Match strength is a small
 * integer tier (exact name > name prefix > name substring > alias exact/prefix/substring >
 * topic/summary substring > bounded fuzzy). Connection strength (`relatedCount`) is a STRICTLY
 * SECONDARY sort key: it breaks ties within an equal text tier but can never override a stronger
 * text match ("ranked by relevance and connection strength, not fame alone"). Final ties break by
 * `id` ascending so re-running the build never reshuffles equal-rank results.
 */
import type { SearchableEntityRecord, SearchMatchField } from './types.js';

/**
 * Match tiers (higher = stronger). Kept sparse so the ordering intent is legible; the exact
 * integers are internal ordering keys, never surfaced.
 */
const TIER_NAME_EXACT = 100;
const TIER_NAME_PREFIX = 90;
const TIER_NAME_SUBSTRING = 80;
const TIER_ALIAS_EXACT = 70;
const TIER_ALIAS_PREFIX = 60;
const TIER_ALIAS_SUBSTRING = 50;
const TIER_TOPIC = 40;
const TIER_SUMMARY = 30;
const TIER_FUZZY = 10;
/** Empty query = browse-all: every record is included, ordered purely by connection strength. */
const TIER_BROWSE = 0;

/** Minimum query length before fuzzy (Levenshtein) matching is attempted avoids pathological
 * false positives on short queries and stays clear of `minQueryLength: 2` floor. */
export const MIN_FUZZY_QUERY_LENGTH = 4;

/** Maximum edit distance treated as a fuzzy match. */
export const MAX_FUZZY_DISTANCE = 2;

export type RankedRecord = {
  readonly record: SearchableEntityRecord;
  readonly matchedOn: SearchMatchField;
  readonly matchedText: string;
};

type MatchInfo = {
  readonly tier: number;
  readonly matchedOn: SearchMatchField;
  readonly matchedText: string;
};

/** Trim, lowercase, and collapse internal whitespace. Idempotent. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Levenshtein edit distance with an early bail-out: if the length difference alone exceeds `max`,
 * returns `max + 1` without doing the full DP. Small, hand-rolled, no external dependency.
 */
export function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowMin = i;
    const ai = a[i - 1];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = ai === b[j - 1] ? 0 : 1;
      // Indices are always in-bounds (arrays are sized b.length + 1), so these cells are defined.
      const value = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }
    // If the best cell in this row already exceeds `max`, no later row can recover.
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

function tokens(value: string): readonly string[] {
  return value.split(' ').filter((t) => t.length > 0);
}

function isFuzzyMatch(query: string, target: string): boolean {
  if (levenshtein(query, target, MAX_FUZZY_DISTANCE) <= MAX_FUZZY_DISTANCE) return true;
  // Also tolerate a typo of a single token within a multi-word target.
  return tokens(target).some(
    (token) => levenshtein(query, token, MAX_FUZZY_DISTANCE) <= MAX_FUZZY_DISTANCE,
  );
}

function bestAliasMatch(query: string, aliases: readonly string[]): MatchInfo | undefined {
  let best: MatchInfo | undefined;
  for (const alias of aliases) {
    let candidate: MatchInfo | undefined;
    if (alias === query)
      candidate = { tier: TIER_ALIAS_EXACT, matchedOn: 'alias', matchedText: alias };
    else if (alias.startsWith(query))
      candidate = { tier: TIER_ALIAS_PREFIX, matchedOn: 'alias', matchedText: alias };
    else if (alias.includes(query))
      candidate = { tier: TIER_ALIAS_SUBSTRING, matchedOn: 'alias', matchedText: alias };
    if (candidate && (!best || candidate.tier > best.tier)) best = candidate;
  }
  return best;
}

/**
 * Scores one record against an already-normalized (non-empty) query, returning the strongest match
 * or `undefined` when nothing matches. Deterministic: checks the strongest tiers first and returns
 * the first hit.
 */
function scoreRecord(query: string, record: SearchableEntityRecord): MatchInfo | undefined {
  const name = record.nameLower;
  if (name === query)
    return { tier: TIER_NAME_EXACT, matchedOn: 'displayName', matchedText: record.displayName };
  if (name.startsWith(query))
    return { tier: TIER_NAME_PREFIX, matchedOn: 'displayName', matchedText: record.displayName };
  if (name.includes(query))
    return { tier: TIER_NAME_SUBSTRING, matchedOn: 'displayName', matchedText: record.displayName };

  const alias = bestAliasMatch(query, record.aliases);
  if (alias) return alias;

  const topic = record.topicTags.find((tag) => tag.toLowerCase().includes(query));
  if (topic) return { tier: TIER_TOPIC, matchedOn: 'topicTags', matchedText: topic };

  if (record.summary && record.summary.toLowerCase().includes(query)) {
    return { tier: TIER_SUMMARY, matchedOn: 'summary', matchedText: query };
  }

  // Lowest-priority tier: bounded misspelling tolerance, only for sufficiently long queries.
  if (query.length >= MIN_FUZZY_QUERY_LENGTH) {
    if (isFuzzyMatch(query, name)) {
      return { tier: TIER_FUZZY, matchedOn: 'displayName', matchedText: record.displayName };
    }
    const fuzzyAlias = record.aliases.find((a) => isFuzzyMatch(query, a));
    if (fuzzyAlias) return { tier: TIER_FUZZY, matchedOn: 'alias', matchedText: fuzzyAlias };
  }

  return undefined;
}

/**
 * Ranks records against `query`. Pure and deterministic. Non-matching records are dropped (unless
 * the query is empty, which is treated as browse-all). Sort order: text tier descending, then
 * `relatedCount` descending (connection strength, secondary), then `id` ascending (stable
 * tie-break).
 */
export function rankRecords(
  query: string,
  records: readonly SearchableEntityRecord[],
): readonly RankedRecord[] {
  const normalized = normalizeQuery(query);
  const isBrowse = normalized === '';

  const matched: { readonly record: SearchableEntityRecord; readonly info: MatchInfo }[] = [];
  for (const record of records) {
    const info = isBrowse
      ? { tier: TIER_BROWSE, matchedOn: 'displayName' as const, matchedText: record.displayName }
      : scoreRecord(normalized, record);
    if (info) matched.push({ record, info });
  }

  matched.sort((a, b) => {
    if (a.info.tier !== b.info.tier) return b.info.tier - a.info.tier;
    if (a.record.relatedCount !== b.record.relatedCount)
      return b.record.relatedCount - a.record.relatedCount;
    return a.record.id.localeCompare(b.record.id);
  });

  return matched.map(({ record, info }) => ({
    record,
    matchedOn: info.matchedOn,
    matchedText: info.matchedText,
  }));
}
