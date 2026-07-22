import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSourceProgramRunId,
  mapBulkFixtureToLoadPlan,
  type BulkFixtureFile,
} from './bulk-candidates-supabase.ts';

const sampleFixture: BulkFixtureFile = {
  generatedAt: '2026-07-19T12:00:00.000Z',
  metadata: {
    sourceProgramId: 'dc-black-history-sites',
    sourceProgramName: 'Black History Sites: Washington',
    custodian: 'DC HPO',
    license: 'CC BY 4.0',
    canonicalUrl: 'https://catalog.data.gov/dataset/black-history-sites-washington',
    retrievedAt: '2026-07-19T12:00:00.000Z',
    count: 1,
    droppedCount: 0,
    sourceCaptures: [
      {
        url: 'https://example.invalid/features.geojson',
        cachedAs: '.cache/bulk-sources/dc-sites/features-offset-0.geojson',
        contentSha256: 'abc123',
        bytes: 100,
      },
    ],
    methodologyNotes: ['research-lane-only'],
  },
  summary: { rowsFetched: 1, newCandidates: 1, skippedUnusable: 0 },
  candidates: [
    {
      id: 'dc-black-history-sites-s1',
      kind: 'place',
      displayName: 'Sample Site',
      summary: 'Institution site in Washington, DC.',
      canonicalUrl: 'https://example.invalid/site',
      lat: 38.9,
      lng: -77.0,
      discoveredAt: '2026-07-19T12:00:00.000Z',
      researchLaneOnly: true,
      provenance: {
        sourceId: 'dc-black-history-sites',
        sourceItemId: 'S1',
        sourceUrl: 'https://example.invalid/features.geojson',
        capturedAt: '2026-07-19T12:00:00.000Z',
        rights: 'CC BY 4.0',
      },
    },
  ],
};

test('buildSourceProgramRunId is stable per lane and day', () => {
  assert.equal(buildSourceProgramRunId('dc-sites', '2026-07-19T12:00:00.000Z'), 'dc-sites-2026-07-19');
});

test('mapBulkFixtureToLoadPlan produces run, captures, and candidate rows', () => {
  const plan = mapBulkFixtureToLoadPlan({
    fixture: sampleFixture,
    lane: 'dc-sites',
    fixturePath: 'packages/firebase/fixtures/discovery-candidates/bulk-dc-sites-2026-07-19.json',
  });
  assert.equal(plan.run.id, 'dc-sites-2026-07-19');
  assert.equal(plan.run.lane, 'dc-sites');
  assert.equal(plan.run.candidate_count, 1);
  assert.equal(plan.captures.length, 1);
  assert.equal(plan.captures[0]?.content_sha256, 'abc123');
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.candidates[0]?.source_item_id, 'S1');
  assert.equal(plan.candidates[0]?.research_lane_only, true);
  assert.equal(plan.candidates[0]?.status, 'pending');
});

test('mapBulkFixtureToLoadPlan rejects non-research-lane candidates', () => {
  assert.throws(() =>
    mapBulkFixtureToLoadPlan({
      fixture: {
        ...sampleFixture,
        candidates: [{ ...sampleFixture.candidates[0]!, researchLaneOnly: false }],
      },
      lane: 'dc-sites',
    }),
  );
});
