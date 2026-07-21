/**
 * Unit tests for live/snapshot public-data source selection.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldUseLivePublicProjections, isPostgresPublicDataSource, shouldPreferReleaseArtifacts } from './live-policy';
import {
  isDisplayableJurisdictionLabel,
  mapProjectionToPublicEntityView,
  resolveJurisdictionLabel,
} from './map-projection';
import { hydrateEntityLearningLinks } from './source';
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

test('shouldUseLivePublicProjections requires explicit postgres source plus DATABASE_URL', () => {
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'production',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'black-book-efaaf',
      PUBLIC_READ_API_DISABLED: '0',
    }),
    false,
  );
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'production',
      PUBLIC_DATA_SOURCE: 'postgres',
      DATABASE_URL: 'postgresql://local:local@127.0.0.1:5432/blackbook',
      PUBLIC_READ_API_DISABLED: '0',
    }),
    true,
  );
});

test('shouldUseLivePublicProjections enables postgres mode when DATABASE_URL is set', () => {
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'development',
      PUBLIC_DATA_SOURCE: 'postgres',
      DATABASE_URL: 'postgresql://local:local@127.0.0.1:5432/blackbook',
    }),
    true,
  );
  assert.equal(isPostgresPublicDataSource({ PUBLIC_DATA_SOURCE: 'postgres' }), true);
});

test('postgres mode skips ADR-004 release artifacts so stale fixtures cannot shadow bb_public', () => {
  // Regression: local rel_seed_001 entities.json is a 684-entity slice; Postgres has 1103+.
  assert.equal(shouldPreferReleaseArtifacts({ PUBLIC_DATA_SOURCE: 'postgres' }), false);
  assert.equal(shouldPreferReleaseArtifacts({ PUBLIC_DATA_SOURCE: 'seed' }), true);
  assert.equal(shouldPreferReleaseArtifacts({}), true);
});

test('shouldUseLivePublicProjections disables postgres mode without DATABASE_URL', () => {
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'development',
      PUBLIC_DATA_SOURCE: 'postgres',
    }),
    false,
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

test('mapProjectionToPublicEntityView places MapFrame pins as 0–100 percentages', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_pin_pct_001',
    releaseId: 'rel_live_001',
    kind: 'place',
    displayName: 'Pin Percent Site',
    nameLower: 'pin percent site',
    summary: 'Has public coordinates for schematic pin placement.',
    claimIds: [],
    location: {
      lat: 40.8336,
      lng: -73.9154,
      geohash: 'dr72',
      precision: 'neighborhood',
    },
    locationLabel: 'Bronx, New York',
  });
  assert.ok(view.mapPin.x > 1 && view.mapPin.x <= 100);
  assert.ok(view.mapPin.y > 1 && view.mapPin.y <= 100);
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

test('mapProjectionToPublicEntityView derives jurisdiction from public coordinates when label is absent', () => {
  // Bootstrap stubs (featured Dunbar / 15th Street projections) omit jurisdictionLabel but
  // carry location — same path production used when cards rendered UNKNOWN.
  const view = mapProjectionToPublicEntityView({
    id: 'ent_dunbar_school_001',
    releaseId: 'rel_live_001',
    kind: 'school',
    displayName: 'Paul Laurence Dunbar High School',
    nameLower: 'paul laurence dunbar high school',
    summary: 'Bootstrap stub without jurisdictionLabel.',
    claimIds: [],
    location: {
      lat: 38.9098,
      lng: -77.0143,
      geohash: 'dqcj',
      precision: 'campus',
    },
  });
  assert.equal(view.jurisdictionLabel, 'District of Columbia');
});

test('mapProjectionToPublicEntityView prefers an explicit jurisdictionLabel over coordinate derivation', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_national_example_dc',
    releaseId: 'rel_live_001',
    kind: 'place',
    displayName: 'Catalog DC Site',
    nameLower: 'catalog dc site',
    summary: 'National catalog entry with curated jurisdiction label.',
    claimIds: [],
    jurisdictionLabel: 'Washington, D.C.',
    location: {
      lat: 38.9098,
      lng: -77.0143,
      geohash: 'dqcj',
      precision: 'campus',
    },
  });
  assert.equal(view.jurisdictionLabel, 'Washington, D.C.');
});

test('mapProjectionToPublicEntityView leaves jurisdiction empty when label and coordinates are both missing', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_no_place_001',
    releaseId: 'rel_live_001',
    kind: 'place',
    displayName: 'No Place Yet',
    nameLower: 'no place yet',
    summary: 'Projection with neither jurisdiction nor coordinates.',
    claimIds: [],
  });
  assert.equal(view.jurisdictionLabel, '');
  assert.equal(isDisplayableJurisdictionLabel(view.jurisdictionLabel), false);
});

test('resolveJurisdictionLabel ignores placeholder Unknown strings', () => {
  assert.equal(
    resolveJurisdictionLabel({
      id: 'ent_x',
      releaseId: 'rel_x',
      kind: 'place',
      displayName: 'X',
      nameLower: 'x',
      claimIds: [],
      jurisdictionLabel: 'Unknown',
      // Albany, NY — unambiguous vs near-border NYC/NJ bbox overlap.
      location: { lat: 42.6526, lng: -73.7562, geohash: 'dredd' },
    }),
    'New York',
  );
});

test('isDisplayableJurisdictionLabel rejects empty and Unknown placeholders', () => {
  assert.equal(isDisplayableJurisdictionLabel(undefined), false);
  assert.equal(isDisplayableJurisdictionLabel(''), false);
  assert.equal(isDisplayableJurisdictionLabel('  '), false);
  assert.equal(isDisplayableJurisdictionLabel('Unknown'), false);
  assert.equal(isDisplayableJurisdictionLabel('UNKNOWN'), false);
  assert.equal(isDisplayableJurisdictionLabel('Washington, D.C.'), true);
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

test('mapProjectionToPublicEntityView maps shipped statusHistory onto the view', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_status_shipped_001',
    releaseId: 'rel_live_004',
    kind: 'school',
    displayName: 'Status Shipped School',
    nameLower: 'status shipped school',
    summary: 'A school projection that already carries release-shipped status history.',
    claimIds: [],
    status: 'active',
    statusHistory: [
      {
        status: 'historic',
        validFrom: '1870',
        validTo: '1891',
        datePrecision: 'year',
        basisClaimIds: ['claim_a'],
      },
      {
        status: 'active',
        validFrom: '1891',
        datePrecision: 'year',
        basisClaimIds: ['claim_b'],
      },
    ],
  });
  assert.equal(view.status, 'active');
  assert.equal(view.statusHistory?.length, 2);
  assert.equal(view.statusHistory?.[0]?.status, 'historic');
  assert.equal(view.statusHistory?.[1]?.validFrom, '1891');
});

test('mapProjectionToPublicEntityView derives statusHistory when only status/era signals exist', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_status_derive_001',
    releaseId: 'rel_live_005',
    kind: 'place',
    displayName: 'Active Campus Site',
    nameLower: 'active campus site',
    summary:
      'This university campus remains a working research university with an active campus today.',
    claimIds: [],
    eraBuckets: ['1860s'],
    status: 'active',
  });
  assert.equal(view.status, 'active');
  assert.ok(view.statusHistory);
  assert.equal(view.statusHistory?.[0]?.status, 'active');
  assert.equal(view.statusHistory?.[0]?.validFrom, '1860');
});

test('hydrateEntityLearningLinks builds a timeline from status history and dated related edges', () => {
  const base = mapProjectionToPublicEntityView({
    id: 'ent_timeline_self_001',
    releaseId: 'rel_live_006',
    kind: 'place',
    displayName: 'Timeline Self',
    nameLower: 'timeline self',
    summary: 'Entity used to verify hydrate-time timeline composition from status history.',
    claimIds: [],
    status: 'active',
    statusHistory: [
      {
        status: 'active',
        validFrom: '1900',
        datePrecision: 'year',
        basisClaimIds: [],
      },
    ],
    related: [
      {
        id: 'ent_timeline_neighbor_001',
        type: 'located_at',
        direction: 'outgoing',
        timespan: { validFrom: '1910' },
      },
    ],
  });
  const neighbor = mapProjectionToPublicEntityView({
    id: 'ent_timeline_neighbor_001',
    releaseId: 'rel_live_006',
    kind: 'place',
    displayName: 'Timeline Neighbor',
    nameLower: 'timeline neighbor',
    summary: 'Neighbor entity used only for display-name resolution in timeline sentences.',
    claimIds: [],
  });
  const hydrated = hydrateEntityLearningLinks(base, [base, neighbor]);
  assert.ok(hydrated.timeline.length >= 2);
  assert.ok(hydrated.timeline.some((item) => item.time === '1900'));
  assert.ok(hydrated.timeline.some((item) => item.time === '1910'));
});
