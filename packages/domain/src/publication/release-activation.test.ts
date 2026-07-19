/**
 * Release-activation state-machine tests (MOB-005). Covers determinism, the atomic single-pointer
 * activation transaction, fail-closed rejection of corrupted/missing artifacts, crash-mid-flight
 * safety, concurrent/duplicate activation, the rollback drill, schema-migration rollback guard,
 * retention/GC protection of active + rollback releases, the bounded-point size/gzip budget, and —
 * critically — that map redaction stays transitive from raw input all the way to the generated
 * artifact (using the REAL `redactLocationForPublic`, not a stub).
 *
 * `@repo/security` is a devDependency for this test only (same pattern as
 * `map/map-source.redaction.test.ts`); shipped release code never imports it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactLocationForPublic } from '@repo/security/redaction';
import {
  DECEASED_RESIDENCE_FIXTURE,
  INSTITUTION_ATLANTA_GA_SENSITIVE_FIXTURE,
  LIVING_PERSON_RESIDENCE_FIXTURE,
  MAP_SOURCE_DEMO_FIXTURES,
  PLACE_HARLEM_NY_FIXTURE,
} from '../map/fixtures.js';
import type { MapSourceEntityInput } from '../map/map-source.js';
import {
  activateRelease,
  collectGarbage,
  createInMemoryReleaseStore,
  generateReleaseArtifacts,
  rollbackTo,
  validateGeneratedArtifacts,
  ReleaseActivationError,
  type GeneratedRelease,
  type GenerateReleaseArtifactsInput,
  type ReleaseStore,
} from './release-activation.js';

const BOOTSTRAP = {
  schemaRange: { min: 1, max: 1 },
  compatibility: {
    apiVersion: 'v1',
    minSupportedApiVersion: 'v1',
    deprecationWindowDays: 90,
    minSupportedAppBuild: 1000,
  },
  featureFlags: { search: true },
  legalVersions: { privacyPolicy: '2026-07-01', termsOfService: '2026-07-01' },
  cacheDirectives: {
    bootstrapMaxAgeSeconds: 60,
    bootstrapStaleWhileRevalidateSeconds: 600,
    releaseArtifactImmutableMaxAgeSeconds: 31_536_000,
  },
} as const;

function input(
  releaseId: string,
  overrides: Partial<GenerateReleaseArtifactsInput> = {},
): GenerateReleaseArtifactsInput {
  return {
    releaseId,
    generatedAt: '2026-07-19T00:00:00.000Z',
    mapEntities: [PLACE_HARLEM_NY_FIXTURE, INSTITUTION_ATLANTA_GA_SENSITIVE_FIXTURE, DECEASED_RESIDENCE_FIXTURE],
    redactLocation: redactLocationForPublic,
    contentIndex: [{ id: 'story-1', kind: 'story', title: 'A Story', version: 'v1' }],
    entitiesList: { schemaVersion: 1, entities: [{ id: 'ent_a', displayName: 'A' }] },
    searchIndex: { schemaVersion: 1, docs: [{ id: 'ent_a', nameLower: 'a' }] },
    bootstrap: BOOTSTRAP,
    ...overrides,
  };
}

function hashesByKind(release: GeneratedRelease): Record<string, string> {
  return Object.fromEntries(release.artifacts.map((a) => [a.kind, a.hash.digest]));
}

// ---------------------------------------------------------------------------

test('determinism: generating twice from the same input is byte-identical', () => {
  const a = generateReleaseArtifacts(input('rel_det'));
  const b = generateReleaseArtifacts(input('rel_det'));
  assert.equal(a.manifest.releaseStamp, b.manifest.releaseStamp);
  assert.deepEqual(hashesByKind(a), hashesByKind(b));
  assert.equal(a.artifacts.length, b.artifacts.length);
});

test('activation transaction: one pointer flip after all artifacts persist', () => {
  const store = createInMemoryReleaseStore();
  const gen = generateReleaseArtifacts(input('rel_a'));
  const result = activateRelease(store, gen);

  assert.equal(result.pointer.activeReleaseId, 'rel_a');
  assert.equal(result.pointer.pointerVersion, 1);
  assert.equal(result.releaseStamp, gen.manifest.releaseStamp);
  // Every generated artifact is now in the store, content-addressed.
  for (const artifact of gen.artifacts) {
    assert.equal(store.getArtifact(artifact.path)?.hash.digest, artifact.hash.digest);
  }
});

test('corrupted artifact is rejected before activation; previous pointer untouched', () => {
  const store = createInMemoryReleaseStore();
  const good = generateReleaseArtifacts(input('rel_good'));
  activateRelease(store, good);
  const before = store.getPointer();

  // Tamper one artifact's content while keeping its declared hash (a corrupted/hash-mismatched artifact).
  const bad = generateReleaseArtifacts(input('rel_bad'));
  const tampered: GeneratedRelease = {
    ...bad,
    artifacts: bad.artifacts.map((a, i) =>
      i === 0 ? { ...a, json: { tampered: true } } : a,
    ),
  };
  assert.throws(
    () => activateRelease(store, tampered),
    (e: unknown) => e instanceof ReleaseActivationError && e.code === 'RELEASE_VALIDATION',
  );
  // Pointer is exactly what it was; the corrupt release never activated.
  assert.deepEqual(store.getPointer(), before);
});

test('missing artifact referenced by the manifest fails validation closed', () => {
  const gen = generateReleaseArtifacts(input('rel_missing'));
  // Drop the search-index artifact the manifest still references.
  const broken: GeneratedRelease = {
    ...gen,
    artifacts: gen.artifacts.filter((a) => a.kind !== 'search-index'),
  };
  assert.throws(
    () => validateGeneratedArtifacts(broken),
    (e: unknown) => e instanceof ReleaseActivationError && e.code === 'MISSING_ARTIFACT',
  );
});

test('crash mid-persistence leaves the previously-active release fully valid and active', () => {
  const base = createInMemoryReleaseStore();
  const a = generateReleaseArtifacts(input('rel_a'));
  activateRelease(base, a);
  const pointerBefore = base.getPointer();

  // Wrap the store so persistence of the 3rd artifact throws — simulating a crash mid-generation.
  let writes = 0;
  const crashing: ReleaseStore = {
    ...base,
    putArtifact(artifact) {
      writes += 1;
      if (writes === 3) throw new Error('simulated crash writing artifact');
      base.putArtifact(artifact);
    },
    flipPointer(next, expected) {
      base.flipPointer(next, expected);
    },
    getPointer: () => base.getPointer(),
  };
  const b = generateReleaseArtifacts(input('rel_b'));
  assert.throws(() => activateRelease(crashing, b), /simulated crash/);

  // The pointer never moved; A is still active and every A artifact still validates against its manifest.
  assert.deepEqual(base.getPointer(), pointerBefore);
  assert.equal(base.getPointer()?.activeReleaseId, 'rel_a');
  const storedA = base.getRelease('rel_a');
  assert.ok(storedA);
  for (const [, ref] of Object.entries(storedA.manifest.artifactHashes)) {
    assert.equal(base.getArtifact(ref.path)?.hash.digest, ref.hash.digest);
  }
});

test('concurrent/duplicate activation: only one wins cleanly', () => {
  const store = createInMemoryReleaseStore();
  const a = generateReleaseArtifacts(input('rel_a'));
  const b = generateReleaseArtifacts(input('rel_b'));

  // Both activations race off pointer version 0.
  const first = activateRelease(store, a, { expectedPointerVersion: 0 });
  assert.equal(first.pointer.pointerVersion, 1);

  assert.throws(
    () => activateRelease(store, b, { expectedPointerVersion: 0 }),
    (e: unknown) => e instanceof ReleaseActivationError && e.code === 'CONCURRENT_ACTIVATION',
  );
  // The winner is still active and consistent; a fresh activation off the new version succeeds.
  assert.equal(store.getPointer()?.activeReleaseId, 'rel_a');
  const second = activateRelease(store, b);
  assert.equal(second.pointer.activeReleaseId, 'rel_b');
  assert.equal(second.pointer.pointerVersion, 2);
});

test('immutability: re-activating a release id with different content is refused', () => {
  const store = createInMemoryReleaseStore();
  activateRelease(store, generateReleaseArtifacts(input('rel_x')));
  // Same id, different content (different feature flags -> different bootstrap, but same paths).
  const conflicting = generateReleaseArtifacts(
    input('rel_x', { contentIndex: [{ id: 'other', kind: 'story', title: 'Other', version: 'v9' }] }),
  );
  assert.throws(
    () => activateRelease(store, conflicting, { expectedPointerVersion: 1 }),
    (e: unknown) => e instanceof ReleaseActivationError && e.code === 'IMMUTABLE_ARTIFACT_VIOLATION',
  );
});

test('rollback drill: A then B, roll back to A restores every artifact hash exactly (not a mix)', () => {
  const store = createInMemoryReleaseStore();
  const a = generateReleaseArtifacts(input('rel_a'));
  const b = generateReleaseArtifacts(input('rel_b'));
  activateRelease(store, a);
  activateRelease(store, b);
  assert.equal(store.getPointer()?.activeReleaseId, 'rel_b');

  const rolled = rollbackTo(store, 'rel_a');
  assert.equal(rolled.pointer.activeReleaseId, 'rel_a');
  assert.equal(rolled.releaseStamp, a.manifest.releaseStamp);

  // Bootstrap manifest + every referenced artifact hash matches release A exactly.
  const storedA = store.getRelease('rel_a');
  assert.deepEqual(storedA?.manifest.artifactHashes, a.manifest.artifactHashes);
  for (const artifact of a.artifacts) {
    assert.equal(store.getArtifact(artifact.path)?.hash.digest, artifact.hash.digest);
  }
});

test('rollback after schema migration is refused when the target schema range is incompatible', () => {
  const store = createInMemoryReleaseStore();
  activateRelease(store, generateReleaseArtifacts(input('rel_a'))); // schemaRange {1,1}
  activateRelease(store, generateReleaseArtifacts(input('rel_b')));

  assert.throws(
    () => rollbackTo(store, 'rel_a', { platformSchemaVersion: 2 }),
    (e: unknown) => e instanceof ReleaseActivationError && e.code === 'ROLLBACK_SCHEMA_INCOMPATIBLE',
  );
  // A rollback within the covered schema range still works.
  const ok = rollbackTo(store, 'rel_a', { platformSchemaVersion: 1 });
  assert.equal(ok.pointer.activeReleaseId, 'rel_a');
});

test('retention/GC never deletes the active or rollback-target release', () => {
  const store = createInMemoryReleaseStore();
  activateRelease(store, generateReleaseArtifacts(input('rel_a')));
  activateRelease(store, generateReleaseArtifacts(input('rel_b')));
  activateRelease(store, generateReleaseArtifacts(input('rel_c')));

  const gc = collectGarbage(store);
  assert.deepEqual([...gc.deleted], ['rel_a']); // active=C, previous=B are protected
  assert.equal(store.getRelease('rel_a'), undefined);
  assert.ok(store.getRelease('rel_b'));
  assert.ok(store.getRelease('rel_c'));

  // Rollback to the still-present previous release works.
  assert.equal(rollbackTo(store, 'rel_b').pointer.activeReleaseId, 'rel_b');

  // Rollback to a GC'd release fails closed.
  assert.throws(
    () => rollbackTo(store, 'rel_a'),
    (e: unknown) => e instanceof ReleaseActivationError && e.code === 'MISSING_RELEASE',
  );
});

test('the store structurally refuses to delete the active or previous release', () => {
  const store = createInMemoryReleaseStore();
  activateRelease(store, generateReleaseArtifacts(input('rel_a')));
  activateRelease(store, generateReleaseArtifacts(input('rel_b')));
  assert.throws(
    () => store.deleteRelease('rel_b'),
    (e: unknown) => e instanceof ReleaseActivationError && e.code === 'PROTECTED_RELEASE',
  );
  assert.throws(
    () => store.deleteRelease('rel_a'),
    (e: unknown) => e instanceof ReleaseActivationError && e.code === 'PROTECTED_RELEASE',
  );
});

test('oversized bounded-point flat GeoJSON is rejected by the size/gzip budget', () => {
  const many: MapSourceEntityInput[] = [];
  for (let i = 0; i < 500; i += 1) {
    many.push({ ...PLACE_HARLEM_NY_FIXTURE, entityId: `ent_bulk_${i}` });
  }
  assert.throws(
    () => generateReleaseArtifacts(input('rel_big', { mapEntities: many, budget: { maxBytes: 200, maxGzipBytes: 200 } })),
    (e: unknown) => e instanceof ReleaseActivationError && e.code === 'BUDGET_EXCEEDED',
  );
  // Under a generous budget the same input generates fine.
  const ok = generateReleaseArtifacts(input('rel_big', { mapEntities: many }));
  assert.ok(ok.sizeReport.find((s) => s.kind === 'bounded-points'));
});

test('CRITICAL: map redaction stays transitive from raw input to the generated artifact', () => {
  const raw = LIVING_PERSON_RESIDENCE_FIXTURE.location;
  assert.ok(raw?.lat !== undefined && raw.lng !== undefined);

  const gen = generateReleaseArtifacts(
    input('rel_redaction', { mapEntities: [LIVING_PERSON_RESIDENCE_FIXTURE, ...MAP_SOURCE_DEMO_FIXTURES] }),
  );

  const mapArtifact = gen.artifacts.find((a) => a.kind === 'map-source');
  const boundedArtifact = gen.artifacts.find((a) => a.kind === 'bounded-points');
  assert.ok(mapArtifact && boundedArtifact);

  // The raw residential coordinate and street-address label must not appear in ANY output artifact.
  for (const artifact of gen.artifacts) {
    const serialized = artifact.canonical;
    assert.doesNotMatch(serialized, new RegExp(String(raw.lat)), `${artifact.kind} leaked raw lat`);
    assert.doesNotMatch(serialized, new RegExp(String(raw.lng)), `${artifact.kind} leaked raw lng`);
    assert.doesNotMatch(serialized, /Bayou Street/, `${artifact.kind} leaked raw address label`);
  }

  // The entity still appears, but only at the coarsened city-level coordinate the constitution allows.
  const feature = (mapArtifact.json as { featureCollection: { features: { id: string; geometry: { coordinates: [number, number] } }[] } })
    .featureCollection.features.find((f) => f.id === LIVING_PERSON_RESIDENCE_FIXTURE.entityId);
  assert.ok(feature, 'living-person entity should appear at reduced precision, not be dropped');
  assert.deepEqual(feature.geometry.coordinates, [-95.37, 29.76]);

  const boundedPoint = (boundedArtifact.json as { features: { id: string; c: [number, number] }[] })
    .features.find((f) => f.id === LIVING_PERSON_RESIDENCE_FIXTURE.entityId);
  assert.ok(boundedPoint);
  assert.deepEqual(boundedPoint.c, [-95.37, 29.76]);
});
