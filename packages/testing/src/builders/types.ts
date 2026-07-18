
/**
 * Shared domain fixture shapes used by test data builders.
 * Aligned with @repo/domain entity kinds; builders remain test-only.
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
  /** Optional fields for provenance-aware tests. */
  organizationId?: string;
  classification?: string;
  adapterId?: string;
  adapterEnabled?: boolean;
  stableIdentifier?: string;
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
  /** Every evidence record resolves to a source item. */
  sourceItemId?: string;
  excerpt: string;
  excerptKind?: 'none' | 'short' | 'substantial';
  rightsStatus?:
    | 'unknown'
    | 'public_domain'
    | 'licensed'
    | 'fair_use'
    | 'restricted'
    | 'prohibited';
  confidence: number;
  capturedAt: string;
  page?: string;
  observedAt?: string;
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
