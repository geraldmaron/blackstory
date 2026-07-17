/**
 * Firestore collection path constants for Black Book (ADR-011 / BB-013–014).
 * Paths always use even segment counts (collection/doc[/collection/doc...]).
 */
export const FIRESTORE_ROOT = {
  policy: 'policy',
  policyVersions: 'policyVersions',
  researchCases: 'researchCases',
  canonicalEntities: 'canonicalEntities',
  canonicalClaims: 'canonicalClaims',
  entityRelationships: 'entityRelationships',
  entityMerges: 'entityMerges',
  evidenceRecords: 'evidenceRecords',
  evidenceSources: 'evidenceSources',
  publicationReleases: 'publicationReleases',
  publicMeta: 'publicMeta',
  publicReleases: 'publicReleases',
  publicSearchIndex: 'publicSearchIndex',
  submissionInbox: 'submissionInbox',
  auditEvents: 'auditEvents',
  killSwitches: 'killSwitches',
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
  entityRelationship: (relationshipId: string) =>
    `${FIRESTORE_ROOT.entityRelationships}/${relationshipId}`,
  entityMerge: (mergeId: string) => `${FIRESTORE_ROOT.entityMerges}/${mergeId}`,
  evidenceRecord: (evidenceId: string) => `${FIRESTORE_ROOT.evidenceRecords}/${evidenceId}`,
  evidenceSource: (sourceId: string) => `${FIRESTORE_ROOT.evidenceSources}/${sourceId}`,
  publicationRelease: (releaseId: string) => `${FIRESTORE_ROOT.publicationReleases}/${releaseId}`,
  publicActiveRelease: () => `${FIRESTORE_ROOT.publicMeta}/activeRelease`,
  publicEntity: (releaseId: string, entityId: string) =>
    `${FIRESTORE_ROOT.publicReleases}/${releaseId}/entities/${entityId}`,
  publicSearchIndex: (docId: string) => `${FIRESTORE_ROOT.publicSearchIndex}/${docId}`,
  submissionInbox: (submissionId: string) => `${FIRESTORE_ROOT.submissionInbox}/${submissionId}`,
  auditEvent: (eventId: string) => `${FIRESTORE_ROOT.auditEvents}/${eventId}`,
  killSwitch: (switchId: string) => `${FIRESTORE_ROOT.killSwitches}/${switchId}`,
} as const;
