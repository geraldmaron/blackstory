/**
 * Unit tests for per-release catalog artifact builders and local writers (ADR-004).
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  buildReleaseCatalogArtifacts,
  fetchReleaseSearchIndexArtifact,
  publicMediaObjectUrl,
  writeReleaseCatalogArtifactsToDir,
} from './release-artifacts.js';

test('buildReleaseCatalogArtifacts sets paths, counts, and stable hashes', () => {
  const built = buildReleaseCatalogArtifacts({
    releaseId: 'rel_test_001',
    generatedAt: '2026-07-18T20:00:00.000Z',
    projections: [{ id: 'ent_a', displayName: 'A' }],
    searchDocs: [{ id: 'ent_a', releaseId: 'rel_test_001', displayName: 'A' }],
  });
  assert.equal(built.entitiesListPath, 'public/releases/rel_test_001/entities.json');
  assert.equal(built.searchIndexPath, 'public/releases/rel_test_001/search-index.json');
  assert.equal(built.entitiesList.entityCount, 1);
  assert.equal(built.searchIndex.docCount, 1);
  assert.match(built.entitiesListHash.digest, /^[a-f0-9]{64}$/);
  assert.match(built.searchIndexHash.digest, /^[a-f0-9]{64}$/);
});

test('writeReleaseCatalogArtifactsToDir mirrors GCS object keys on disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ds-release-artifacts-'));
  try {
    const built = buildReleaseCatalogArtifacts({
      releaseId: 'rel_disk_001',
      generatedAt: '2026-07-18T20:00:00.000Z',
      projections: [{ id: 'ent_b' }],
      searchDocs: [{ id: 'ent_b' }],
    });
    const written = writeReleaseCatalogArtifactsToDir(built, dir);
    const entities = JSON.parse(readFileSync(written.entitiesListFile, 'utf8')) as {
      entityCount: number;
    };
    const search = JSON.parse(readFileSync(written.searchIndexFile, 'utf8')) as {
      docCount: number;
    };
    assert.equal(entities.entityCount, 1);
    assert.equal(search.docCount, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('publicMediaObjectUrl builds the Supabase Storage HTTPS URL', () => {
  assert.equal(
    publicMediaObjectUrl('public/releases/rel_x/entities.json'),
    'https://twykhihqkcldpreuovay.supabase.co/storage/v1/object/public/public-media/public/releases/rel_x/entities.json',
  );
});

test('fetchReleaseSearchIndexArtifact returns remote artifact when fetch succeeds', async () => {
  const releaseId = 'rel_fetch_001';
  const artifact = {
    schemaVersion: 1 as const,
    releaseId,
    generatedAt: '2026-07-20T00:00:00.000Z',
    docCount: 1,
    docs: [{ id: 'ent_fetch_001', releaseId, displayName: 'Fetched' }],
  };
  const fetched = await fetchReleaseSearchIndexArtifact(releaseId, {
    allowLocalFallback: false,
    fetchImpl: async () =>
      new Response(JSON.stringify(artifact), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  });
  assert.deepEqual(fetched, artifact);
});
