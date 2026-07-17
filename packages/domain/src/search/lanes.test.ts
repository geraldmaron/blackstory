/**
 * Tests for hybrid lane execution, era pre-filter (BB-090), and kill switches (BB-072).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveDecadeLabel } from '../era.js';
import {
  DEFAULT_LANE_KILL_SWITCHES,
  deriveVectorEraPreFilter,
  eraBucketOverlapsRecord,
  runParallelLanes,
  runStructuredLane,
  runVectorLane,
  type VectorLaneQueryPort,
} from './lanes.js';
import { buildPublicSearchIndexDocs } from './index-build.js';
import type { PublicSearchIndexDoc } from './types.js';

const INDEX: readonly PublicSearchIndexDoc[] = buildPublicSearchIndexDocs('rel-1', [
  {
    id: 'ent_a',
    kind: 'school',
    displayName: 'Alpha School',
    nameLower: 'alpha school',
    aliases: [],
    topicTags: ['education'],
    eraBuckets: ['1900s'],
    jurisdictionState: 'NC',
    notabilityBasis: [{ criterion: 'documented_site', note: 'basis', evidenceIds: ['ev-1'] }],
    notabilityLabels: ['A documented site.'],
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    relatedCount: 2,
    claimCount: 0,
  },
]).docs;

test('deriveVectorEraPreFilter uses explicit era filter', () => {
  assert.equal(
    deriveVectorEraPreFilter({
      normalizedQuery: 'school',
      filters: [{ field: 'era', value: '1900s' }],
    }),
    '1900s',
  );
});

test('deriveVectorEraPreFilter extracts year from query via shared deriveDecadeLabel', () => {
  const bucket = deriveVectorEraPreFilter({
    normalizedQuery: 'school in 1957',
    filters: [],
  });
  assert.equal(bucket, deriveDecadeLabel(1957));
});

test('eraBucketOverlapsRecord uses deriveEraBuckets labels', () => {
  assert.equal(eraBucketOverlapsRecord('1950s', ['1950s', '1960s']), true);
  assert.equal(eraBucketOverlapsRecord('1950s', ['1900s']), false);
});

test('structured lane respects kill switch', () => {
  const result = runStructuredLane(
    { normalizedQuery: 'alpha', filters: [], limit: 10 },
    INDEX,
    { structuredEnabled: false, vectorEnabled: true },
  );
  assert.equal(result.status, 'disabled');
  assert.equal(result.ranked.length, 0);
});

test('vector lane returns unavailable without port', async () => {
  const result = await runVectorLane(
    { normalizedQuery: 'alpha', filters: [], limit: 5 },
    DEFAULT_LANE_KILL_SWITCHES,
    undefined,
  );
  assert.equal(result.status, 'unavailable');
});

test('parallel lanes run structured and vector concurrently', async () => {
  const port: VectorLaneQueryPort = {
    findNearest() {
      return { status: 'ok', matches: [{ entityId: 'ent_a', distance: 0.8 }] };
    },
  };
  const output = await runParallelLanes(
    { normalizedQuery: 'alpha', filters: [], structuredLimit: 5, vectorLimit: 5 },
    INDEX,
    DEFAULT_LANE_KILL_SWITCHES,
    port,
  );
  assert.equal(output.structured.status, 'ok');
  assert.equal(output.vector.status, 'ok');
  assert.equal(output.structured.ranked[0]?.record.id, 'ent_a');
});
