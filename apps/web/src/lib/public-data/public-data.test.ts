/**
 * Unit tests for live/snapshot public-data source selection.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldUseLivePublicProjections } from './live-policy';
import { mapProjectionToPublicEntityView } from './map-projection';

test('shouldUseLivePublicProjections is off by default in development', () => {
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'development',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'black-book-efaaf',
    }),
    false,
  );
});

test('shouldUseLivePublicProjections respects PUBLIC_READ_API_DISABLED', () => {
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'production',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'black-book-efaaf',
      PUBLIC_READ_API_DISABLED: '1',
    }),
    false,
  );
});

test('shouldUseLivePublicProjections enables production project reads', () => {
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'production',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'black-book-efaaf',
      PUBLIC_READ_API_DISABLED: '0',
    }),
    true,
  );
});

test('mapProjectionToPublicEntityView renders claims carried by the projection itself', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_15th_st_church_001',
    releaseId: 'rel_seed_001',
    kind: 'place',
    displayName: 'Fifteenth Street Presbyterian Church',
    nameLower: 'fifteenth street presbyterian church',
    summary: 'Fixture projection for emulator reads.',
    claimIds: ['claim_seed_001'],
    claims: [
      {
        id: 'claim_seed_001',
        predicate: 'founded_in',
        object: '1841',
        confidenceLevel: 'high',
        citationSource: 'nps.gov',
        citationLabel: 'National Park Service',
      },
    ],
  });
  assert.equal(view.id, 'ent_15th_st_church_001');
  assert.equal(view.claims.length, 1);
  assert.equal(view.claims[0]!.object, '1841');
  assert.equal(view.revision.releaseId, 'rel_seed_001');
});

test('mapProjectionToPublicEntityView does not backfill from the bundled seed catalog even when the id matches', () => {
  // `ent_15th_st_church_001` is a real bundled seed id with its own summary/claims. A live
  // projection sharing that id must render only its own (thinner) data — never silently pull
  // in the seed's summary/topicTags/claims (the related workstream fixed this seed-enrichment bug).
  const view = mapProjectionToPublicEntityView({
    id: 'ent_15th_st_church_001',
    releaseId: 'rel_live_001',
    kind: 'place',
    displayName: 'Fifteenth Street Presbyterian Church',
    nameLower: 'fifteenth street presbyterian church',
    summary: '',
    claimIds: [],
  });
  assert.equal(view.claims.length, 0);
  assert.deepEqual(view.topicTags, []);
});

test('live-only projections get a default notability label for search-pool parity', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_national_example_001',
    releaseId: 'rel_live_001',
    kind: 'place',
    displayName: 'Example National Site',
    nameLower: 'example national site',
    summary: 'A live-only catalog projection without curated notability.',
    claimIds: [],
    jurisdictionLabel: 'Oklahoma',
    locationLabel: 'Tulsa, Oklahoma',
  });
  assert.ok(view.notabilityLabels && view.notabilityLabels.length >= 1);
  assert.match(view.notabilityLabels![0]!, /documented site/i);
});

test('mapProjectionToPublicEntityView uses the release builder real notabilityBasis/researchCoverage/revision metadata when present (the related workstream)', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_national_example_002',
    releaseId: 'rel_live_002',
    kind: 'place',
    displayName: 'Example Built Site',
    nameLower: 'example built site',
    summary: 'A projection produced by the release builder.',
    claimIds: ['claim_ex_01'],
    claims: [
      {
        id: 'claim_ex_01',
        predicate: 'founded_year',
        object: '1900',
        confidenceLevel: 'high',
        citationSource: 'Example Source',
        citationLabel: 'Example Citation',
      },
    ],
    notabilityBasis: [
      { criterion: 'documented_site', note: 'A documented site.', evidenceIds: ['claim_ex_01'] },
    ],
    researchCoverage: 'substantial',
    generatedAt: '2026-07-18T00:00:00.000Z',
    recordUpdatedAt: '2026-07-18T00:00:00.000Z',
  });
  assert.deepEqual(view.notabilityBasis, [
    { criterion: 'documented_site', note: 'A documented site.', evidenceIds: ['claim_ex_01'] },
  ]);
  assert.equal(view.researchCoverage, 'substantial');
  assert.equal(view.revision.generatedAt, '2026-07-18T00:00:00.000Z');
  assert.equal(view.revision.recordUpdatedAt, '2026-07-18T00:00:00.000Z');
});

test('mapProjectionToPublicEntityView falls back to computed researchCoverage and empty revision timestamps when the projection predates the release builder', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_bootstrap_example_001',
    releaseId: 'rel_seed_001',
    kind: 'place',
    displayName: 'Bootstrap Stub',
    nameLower: 'bootstrap stub',
    summary: 'A bootstrap-window stub predating the release builder.',
    claimIds: [],
  });
  assert.equal(view.notabilityBasis, undefined);
  assert.equal(view.researchCoverage, 'minimal');
  assert.equal(view.revision.generatedAt, '');
  assert.equal(view.revision.recordUpdatedAt, '');
});

test('mapProjectionToPublicEntityView maps independentLineageCount when present on projection claims', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_lineage_example_001',
    releaseId: 'rel_live_003',
    kind: 'place',
    displayName: 'Lineage Example',
    nameLower: 'lineage example',
    summary: 'Projection with explicit independent lineage counts on claims.',
    claimIds: ['claim_lineage_01', 'claim_lineage_02'],
    claims: [
      {
        id: 'claim_lineage_01',
        predicate: 'founded_year',
        object: '1900',
        confidenceLevel: 'high',
        citationSource: 'Example Source A',
        citationLabel: 'Example Citation A',
        independentLineageCount: 3,
      },
      {
        id: 'claim_lineage_02',
        predicate: 'located_in',
        object: 'Tulsa',
        confidenceLevel: 'medium',
        citationSource: 'Example Source B',
        citationLabel: 'Example Citation B',
      },
    ],
  });
  assert.equal(view.claims[0]!.independentLineageCount, 3);
  assert.equal(view.claims[1]!.independentLineageCount, undefined);
});
