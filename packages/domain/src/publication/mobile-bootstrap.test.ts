/**
 * Tests for the mobile bootstrap manifest generator (MOB-005): determinism, the release-stamp
 * contract (ADR-022 §4 staleness), the client-version floor (ADR-021 §2), and the `/v1/bootstrap`
 * pointer-shape projection that keeps this manifest compatible with the already-built endpoint.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildMobileBootstrapManifest,
  bootstrapManifestToJson,
  evaluateClientCompatibility,
  isReleaseStampStale,
  toReleasePointer,
  type BuildMobileBootstrapManifestInput,
  type MobileArtifactHashRef,
} from './mobile-bootstrap.js';
import { canonicalJson, sha256Json } from './index.js';

function hashRef(seed: string): MobileArtifactHashRef {
  return { path: `public/releases/x/${seed}.json`, hash: sha256Json({ seed }), byteLength: seed.length };
}

function sampleInput(overrides: Partial<BuildMobileBootstrapManifestInput> = {}): BuildMobileBootstrapManifestInput {
  return {
    releaseId: 'rel_2026_07_19_a',
    generatedAt: '2026-07-19T00:00:00.000Z',
    schemaRange: { min: 1, max: 1 },
    compatibility: {
      apiVersion: 'v1',
      minSupportedApiVersion: 'v1',
      deprecationWindowDays: 90,
      minSupportedAppBuild: 1000,
    },
    featureFlags: { search: true, corrections: false },
    legalVersions: { privacyPolicy: '2026-07-01', termsOfService: '2026-07-01' },
    artifactHashes: { 'map-source': hashRef('map'), 'search-index': hashRef('search') },
    cacheDirectives: {
      bootstrapMaxAgeSeconds: 60,
      bootstrapStaleWhileRevalidateSeconds: 600,
      releaseArtifactImmutableMaxAgeSeconds: 31_536_000,
    },
    searchIndexVersion: 'search-2026-07-19',
    ...overrides,
  };
}

test('determinism: same input yields a byte-identical manifest and stamp', () => {
  const a = buildMobileBootstrapManifest(sampleInput());
  const b = buildMobileBootstrapManifest(sampleInput());
  assert.equal(a.releaseStamp, b.releaseStamp);
  assert.equal(canonicalJson(bootstrapManifestToJson(a)), canonicalJson(bootstrapManifestToJson(b)));
});

test('release stamp is content-derived: it changes with release id and with content', () => {
  const base = buildMobileBootstrapManifest(sampleInput());
  const otherId = buildMobileBootstrapManifest(sampleInput({ releaseId: 'rel_2026_07_19_b' }));
  const otherContent = buildMobileBootstrapManifest(
    sampleInput({ featureFlags: { search: true, corrections: true } }),
  );
  assert.notEqual(base.releaseStamp, otherId.releaseStamp);
  assert.notEqual(base.releaseStamp, otherContent.releaseStamp);
  assert.ok(base.releaseStamp.startsWith('rel_2026_07_19_a@'));
});

test('stamp ignores wall-clock skew: identical content generated at the same generatedAt is identical', () => {
  // No Date.now() is read; the stamp depends only on declared content, not when generation ran.
  const first = buildMobileBootstrapManifest(sampleInput());
  const second = buildMobileBootstrapManifest(sampleInput());
  assert.equal(first.releaseStamp, second.releaseStamp);
});

test('ADR-022 staleness: a client stamp mismatch (or absence) is stale, a match is fresh', () => {
  const a = buildMobileBootstrapManifest(sampleInput({ releaseId: 'rel_a' }));
  const b = buildMobileBootstrapManifest(sampleInput({ releaseId: 'rel_b' }));
  assert.equal(isReleaseStampStale(undefined, a.releaseStamp), true);
  assert.equal(isReleaseStampStale(a.releaseStamp, b.releaseStamp), true);
  assert.equal(isReleaseStampStale(a.releaseStamp, a.releaseStamp), false);
});

test('toReleasePointer projects exactly the /v1/bootstrap pointer shape', () => {
  const manifest = buildMobileBootstrapManifest(sampleInput({ contentVersion: 'content-2026' }));
  const pointer = toReleasePointer(manifest);
  // Field-for-field the shape apps/api-public's handler reads (ReleasePointer / RevisionMetadataV1).
  assert.deepEqual(Object.keys(pointer).sort(), ['activeRelease', 'contentVersion', 'searchIndexVersion']);
  assert.deepEqual(Object.keys(pointer.activeRelease).sort(), ['generatedAt', 'recordUpdatedAt', 'releaseId']);
  assert.equal(pointer.activeRelease.releaseId, 'rel_2026_07_19_a');
  assert.ok(pointer.activeRelease.generatedAt.length <= 64);
  assert.ok(pointer.activeRelease.recordUpdatedAt.length <= 64);
  assert.equal(pointer.searchIndexVersion, 'search-2026-07-19');
  assert.equal(pointer.contentVersion, 'content-2026');
});

test('optional pointer fields are omitted (not null) when absent', () => {
  const manifest = buildMobileBootstrapManifest(
    sampleInput({ searchIndexVersion: undefined, contentVersion: undefined }),
  );
  const pointer = toReleasePointer(manifest);
  assert.deepEqual(Object.keys(pointer), ['activeRelease']);
});

test('ADR-021 client floor: below min app build or wrong api version is incompatible', () => {
  const manifest = buildMobileBootstrapManifest(sampleInput());
  assert.deepEqual(evaluateClientCompatibility(manifest, { appBuild: 999, apiVersion: 'v1' }), {
    ok: false,
    reason: 'app_build_below_floor',
  });
  assert.deepEqual(evaluateClientCompatibility(manifest, { appBuild: 1000, apiVersion: 'v0' }), {
    ok: false,
    reason: 'api_version_unsupported',
  });
  assert.deepEqual(evaluateClientCompatibility(manifest, { appBuild: 1000, apiVersion: 'v1' }), {
    ok: true,
  });
});

test('invalid inputs fail closed', () => {
  assert.throws(() => buildMobileBootstrapManifest(sampleInput({ releaseId: '../evil' })), /safe release/);
  assert.throws(() => buildMobileBootstrapManifest(sampleInput({ generatedAt: 'not-a-date' })), /ISO/);
  assert.throws(
    () => buildMobileBootstrapManifest(sampleInput({ schemaRange: { min: 3, max: 1 } })),
    /schemaRange/,
  );
});
