/**
 * Branded identifiers for sources, captures, evidence, and related provenance records.
 */

export type SourceOrganizationId = string & { readonly __brand: 'SourceOrganizationId' };
export type SourceDomainId = string & { readonly __brand: 'SourceDomainId' };
export type SourceId = string & { readonly __brand: 'SourceId' };
export type SourceItemId = string & { readonly __brand: 'SourceItemId' };
export type SourceCaptureId = string & { readonly __brand: 'SourceCaptureId' };
export type RetrievalEventId = string & { readonly __brand: 'RetrievalEventId' };
export type EvidenceId = string & { readonly __brand: 'EvidenceId' };
export type EvidenceLineageId = string & { readonly __brand: 'EvidenceLineageId' };

function brandNonEmpty<T extends string>(value: string, label: string): T {
  if (!value.trim()) {
    throw new Error(`${label} must be non-empty`);
  }
  return value as T;
}

export function asSourceOrganizationId(value: string): SourceOrganizationId {
  return brandNonEmpty(value, 'SourceOrganizationId');
}

export function asSourceDomainId(value: string): SourceDomainId {
  return brandNonEmpty(value, 'SourceDomainId');
}

export function asSourceId(value: string): SourceId {
  return brandNonEmpty(value, 'SourceId');
}

export function asSourceItemId(value: string): SourceItemId {
  return brandNonEmpty(value, 'SourceItemId');
}

export function asSourceCaptureId(value: string): SourceCaptureId {
  return brandNonEmpty(value, 'SourceCaptureId');
}

export function asRetrievalEventId(value: string): RetrievalEventId {
  return brandNonEmpty(value, 'RetrievalEventId');
}

export function asEvidenceId(value: string): EvidenceId {
  return brandNonEmpty(value, 'EvidenceId');
}

export function asEvidenceLineageId(value: string): EvidenceLineageId {
  return brandNonEmpty(value, 'EvidenceLineageId');
}
