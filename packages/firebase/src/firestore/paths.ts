/**
 * Firestore collection path constants for BlackStory (ADR-011 018).
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
  /** Private run records for scheduled discovery campaign jobs. */
  discoveryCampaignRuns: 'discoveryCampaignRuns',
  /** Jurisdiction reference data: states + counties wholesale, cities on-demand. */
  jurisdictions: 'jurisdictions',
  /** Published census statistics: one doc per county per decennial vintage (the related workstream). */
  censusCountyDecades: 'censusCountyDecades',
  /** ACS 5-year county estimates: one doc per county per vintage. */
  acsCountyProfiles: 'acsCountyProfiles',
  /** ACS 5-year tract estimates (~85k/vintage): county-bounded reads only, never full scans. */
  acsTractProfiles: 'acsTractProfiles',
  /** FBI UCR agency directory: ORI → county crosswalk, shared by every UCR dataset. */
  ucrAgencies: 'ucrAgencies',
  /** FBI hate crime incidents aggregated by county + year (joins on fips5). */
  hateCrimeCountyYears: 'hateCrimeCountyYears',
  /** UCR reporting participation by state + year — the coverage denominator. */
  ucrStateParticipation: 'ucrStateParticipation',
  /** Admin-recorded bulk decisions on published catalog entities (flag/needs-review/clear).
   * Never mutates the entity or a release directly — the release builder reads these and the
   * existing signed-manifest privileged-apply flow is what actually changes what's live. */
  catalogDecisions: 'catalogDecisions',
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
  /** Versions subcollection: append-only, one immutable doc per claim revision. */
  claimVersion: (claimId: string, versionId: string) =>
    `${FIRESTORE_ROOT.canonicalClaims}/${claimId}/versions/${versionId}`,
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
  discoveryCampaignRun: (runId: string) => `${FIRESTORE_ROOT.discoveryCampaignRuns}/${runId}`,
  /** Convention: source adapter kill switches use this id pattern. */
  sourceAdapterKillSwitch: (adapterId: string) =>
    `${FIRESTORE_ROOT.killSwitches}/source-adapter-${adapterId}`,
  /** Jurisdiction reference data: flat `{id}` docs, e.g. `us`, `us-06`, `us-06-001`. */
  jurisdiction: (jurisdictionId: string) => `${FIRESTORE_ROOT.jurisdictions}/${jurisdictionId}`,
  /** Census county-decade statistics: flat `{fips5}_{decade}` docs, e.g. `01001_2020`. */
  censusCountyDecade: (fips5: string, decade: string) =>
    `${FIRESTORE_ROOT.censusCountyDecades}/${fips5}_${decade}`,
  /** One doc per entity id — the latest bulk decision wins (set, not append). */
  catalogDecision: (entityId: string) => `${FIRESTORE_ROOT.catalogDecisions}/${entityId}`,
} as const;
