/**
 * Content-hash helpers for capture deduplication.
 * Duplicate captures with the same algorithm+hash resolve to the first capture.
 */
import { createHash } from 'node:crypto';

export const CONTENT_HASH_ALGORITHMS = ['sha256'] as const;

export type ContentHashAlgorithm = (typeof CONTENT_HASH_ALGORITHMS)[number];

export type ContentHash = {
  readonly algorithm: ContentHashAlgorithm;
  /** Lowercase hex digest. */
  readonly digest: string;
};

export type HashDedupCandidate = {
  readonly id: string;
  readonly contentHash: ContentHash;
};

export type HashDedupResult =
  | { readonly kind: 'new'; readonly contentHash: ContentHash }
  | {
      readonly kind: 'duplicate';
      readonly contentHash: ContentHash;
      readonly existingCaptureId: string;
    };

const HEX_SHA256 = /^[a-f0-9]{64}$/;

export function normalizeContentHash(hash: ContentHash): ContentHash {
  const digest = hash.digest.trim().toLowerCase();
  if (hash.algorithm !== 'sha256') {
    throw new Error(`Unsupported hash algorithm: ${hash.algorithm}`);
  }
  if (!HEX_SHA256.test(digest)) {
    throw new Error('sha256 digest must be 64 lowercase hex characters');
  }
  return { algorithm: 'sha256', digest };
}

export function hashBytes(
  bytes: Uint8Array | Buffer,
  algorithm: ContentHashAlgorithm = 'sha256',
): ContentHash {
  if (algorithm !== 'sha256') {
    throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }
  const digest = createHash('sha256').update(bytes).digest('hex');
  return normalizeContentHash({ algorithm: 'sha256', digest });
}

export function hashUtf8(text: string, algorithm: ContentHashAlgorithm = 'sha256'): ContentHash {
  return hashBytes(Buffer.from(text, 'utf8'), algorithm);
}

export function contentHashesEqual(a: ContentHash, b: ContentHash): boolean {
  const left = normalizeContentHash(a);
  const right = normalizeContentHash(b);
  return left.algorithm === right.algorithm && left.digest === right.digest;
}

/**
 * Given existing captures and a proposed hash, return whether this is new or a duplicate.
 */
export function deduplicateCaptureByHash(
  existing: readonly HashDedupCandidate[],
  proposed: ContentHash,
): HashDedupResult {
  const contentHash = normalizeContentHash(proposed);
  for (const candidate of existing) {
    if (contentHashesEqual(candidate.contentHash, contentHash)) {
      return {
        kind: 'duplicate',
        contentHash,
        existingCaptureId: candidate.id,
      };
    }
  }
  return { kind: 'new', contentHash };
}
