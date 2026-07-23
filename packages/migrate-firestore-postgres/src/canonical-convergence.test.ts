import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCanonicalConvergencePlan,
  inferEntityClass,
  stableDigest,
  stableId,
  type ActiveReleaseRow,
} from './canonical-convergence.js';

function row(overrides: Partial<ActiveReleaseRow> = {}): ActiveReleaseRow {
  return {
    release_id: 'rel_test',
    entity_id: 'ent_test',
    display_name: 'Test Place',
    kind: 'place',
    summary: 'A documented place.',
    location: {
      lat: 38.9,
      lng: -77.01,
      geohash: 'dqcjq',
      geohashPrefixes: ['d', 'dq', 'dqc'],
      precision: 'site',
      matchMethod: 'manual_research',
    },
    geohash: 'dqcjq',
    lat: 38.9,
    lng: -77.01,
    claims: [
      {
        id: 'claim_test',
        predicate: 'documented_as',
        object: 'a test place',
        confidenceLevel: 'high',
        citationSource: 'National Park Service',
        citationHref: 'https://www.nps.gov/example',
        citationLabel: 'NPS record',
      },
    ],
    taxonomy: { topicIds: ['topic_test'] },
    related: [],
    primary_image: null,
    projection: {
      jurisdictionLabel: 'Washington, D.C.',
      locationLabel: 'Documented site',
      topicIds: ['topic_test'],
      topicTags: ['history'],
      researchCoverage: 'partial',
    },
    search_aliases: [],
    created_at: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
}

test('stable hashing is independent of object key insertion order', () => {
  assert.equal(stableDigest({ a: 1, b: 2 }), stableDigest({ b: 2, a: 1 }));
  assert.equal(stableId('x', { a: 1 }), stableId('x', { a: 1 }));
});

test('entity classes map product kinds without inventing a class for other', () => {
  assert.equal(inferEntityClass('school'), 'organization');
  assert.equal(inferEntityClass('case'), 'legal');
  assert.equal(inferEntityClass('publication'), 'work');
  assert.equal(inferEntityClass('other'), null);
});

test('convergence plan normalizes entity, claim, location, source, and evidence', () => {
  const plan = buildCanonicalConvergencePlan([row()], []);
  assert.equal(plan.entities.length, 1);
  assert.equal(plan.locations.length, 1);
  assert.equal(plan.claims.length, 1);
  assert.equal(plan.claimVersions.length, 1);
  assert.equal(plan.sourceOrganizations.length, 1);
  assert.equal(plan.sourceDomains[0]?.hostname, 'www.nps.gov');
  assert.equal(plan.evidenceRecords[0]?.excerpt, null);
  assert.equal(plan.claimEvidenceLinks[0]?.role, 'supporting');
  assert.equal(plan.claims[0]?.current_version_id, plan.claimVersions[0]?.id);
});

test('convergence plan recovers explicitly cited legacy seed claims from malformed rows', () => {
  const plan = buildCanonicalConvergencePlan([
    row({
      entity_id: 'ent_dc_landmark_listing_1975',
      claims: {},
      projection: {
        jurisdictionLabel: 'Washington, D.C.',
        locationLabel: 'Dunbar campus',
        claimIds: ['claim_landmark_listed_1975'],
      },
    }),
  ]);
  assert.deepEqual(
    plan.claims.map((claim) => claim.id),
    ['claim_landmark_listed_1975'],
  );
  assert.match(plan.warnings.join('\n'), /recovered cited legacy claim/);
});

test('mirrored related entries collapse to one canonical relationship', () => {
  const left = row({
    entity_id: 'ent_left',
    related: [{ id: 'ent_right', type: 'part_of', direction: 'outgoing' }],
  });
  const right = row({
    entity_id: 'ent_right',
    display_name: 'Right',
    claims: [
      {
        id: 'claim_right',
        predicate: 'documented_as',
        object: 'right',
        confidenceLevel: 'high',
        citationSource: 'NPS',
        citationHref: 'https://www.nps.gov/right',
        citationLabel: 'NPS',
      },
    ],
    related: [{ id: 'ent_left', type: 'part_of', direction: 'incoming' }],
  });
  const plan = buildCanonicalConvergencePlan([left, right], []);
  assert.equal(plan.relationships.length, 1);
});
