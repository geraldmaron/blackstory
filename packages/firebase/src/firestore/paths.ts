
/**
 * Firestore collection path constants for Black Book (ADR-011 018).
 * Paths always use even segment counts (collection/doc[/collection/doc...]).
 */
export const FIRESTORE_ROOT = {
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
  /** Jurisdiction reference data: states + counties wholesale, cities on-demand. */
  jurisdictions: 'jurisdictions',
} as const;

export type FirestoreRootCollection = (typeof FIRESTORE_ROOT)[keyof typeof FIRESTORE_ROOT];

/** Document path helpers (no leading slash; even segment counts). */
export const firestorePaths = {
  policyActive: () => `${FIRESTORE_ROOT.policy}/active`,
  policyVersion: (versionId: string) => `${FIRESTORE_ROOT.policyVersions}/${versionId}`,
  researchCase: (caseId: string) => `${FIRESTORE_ROOT.researchCases}/${caseId}`,
  canonicalEntity: (entityId: string) => `${FIRESTORE_ROOT.canonicalEntities}/${entityId}`,
  /** Locations subcollection: historical and current may coexist on one entity. */
  entityLocation: (entityId: string, locationId: string) =>
    `${FIRESTORE_ROOT.canonicalEntities}/${entityId}/locations/${locationId}`,
  canonicalClaim: (claimId: string) => `${FIRESTORE_ROOT.canonicalClaims}/${claimId}`,
  claimEvidenceLink: (linkId: string) => `${FIRESTORE_ROOT.claimEvidenceLinks}/${linkId}`,
  entityRelationship: (relationshipId: string) =>
    `${FIRESTORE_ROOT.entityRelationships}/${relationshipId}`,
  entityMerge: (mergeId: string) => `${FIRESTORE_ROOT.entityMerges}/${mergeId}`,
  sourceOrganization: (organizationId: string) =>
    `${FIRESTORE_ROOT.sourceOrganizations}/${organizationId}`,
  sourceDomain: (domainId: string) => `${FIRESTORE_ROOT.sourceDomains}/${domainId}`,
  evidenceSource: (sourceId: string) => `${FIRESTORE_ROOT.evidenceSources}/${sourceId}`,
  sourceItem: (itemId: string) => `${FIRESTORE_ROOT.sourceItems}/${itemId}`,
  sourceCapture: (captureId: string) => `${FIRESTORE_ROOT.sourceCaptures}/${captureId}`,
  retrievalEvent: (eventId: string) => `${FIRESTORE_ROOT.retrievalEvents}/${eventId}`,
  evidenceRecord: (evidenceId: string) => `${FIRESTORE_ROOT.evidenceRecords}/${evidenceId}`,
  evidenceLineage: (lineageId: string) => `${FIRESTORE_ROOT.evidenceLineage}/${lineageId}`,
  publicationRelease: (releaseId: string) => `${FIRESTORE_ROOT.publicationReleases}/${releaseId}`,
  publicActiveRelease: () => `${FIRESTORE_ROOT.publicMeta}/activeRelease`,
  publicEntity: (releaseId: string, entityId: string) =>
    `${FIRESTORE_ROOT.publicReleases}/${releaseId}/entities/${entityId}`,
  publicSearchIndex: (docId: string) => `${FIRESTORE_ROOT.publicSearchIndex}/${docId}`,
  submissionInbox: (submissionId: string) => `${FIRESTORE_ROOT.submissionInbox}/${submissionId}`,
  auditEvent: (eventId: string) => `${FIRESTORE_ROOT.auditEvents}/${eventId}`,
  outboxMessage: (messageId: string) => `${FIRESTORE_ROOT.outboxMessages}/${messageId}`,
  idempotencyKey: (keyId: string) => `${FIRESTORE_ROOT.idempotencyKeys}/${keyId}`,
  outboxConsumerReceipt: (receiptId: string) =>
    `${FIRESTORE_ROOT.outboxConsumerReceipts}/${receiptId}`,
  killSwitch: (switchId: string) => `${FIRESTORE_ROOT.killSwitches}/${switchId}`,
  /** Convention: source adapter kill switches use this id pattern. */
  sourceAdapterKillSwitch: (adapterId: string) =>
    `${FIRESTORE_ROOT.killSwitches}/source-adapter-${adapterId}`,
  /** Jurisdiction reference data: flat `{id}` docs, e.g. `us`, `us-06`, `us-06-001`. */
  jurisdiction: (jurisdictionId: string) => `${FIRESTORE_ROOT.jurisdictions}/${jurisdictionId}`,
} as const;
