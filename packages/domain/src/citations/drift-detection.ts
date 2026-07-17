/**
 * Content-drift detection: compares a live-fetched page's
 * content against the stored capture via exact hash and, when text is available, a fuzzy
 * token-shingle similarity. Divergence is flagged for research review this module never
 * auto-resolves a drift; the capture remains the evidentiary anchor either way.
 */
import type { ContentHash } from '../provenance/hashes.js';
import { contentHashesEqual } from '../provenance/hashes.js';

export type ContentDriftResult = {
  readonly hashMatches: boolean;
  /** Jaccard similarity over word-trigram shingles, 0..1. Undefined when no text was supplied
   * for a fuzzy comparison (hash-only comparison). */
  readonly similarity?: number;
  /** True when the live content differs enough from the capture that the claim's citation may
   * now point at something different from what it originally supported. */
  readonly diverged: boolean;
  /** True whenever `diverged` is true kept as a distinct, explicitly named field so a
   * research-review queue can filter on intent rather than re-deriving it from `diverged`. */
  readonly flaggedForReview: boolean;
};

export const DEFAULT_DRIFT_SIMILARITY_THRESHOLD = 0.85;

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean);
}

function shingles(words: readonly string[], size = 3): Set<string> {
  if (words.length < size) {
    return new Set(words.length > 0 ? [words.join(' ')] : []);
  }
  const result = new Set<string>();
  for (let i = 0; i <= words.length - size; i += 1) {
    result.add(words.slice(i, i + size).join(' '));
  }
  return result;
}

/** Jaccard similarity between two word-trigram shingle sets, 0..1. */
export function jaccardSimilarity(a: string, b: string): number {
  const left = shingles(normalizeWords(a));
  const right = shingles(normalizeWords(b));
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const shingle of left) {
    if (right.has(shingle)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Compares captured content against a fresh live fetch. Exact hash match short-circuits to
 * "not diverged". Otherwise, when text is available for both sides, a fuzzy similarity check
 * tolerates minor drift (ads, timestamps, byline updates) below the divergence threshold. With
 * a hash mismatch and no text to compare, this fails closed toward "diverged" an
 * unverifiable difference is treated as a difference worth a human's attention, never silently
 * accepted.
 */
export function compareCapturedContent(input: {
  readonly capturedHash: ContentHash;
  readonly liveContentHash: ContentHash;
  readonly capturedText?: string;
  readonly liveText?: string;
  readonly similarityThreshold?: number;
}): ContentDriftResult {
  const hashMatches = contentHashesEqual(input.capturedHash, input.liveContentHash);
  if (hashMatches) {
    return { hashMatches: true, diverged: false, flaggedForReview: false };
  }

  if (input.capturedText === undefined || input.liveText === undefined) {
    return { hashMatches: false, diverged: true, flaggedForReview: true };
  }

  const threshold = input.similarityThreshold ?? DEFAULT_DRIFT_SIMILARITY_THRESHOLD;
  const similarity = jaccardSimilarity(input.capturedText, input.liveText);
  const diverged = similarity < threshold;
  return { hashMatches: false, similarity, diverged, flaggedForReview: diverged };
}
