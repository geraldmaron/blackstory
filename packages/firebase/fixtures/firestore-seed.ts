/**
 * Emulator / local seed fixtures for Firestore (demo-black-book only).
 * BB-014: schools/people/places with historical vs current locations and merge lineage.
 * Never load these into production `black-book-efaaf` without explicit promotion workflows.
 */
import { buildGeoPointFields } from '@black-book/domain';
import type {
  CanonicalEntityDoc,
  EntityLocationDoc,
  EntityMergeDoc,
  EntityRelationshipDoc,
  PolicyActiveDoc,
  PublicActiveReleaseDoc,
  PublicEntityProjectionDoc,
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
    statusHistory: [
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
  {
    path: 'auditEvents/audit_seed_merge_001',
    data: {
      id: 'audit_seed_merge_001',
      action: 'entity.merge',
      actor: 'researcher_seed',
      resource: 'entityMerges/merge_seed_001',
      at: FIXED_NOW,
      detail: { survivorId: 'ent_seed_person_001', absorbedIds: ['ent_seed_person_dup'] },
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
];
