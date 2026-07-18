/**
 * Core legal landscape vocabulary: license tags, archive evidence, citation fields, and topic
 * tags for the curated snapshot corpus. Reuses `LawStatus` and
 * `FactRecord` (`claimType: 'law'`) — this module never defines a parallel law store.
 */
import type { LawStatus } from '../entity-status.js';

/** Per-source licensing discipline recorded on every stored legal object. */
export const LEGAL_LICENSE_TAGS = ['public-domain', 'cc-by-nc', 'link-only'] as const;
export type LegalLicenseTag = (typeof LEGAL_LICENSE_TAGS)[number];

export function isLegalLicenseTag(value: string): value is LegalLicenseTag {
  return (LEGAL_LICENSE_TAGS as readonly string[]).includes(value);
}

/** Curated snapshot kinds the monitoring adapters and seed catalog recognize. */
export const LEGAL_SNAPSHOT_KINDS = [
  'federal-statute',
  'federal-regulation',
  'landmark-case',
  'state-statute',
] as const;
export type LegalSnapshotKind = (typeof LEGAL_SNAPSHOT_KINDS)[number];

export function isLegalSnapshotKind(value: string): value is LegalSnapshotKind {
  return (LEGAL_SNAPSHOT_KINDS as readonly string[]).includes(value);
}

/** Topical tags for browse filters and review-queue routing. */
export const LEGAL_TOPICS = [
  'voting',
  'housing',
  'employment',
  'education',
  'policing',
  'constitutional',
  'criminal-justice',
] as const;
export type LegalTopic = (typeof LEGAL_TOPICS)[number];

export function isLegalTopic(value: string): value is LegalTopic {
  return (LEGAL_TOPICS as readonly string[]).includes(value);
}

/** Archive + retrieval evidence every legal object must carry before publish. */
export type LegalArchiveEvidence = {
  readonly sourceUrl: string;
  readonly officialUrl?: string;
  readonly archivedCaptureUrl: string;
  readonly retrievedAt: string;
  readonly changeHash?: string;
};

/** Canonical citation + provenance block shared by snapshots and review events. */
export type LegalCitationFields = {
  readonly canonicalCitation: string;
  readonly licenseTag: LegalLicenseTag;
  readonly archive: LegalArchiveEvidence;
};

/** External source identity for dedupe and monitoring (Congress.gov bill id, CourtListener id, etc.). */
export type LegalExternalId = {
  readonly source: string;
  readonly externalId: string;
};

/** A curated legal snapshot document the corpus atom before plain-language layering. */
export type LegalSnapshot = {
  readonly id: string;
  readonly slug: string;
  readonly kind: LegalSnapshotKind;
  readonly title: string;
  readonly jurisdictionId: string;
  readonly lawStatus: LawStatus;
  readonly topics: readonly LegalTopic[];
  readonly citation: LegalCitationFields;
  readonly externalIds: readonly LegalExternalId[];
  /** Optional link to a `FactRecord` permalink when the snapshot is also a published fact. */
  readonly factId?: string;
};

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertLegalArchiveEvidenceValid(evidence: LegalArchiveEvidence): void {
  if (!isNonEmpty(evidence.sourceUrl)) {
    throw new Error('LegalArchiveEvidence.sourceUrl must be non-empty');
  }
  if (!isNonEmpty(evidence.archivedCaptureUrl)) {
    throw new Error('LegalArchiveEvidence.archivedCaptureUrl must be non-empty');
  }
  if (!isNonEmpty(evidence.retrievedAt)) {
    throw new Error('LegalArchiveEvidence.retrievedAt must be non-empty');
  }
}

export function assertLegalSnapshotValid(snapshot: LegalSnapshot): void {
  if (!isNonEmpty(snapshot.id)) {
    throw new Error('LegalSnapshot.id must be non-empty');
  }
  if (!isNonEmpty(snapshot.slug)) {
    throw new Error('LegalSnapshot.slug must be non-empty');
  }
  if (!isLegalSnapshotKind(snapshot.kind)) {
    throw new Error(`Unknown LegalSnapshot.kind "${snapshot.kind}"`);
  }
  if (!isNonEmpty(snapshot.title)) {
    throw new Error('LegalSnapshot.title must be non-empty');
  }
  if (!isNonEmpty(snapshot.jurisdictionId)) {
    throw new Error('LegalSnapshot.jurisdictionId must be non-empty');
  }
  if (!isNonEmpty(snapshot.citation.canonicalCitation)) {
    throw new Error('LegalSnapshot.citation.canonicalCitation must be non-empty');
  }
  if (!isLegalLicenseTag(snapshot.citation.licenseTag)) {
    throw new Error(`Unknown LegalSnapshot license tag "${snapshot.citation.licenseTag}"`);
  }
  assertLegalArchiveEvidenceValid(snapshot.citation.archive);
  if (snapshot.externalIds.length === 0) {
    throw new Error('LegalSnapshot.externalIds must contain at least one external id');
  }
  for (const topic of snapshot.topics) {
    if (!isLegalTopic(topic)) {
      throw new Error(`Unknown LegalSnapshot topic "${topic}"`);
    }
  }
}
