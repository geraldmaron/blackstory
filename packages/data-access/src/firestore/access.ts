/**
 * Server-side Firestore collection map and publish guards.
 * Mirrors @blap/firebase path names without requiring a runtime Firebase import
 * for static allowlists used by APIs and workers.
 */
import { assertServerOnly } from '../server-only.js';

export const FIRESTORE_COLLECTIONS = [
  'policy',
  'policyVersions',
  'researchCases',
  'canonicalEntities',
  'canonicalClaims',
  'claimEvidenceLinks',
  'entityRelationships',
  'entityMerges',
  'sourceOrganizations',
  'sourceDomains',
  'evidenceSources',
  'sourceItems',
  'sourceCaptures',
  'retrievalEvents',
  'evidenceRecords',
  'evidenceLineage',
  'publicationReleases',
  'publicMeta',
  'publicReleases',
  'publicSearchIndex',
  'submissionInbox',
  'auditEvents',
  'outboxMessages',
  'idempotencyKeys',
  'outboxConsumerReceipts',
  'killSwitches',
  /** Jurisdiction reference data: states + counties wholesale, cities on-demand.  */
  'jurisdictions',
] as const;

export type FirestoreCollectionId = (typeof FIRESTORE_COLLECTIONS)[number];

export const FIRESTORE_PATHS = {
  policy: 'policy',
  policyVersions: 'policyVersions',
  researchCases: 'researchCases',
  canonicalEntities: 'canonicalEntities',
  canonicalClaims: 'canonicalClaims',
  claimEvidenceLinks: 'claimEvidenceLinks',
  entityRelationships: 'entityRelationships',
  entityMerges: 'entityMerges',
  sourceOrganizations: 'sourceOrganizations',
  sourceDomains: 'sourceDomains',
  evidenceSources: 'evidenceSources',
  sourceItems: 'sourceItems',
  sourceCaptures: 'sourceCaptures',
  retrievalEvents: 'retrievalEvents',
  evidenceRecords: 'evidenceRecords',
  evidenceLineage: 'evidenceLineage',
  publicationReleases: 'publicationReleases',
  publicMeta: 'publicMeta',
  publicReleases: 'publicReleases',
  publicSearchIndex: 'publicSearchIndex',
  submissionInbox: 'submissionInbox',
  auditEvents: 'auditEvents',
  outboxMessages: 'outboxMessages',
  idempotencyKeys: 'idempotencyKeys',
  outboxConsumerReceipts: 'outboxConsumerReceipts',
  killSwitches: 'killSwitches',
  jurisdictions: 'jurisdictions',
} as const;

export type StaffClaims = {
  readonly admin?: boolean;
  readonly research?: boolean;
  readonly publication?: boolean;
  readonly security?: boolean;
  readonly bb_role?: string;
};

export function assertStaffMayPublish(claims: StaffClaims | null | undefined): void {
  assertServerOnly();
  const ok =
    claims?.admin === true ||
    claims?.publication === true ||
    claims?.bb_role === 'admin' ||
    claims?.bb_role === 'publication';
  if (!ok) {
    throw new Error('Publication requires admin or publication claims');
  }
  if (claims?.bb_role === 'research' && claims.admin !== true && claims.publication !== true) {
    throw new Error('Research role cannot publish');
  }
}

export function assertNotResearchPublish(claims: StaffClaims | null | undefined): void {
  assertServerOnly();
  if (claims?.bb_role === 'research' && claims.admin !== true && claims.publication !== true) {
    throw new Error('Research workers cannot publish');
  }
  if (claims?.research === true && claims.admin !== true && claims.publication !== true) {
    throw new Error('Research workers cannot publish');
  }
}
