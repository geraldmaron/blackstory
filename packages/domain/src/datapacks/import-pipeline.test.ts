/**
 * Unit tests for the Data Pack v1 import pipeline (the related workstream): a full valid-pack round trip
 * that passes every stage, and a pack with one bad resource that gets quarantined while the rest
 * of the batch is unaffected. See ./import-pipeline.ts's header for the staged-flow contract.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { sha256Bytes, sha256Json } from '../publication/index.js';
import {
  DATA_PACK_SCHEMA_VERSION,
  signDataPackManifest,
  type DataPackManifest,
} from './manifest.js';
import type { DataPackClaimRecord, DataPackEntityRecord } from './records.js';
import { runDataPackImportPipeline, type DataPackResourcePayload } from './import-pipeline.js';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const BUDGET = { maxResources: 10, maxTotalBytes: 100_000, maxRecordsPerResource: 1_000 };

function baseManifest(overrides: Partial<DataPackManifest> = {}): DataPackManifest {
  return {
    schemaVersion: DATA_PACK_SCHEMA_VERSION,
    datasetId: 'example-dataset',
    datasetVersion: '2026.1',
    publisher: { name: 'Example Publisher' },
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    issuedAt: '2026-07-01T00:00:00.000Z',
    modifiedAt: '2026-07-01T00:00:00.000Z',
    updateCadence: 'annual',
    resources: [],
    ...overrides,
  };
}

test('a full valid pack passes every stage and is accepted', () => {
  const entities: readonly DataPackEntityRecord[] = [
    { externalId: 'ent-1', title: 'Example Site', topicIds: ['church'] },
  ];
  const claims: readonly DataPackClaimRecord[] = [
    {
      externalId: 'claim-1',
      subjectExternalId: 'ent-1',
      predicate: 'founded_year',
      object: '1900',
    },
  ];

  const manifest = baseManifest({
    resources: [
      {
        name: 'entities',
        path: 'entities.json',
        kind: 'entities',
        sha256: sha256Json(entities),
        byteSize: 10,
        recordCount: entities.length,
      },
      {
        name: 'claims',
        path: 'claims.json',
        kind: 'claims',
        sha256: sha256Json(claims),
        byteSize: 10,
        recordCount: claims.length,
      },
    ],
  });
  const signedManifest = signDataPackManifest(manifest, {
    keyId: 'datapack-key-1',
    publicKeyId: 'datapack-key-1',
    privateKey,
  });

  const resources: readonly DataPackResourcePayload[] = [
    {
      entry: manifest.resources[0]!,
      records: entities,
      checksumSource: { kind: 'json', value: entities },
    },
    {
      entry: manifest.resources[1]!,
      records: claims,
      checksumSource: { kind: 'json', value: claims },
    },
  ];

  const result = runDataPackImportPipeline({
    signedManifest,
    publicKey,
    budget: BUDGET,
    resources,
  });

  assert.equal(result.manifestOutcome, 'accepted');
  assert.deepEqual(result.manifestFindings, []);
  assert.equal(result.resources.length, 2);
  for (const resource of result.resources) {
    assert.equal(resource.outcome, 'accepted');
    assert.deepEqual(resource.findings, []);
  }
  assert.deepEqual(result.resources[0]!.namespacedIds, [
    { namespace: 'example-dataset', externalId: 'ent-1' },
  ]);
});

test('checksum mismatch is surfaced as a per-resource finding and quarantines only that resource', () => {
  const goodEntities: readonly DataPackEntityRecord[] = [{ externalId: 'ent-1', title: 'Good' }];
  const badEntities: readonly DataPackEntityRecord[] = [{ externalId: 'ent-2', title: 'Bad' }];

  const manifest = baseManifest({
    resources: [
      {
        name: 'good-entities',
        path: 'good.json',
        kind: 'entities',
        sha256: sha256Json(goodEntities),
        byteSize: 10,
      },
      {
        name: 'bad-entities',
        path: 'bad.json',
        kind: 'entities',
        // Declares a checksum that will not match the actual payload below.
        sha256: sha256Bytes('not-the-real-payload'),
        byteSize: 10,
      },
    ],
  });
  const signedManifest = signDataPackManifest(manifest, {
    keyId: 'datapack-key-1',
    publicKeyId: 'datapack-key-1',
    privateKey,
  });

  const resources: readonly DataPackResourcePayload[] = [
    {
      entry: manifest.resources[0]!,
      records: goodEntities,
      checksumSource: { kind: 'json', value: goodEntities },
    },
    {
      entry: manifest.resources[1]!,
      records: badEntities,
      checksumSource: { kind: 'json', value: badEntities },
    },
  ];

  const result = runDataPackImportPipeline({
    signedManifest,
    publicKey,
    budget: BUDGET,
    resources,
  });

  assert.equal(result.manifestOutcome, 'accepted');
  const good = result.resources.find((resource) => resource.resourceName === 'good-entities')!;
  const bad = result.resources.find((resource) => resource.resourceName === 'bad-entities')!;
  assert.equal(good.outcome, 'accepted');
  assert.equal(bad.outcome, 'quarantined');
  assert.equal(
    bad.findings.some((finding) => finding.stage === 'checksum'),
    true,
  );
});

test('one resource with shape/vocabulary/reference failures is quarantined without blocking the rest of the batch', () => {
  const goodEntities: readonly DataPackEntityRecord[] = [{ externalId: 'ent-1', title: 'Good' }];
  const badClaims: readonly DataPackClaimRecord[] = [
    // Missing predicate/object (shape failure), bad topic id (vocabulary failure), and a
    // subjectExternalId that resolves nowhere in the pack (reference-resolution failure).
    {
      externalId: 'claim-bad',
      subjectExternalId: 'does-not-exist',
      topicIds: ['not-a-real-topic'],
    },
  ];

  const manifest = baseManifest({
    resources: [
      {
        name: 'entities',
        path: 'entities.json',
        kind: 'entities',
        sha256: sha256Json(goodEntities),
        byteSize: 10,
      },
      {
        name: 'claims',
        path: 'claims.json',
        kind: 'claims',
        sha256: sha256Json(badClaims),
        byteSize: 10,
      },
    ],
  });
  const signedManifest = signDataPackManifest(manifest, {
    keyId: 'datapack-key-1',
    publicKeyId: 'datapack-key-1',
    privateKey,
  });

  const resources: readonly DataPackResourcePayload[] = [
    {
      entry: manifest.resources[0]!,
      records: goodEntities,
      checksumSource: { kind: 'json', value: goodEntities },
    },
    {
      entry: manifest.resources[1]!,
      records: badClaims,
      checksumSource: { kind: 'json', value: badClaims },
    },
  ];

  const result = runDataPackImportPipeline({
    signedManifest,
    publicKey,
    budget: BUDGET,
    resources,
  });

  assert.equal(result.manifestOutcome, 'accepted');
  const entitiesResult = result.resources.find((resource) => resource.resourceName === 'entities')!;
  const claimsResult = result.resources.find((resource) => resource.resourceName === 'claims')!;
  assert.equal(entitiesResult.outcome, 'accepted');
  assert.equal(claimsResult.outcome, 'quarantined');

  const stages = claimsResult.findings.map((finding) => finding.stage).sort();
  assert.deepEqual(stages, ['reference-resolution', 'shape', 'shape', 'vocabulary'].sort());
});

test('signature verification failure rejects the whole batch and quarantines every resource', () => {
  const entities: readonly DataPackEntityRecord[] = [{ externalId: 'ent-1', title: 'Example' }];
  const manifest = baseManifest({
    resources: [
      {
        name: 'entities',
        path: 'entities.json',
        kind: 'entities',
        sha256: sha256Json(entities),
        byteSize: 10,
      },
    ],
  });
  const signedManifest = signDataPackManifest(manifest, {
    keyId: 'datapack-key-1',
    publicKeyId: 'datapack-key-1',
    privateKey,
  });
  const tampered = {
    ...signedManifest,
    manifest: { ...signedManifest.manifest, datasetVersion: 'tampered' },
  };

  const resources: readonly DataPackResourcePayload[] = [
    {
      entry: manifest.resources[0]!,
      records: entities,
      checksumSource: { kind: 'json', value: entities },
    },
  ];

  const result = runDataPackImportPipeline({
    signedManifest: tampered,
    publicKey,
    budget: BUDGET,
    resources,
  });

  assert.equal(result.manifestOutcome, 'rejected');
  assert.equal(
    result.manifestFindings.some((finding) => finding.stage === 'signature'),
    true,
  );
  assert.equal(result.resources[0]!.outcome, 'quarantined');
});

test('budget rejection at the pipeline level rejects the whole batch', () => {
  const entities: readonly DataPackEntityRecord[] = [{ externalId: 'ent-1', title: 'Example' }];
  const manifest = baseManifest({
    resources: [
      {
        name: 'entities',
        path: 'entities.json',
        kind: 'entities',
        sha256: sha256Json(entities),
        byteSize: 10,
      },
    ],
  });
  const signedManifest = signDataPackManifest(manifest, {
    keyId: 'datapack-key-1',
    publicKeyId: 'datapack-key-1',
    privateKey,
  });
  const resources: readonly DataPackResourcePayload[] = [
    {
      entry: manifest.resources[0]!,
      records: entities,
      checksumSource: { kind: 'json', value: entities },
    },
  ];

  const result = runDataPackImportPipeline({
    signedManifest,
    publicKey,
    budget: { maxResources: 10, maxTotalBytes: 1 },
    resources,
  });

  assert.equal(result.manifestOutcome, 'rejected');
  assert.equal(
    result.manifestFindings.some((finding) => finding.stage === 'budget'),
    true,
  );
  assert.equal(result.resources[0]!.outcome, 'quarantined');
});

test('license rejection at the pipeline level rejects the whole batch', () => {
  const entities: readonly DataPackEntityRecord[] = [{ externalId: 'ent-1', title: 'Example' }];
  const manifest = baseManifest({
    license: { name: 'unknown terms', verdict: 'unverified' },
    resources: [
      {
        name: 'entities',
        path: 'entities.json',
        kind: 'entities',
        sha256: sha256Json(entities),
        byteSize: 10,
      },
    ],
  });
  const signedManifest = signDataPackManifest(manifest, {
    keyId: 'datapack-key-1',
    publicKeyId: 'datapack-key-1',
    privateKey,
  });
  const resources: readonly DataPackResourcePayload[] = [
    {
      entry: manifest.resources[0]!,
      records: entities,
      checksumSource: { kind: 'json', value: entities },
    },
  ];

  const result = runDataPackImportPipeline({
    signedManifest,
    publicKey,
    budget: BUDGET,
    resources,
  });

  assert.equal(result.manifestOutcome, 'rejected');
  assert.equal(
    result.manifestFindings.some((finding) => finding.stage === 'license'),
    true,
  );
  assert.equal(result.resources[0]!.outcome, 'quarantined');
});
