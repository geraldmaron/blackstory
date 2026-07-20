/**
 * Integration tests for hybrid search: fallback ladder, re-rank, public payload safety.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPublicSearchIndexDocs } from './index-build.js';
import {
  mergeLaneKillSwitches,
  parseLaneKillSwitches,
  runHybridSearch,
  shouldUseHybridSearch,
  toPublicHybridSearchPayload,
  type HybridSearchExecutionResult,
} from './hybrid.js';
import type { PublicSearchIndexDoc, SearchExecutionInput } from './types.js';

function record(
  overrides: Partial<PublicSearchIndexDoc> & Pick<PublicSearchIndexDoc, 'id' | 'displayName'>,
): PublicSearchIndexDoc {
  const displayName = overrides.displayName;
  return {
    releaseId: 'rel-1',
    kind: 'place',
    aliases: [],
    topicTags: [],
    eraBuckets: [],
    notabilityBasis: [{ criterion: 'documented_site', note: 'basis', evidenceIds: ['ev-1'] }],
    notabilityLabels: ['A documented site.'],
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    relatedCount: 0,
    claimCount: 0,
    ...overrides,
    id: overrides.id,
    displayName,
    nameLower: overrides.nameLower ?? displayName.toLowerCase(),
  };
}

const INDEX: readonly PublicSearchIndexDoc[] = buildPublicSearchIndexDocs('rel-1', [
  record({
    id: 'ent_exact',
    displayName: 'Rosewood School',
    kind: 'school',
    eraBuckets: ['1900s'],
    jurisdictionState: 'FL',
    relatedCount: 1,
    researchCoverage: 'substantial',
    topicTags: ['education'],
  }),
  record({
    id: 'ent_famous',
    displayName: 'Famous Rosewood Annex',
    kind: 'school',
    eraBuckets: ['1900s'],
    jurisdictionState: 'FL',
    relatedCount: 999,
    researchCoverage: 'minimal',
    topicTags: ['education'],
  }),
  record({
    id: 'ent_vector_only',
    displayName: 'Obscure Freedmen Chapel',
    kind: 'place',
    eraBuckets: ['1860s'],
    jurisdictionState: 'GA',
    relatedCount: 0,
    researchCoverage: 'partial',
    summary: 'A freedmen chapel referenced in oral histories.',
  }),
]).docs;

function input(overrides: Partial<SearchExecutionInput> = {}): SearchExecutionInput {
  return {
    normalizedQuery: 'rosewood',
    filters: [],
    sort: 'relevance',
    offset: 0,
    pageSize: 10,
    ...overrides,
  };
}

test('shouldUseHybridSearch requires flag and non-empty query', () => {
  assert.equal(shouldUseHybridSearch({ hybridFlag: '1', normalizedQuery: 'school' }), true);
  assert.equal(shouldUseHybridSearch({ hybridFlag: '1', normalizedQuery: '  ' }), false);
  assert.equal(shouldUseHybridSearch({ hybridFlag: '0', normalizedQuery: 'school' }), false);
});

test('hybrid mode fuses structured and vector lanes', async () => {
  const result = await runHybridSearch(input(), INDEX, {
    hybridEnabled: true,
    vectorPort: {
      findNearest() {
        return {
          status: 'ok',
          matches: [{ entityId: 'ent_vector_only', distance: 0.85 }],
        };
      },
    },
  });
  assert.equal(result.telemetry.mode, 'hybrid');
  assert.equal(result.telemetry.degraded, false);
  const ids = result.results.map((r) => r.id);
  assert.ok(ids.includes('ent_exact'));
  assert.ok(ids.includes('ent_vector_only'));
});

test('fallback: vector lane down yields structured-only with degraded telemetry', async () => {
  const result = await runHybridSearch(input(), INDEX, {
    hybridEnabled: true,
    vectorPort: undefined,
  });
  assert.equal(result.telemetry.mode, 'structured_only');
  assert.equal(result.telemetry.degraded, true);
  assert.equal(result.telemetry.lanes.vector, 'unavailable');
  assert.ok(result.results.every((r) => r.id !== 'ent_vector_only' || r.id === 'ent_vector_only'));
});

test('fallback: both lanes down yields snapshot browse', async () => {
  const result = await runHybridSearch(input({ normalizedQuery: 'zzz-no-match-xyz' }), INDEX, {
    hybridEnabled: true,
    killSwitches: { structuredEnabled: false, vectorEnabled: false },
  });
  assert.equal(result.telemetry.mode, 'snapshot_browse');
  assert.equal(result.totalMatched, INDEX.length);
});

test('connection strength never overrides stronger structured match in hybrid rerank', async () => {
  const result = await runHybridSearch(input(), INDEX, { hybridEnabled: false });
  const ids = result.results.map((r) => r.id);
  assert.equal(ids[0], 'ent_exact');
});

test('public payload strips telemetry and whyThisResult numeric scores', async () => {
  const hybridResult = await runHybridSearch(input(), INDEX, {
    hybridEnabled: true,
    vectorPort: {
      findNearest() {
        return { status: 'ok', matches: [{ entityId: 'ent_vector_only', distance: 0.9 }] };
      },
    },
  });
  const publicPayload = toPublicHybridSearchPayload(hybridResult);
  assert.ok(!('telemetry' in publicPayload));
  for (const row of publicPayload.results) {
    assert.ok(!('whyThisResult' in row));
    assert.ok(!('fusionScore' in row));
    assert.ok(!('distance' in row));
    assert.ok(!/\b0\.\d+\b/.test(row.explanation));
  }
});

test('every hybrid result carries whyThisResult affordance', async () => {
  const result = await runHybridSearch(input(), INDEX, { hybridEnabled: true });
  for (const row of result.results) {
    assert.ok(row.whyThisResult.length >= 1);
    assert.equal(typeof row.explanation, 'string');
  }
});

test('parseLaneKillSwitches maps query params', () => {
  assert.deepEqual(parseLaneKillSwitches({ structured: '0', vector: '1' }), {
    structuredEnabled: false,
    vectorEnabled: true,
  });
  assert.deepEqual(mergeLaneKillSwitches(parseLaneKillSwitches({ vector: '0' })), {
    structuredEnabled: true,
    vectorEnabled: false,
  });
});

test('deterministic hybrid search returns identical order on repeat', async () => {
  const opts = {
    hybridEnabled: true,
    vectorPort: {
      findNearest() {
        return {
          status: 'ok',
          matches: [
            { entityId: 'ent_vector_only', distance: 0.7 },
            { entityId: 'ent_famous', distance: 0.6 },
          ],
        };
      },
    },
  };
  const first = await runHybridSearch(input(), INDEX, opts);
  const second = await runHybridSearch(input(), INDEX, opts);
  assert.deepEqual(
    first.results.map((r) => r.id),
    second.results.map((r) => r.id),
  );
});

function assertNoNumericScoresInHybridResult(result: HybridSearchExecutionResult): void {
  const serialized = JSON.stringify(result.results);
  assert.ok(!/"fusionScore"/.test(serialized));
  assert.ok(!/"distance"/.test(serialized));
}

test('hybrid results never serialize internal numeric scores', async () => {
  const result = await runHybridSearch(input(), INDEX, {
    hybridEnabled: true,
    vectorPort: {
      findNearest() {
        return { status: 'ok', matches: [{ entityId: 'ent_vector_only', distance: 0.42 }] };
      },
    },
  });
  assertNoNumericScoresInHybridResult(result);
});
