import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapPublicSearchProjection } from './map-search-index.js';
import {
  fetchReleaseEntitiesListArtifact,
  fetchReleaseSearchIndexArtifact,
} from './release-artifacts.js';

test('mapPublicSearchProjection preserves ranking inputs and theme topicIds', () => {
  const mapped = mapPublicSearchProjection({
    id: 'ent_map_001',
    releaseId: 'rel_map_001',
    kind: 'place',
    displayName: 'Mapped Place',
    nameLower: 'mapped place',
    aliases: [],
    topicTags: [],
    topicIds: ['civil-rights'],
    mentionedEntityIds: [],
    keywords: [],
    campaignIds: [],
    eraBuckets: ['1960s'],
    notabilityBasis: [
      { criterion: 'documented_site', note: 'Documented historic site.', evidenceIds: ['c1'] },
    ],
    notabilityLabels: ['Documented historic site.'],
    recordMaturity: 'published',
    researchCoverage: 'substantial',
    relatedCount: 2,
    claimCount: 3,
  });
  assert.deepEqual(mapped.topicIds, ['civil-rights']);
  assert.equal(mapped.relatedCount, 2);
  assert.equal(mapped.claimCount, 3);
});

test('release artifacts are accepted only from the configured origin and matching release', async () => {
  const env = {
    APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL: 'https://static.example.test',
  } as unknown as NodeJS.ProcessEnv;
  const entities = await fetchReleaseEntitiesListArtifact('rel_001', {
    env,
    fetchImpl: async (url) =>
      new Response(
        JSON.stringify({
          releaseId: 'rel_001',
          generatedAt: '2026-07-21T00:00:00.000Z',
          entityCount: 1,
          entities: [{ id: 'ent_001' }],
        }),
        { status: url.endsWith('/public/releases/rel_001/entities.json') ? 200 : 404 },
      ),
  });
  assert.equal(entities?.entityCount, 1);

  const search = await fetchReleaseSearchIndexArtifact('rel_001', {
    env,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          releaseId: 'rel_other',
          generatedAt: '2026-07-21T00:00:00.000Z',
          docCount: 0,
          docs: [],
        }),
      ),
  });
  assert.equal(search, undefined);
});

test('release artifact reads are disabled when no origin is configured', async () => {
  let called = false;
  const result = await fetchReleaseEntitiesListArtifact('rel_001', {
    env: {} as NodeJS.ProcessEnv,
    fetchImpl: async () => {
      called = true;
      return new Response('{}');
    },
  });
  assert.equal(result, undefined);
  assert.equal(called, false);
});
