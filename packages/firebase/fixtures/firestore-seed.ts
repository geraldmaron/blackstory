/**
 * Emulator / local seed fixtures for Firestore (demo-black-book only).
 * BB-014: schools/people/places with historical vs current locations and merge lineage.
 * BB-016: source organizations, items, captures, evidence rights, lineage, kill switches.
 * BB-017: atomic claims, evidence links, confidence scores, preserved contradictions.
 * Never load these into production `black-book-efaaf` without explicit promotion workflows.
 */
import {
  buildGeoPointFields,
  calculateClaimConfidence,
  hashUtf8,
  measureConnectionStrength,
  measureRelevance,
  preserveContradictoryValues,
} from '@black-book/domain';
import type {
  CanonicalClaimDoc,
  CanonicalEntityDoc,
  ClaimEvidenceLinkDoc,
  EntityLocationDoc,
  EntityMergeDoc,
  EntityRelationshipDoc,
  EvidenceLineageDoc,
  EvidenceRecordDoc,
  EvidenceSourceDoc,
  PolicyActiveDoc,
  PublicActiveReleaseDoc,
  PublicEntityProjectionDoc,
  RetrievalEventDoc,
  SourceCaptureDoc,
  SourceDomainDoc,
  SourceItemDoc,
  SourceOrganizationDoc,
  SubmissionInboxDoc,
} from '../src/firestore/types.js';

export type SeedDocument = {
  readonly path: string;
  readonly data: Record<string, unknown>;
};

const FIXED_NOW = '2026-07-16T18:00:00.000Z';

const placeCurrentPoint = {
  ...buildGeoPointFields(38.9072, -77.0369, 5),
  precision: 'city' as const,
  matchMethod: 'manual_research' as const,
};

const schoolHistoricalPoint = {
  ...buildGeoPointFields(38.9, -77.0, 5),
  precision: 'campus' as const,
  matchMethod: 'manual_research' as const,
};

const schoolCurrentPoint = {
  ...buildGeoPointFields(38.91, -77.02, 5),
  precision: 'campus' as const,
  matchMethod: 'geocode_other' as const,
};

export const seedPolicyActive: PolicyActiveDoc = {
  policyVersion: 'policy.v1',
  activatedAt: FIXED_NOW,
};

