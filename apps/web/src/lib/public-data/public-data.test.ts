/**
 * Unit tests for live/snapshot public-data source selection.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  shouldUseLivePublicProjections,
  isPostgresPublicDataMisconfigured,
  isPostgresPublicDataSource,
  shouldPreferReleaseArtifacts,
  resolvePublicDataSource,
} from './live-policy';
import {
  isDisplayableJurisdictionLabel,
  mapProjectionToPublicEntityView,
  resolveJurisdictionLabel,
} from './map-projection';
import { hydrateEntityLearningLinks, retainCitedRelationshipViews } from './source';
test('shouldUseLivePublicProjections is off by default in development', () => {
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'development',
    }),
    false,
  );
});

test('PUBLIC_DATA_SOURCE=firestore is not a live-policy value', () => {
  // Root .env.example used to list firestore as a third source. live-policy only
  // accepts seed|postgres; a firestore value must not enable live reads.
  assert.equal(resolvePublicDataSource({ PUBLIC_DATA_SOURCE: 'firestore' }), undefined);
  assert.equal(isPostgresPublicDataSource({ PUBLIC_DATA_SOURCE: 'firestore' }), false);
  assert.equal(
    shouldUseLivePublicProjections({
      PUBLIC_DATA_SOURCE: 'firestore',
      DATABASE_URL: 'postgresql://local:local@127.0.0.1:5432/blackbook',
    }),
    false,
  );
});

test('PUBLIC_READ_API_DISABLED is not read by web live-policy', () => {
  // The Vercel cutover runbook and disable-public-beta doc treat this flag as the
  // web kill switch. The function does not consult it. Setting it to 1 with a
  // valid postgres pair still enables live reads. Do not "fix" this assertion by
  // pretending the flag works; wire it or retire the runbook claim.
  assert.equal(
    shouldUseLivePublicProjections({
      PUBLIC_DATA_SOURCE: 'postgres',
      DATABASE_URL: 'postgresql://local:local@127.0.0.1:5432/blackbook',
      PUBLIC_READ_API_DISABLED: '1',
    }),
    true,
  );
});

test('shouldUseLivePublicProjections requires explicit postgres source plus DATABASE_URL', () => {
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'production',
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

test('postgres mode uses release-catalog artifacts only behind an explicit origin', () => {
  // Regression: local rel_seed_001 entities.json is a 684-entity slice; Postgres has 1103+.
  // Without a configured origin, postgres mode must never pick up fixture artifacts.
  assert.equal(shouldPreferReleaseArtifacts({ PUBLIC_DATA_SOURCE: 'postgres' }), false);
  assert.equal(
    shouldPreferReleaseArtifacts({
      PUBLIC_DATA_SOURCE: 'postgres',
      APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL: '   ',
    }),
    false,
  );
  // With an explicit origin, artifacts act as the egress read-through cache;
  // The shared release-artifact fetcher still rejects any artifact whose releaseId mismatches
  // the live pointer.
  assert.equal(
    shouldPreferReleaseArtifacts({
      PUBLIC_DATA_SOURCE: 'postgres',
      APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL: 'https://cdn.example.com/public-media',
    }),
    true,
  );
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

test('postgres without DATABASE_URL is an explicit misconfig (empty catalog, not seed)', () => {
  // Local dig footgun: PUBLIC_DATA_SOURCE=postgres in .env without DATABASE_URL → 0 entities.
  assert.equal(isPostgresPublicDataMisconfigured({ PUBLIC_DATA_SOURCE: 'postgres' }), true);
  assert.equal(
    isPostgresPublicDataMisconfigured({
      PUBLIC_DATA_SOURCE: 'postgres',
      DATABASE_URL: 'postgresql://local:local@127.0.0.1:5432/blackbook',
    }),
    false,
  );
  assert.equal(isPostgresPublicDataMisconfigured({ PUBLIC_DATA_SOURCE: 'seed' }), false);
  assert.equal(isPostgresPublicDataMisconfigured({}), false);
});

test('postgres mode must not prefer seed-style artifact caches (hero 4-pin regression)', () => {
  // Build-time prerender without DATABASE_URL previously baked listPublicEntities() (4 Dunbar
  // fixtures) into `/` while `/explore/api` stayed live. Artifact preference must stay off
  // in PUBLIC_DATA_SOURCE=postgres unless an explicit artifact origin is configured.
  assert.equal(isPostgresPublicDataSource({ PUBLIC_DATA_SOURCE: 'postgres' }), true);
  assert.equal(shouldPreferReleaseArtifacts({ PUBLIC_DATA_SOURCE: 'postgres' }), false);
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
        citationHref: 'https://example.gov/record/1',
        archivedUrl: 'https://web.archive.org/web/20260901000000/https://example.gov/record/1',
        archivedAt: '2026-09-01T00:00:00.000Z',
        citationLabel: 'National Park Service',
      },
    ],
  });
  assert.equal(view.id, 'ent_15th_st_church_001');
  assert.equal(view.claims.length, 1);
  assert.equal(view.claims[0]!.object, '1841');
  assert.equal(view.claims[0]!.citationHref, 'https://example.gov/record/1');
  assert.equal(view.claims[0]!.archivedAt, '2026-09-01T00:00:00.000Z');
  assert.equal(view.revision.releaseId, 'rel_seed_001');
});

test('mapProjectionToPublicEntityView drops an unvalidated archive pointer and keeps the original', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_archive_invalid_001',
    releaseId: 'rel_seed_001',
    kind: 'place',
    displayName: 'Archive Validation Site',
    nameLower: 'archive validation site',
    summary: 'Fixture projection for invalid archive pointer handling.',
    claimIds: ['claim-1'],
    claims: [
      {
        id: 'claim-1',
        predicate: 'documented_at',
        object: 'the cited record',
        confidenceLevel: 'high',
        citationSource: 'example.gov',
        citationHref: 'https://example.gov/record/1',
        archivedUrl: 'https://web.archive.org/web/20260901000000/https://other.gov/record/1',
        archivedAt: '2026-09-01T00:00:00.000Z',
        citationLabel: 'Example record',
      },
    ],
  });
  assert.equal(view.claims[0]?.citationHref, 'https://example.gov/record/1');
  assert.equal(view.claims[0]?.archivedUrl, undefined);
  assert.equal(view.claims[0]?.archivedAt, undefined);
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
  // A live record sharing a bundled seed id must render only its live fields, never borrow the
  // seed's claims, summary or topics.
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

test('resolveJurisdictionLabel keeps country-only United States (bbox would mislabel St. Louis as Illinois)', () => {
  assert.equal(
    resolveJurisdictionLabel({
      id: 'nrhp-black-heritage-76002235',
      releaseId: 'rel_x',
      kind: 'place',
      displayName: 'Joplin, Scott, House',
      nameLower: 'joplin, scott, house',
      claimIds: [],
      jurisdictionLabel: 'United States',
      location: { lat: 38.637, lng: -90.216, geohash: '9yzg' },
    }),
    'United States',
  );
});

test('isDisplayableJurisdictionLabel rejects empty, Unknown, and country-only US labels', () => {
  assert.equal(isDisplayableJurisdictionLabel(undefined), false);
  assert.equal(isDisplayableJurisdictionLabel(''), false);
  assert.equal(isDisplayableJurisdictionLabel('  '), false);
  assert.equal(isDisplayableJurisdictionLabel('Unknown'), false);
  assert.equal(isDisplayableJurisdictionLabel('UNKNOWN'), false);
  assert.equal(isDisplayableJurisdictionLabel('United States'), false);
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
  assert.match(view.notabilityLabels![0]!, /record in the active public release/i);
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

test('public relationship hydration rejects unsupported candidates and retains cited direction', () => {
  const root = mapProjectionToPublicEntityView({
    ...relationshipProjection('root', 'Root record'),
    claims: [relationshipClaim('root-outgoing', 'founded', 'outgoing')],
    related: [
      { id: 'outgoing', type: 'founded', direction: 'outgoing' },
      { id: 'incoming', type: 'employed_by', direction: 'incoming' },
      { id: 'unsupported', type: 'related_to', direction: 'outgoing' },
    ],
  });
  const outgoing = mapProjectionToPublicEntityView(
    relationshipProjection('outgoing', 'Outgoing target'),
  );
  const incoming = mapProjectionToPublicEntityView({
    ...relationshipProjection('incoming', 'Incoming source'),
    claims: [relationshipClaim('incoming-root', 'employed_by', 'root')],
  });
  const unsupported = mapProjectionToPublicEntityView(
    relationshipProjection('unsupported', 'Unsupported target'),
  );

  const gated = retainCitedRelationshipViews([root, outgoing, incoming, unsupported]);
  const byId = new Map(gated.map((entity) => [entity.id, entity]));

  assert.deepEqual(byId.get('root')?.related, [
    { id: 'incoming', type: 'employed_by', direction: 'incoming' },
    { id: 'outgoing', type: 'founded', direction: 'outgoing' },
  ]);
  assert.deepEqual(byId.get('root')?.relatedIds, ['incoming', 'outgoing']);
  assert.deepEqual(byId.get('outgoing')?.related, [
    { id: 'root', type: 'founded', direction: 'incoming' },
  ]);
  assert.deepEqual(byId.get('incoming')?.related, [
    { id: 'root', type: 'employed_by', direction: 'outgoing' },
  ]);
  assert.deepEqual(byId.get('unsupported')?.related, []);
});

test('each relationship hop needs its own exact cited claim before hydration can traverse it', () => {
  const root = mapProjectionToPublicEntityView({
    ...relationshipProjection('root', 'Root record'),
    related: [{ id: 'first', type: 'employed_by', direction: 'incoming' }],
  });
  const firstWithoutProof = mapProjectionToPublicEntityView({
    ...relationshipProjection('first', 'First hop'),
    claims: [relationshipClaim('first-root', 'employed_by', 'root')],
    related: [{ id: 'second', type: 'related_to', direction: 'incoming' }],
  });
  const second = mapProjectionToPublicEntityView(relationshipProjection('second', 'Second hop'));

  const rejectedCatalog = retainCitedRelationshipViews([root, firstWithoutProof, second]);
  const rejectedRoot = rejectedCatalog.find((entity) => entity.id === 'root');
  assert.ok(rejectedRoot);
  const rejectedHydration = hydrateEntityLearningLinks(rejectedRoot, rejectedCatalog);
  assert.deepEqual(
    rejectedHydration.relatedNeighbors?.map((entity) => entity.id),
    ['first'],
  );
  assert.equal(rejectedHydration.continueLearning, undefined);
  assert.deepEqual(
    rejectedHydration.relationshipGraph?.nodes.map((node) => node.id),
    ['first'],
  );

  const secondWithProof = mapProjectionToPublicEntityView({
    ...relationshipProjection('second', 'Second hop'),
    claims: [relationshipClaim('second-first', 'related_to', 'first')],
  });
  const acceptedCatalog = retainCitedRelationshipViews([root, firstWithoutProof, secondWithProof]);
  const acceptedRoot = acceptedCatalog.find((entity) => entity.id === 'root');
  assert.ok(acceptedRoot);
  const acceptedHydration = hydrateEntityLearningLinks(acceptedRoot, acceptedCatalog);
  assert.deepEqual(
    acceptedHydration.continueLearning?.map((entity) => entity.id),
    ['second'],
  );
  assert.deepEqual(
    acceptedHydration.relationshipGraph?.nodes.map((node) => [node.id, node.hop]),
    [
      ['first', 1],
      ['second', 2],
    ],
  );
});

function relationshipProjection(id: string, displayName: string) {
  return {
    id,
    releaseId: 'rel_relationship_gate',
    kind: 'place',
    displayName,
    nameLower: displayName.toLowerCase(),
    summary: `${displayName} is a projection fixture for evidence-gated public relationships.`,
    claimIds: [],
  } as const;
}

function relationshipClaim(id: string, predicate: string, object: string) {
  return {
    id,
    predicate,
    object,
    confidenceLevel: 'high' as const,
    citationSource: 'Archive',
    citationLabel: 'Cited relationship record',
    citationHref: `https://archive.example.org/${id}`,
  };
}

test('projection grades do not invent scores and missing or unrecognized precision never creates a pin', () => {
  const projection = {
    id: 'publication',
    releaseId: 'release',
    kind: 'publication',
    displayName: 'Source review',
    nameLower: 'source review',
    claimIds: ['claim'],
    claims: [
      {
        id: 'claim',
        predicate: 'description',
        object: 'A sourced statement',
        confidenceLevel: 'low' as const,
        citationSource: 'Archive',
        citationLabel: 'Record',
      },
    ],
  };
  const view = mapProjectionToPublicEntityView(projection);
  assert.equal(view.claims[0]?.confidenceScore, undefined);
  assert.equal(view.locationPrecision, 'none');
  assert.equal(view.geoAnchor, undefined);
  assert.doesNotMatch(view.relevanceExplanation, /documented site/);
  for (const precision of [undefined, 'unrecognized', 'none', 'country']) {
    const located = mapProjectionToPublicEntityView({
      ...projection,
      location: {
        lat: 38,
        lng: -77,
        geohash: 'dqc',
        ...(precision !== undefined ? { precision } : {}),
      },
    });
    assert.equal(located.geoAnchor, undefined);
  }
});
