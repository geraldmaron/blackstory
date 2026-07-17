/**
 * Shared domain fixture shapes used by test data builders.
 * Aligned with @black-book/domain entity kinds (BB-014); builders remain test-only.
 */

export type EntityKind =
  | 'person'
  | 'place'
  | 'school'
  | 'organization'
  | 'institution'
  | 'event'
  | 'law'
  | 'case'
  | 'publication'
  | 'artifact'
  | 'other';

export type LivingStatus = 'living' | 'deceased' | 'unknown';

export type ClaimStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';

export type SubmissionKind = 'correction' | 'contribution';

export type SubmissionStatus = 'quarantined' | 'accepted' | 'rejected' | 'withdrawn';

export type ReleaseStatus = 'draft' | 'released' | 'retracted';

export interface EntityFixture {
  id: string;
  kind: EntityKind;
  name: string;
  livingStatus?: LivingStatus;
  createdAt: string;
}

export interface SourceFixture {
  id: string;
  title: string;
  url: string;
  authority: 'primary' | 'secondary' | 'tertiary';
  rights: 'public-domain' | 'fair-use' | 'licensed' | 'unknown';
  capturedAt: string;
}

export interface ClaimFixture {
  id: string;
  entityId: string;
  predicate: string;
  object: string;
  status: ClaimStatus;
  confidence: number;
  createdAt: string;
}

export interface EvidenceFixture {
  id: string;
  claimId: string;
  sourceId: string;
  excerpt: string;
  confidence: number;
  capturedAt: string;
}

export interface PublicationReleaseFixture {
  id: string;
  version: string;
  status: ReleaseStatus;
  snapshotId: string;
  releasedAt: string | null;
  notes: string;
}

export interface SubmissionFixture {
  id: string;
  kind: SubmissionKind;
  status: SubmissionStatus;
  entityId: string | null;
  summary: string;
  payload: Readonly<Record<string, unknown>>;
  submittedAt: string;
}
