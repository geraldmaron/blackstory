/**
 * BB-057 protected-field registry for public metadata and social previews.
 * Fields listed here must never appear in title, description, openGraph, or twitter tags.
 */

/** Keys stripped recursively from metadata source objects before preview serialization. */
export const PROTECTED_METADATA_KEYS: readonly string[] = Object.freeze([
  'confidenceScore',
  'confidenceLevel',
  'mapPin',
  'basisClaimIds',
  'disputeNote',
  'sensitivity',
  'sensitivityClass',
  'internalNote',
  'moderationFlags',
  'spamScore',
  'receiptCode',
  'campaignId',
  'researchCaseId',
  'rawAddress',
  'streetAddress',
  'residentialAddress',
  'coordinates',
  'latitude',
  'longitude',
  'email',
  'phone',
  'ipAddress',
  'notabilityScore',
  'relevanceScore',
]);

/** Regex patterns that invalidate a preview string if matched. */
export const PROTECTED_METADATA_PATTERNS: readonly RegExp[] = Object.freeze([
  /\b\d{1,5}\s+\w+\s+(st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive)\b/i,
  /\b\d{5}(-\d{4})?\b.*\b(st|street|ave|avenue)\b/i,
  /confidence\s*[:=]\s*0\.\d+/i,
  /basisClaimIds/i,
  /moderation/i,
  /@\w+\.\w+/,
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
]);

export type MetadataPreviewInput = {
  readonly title?: string;
  readonly description?: string;
  readonly canonicalPath?: string;
  readonly imageUrl?: string;
  readonly noIndex?: boolean;
};

export type PublicMetadataPreview = {
  readonly title: string;
  readonly description: string;
  readonly canonicalPath?: string;
  readonly openGraph?: {
    readonly title: string;
    readonly description: string;
    readonly url?: string;
    readonly images?: readonly { readonly url: string }[];
  };
  readonly robots?: { readonly index: boolean; readonly follow: boolean };
};

function containsProtectedPattern(value: string): boolean {
  return PROTECTED_METADATA_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Removes protected keys from arbitrary source records before metadata extraction.
 */
export function stripProtectedFields<T extends Record<string, unknown>>(source: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (PROTECTED_METADATA_KEYS.includes(key)) continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = stripProtectedFields(value as Record<string, unknown>);
      continue;
    }
    if (typeof value === 'string' && containsProtectedPattern(value)) continue;
    result[key] = value;
  }
  return result as Partial<T>;
}

/**
 * Sanitizes a single preview string — returns empty when protected content is detected.
 */
export function sanitizePreviewText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || containsProtectedPattern(trimmed)) return fallback;
  return trimmed;
}
