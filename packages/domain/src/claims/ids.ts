/**
 * Branded identifiers for claims, versions, and claim–evidence links (BB-017).
 */

export type ClaimId = string & { readonly __brand: 'ClaimId' };
export type ClaimVersionId = string & { readonly __brand: 'ClaimVersionId' };
export type ClaimEvidenceLinkId = string & { readonly __brand: 'ClaimEvidenceLinkId' };

function brandNonEmpty<T extends string>(value: string, label: string): T {
  if (!value.trim()) {
    throw new Error(`${label} must be non-empty`);
  }
  return value as T;
}

export function asClaimId(value: string): ClaimId {
  return brandNonEmpty(value, 'ClaimId');
}

export function asClaimVersionId(value: string): ClaimVersionId {
  return brandNonEmpty(value, 'ClaimVersionId');
}

export function asClaimEvidenceLinkId(value: string): ClaimEvidenceLinkId {
  return brandNonEmpty(value, 'ClaimEvidenceLinkId');
}
