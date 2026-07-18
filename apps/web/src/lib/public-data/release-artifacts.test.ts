/**
 * Unit tests for release artifact fetch (remote miss → local fixture) and search-index mapping.
 */
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildReleaseCatalogArtifacts, writeReleaseCatalogArtifactsToDir } from '@blap/firebase';
import { mapFirestoreSearchIndexDoc } from './map-search-index.js';
import {
  fetchReleaseEntitiesListArtifact,
  fetchReleaseSearchIndexArtifact,
} from './release-artifacts.js';

const fixturesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../packages/firebase/fixtures/release-artifacts',
);

test('mapFirestoreSearchIndexDoc preserves ranking inputs and theme topicIds', () => {
  const mapped = mapFirestoreSearchIndexDoc({
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
  assert.equal(mapped.id, 'ent_map_001');
  assert.equal(mapped.releaseId, 'rel_map_001');
  assert.deepEqual(mapped.topicIds, ['civil-rights']);
  assert.equal(mapped.relatedCount, 2);
  assert.equal(mapped.claimCount, 3);
});

test('fetchReleaseEntitiesListArtifact uses local fixture when remote fetch fails', async () => {
  const releaseId = 'rel_artifact_test_001';
  const built = buildReleaseCatalogArtifacts({
    releaseId,
    generatedAt: '2026-07-18T21:00:00.000Z',
    projections: [
      {
        id: 'ent_artifact_001',
        releaseId,
        kind: 'place',
        displayName: 'Artifact Place',
        nameLower: 'artifact place',
        claimIds: [],
      },
    ],
    searchDocs: [
      {
        id: 'ent_artifact_001',
        releaseId,
        kind: 'place',
        displayName: 'Artifact Place',
        nameLower: 'artifact place',
        aliases: [],
        topicTags: [],
        topicIds: [],
        mentionedEntityIds: [],
        keywords: [],
        campaignIds: [],
        eraBuckets: [],
        notabilityBasis: [],
        notabilityLabels: [],
        recordMaturity: 'published',
        researchCoverage: 'minimal',
        relatedCount: 0,
        claimCount: 0,
      },
    ],
  });
  mkdirSync(fixturesRoot, { recursive: true });
  writeReleaseCatalogArtifactsToDir(built, fixturesRoot);

  try {
    const entities = await fetchReleaseEntitiesListArtifact(releaseId, {
      fetchImpl: async () => new Response('missing', { status: 404 }),
    });
    assert.ok(entities);
    assert.equal(entities.releaseId, releaseId);
    assert.equal(entities.entityCount, 1);

    const search = await fetchReleaseSearchIndexArtifact(releaseId, {
      fetchImpl: async () => new Response('missing', { status: 404 }),
    });
    assert.ok(search);
    assert.equal(search.docCount, 1);
  } finally {
    rmSync(join(fixturesRoot, 'public', 'releases', releaseId), { recursive: true, force: true });
  }
});

test('fetchReleaseEntitiesListArtifact returns undefined when remote and local miss', async () => {
  const result = await fetchReleaseEntitiesListArtifact('rel_does_not_exist_zzz', {
    fetchImpl: async () => new Response('missing', { status: 404 }),
    allowLocalFallback: false,
  });
  assert.equal(result, undefined);
});
