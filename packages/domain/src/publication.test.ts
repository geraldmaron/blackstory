/**
 * Unit tests for BB-019 immutable releases, signed manifests, snapshot layout,
 * lifecycle transitions, and public-read guards.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import {
  buildReleaseManifest,
  canTransitionRelease,
  canonicalJson,
  createPublicEntitySnapshot,
  createPublicationRelease,
  publicEntitySnapshotPath,
  publicReleaseMetadata,
  sha256Json,
  signReleaseManifest,
  verifySignedReleaseManifest,
  type PublicationRelease,
  type ReleaseStatus,
} from './publication/index.js';

const NOW = '2026-07-17T04:00:00.000Z';
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

function signedManifest() {
  const manifest = buildReleaseManifest({
    releaseId: 'release-001',
    generatedAt: NOW,
    searchIndexVersion: 'search-001',
    artifacts: [
      {
        entityId: 'entity-b',
        revision: 'revision-2',
        projection: { displayName: 'Beta', claimIds: ['claim-2'] },
        snapshot: { entity: { displayName: 'Beta' }, schemaVersion: 1 },
      },
      {
        entityId: 'entity-a',
        revision: 'revision-1',
        projection: { claimIds: ['claim-1'], displayName: 'Alpha' },
        snapshot: { schemaVersion: 1, entity: { displayName: 'Alpha' } },
      },
    ],
  });
  return signReleaseManifest(manifest, { keyId: 'publication-key-1', privateKey });
}

function release(status: ReleaseStatus = 'active'): PublicationRelease {
  return createPublicationRelease({
    id: 'release-001',
    status,
    signedManifest: signedManifest(),
    searchIndexVersion: 'search-001',
    createdAt: NOW,
    createdBy: 'publisher-1',
    ...(status === 'active' ? { activatedAt: NOW } : {}),
  });
}

test('canonical JSON and sha256 are stable across object insertion order', () => {
  const left = { beta: [2, 1], alpha: { z: true, a: null } };
  const right = { alpha: { a: null, z: true }, beta: [2, 1] };

  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.deepEqual(sha256Json(left), sha256Json(right));
  assert.match(sha256Json(left).digest, /^[a-f0-9]{64}$/);
});

test('manifest deterministically hashes projection and snapshot payloads', () => {
  const signed = signedManifest();
  assert.deepEqual(
    signed.manifest.entries.map((entry) => entry.entityId),
    ['entity-a', 'entity-b'],
  );
  assert.equal(
    signed.manifest.entries[0]?.projectionPath,
    'publicReleases/release-001/entities/entity-a',
  );
  assert.equal(
    signed.manifest.entries[0]?.snapshotPath,
    'public/releases/release-001/entities/entity-a.json',
  );
  assert.notEqual(
    signed.manifest.entries[0]?.projectionHash.digest,
    signed.manifest.entries[0]?.snapshotHash.digest,
  );
});

test('signed manifest verifies and tampering invalidates its content hash', () => {
  const signed = signedManifest();
  assert.equal(verifySignedReleaseManifest(signed, publicKey), true);

  const tampered = {
    ...signed,
    manifest: {
      ...signed.manifest,
      searchIndexVersion: 'search-tampered',
    },
  };
  assert.equal(verifySignedReleaseManifest(tampered, publicKey), false);
});

test('release record must agree with immutable signed manifest identity', () => {
  assert.throws(
    () =>
      createPublicationRelease({
        ...release(),
        id: 'different-release',
      }),
    /Release id must match/,
  );
  assert.throws(
    () =>
      createPublicationRelease({
        ...release(),
        searchIndexVersion: 'different-index',
      }),
    /Search-index version must match/,
  );
});

test('release lifecycle supports preview activation and historical rollback only', () => {
  assert.equal(canTransitionRelease('draft', 'preview'), true);
  assert.equal(canTransitionRelease('preview', 'active'), true);
  assert.equal(canTransitionRelease('active', 'superseded'), true);
  assert.equal(canTransitionRelease('active', 'rolled_back'), true);
  assert.equal(canTransitionRelease('superseded', 'active'), true);
  assert.equal(canTransitionRelease('rolled_back', 'active'), true);
  assert.equal(canTransitionRelease('draft', 'active'), false);
  assert.equal(canTransitionRelease('preview', 'rolled_back'), false);
});

test('public metadata and snapshots refuse every non-active release', () => {
  for (const status of ['draft', 'preview', 'superseded', 'rolled_back'] as const) {
    assert.throws(() => publicReleaseMetadata(release(status), 'revision-1'), /not active/);
    assert.throws(
      () => createPublicEntitySnapshot(release(status), 'revision-1', { id: 'entity-a' }),
      /not active/,
    );
  }
});

test('public snapshot carries release, revision, manifest, and search-index metadata', () => {
  const snapshot = createPublicEntitySnapshot(release(), 'revision-1', {
    id: 'entity-a',
    displayName: 'Alpha',
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.metadata.releaseId, 'release-001');
  assert.equal(snapshot.metadata.revision, 'revision-1');
  assert.equal(snapshot.metadata.searchIndexVersion, 'search-001');
  assert.match(snapshot.metadata.manifestHash, /^[a-f0-9]{64}$/);
  assert.equal(
    publicEntitySnapshotPath('release-001', 'entity-a'),
    snapshot.metadata.releaseId ? 'public/releases/release-001/entities/entity-a.json' : '',
  );
});

test('snapshot paths reject traversal and manifest entity ids are unique', () => {
  assert.throws(() => publicEntitySnapshotPath('../draft', 'entity-a'), /safe storage path/);
  assert.throws(
    () =>
      buildReleaseManifest({
        releaseId: 'release-001',
        generatedAt: NOW,
        searchIndexVersion: 'search-001',
        artifacts: [
          { entityId: 'duplicate', revision: '1', projection: {}, snapshot: {} },
          { entityId: 'duplicate', revision: '2', projection: {}, snapshot: {} },
        ],
      }),
    /Duplicate manifest entity/,
  );
});
