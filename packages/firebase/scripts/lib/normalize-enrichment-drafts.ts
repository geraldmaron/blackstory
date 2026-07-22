/**
 * Post-enrichment normalizer for auto-promote and rejudge eligibility checks.
 * Cleans LLM draft fields before release-builder validation — summary length,
 * decade-range era buckets, and unregistered topic ids.
 */
import { isValidTopicId } from '@repo/domain';

const PUBLIC_SUMMARY_MAX = 400;

export type EnrichmentDraftFields = {
  readonly publicSummary?: string;
  readonly eraBuckets?: readonly string[];
  readonly topicIds?: readonly string[];
};

/** Trims publicSummary to ≤400 chars, preferring a sentence boundary when possible. */
export function trimPublicSummary(summary: string, maxLen = PUBLIC_SUMMARY_MAX): string {
  const trimmed = summary.trim();
  if (trimmed.length <= maxLen) return trimmed;

  const slice = trimmed.slice(0, maxLen);
  const sentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );
  if (sentenceEnd >= 120) {
    return slice.slice(0, sentenceEnd + 1).trim();
  }

  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > 0) return slice.slice(0, lastSpace).trim();
  return slice.trim();
}

const DECADE_RANGE_PATTERN = /^(\d{4})s[-–](\d{2,4})s?$/u;
const DECADE_LABEL_PATTERN = /^(\d{4})s$/u;

function decadeLabel(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

function expandDecadeRange(bucket: string): readonly string[] {
  const match = DECADE_RANGE_PATTERN.exec(bucket.trim());
  if (!match) return [bucket.trim()];

  const startYear = Number.parseInt(match[1]!, 10);
  const endToken = match[2]!;
  const endYear =
    endToken.length === 2
      ? Number.parseInt(`${match[1]!.slice(0, 2)}${endToken}`, 10)
      : Number.parseInt(endToken, 10);

  const buckets: string[] = [];
  for (
    let decade = Math.floor(startYear / 10) * 10;
    decade <= Math.floor(endYear / 10) * 10;
    decade += 10
  ) {
    buckets.push(decadeLabel(decade));
  }
  return buckets;
}

/** Normalizes era bucket labels, expanding common decade-range typos like 1960s-70s. */
export function normalizeEraBuckets(buckets: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (const bucket of buckets) {
    const trimmed = bucket.trim();
    if (!trimmed) continue;

    if (DECADE_RANGE_PATTERN.test(trimmed)) {
      out.push(...expandDecadeRange(trimmed));
      continue;
    }
    if (DECADE_LABEL_PATTERN.test(trimmed)) {
      out.push(trimmed);
    }
  }
  return [...new Set(out)];
}

/** Drops topic ids that are not members of TOPIC_REGISTRY. */
export function filterRegisteredTopicIds(topicIds: readonly string[]): readonly string[] {
  return topicIds.filter(isValidTopicId);
}

/** Applies all draft normalizers in place for promote/rejudge packet handling. */
export function normalizeEnrichmentDrafts<T extends EnrichmentDraftFields>(drafts: T): T {
  const normalized: EnrichmentDraftFields = {};

  if (drafts.publicSummary !== undefined) {
    normalized.publicSummary = trimPublicSummary(drafts.publicSummary);
  }
  if (drafts.eraBuckets !== undefined) {
    normalized.eraBuckets = normalizeEraBuckets(drafts.eraBuckets);
  }
  if (drafts.topicIds !== undefined) {
    normalized.topicIds = filterRegisteredTopicIds(drafts.topicIds);
  }

  return { ...drafts, ...normalized };
}
