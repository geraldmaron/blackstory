/**
 * Unit tests for the ADR-004 release-artifact read-through (repo-csw0).
 *
 * The safety properties matter more than the happy path: an unconfigured deployment must never
 * pick up an artifact, and an artifact from a different release must never be served — those are
 * what keep Postgres the system of record while catalogs come off the CDN.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicEntityProjectionDoc } from '@repo/schemas';
import {
  hasReleaseArtifactOrigin,
  loadEntityProjectionsFromArtifact,
  loadSearchIndexDocsFromArtifact,
} from './release-artifact-catalogs.js';

const RELEASE_ID = 'rel_seed_001';
const ORIGIN_ENV = {
  APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL: 'https://cdn.example.com/public-media',
} as const;

const sampleProjection: PublicEntityProjectionDoc = {
  id: 'ent_seed_place_001',
  releaseId: RELEASE_ID,
  kind: 'place',
  displayName: 'Seed Historical Place',
  nameLower: 'seed historical place',
  summary:
    'A historically documented Black community place in the District of Columbia area, tied to education ' +
    'and mutual-aid networks with published archival claims for learners and researchers.',
  claimIds: ['claim_seed_001'],
  topicTags: ['community', 'education'],
  topicIds: [],
  mentionedEntityIds: [],
  keywords: [],
  campaignIds: [],
  historicalContext:
    'Reconstruction-era Black communities organized schools and mutual aid networks.',
  eraBuckets: ['1860s'],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function entitiesArtifact(releaseId: string) {
  return {
    schemaVersion: 1,
    releaseId,
    generatedAt: '2026-01-01T00:00:00.000Z',
    entityCount: 1,
    entities: [sampleProjection],
  };
}

test('artifacts are not consulted at all without an explicit origin', async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return jsonResponse(entitiesArtifact(RELEASE_ID));
  };

  assert.equal(hasReleaseArtifactOrigin({}), false);
  assert.equal(hasReleaseArtifactOrigin({ APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL: '   ' }), false);

  const projections = await loadEntityProjectionsFromArtifact(RELEASE_ID, {
    env: {},
    fetchImpl,
  });
  assert.equal(projections, undefined, 'unconfigured deployment must fall through to Postgres');
  assert.equal(fetchCalls, 0, 'no artifact request may be issued without a configured origin');
});

test('a configured origin serves parsed projections from the artifact', async () => {
  const projections = await loadEntityProjectionsFromArtifact(RELEASE_ID, {
    env: ORIGIN_ENV,
    fetchImpl: async () => jsonResponse(entitiesArtifact(RELEASE_ID)),
  });
  assert.equal(projections?.length, 1);
  assert.equal(projections?.[0]?.id, sampleProjection.id);
});

test('an artifact for a different release is rejected, never served', async () => {
  const projections = await loadEntityProjectionsFromArtifact(RELEASE_ID, {
    env: ORIGIN_ENV,
    // Stale object left at the path after a new release activated.
    fetchImpl: async () => jsonResponse(entitiesArtifact('rel_previous_000')),
  });
  assert.equal(projections, undefined, 'release mismatch must fall through to bb_public');
});

test('a missing or failing artifact falls through rather than throwing', async () => {
  const notFound = await loadEntityProjectionsFromArtifact(RELEASE_ID, {
    env: ORIGIN_ENV,
    fetchImpl: async () => new Response('not found', { status: 404 }),
  });
  assert.equal(notFound, undefined);

  const network = await loadSearchIndexDocsFromArtifact(RELEASE_ID, {
    env: ORIGIN_ENV,
    fetchImpl: async () => {
      throw new Error('connection reset');
    },
  });
  assert.equal(network, undefined, 'a transport failure must degrade to Postgres, not 500');
});

test('an empty artifact is treated as a miss so the catalog is never blanked', async () => {
  const empty = await loadEntityProjectionsFromArtifact(RELEASE_ID, {
    env: ORIGIN_ENV,
    fetchImpl: async () =>
      jsonResponse({ ...entitiesArtifact(RELEASE_ID), entityCount: 0, entities: [] }),
  });
  assert.equal(empty, undefined);

  const unparseable = await loadEntityProjectionsFromArtifact(RELEASE_ID, {
    env: ORIGIN_ENV,
    fetchImpl: async () =>
      jsonResponse({ ...entitiesArtifact(RELEASE_ID), entities: [{ nope: true }] }),
  });
  assert.equal(unparseable, undefined, 'nothing parseable must not present as an empty catalog');
});
