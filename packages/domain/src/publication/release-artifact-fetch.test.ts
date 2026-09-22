import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  __resetReleaseArtifactMemoForTests,
  fetchReleaseEntitiesListArtifact,
  fetchReleaseSearchIndexArtifact,
  type ArtifactFetchInit,
} from './release-artifact-fetch.js';

const ORIGIN_ENV = {
  APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL: 'https://static.example.test',
} as unknown as NodeJS.ProcessEnv;

function entitiesBody(entityCount: number) {
  return JSON.stringify({
    releaseId: 'rel_001',
    generatedAt: '2026-07-21T00:00:00.000Z',
    entityCount,
    entities: Array.from({ length: entityCount }, (_, i) => ({ id: `ent_${i}` })),
  });
}

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
  // Never `force-cache` again: Next's data cache cannot hold these bodies, so that setting only
  // logged a warning per fetch while every instance re-downloaded the artifact (repo-ogo3j.2).
  assert.match(source, /cache: 'no-store'/);
  assert.doesNotMatch(source, /cache: 'force-cache'/);
});

test('an artifact GET asks for compression and refreshes by conditional GET', async () => {
  __resetReleaseArtifactMemoForTests();
  const inits: ArtifactFetchInit[] = [];
  let served = 0;
  const fetchImpl = async (_url: string, init?: ArtifactFetchInit) => {
    inits.push(init ?? {});
    const ifNoneMatch = init?.headers?.['if-none-match'];
    if (ifNoneMatch === '"v1"') {
      return new Response(null, { status: 304 });
    }
    served += 1;
    return new Response(entitiesBody(2), { status: 200, headers: { etag: '"v1"' } });
  };

  const first = await fetchReleaseEntitiesListArtifact('rel_001', { env: ORIGIN_ENV, fetchImpl });
  assert.equal(first?.entityCount, 2);
  assert.equal(inits[0]?.headers?.['accept-encoding'], 'br, gzip');
  assert.equal(inits[0]?.headers?.['if-none-match'], undefined, 'nothing to validate yet');
  assert.equal(inits[0]?.cache, 'no-store');

  const second = await fetchReleaseEntitiesListArtifact('rel_001', { env: ORIGIN_ENV, fetchImpl });
  assert.equal(inits[1]?.headers?.['if-none-match'], '"v1"');
  assert.equal(served, 1, 'the second read must be answered by the 304, not a download');
  assert.equal(second?.entityCount, 2, 'a 304 returns the remembered artifact');
  assert.equal(second, first, 'and it is the same parsed object, not a re-parse');
});

test('a changed ETag is a full download that replaces the remembered artifact', async () => {
  __resetReleaseArtifactMemoForTests();
  let version = 1;
  const fetchImpl = async (_url: string, init?: ArtifactFetchInit) => {
    const ifNoneMatch = init?.headers?.['if-none-match'];
    if (ifNoneMatch === `"v${version}"`) return new Response(null, { status: 304 });
    return new Response(entitiesBody(version), {
      status: 200,
      headers: { etag: `"v${version}"` },
    });
  };
  const v1 = await fetchReleaseEntitiesListArtifact('rel_001', { env: ORIGIN_ENV, fetchImpl });
  assert.equal(v1?.entityCount, 1);
  // The publisher rewrites the object in place (a correction under the same release id).
  version = 2;
  const v2 = await fetchReleaseEntitiesListArtifact('rel_001', { env: ORIGIN_ENV, fetchImpl });
  assert.equal(v2?.entityCount, 2, 'the stale ETag is rejected and the new body downloaded');
  const again = await fetchReleaseEntitiesListArtifact('rel_001', { env: ORIGIN_ENV, fetchImpl });
  assert.equal(again, v2, 'and the new ETag is what the next refresh validates against');
});

test('a 304 with nothing remembered is a miss, never an empty artifact', async () => {
  __resetReleaseArtifactMemoForTests();
  const result = await fetchReleaseEntitiesListArtifact('rel_001', {
    env: ORIGIN_ENV,
    fetchImpl: async () => new Response(null, { status: 304 }),
  });
  assert.equal(result, undefined);
});

test('a response without an ETag is used but not remembered', async () => {
  __resetReleaseArtifactMemoForTests();
  const inits: ArtifactFetchInit[] = [];
  const fetchImpl = async (_url: string, init?: ArtifactFetchInit) => {
    inits.push(init ?? {});
    return new Response(entitiesBody(1), { status: 200 });
  };
  await fetchReleaseEntitiesListArtifact('rel_001', { env: ORIGIN_ENV, fetchImpl });
  await fetchReleaseEntitiesListArtifact('rel_001', { env: ORIGIN_ENV, fetchImpl });
  assert.equal(inits[1]?.headers?.['if-none-match'], undefined);
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
