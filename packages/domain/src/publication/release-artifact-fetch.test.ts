import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  fetchReleaseEntitiesListArtifact,
  fetchReleaseSearchIndexArtifact,
} from './release-artifact-fetch.js';

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

test('default artifact fetch timeout is 60s so a 13.8 MB GET is not a miss', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./release-artifact-fetch.ts', import.meta.url)),
    'utf8',
  );
  assert.match(source, /timeoutMs = options\.timeoutMs \?\? 60_000/);
  assert.match(source, /cache: 'force-cache'/);
});

test('a fetched artifact origin is used without an implicit public-media fallback', async () => {
  let called = false;
  const result = await fetchReleaseSearchIndexArtifact('rel_001', {
    env: {} as NodeJS.ProcessEnv,
    fetchImpl: async () => {
      called = true;
      return new Response(
        JSON.stringify({ releaseId: 'rel_001', generatedAt: 'x', docCount: 0, docs: [] }),
      );
    },
  });
  assert.equal(result, undefined);
  assert.equal(called, false, 'no origin configured must never fall back to a default CDN URL');
});
