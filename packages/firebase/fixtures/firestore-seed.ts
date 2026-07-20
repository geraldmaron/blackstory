/**
 * Emulator local seed fixtures for Firestore (demo-repo only).
 * : schools/people/places with historical vs current locations and merge lineage.
 * : source organizations, items, captures, evidence rights, lineage, kill switches.
 * : atomic claims, evidence links, confidence scores, preserved contradictions.
 * Never load these into production `` without explicit promotion workflows.
 */
import {
  buildGeoPointFields,
  calculateClaimConfidence,
  hashUtf8,
  measureConnectionStrength,
  measureRelevance,
  preserveContradictoryValues,
} from '@repo/domain';
import type {
  CanonicalClaimDoc,
  CanonicalEntityDoc,
  ClaimEvidenceLinkDoc,
  ClaimVersionDoc,
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
import { SEED_STORY_PROJECTIONS } from '../src/firestore/public-story-seed.js';

export type SeedDocument = {
  readonly path: string;
  readonly data: Record<string, unknown>;
};

const FIXED_NOW = '2026-07-16T18:00:00.000Z';

// `buildGeoPointFields` (from `@repo/domain`) returns a `readonly string[]`
// `geohashPrefixes`; the Firestore doc schema infers a mutable `string[]` for the same field.
// Copying it here reconciles the two packages' array mutability without changing any value.
function mutableGeoPoint(lat: number, lng: number, precision: number) {
  const fields = buildGeoPointFields(lat, lng, precision);
  return { ...fields, geohashPrefixes: [...fields.geohashPrefixes] };
}

// Fifteenth Street Presbyterian Church's current site (1701 15th Street NW; congregation moved
// here in 1918, present building completed 1979) — a manual-research neighborhood estimate, per
// the research brief, not a rooftop geocode.
const placeCurrentPoint = {
  ...mutableGeoPoint(38.9126, -77.0366, 5),
  precision: 'neighborhood' as const,
  matchMethod: 'manual_research' as const,
};

// The school's 1870-1891 location: the same church basement as `placeCurrentPoint` above.
const schoolHistoricalPoint = {
  ...mutableGeoPoint(38.9126, -77.0366, 5),
  precision: 'neighborhood' as const,
  matchMethod: 'manual_research' as const,
};

// The school's campus since 1891 (New Jersey Avenue NW; the present 2013 building sits on the
// same footprint occupied since 1916) — a manual-research campus-level estimate.
const schoolCurrentPoint = {
  ...mutableGeoPoint(38.9098, -77.0143, 5),
  precision: 'campus' as const,
  matchMethod: 'manual_research' as const,
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
  id: 'ent_15th_st_church_001',
  releaseId: 'rel_seed_001',
  kind: 'place',
  displayName: 'Fifteenth Street Presbyterian Church',
  nameLower: 'fifteenth street presbyterian church',
  summary:
    'Founded in 1841, Fifteenth Street Presbyterian Church hosted the 1870 founding of the ' +
    'nation’s first public high school for Black students in its basement.',
  location: placeCurrentPoint,
  claimIds: ['claim_seed_001'],
  jurisdictionLabel: 'Washington, D.C.',
  locationLabel: 'Dupont/Sixteenth Street Historic District area (neighborhood-level pin)',
  topicTags: ['church', 'education', 'community'],
  historicalContext:
    'Washington’s historically Black Presbyterian congregations built and sustained educational ' +
    'and civic institutions well beyond their own sanctuaries.',
  eraBuckets: ['1840s', '1870s'],
};

export const seedSubmission: SubmissionInboxDoc = {
  status: 'quarantined',
  createdBy: 'user_seed_submitter',
  createdAt: FIXED_NOW,
  kind: 'correction',
  payload: { note: 'Fixture quarantine submission' },
};

export const seedPlaceEntity: CanonicalEntityDoc = {
  id: 'ent_15th_st_church_001',
  kind: 'place',
  displayName: 'Fifteenth Street Presbyterian Church',
  aliases: [],
  identifiers: [{ system: 'seed', value: 'place-001' }],
  livingStatus: 'unknown',
  place: {
    // No former name is documented in sources consulted; the congregation's name has stayed
    // consistent since its 1841 founding (only the site itself changed, in 1918).
    historicalNames: [],
    jurisdictionIds: ['jur_dc'],
    primaryLocationId: 'loc_place_current',
  },
  mergeState: { status: 'active', mergeIds: [] },
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedPlaceHistoricalLocation: EntityLocationDoc = {
  id: 'loc_place_historical',
  entityId: 'ent_15th_st_church_001',
  role: 'historical',
  geometry: {
    // Coarse Washington, D.C. citywide extent, deliberately NOT a specific claimed address the
    // congregation's exact pre-1918 location is not documented in sources consulted this session
    // (only that it "moved to this site in 1918" per the research brief) see `match.notes`.
    type: 'BBox',
    bbox: [-77.1198, 38.7916, -76.9094, 38.9958],
  },
  precision: 'city',
  match: {
    method: 'manual_research',
    precision: 'city',
    recordedAt: FIXED_NOW,
    notes:
      'Pre-1918 location undocumented in sources consulted this session; this is a coarse D.C. ' +
      'citywide extent, not a specific claimed address.',
  },
  validFrom: '1841',
  validTo: '1918',
  jurisdictionIds: ['jur_dc'],
  label: 'Pre-1918 location (undocumented, citywide extent only)',
  evidenceIds: ['ev_seed_place_hist'],
};

export const seedPlaceCurrentLocation: EntityLocationDoc = {
  id: 'loc_place_current',
  entityId: 'ent_15th_st_church_001',
  role: 'current',
  geometry: {
    type: 'Point',
    coordinates: [placeCurrentPoint.lng, placeCurrentPoint.lat],
  },
  point: placeCurrentPoint,
  precision: 'neighborhood',
  match: {
    method: 'manual_research',
    precision: 'neighborhood',
    recordedAt: FIXED_NOW,
  },
  validFrom: '1918',
  validTo: null,
  modernZip: { zip: '20009', role: 'modern_input', countryCode: 'US' },
  label: 'Current site (1701 15th Street NW; present building completed 1979)',
  evidenceIds: ['ev_seed_place_cur'],
};

export const seedSchoolEntity: CanonicalEntityDoc = {
  id: 'ent_dunbar_school_001',
  kind: 'school',
  displayName: 'Paul Laurence Dunbar High School',
  aliases: [
    { value: 'Preparatory High School for Colored Youth', kind: 'former_name', validFrom: '1870', validTo: '1891' },
    { value: 'M Street High School', kind: 'former_name', validFrom: '1891', validTo: '1916' },
  ],
  livingStatus: 'unknown',
  school: {
    names: [
      { name: 'Preparatory High School for Colored Youth', validFrom: '1870', validTo: '1891', primary: false },
      { name: 'M Street High School', validFrom: '1891', validTo: '1916', primary: false },
      { name: 'Paul Laurence Dunbar High School', validFrom: '1916', validTo: null, primary: true },
    ],
    campuses: [
      {
        id: 'campus_hist',
        name: 'Fifteenth Street Presbyterian Church basement',
        locationId: 'loc_school_historical',
        status: 'closed',
        validFrom: '1870',
        validTo: '1891',
      },
      {
        id: 'campus_cur',
        name: 'New Jersey Avenue NW campus',
        locationId: 'loc_school_current',
        status: 'active',
        validFrom: '1891',
        validTo: null,
      },
    ],
    // : renamed from `statusHistory` to `milestones` to resolve a naming collision with
    // the new entity-level CanonicalEntityDoc.statusHistory (see packages/domain/src/school.ts).
    milestones: [
      { status: 'opened', at: '1870', evidenceIds: ['ev_seed_school_open'] },
      { status: 'relocated', at: '1891', evidenceIds: ['ev_seed_school_move'] },
    ],
  },
  mergeState: { status: 'active', mergeIds: [] },
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedSchoolHistoricalLocation: EntityLocationDoc = {
  id: 'loc_school_historical',
  entityId: 'ent_dunbar_school_001',
  role: 'historical',
  geometry: {
    type: 'Point',
    coordinates: [schoolHistoricalPoint.lng, schoolHistoricalPoint.lat],
  },
  point: schoolHistoricalPoint,
  precision: 'neighborhood',
  match: {
    method: 'manual_research',
    precision: 'neighborhood',
    recordedAt: FIXED_NOW,
  },
  validFrom: '1870',
  validTo: '1891',
  label: 'Original location — Fifteenth Street Presbyterian Church basement (historical)',
  evidenceIds: ['ev_seed_school_open'],
};

export const seedSchoolCurrentLocation: EntityLocationDoc = {
  id: 'loc_school_current',
  entityId: 'ent_dunbar_school_001',
  role: 'current',
  geometry: {
    type: 'Point',
    coordinates: [schoolCurrentPoint.lng, schoolCurrentPoint.lat],
  },
  point: schoolCurrentPoint,
  precision: 'campus',
  match: {
    method: 'manual_research',
    precision: 'campus',
    recordedAt: FIXED_NOW,
  },
  validFrom: '1891',
  validTo: null,
  modernZip: { zip: '20001', role: 'modern_lookup' },
  label: 'Current campus (New Jersey Avenue NW; present 2013 building on the same footprint since 1916)',
  evidenceIds: ['ev_seed_school_move'],
};

// Deliberately a generic, clearly-synthetic fixture person (never a real named historical
// figure) the duplicate-spelling merge mechanism below needs a birth year and an "alleged"
// high-impact claim to exercise its mechanics, and attaching either to a real person's name would
// misrepresent them see the module doc above and 's scope note on this narrow carve-out.
export const seedPersonEntity: CanonicalEntityDoc = {
  id: 'ent_seed_person_001',
  kind: 'person',
  displayName: 'Fixture Test Person',
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
  displayName: 'Fixture Test Person (duplicate spelling)',
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
  toEntityId: 'ent_dunbar_school_001',
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
  id: 'ent_dunbar_school_001',
  releaseId: 'rel_seed_001',
  kind: 'school',
  displayName: 'Paul Laurence Dunbar High School',
  nameLower: 'paul laurence dunbar high school',
  summary:
    'Founded in 1870 as the Preparatory High School for Colored Youth, the nation’s first public ' +
    'high school for Black students, later renamed M Street High School (1891) and Paul Laurence ' +
    'Dunbar High School (1916).',
  location: schoolCurrentPoint,
  claimIds: [],
  jurisdictionLabel: 'Washington, D.C.',
  locationLabel: 'New Jersey Avenue NW campus, Truxton Circle (campus-level pin)',
  topicTags: ['education', 'schools', 'preservation'],
  historicalContext:
    'The Preparatory High School for Colored Youth opened during Reconstruction, when Black ' +
    'communities in the District of Columbia built public schooling largely without support from ' +
    'the segregated municipal government.',
  extendedNarrative:
    'By the 1950s the school sent roughly 80% of its graduates on to college. Faculty and alumni ' +
    'include Anna Julia Cooper, Carter G. Woodson, Charles R. Drew, and Charles Hamilton Houston.',
  eraBuckets: ['1870s', '1890s', '1910s'],
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
  snapshotStorageObject: 'gs://demo-repo-evidence/captures/cap_seed_001.pdf',
  createdAt: FIXED_NOW,
};

export const seedEvidenceRecord: EvidenceRecordDoc = {
  id: 'ev_seed_place_hist',
  sourceItemId: 'sitm_seed_nara_001',
  sourceId: 'src_seed_nara_catalog',
  captureId: 'cap_seed_001',
  storageObject: 'gs://demo-repo-evidence/captures/cap_seed_001.pdf',
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
  assertedValue: '1841',
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
  assertedValue: '1841',
  notes: 'Syndicated wire copy — same lineageRootId as archival root',
  createdAt: FIXED_NOW,
};

// This one evidence link's assertedValue is deliberately synthetic (see the module doc's
// "contradicting evidence" note): the church's real founding year (1841) is single-sourced with
// no credible alternate in the research brief, so this narrow mechanical data point demonstrates
// what a contradicting-evidence link LOOKS like schema-wise without fabricating a real dispute
// over the church's actual founding year.
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
  assertedValue: '1840',
  notes:
    'Illustrative-only alternate value for confidence-scoring/contradiction-preservation ' +
    'mechanics demonstration; not a real documented dispute over Fifteenth Street Presbyterian ' +
    'Church’s actual founding year (1841, per HMdb.org and Howard University archives).',
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
  contributingEvidenceIds: [...seedClaimConfidenceResult.contributingEvidenceIds],
  calculatedAt: seedClaimConfidenceResult.calculatedAt,
};

const seedPreservedValues = preserveContradictoryValues({
  claimId: 'claim_seed_001',
  primaryValue: '1841',
  evidenceLinks: seedClaimLinks,
}).values;

export const seedCanonicalClaimVersion: ClaimVersionDoc = {
  id: 'cver_seed_001',
  claimId: 'claim_seed_001',
  versionNumber: 1,
  entityId: 'ent_15th_st_church_001',
  predicate: 'founded_year',
  object: '1841',
  temporal: { label: 'founding', validFrom: '1841-01-01' },
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
};

export const seedCanonicalClaim: CanonicalClaimDoc = {
  id: 'claim_seed_001',
  entityId: 'ent_15th_st_church_001',
  predicate: 'founded_year',
  currentVersionId: 'cver_seed_001',
  claimClass: 'standard',
  workflowStatus: 'accepted',
  publicationStatus: 'published',
  proceduralStatus: 'ruled',
  temporal: { label: 'founding', validFrom: '1841-01-01' },
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
  preservedValues: seedPreservedValues.map((value) => ({
    ...value,
    evidenceLinkIds: [...value.evidenceLinkIds],
  })),
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
};

export const seedHighImpactClaimVersion: ClaimVersionDoc = {
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
};

export const seedHighImpactClaim: CanonicalClaimDoc = {
  id: 'claim_seed_high_impact',
  entityId: 'ent_seed_person_001',
  predicate: 'conviction_status',
  currentVersionId: 'cver_seed_hi_001',
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
      contributingEvidenceIds: [...result.contributingEvidenceIds],
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

/** Flat list for Admin SDK emulator import scripts.  */
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
    path: 'publicReleases/rel_seed_001/entities/ent_15th_st_church_001',
    data: seedPublicEntity,
  },
  {
    path: 'publicReleases/rel_seed_001/entities/ent_dunbar_school_001',
    data: seedPublicSchoolEntity,
  },
  ...SEED_STORY_PROJECTIONS.map((storyDoc) => ({
    path: `publicReleases/rel_seed_001/stories/${storyDoc.slug}`,
    data: storyDoc as unknown as Record<string, unknown>,
  })),
  {
    path: 'publicSearchIndex/ent_15th_st_church_001',
    data: {
      id: 'ent_15th_st_church_001',
      releaseId: 'rel_seed_001',
      displayName: seedPublicEntity.displayName,
      nameLower: seedPublicEntity.nameLower,
      geohash: seedPublicEntity.location?.geohash,
      kind: seedPublicEntity.kind,
      summary: seedPublicEntity.summary,
      topicTags: seedPublicEntity.topicTags,
      eraBuckets: seedPublicEntity.eraBuckets ?? [],
      recordMaturity: 'partial_enrichment',
      researchCoverage: 'partial',
      relatedCount: 1,
      claimCount: seedPublicEntity.claimIds.length,
    },
  },
  {
    path: 'publicSearchIndex/ent_dunbar_school_001',
    data: {
      id: 'ent_dunbar_school_001',
      releaseId: 'rel_seed_001',
      displayName: seedPublicSchoolEntity.displayName,
      nameLower: seedPublicSchoolEntity.nameLower,
      geohash: seedPublicSchoolEntity.location?.geohash,
      kind: seedPublicSchoolEntity.kind,
      summary: seedPublicSchoolEntity.summary,
      topicTags: seedPublicSchoolEntity.topicTags,
      eraBuckets: seedPublicSchoolEntity.eraBuckets ?? [],
      recordMaturity: 'minimum_record',
      researchCoverage: 'partial',
      relatedCount: 2,
      claimCount: seedPublicSchoolEntity.claimIds.length,
    },
  },
  {
    path: 'submissionInbox/sub_seed_001',
    data: seedSubmission,
  },
  { path: 'canonicalEntities/ent_15th_st_church_001', data: seedPlaceEntity },
  {
    path: 'canonicalEntities/ent_15th_st_church_001/locations/loc_place_historical',
    data: seedPlaceHistoricalLocation,
  },
  {
    path: 'canonicalEntities/ent_15th_st_church_001/locations/loc_place_current',
    data: seedPlaceCurrentLocation,
  },
  { path: 'canonicalEntities/ent_dunbar_school_001', data: seedSchoolEntity },
  {
    path: 'canonicalEntities/ent_dunbar_school_001/locations/loc_school_historical',
    data: seedSchoolHistoricalLocation,
  },
  {
    path: 'canonicalEntities/ent_dunbar_school_001/locations/loc_school_current',
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
  {
    path: 'canonicalClaims/claim_seed_001/versions/cver_seed_001',
    data: seedCanonicalClaimVersion,
  },
  { path: 'canonicalClaims/claim_seed_high_impact', data: seedHighImpactClaim },
  {
    path: 'canonicalClaims/claim_seed_high_impact/versions/cver_seed_hi_001',
    data: seedHighImpactClaimVersion,
  },
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