export const seedActiveRelease: PublicActiveReleaseDoc = {
  releaseId: 'rel_seed_001',
  activatedAt: FIXED_NOW,
  searchIndexVersion: 'search_seed_001',
  manifestHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

export const seedPublicEntity: PublicEntityProjectionDoc = {
  id: 'ent_seed_place_001',
  releaseId: 'rel_seed_001',
  kind: 'place',
  displayName: 'Seed Historical Place',
  nameLower: 'seed historical place',
  summary: 'Fixture projection for emulator reads.',
  location: placeCurrentPoint,
  claimIds: ['claim_seed_001'],
};

export const seedSubmission: SubmissionInboxDoc = {
  status: 'quarantined',
  createdBy: 'user_seed_submitter',
  createdAt: FIXED_NOW,
  kind: 'correction',
  payload: { note: 'Fixture quarantine submission' },
};

export const seedPlaceEntity: CanonicalEntityDoc = {
  id: 'ent_seed_place_001',
  kind: 'place',
  displayName: 'Seed Historical Place',
  aliases: [{ value: 'Old Place Name', kind: 'former_name', validFrom: '1900', validTo: '1940' }],
  identifiers: [{ system: 'seed', value: 'place-001' }],
  livingStatus: 'unknown',
  place: {
    historicalNames: ['Old Place Name'],
    jurisdictionIds: ['jur_dc'],
    primaryLocationId: 'loc_place_current',
  },
  mergeState: { status: 'active', mergeIds: [] },
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedPlaceHistoricalLocation: EntityLocationDoc = {
  id: 'loc_place_historical',
  entityId: 'ent_seed_place_001',
  role: 'historical',
  geometry: {
    type: 'BBox',
    bbox: [-77.05, 38.88, -77.0, 38.92],
  },
  precision: 'neighborhood',
  match: {
    method: 'manual_research',
    precision: 'neighborhood',
    recordedAt: FIXED_NOW,
    notes: 'Approximate 1920s neighborhood extent; not a ZIP boundary',
  },
  validFrom: '1920',
  validTo: '1950',
  jurisdictionIds: ['jur_dc'],
  label: 'Historical neighborhood extent',
  evidenceIds: ['ev_seed_place_hist'],
};

export const seedPlaceCurrentLocation: EntityLocationDoc = {
  id: 'loc_place_current',
  entityId: 'ent_seed_place_001',
  role: 'current',
  geometry: {
    type: 'Point',
    coordinates: [placeCurrentPoint.lng, placeCurrentPoint.lat],
  },
  point: placeCurrentPoint,
  precision: 'city',
  match: {
    method: 'manual_research',
    precision: 'city',
    recordedAt: FIXED_NOW,
  },
  validFrom: '1950',
  validTo: null,
  modernZip: { zip: '20001', role: 'modern_input', countryCode: 'US' },
  label: 'Current map pin (ZIP is modern input only)',
  evidenceIds: ['ev_seed_place_cur'],
};

export const seedSchoolEntity: CanonicalEntityDoc = {
  id: 'ent_seed_school_001',
  kind: 'school',
  displayName: 'Seed Freedmen School',
  aliases: [
    { value: 'Colored School No. 1', kind: 'former_name', validFrom: '1868', validTo: '1910' },
  ],
  livingStatus: 'unknown',
  school: {
    names: [
      { name: 'Colored School No. 1', validFrom: '1868', validTo: '1910', primary: false },
      { name: 'Seed Freedmen School', validFrom: '1910', validTo: null, primary: true },
    ],
    campuses: [
      {
        id: 'campus_hist',
        name: 'Original campus',
        locationId: 'loc_school_historical',
        status: 'closed',
        validFrom: '1868',
        validTo: '1954',
      },
      {
        id: 'campus_cur',
        name: 'Current campus',
        locationId: 'loc_school_current',
        status: 'active',
        validFrom: '1954',
        validTo: null,
      },
    ],
    // BB-090: renamed from `statusHistory` to `milestones` to resolve a naming collision with
    // the new entity-level CanonicalEntityDoc.statusHistory (see packages/domain/src/school.ts).
    milestones: [
      { status: 'opened', at: '1868', evidenceIds: ['ev_seed_school_open'] },
      { status: 'relocated', at: '1954', evidenceIds: ['ev_seed_school_move'] },
    ],
  },
  mergeState: { status: 'active', mergeIds: [] },
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedSchoolHistoricalLocation: EntityLocationDoc = {
  id: 'loc_school_historical',
  entityId: 'ent_seed_school_001',
  role: 'historical',
  geometry: {
    type: 'Point',
    coordinates: [schoolHistoricalPoint.lng, schoolHistoricalPoint.lat],
  },
  point: schoolHistoricalPoint,
  precision: 'campus',
  match: {
    method: 'manual_research',
    precision: 'campus',
    recordedAt: FIXED_NOW,
  },
  validFrom: '1868',
  validTo: '1954',
  label: 'Original campus (historical)',
  evidenceIds: ['ev_seed_school_open'],
};

export const seedSchoolCurrentLocation: EntityLocationDoc = {
  id: 'loc_school_current',
  entityId: 'ent_seed_school_001',
  role: 'current',
  geometry: {
    type: 'Point',
    coordinates: [schoolCurrentPoint.lng, schoolCurrentPoint.lat],
  },
  point: schoolCurrentPoint,
  precision: 'campus',
  match: {
    method: 'geocode_other',
    precision: 'campus',
    recordedAt: FIXED_NOW,
  },
  validFrom: '1954',
  validTo: null,
  modernZip: { zip: '20002', role: 'modern_lookup' },
  label: 'Current campus',
  evidenceIds: ['ev_seed_school_move'],
};

export const seedPersonEntity: CanonicalEntityDoc = {
  id: 'ent_seed_person_001',
  kind: 'person',
  displayName: 'Seed Historical Person',
  livingStatus: 'unknown',
  person: {
    livingStatus: 'unknown',
    birthYear: 1890,
    deathYear: null,
    biographySummary: 'Unknown living status must be treated as living at model level.',
  },
  mergeState: { status: 'active', mergeIds: ['merge_seed_001'] },
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedAbsorbedPersonEntity: CanonicalEntityDoc = {
  id: 'ent_seed_person_dup',
  kind: 'person',
  displayName: 'Seed Historical Person (duplicate spelling)',
  livingStatus: 'unknown',
  person: { livingStatus: 'unknown', birthYear: 1890 },
  mergeState: {
    status: 'merged_away',
    survivorId: 'ent_seed_person_001',
    mergeIds: ['merge_seed_001'],
  },
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedPersonSchoolRelationship: EntityRelationshipDoc = {
  id: 'rel_seed_attended_001',
  fromEntityId: 'ent_seed_person_001',
  toEntityId: 'ent_seed_school_001',
  type: 'attended',
  evidenceIds: ['ev_seed_rel_attended'],
  temporal: { validFrom: '1905', validTo: '1910', label: 'student years' },
  geographic: { locationId: 'loc_school_historical' },
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedEntityMerge: EntityMergeDoc = {
  id: 'merge_seed_001',
  survivorId: 'ent_seed_person_001',
  absorbedIds: ['ent_seed_person_dup'],
  status: 'active',
  reason: 'Duplicate spelling of the same person',
  evidenceIds: ['ev_seed_merge'],
  createdAt: FIXED_NOW,
  createdBy: 'researcher_seed',
  auditEventIds: ['audit_seed_merge_001'],
};

export const seedPublicSchoolEntity: PublicEntityProjectionDoc = {
  id: 'ent_seed_school_001',
  releaseId: 'rel_seed_001',
  kind: 'school',
  displayName: 'Seed Freedmen School',
  nameLower: 'seed freedmen school',
  summary: 'School with historical and current campus locations.',
  location: schoolCurrentPoint,
  claimIds: [],
};

const seedCaptureHash = hashUtf8('seed-nara-catalog-item-body-v1');

export const seedSourceOrganization: SourceOrganizationDoc = {
  id: 'org_seed_nara',
  name: 'National Archives and Records Administration',
  homepageUrl: 'https://www.archives.gov/',
  notes: 'Federal archival source organization fixture',
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedSourceDomain: SourceDomainDoc = {
  id: 'dom_seed_archives_gov',
  organizationId: 'org_seed_nara',
  hostname: 'catalog.archives.gov',
  verified: true,
  createdAt: FIXED_NOW,
};

export const seedEvidenceSource: EvidenceSourceDoc = {
  id: 'src_seed_nara_catalog',
  organizationId: 'org_seed_nara',
  domainIds: ['dom_seed_archives_gov'],
  displayName: 'NARA Catalog (seed)',
  classification: 'primary_archival',
  adapterId: 'nara-catalog-v1',
  stableIdScheme: 'nara-naid',
  policy: {
    snapshotMode: 'selective',
    rights: {
      defaultStatus: 'public_domain',
      publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt', 'display_media'],
      prohibitedUses: ['biometric_extraction'],
    },
    permittedClaimClasses: ['existence', 'location', 'identity'],
    refreshSchedule: 'weekly',
    notes: 'Selective snapshots only; never automatic full crawl',
  },
  adapterEnabled: true,
  killSwitchId: 'source-adapter-nara-catalog-v1',
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedDisabledEvidenceSource: EvidenceSourceDoc = {
  id: 'src_seed_disabled_wire',
  organizationId: 'org_seed_nara',
  displayName: 'Disabled wire adapter (seed)',
  classification: 'news_reportage',
  adapterId: 'wire-feed-v0',
  stableIdScheme: 'url',
  policy: {
    snapshotMode: 'none',
    rights: {
      defaultStatus: 'restricted',
      publicationPermissions: ['cite'],
      prohibitedUses: ['full_text_republication', 'commercial_reuse'],
    },
  },
  adapterEnabled: false,
  killSwitchId: 'source-adapter-wire-feed-v0',
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedSourceItem: SourceItemDoc = {
  id: 'sitm_seed_nara_001',
  sourceId: 'src_seed_nara_catalog',
  stableIdentifier: 'NAID-SEED-001',
  canonicalUrl: 'https://catalog.archives.gov/id/SEED-001',
  title: 'Seed archival item',
  classification: 'primary_archival',
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedRetrievalEvent: RetrievalEventDoc = {
  id: 'retr_seed_001',
  sourceId: 'src_seed_nara_catalog',
  sourceItemId: 'sitm_seed_nara_001',
  adapterId: 'nara-catalog-v1',
  startedAt: FIXED_NOW,
  completedAt: FIXED_NOW,
  status: 'success',
  httpStatus: 200,
  parserVersion: 'nara-parser-1.0.0',
};

export const seedSourceCapture: SourceCaptureDoc = {
  id: 'cap_seed_001',
  sourceItemId: 'sitm_seed_nara_001',
  sourceId: 'src_seed_nara_catalog',
  contentHash: seedCaptureHash,
  parserVersion: 'nara-parser-1.0.0',
  retrievedAt: FIXED_NOW,
  retrievalEventId: 'retr_seed_001',
  snapshotMode: 'selective',
  snapshotStorageObject: 'gs://demo-black-book-evidence/captures/cap_seed_001.pdf',
  createdAt: FIXED_NOW,
};

export const seedEvidenceRecord: EvidenceRecordDoc = {
  id: 'ev_seed_place_hist',
  sourceItemId: 'sitm_seed_nara_001',
  sourceId: 'src_seed_nara_catalog',
  captureId: 'cap_seed_001',
  storageObject: 'gs://demo-black-book-evidence/captures/cap_seed_001.pdf',
  locator: { page: '12', pages: '12-13', label: 'campus description' },
  excerpt: 'The school stood near the river landing.',
  excerptKind: 'short',
  observedAt: '1868',
  rightsStatus: 'public_domain',
  publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt', 'display_media'],
  prohibitedUses: ['biometric_extraction'],
  lineageRootId: 'ev_seed_place_hist',
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedSyndicatedEvidenceRecord: EvidenceRecordDoc = {
  id: 'ev_seed_wire_copy',
  sourceItemId: 'sitm_seed_nara_001',
  sourceId: 'src_seed_nara_catalog',
  captureId: 'cap_seed_001',
  locator: { page: '12' },
  excerpt: 'The school stood near the river landing.',
  excerptKind: 'short',
  observedAt: '1868',
  rightsStatus: 'public_domain',
  publicationPermissions: ['cite', 'short_excerpt'],
  prohibitedUses: ['full_text_republication'],
  lineageRootId: 'ev_seed_place_hist',
  syndicatedFromEvidenceId: 'ev_seed_place_hist',
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedEvidenceLineage: EvidenceLineageDoc = {
  id: 'elin_seed_001',
  kind: 'syndication',
  fromEvidenceId: 'ev_seed_place_hist',
  toEvidenceId: 'ev_seed_wire_copy',
  lineageRootId: 'ev_seed_place_hist',
  notes: 'Wire copy of archival excerpt; counts as one lineage for confidence',
  createdAt: FIXED_NOW,
};

export const seedClaimEvidenceSupporting: ClaimEvidenceLinkDoc = {
  id: 'cel_seed_support_001',
  claimId: 'claim_seed_001',
  claimVersionId: 'cver_seed_001',
  evidenceId: 'ev_seed_place_hist',
  role: 'supporting',
  lineageRootId: 'ev_seed_place_hist',
  credible: true,
  sourceClassification: 'primary_archival',
  directness: 0.92,
  temporalProximity: 0.88,
  geographicPrecision: 0.85,
  entityMatchQuality: 0.9,
  extractionQuality: 0.9,
  assertedValue: '1867',
  createdAt: FIXED_NOW,
};

export const seedClaimEvidenceSyndicated: ClaimEvidenceLinkDoc = {
  id: 'cel_seed_syndicated_001',
  claimId: 'claim_seed_001',
  claimVersionId: 'cver_seed_001',
  evidenceId: 'ev_seed_wire_copy',
  role: 'supporting',
  lineageRootId: 'ev_seed_place_hist',
  credible: true,
  sourceClassification: 'news_reportage',
  directness: 0.4,
  temporalProximity: 0.5,
  geographicPrecision: 0.5,
  entityMatchQuality: 0.7,
  extractionQuality: 0.6,
  assertedValue: '1867',
  notes: 'Syndicated wire copy — same lineageRootId as archival root',
  createdAt: FIXED_NOW,
};

export const seedClaimEvidenceContradicting: ClaimEvidenceLinkDoc = {
  id: 'cel_seed_contradict_001',
  claimId: 'claim_seed_001',
  claimVersionId: 'cver_seed_001',
  evidenceId: 'ev_seed_place_hist',
  role: 'contradicting',
  lineageRootId: 'ev_seed_alt_year',
  credible: true,
  sourceClassification: 'government_record',
  directness: 0.8,
  temporalProximity: 0.75,
  geographicPrecision: 0.8,
  entityMatchQuality: 0.85,
  extractionQuality: 0.8,
  assertedValue: '1868',
  notes: 'Credible alternate founding year preserved',
  createdAt: FIXED_NOW,
};

const seedClaimLinks = [
  seedClaimEvidenceSupporting,
  seedClaimEvidenceSyndicated,
  seedClaimEvidenceContradicting,
] as const;

const seedClaimConfidenceResult = calculateClaimConfidence({
  claimClass: 'standard',
  evidenceLinks: seedClaimLinks,
  calculatedAt: FIXED_NOW,
});

const seedClaimConfidence = {
  score: seedClaimConfidenceResult.score,
  components: seedClaimConfidenceResult.components,
  policyVersion: seedClaimConfidenceResult.policyVersion,
  independentLineageCount: seedClaimConfidenceResult.independentLineageCount,
  supportingEvidenceCount: seedClaimConfidenceResult.supportingEvidenceCount,
  contradictingEvidenceCount: seedClaimConfidenceResult.contradictingEvidenceCount,
  contributingEvidenceIds: seedClaimConfidenceResult.contributingEvidenceIds,
  calculatedAt: seedClaimConfidenceResult.calculatedAt,
};

const seedPreservedValues = preserveContradictoryValues({
  claimId: 'claim_seed_001',
  primaryValue: '1867',
  evidenceLinks: seedClaimLinks,
}).values;

export const seedCanonicalClaim: CanonicalClaimDoc = {
  id: 'claim_seed_001',
  entityId: 'ent_seed_place_001',
  predicate: 'founded_year',
  currentVersionId: 'cver_seed_001',
  versions: [
    {
      id: 'cver_seed_001',
      claimId: 'claim_seed_001',
      versionNumber: 1,
      entityId: 'ent_seed_place_001',
      predicate: 'founded_year',
      object: '1867',
      temporal: { label: 'founding', validFrom: '1867-01-01' },
      geographic: {
        locationId: 'loc_place_historical',
        precision: 'institution',
      },
      proceduralStatus: 'ruled',
      claimClass: 'standard',
      workflowStatus: 'accepted',
      publicationStatus: 'published',
      createdAt: FIXED_NOW,
      createdBy: 'researcher_seed',
    },
  ],
  claimClass: 'standard',
  workflowStatus: 'accepted',
  publicationStatus: 'published',
  proceduralStatus: 'ruled',
  temporal: { label: 'founding', validFrom: '1867-01-01' },
  geographic: {
    locationId: 'loc_place_historical',
    precision: 'institution',
  },
  confidence: seedClaimConfidence,
  relevance: measureRelevance(0.82, 'include'),
  connectionStrength: measureConnectionStrength(
    0.8,
    'Founding year ties the place to Black educational history',
  ),
  researchCoverage: {
    level: 'partial',
    score: 0.55,
    lastCheckedAt: FIXED_NOW,
  },
  preservedValues: [...seedPreservedValues],
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedHighImpactClaim: CanonicalClaimDoc = {
  id: 'claim_seed_high_impact',
  entityId: 'ent_seed_person_001',
  predicate: 'conviction_status',
  currentVersionId: 'cver_seed_hi_001',
  versions: [
    {
      id: 'cver_seed_hi_001',
      claimId: 'claim_seed_high_impact',
      versionNumber: 1,
      entityId: 'ent_seed_person_001',
      predicate: 'conviction_status',
      object: 'alleged',
      proceduralStatus: 'alleged',
      claimClass: 'high_impact',
      workflowStatus: 'accepted',
      publicationStatus: 'unpublished',
      createdAt: FIXED_NOW,
    },
  ],
  claimClass: 'high_impact',
  workflowStatus: 'accepted',
  publicationStatus: 'unpublished',
  proceduralStatus: 'alleged',
  confidence: (() => {
    const result = calculateClaimConfidence({
      claimClass: 'high_impact',
      evidenceLinks: [
        {
          id: 'cel_seed_hi_001',
          claimId: 'claim_seed_high_impact',
          claimVersionId: 'cver_seed_hi_001',
          evidenceId: 'ev_seed_place_hist',
          role: 'supporting',
          lineageRootId: 'ev_seed_place_hist',
          credible: true,
          sourceClassification: 'news_reportage',
          directness: 0.55,
          temporalProximity: 0.5,
          geographicPrecision: 0.5,
          entityMatchQuality: 0.6,
          extractionQuality: 0.55,
          createdAt: FIXED_NOW,
        },
      ],
      calculatedAt: FIXED_NOW,
    });
    return {
      score: result.score,
      components: result.components,
      policyVersion: result.policyVersion,
      independentLineageCount: result.independentLineageCount,
      supportingEvidenceCount: result.supportingEvidenceCount,
      contradictingEvidenceCount: result.contradictingEvidenceCount,
      contributingEvidenceIds: result.contributingEvidenceIds,
      calculatedAt: result.calculatedAt,
    };
  })(),
  preservedValues: [
    {
      value: 'alleged',
      evidenceLinkIds: ['cel_seed_hi_001'],
      credible: true,
      kind: 'primary',
    },
  ],
  researchCoverage: { level: 'minimal', score: 0.3 },
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

/** Flat list for Admin SDK / emulator import scripts. */
export const firestoreSeedDocuments: readonly SeedDocument[] = [
  { path: 'policy/active', data: seedPolicyActive },
  {
    path: 'policyVersions/policy.v1',
    data: {
      policyVersion: 'policy.v1',
      checksum: 'seed-checksum-policy-v1',
      notes: 'Emulator fixture',
    },
  },
  { path: 'publicMeta/activeRelease', data: seedActiveRelease },
  {
    path: 'publicReleases/rel_seed_001/entities/ent_seed_place_001',
    data: seedPublicEntity,
  },
  {
    path: 'publicReleases/rel_seed_001/entities/ent_seed_school_001',
    data: seedPublicSchoolEntity,
  },
  {
    path: 'publicSearchIndex/ent_seed_place_001',
    data: {
      releaseId: 'rel_seed_001',
      entityId: 'ent_seed_place_001',
      nameLower: seedPublicEntity.nameLower,
      geohash: seedPublicEntity.location?.geohash,
      kind: seedPublicEntity.kind,
    },
  },
  {
    path: 'publicSearchIndex/ent_seed_school_001',
    data: {
      releaseId: 'rel_seed_001',
      entityId: 'ent_seed_school_001',
      nameLower: seedPublicSchoolEntity.nameLower,
      geohash: seedPublicSchoolEntity.location?.geohash,
      kind: seedPublicSchoolEntity.kind,
    },
  },
  {
    path: 'submissionInbox/sub_seed_001',
    data: seedSubmission,
  },
  { path: 'canonicalEntities/ent_seed_place_001', data: seedPlaceEntity },
  {
    path: 'canonicalEntities/ent_seed_place_001/locations/loc_place_historical',
    data: seedPlaceHistoricalLocation,
  },
  {
    path: 'canonicalEntities/ent_seed_place_001/locations/loc_place_current',
    data: seedPlaceCurrentLocation,
  },
  { path: 'canonicalEntities/ent_seed_school_001', data: seedSchoolEntity },
  {
    path: 'canonicalEntities/ent_seed_school_001/locations/loc_school_historical',
    data: seedSchoolHistoricalLocation,
  },
  {
    path: 'canonicalEntities/ent_seed_school_001/locations/loc_school_current',
    data: seedSchoolCurrentLocation,
  },
  { path: 'canonicalEntities/ent_seed_person_001', data: seedPersonEntity },
  { path: 'canonicalEntities/ent_seed_person_dup', data: seedAbsorbedPersonEntity },
  { path: 'entityRelationships/rel_seed_attended_001', data: seedPersonSchoolRelationship },
  { path: 'entityMerges/merge_seed_001', data: seedEntityMerge },
  { path: 'sourceOrganizations/org_seed_nara', data: seedSourceOrganization },
  { path: 'sourceDomains/dom_seed_archives_gov', data: seedSourceDomain },
  { path: 'evidenceSources/src_seed_nara_catalog', data: seedEvidenceSource },
  { path: 'evidenceSources/src_seed_disabled_wire', data: seedDisabledEvidenceSource },
  { path: 'sourceItems/sitm_seed_nara_001', data: seedSourceItem },
  { path: 'retrievalEvents/retr_seed_001', data: seedRetrievalEvent },
  { path: 'sourceCaptures/cap_seed_001', data: seedSourceCapture },
  { path: 'evidenceRecords/ev_seed_place_hist', data: seedEvidenceRecord },
  { path: 'evidenceRecords/ev_seed_wire_copy', data: seedSyndicatedEvidenceRecord },
  { path: 'evidenceLineage/elin_seed_001', data: seedEvidenceLineage },
  { path: 'canonicalClaims/claim_seed_001', data: seedCanonicalClaim },
  { path: 'canonicalClaims/claim_seed_high_impact', data: seedHighImpactClaim },
  { path: 'claimEvidenceLinks/cel_seed_support_001', data: seedClaimEvidenceSupporting },
  { path: 'claimEvidenceLinks/cel_seed_syndicated_001', data: seedClaimEvidenceSyndicated },
  { path: 'claimEvidenceLinks/cel_seed_contradict_001', data: seedClaimEvidenceContradicting },
  {
    path: 'auditEvents/audit_seed_merge_001',
    data: {
      id: 'audit_seed_merge_001',
      action: 'research.updated',
      category: 'research',
      actor: { id: 'researcher_seed', type: 'user' },
      subject: {
        type: 'entity_merge',
        id: 'merge_seed_001',
        path: 'entityMerges/merge_seed_001',
      },
      reason: 'Duplicate entity merge',
      requestId: 'request_seed_merge_001',
      correlationId: 'correlation_seed_merge_001',
      entityId: 'ent_seed_person_001',
      idempotencyKey: 'merge:merge_seed_001',
      occurredAt: FIXED_NOW,
      data: { survivorId: 'ent_seed_person_001', absorbedIds: ['ent_seed_person_dup'] },
    },
  },
  {
    path: 'killSwitches/public-search',
    data: {
      id: 'public-search',
      enabled: false,
      reason: 'Fixture off',
      updatedAt: FIXED_NOW,
    },
  },
  {
    path: 'killSwitches/source-adapter-nara-catalog-v1',
    data: {
      id: 'source-adapter-nara-catalog-v1',
      enabled: false,
      reason: 'Adapter enabled; kill switch disengaged',
      updatedAt: FIXED_NOW,
    },
  },
  {
    path: 'killSwitches/source-adapter-wire-feed-v0',
    data: {
      id: 'source-adapter-wire-feed-v0',
      enabled: true,
      reason: 'Fixture: disabled adapter + engaged kill switch',
      updatedAt: FIXED_NOW,
    },
  },
];
