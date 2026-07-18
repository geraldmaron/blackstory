/**
 * Unit tests for the Data Pack v1 manifest contract (black-book-ud5q): shape validation, deterministic
 * signing, and signature verification (valid + tampered). See ./manifest.ts's header for the
 * design rationale.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { sha256Bytes } from '../publication/index.js';
import {
  DATA_PACK_SCHEMA_VERSION,
  assertDataPackManifestShapeValid,
  isDataPackResourceKind,
  signDataPackManifest,
  verifySignedDataPackManifest,
  type DataPackManifest,
} from './manifest.js';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const OTHER_KEYS = generateKeyPairSync('ec', { namedCurve: 'P-256' });

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
    resources: [
      {
        name: 'entities',
        path: 'entities.json',
        kind: 'entities',
        sha256: sha256Bytes('[]'),
        byteSize: 2,
        recordCount: 0,
      },
    ],
    ...overrides,
  };
}

test('isDataPackResourceKind recognizes only the seven declared kinds', () => {
  assert.equal(isDataPackResourceKind('entities'), true);
  assert.equal(isDataPackResourceKind('claims'), true);
  assert.equal(isDataPackResourceKind('nonsense'), false);
});

test('assertDataPackManifestShapeValid accepts a well-formed manifest', () => {
  assert.doesNotThrow(() => assertDataPackManifestShapeValid(baseManifest()));
});

test('assertDataPackManifestShapeValid rejects an empty resources array', () => {
  assert.throws(() => assertDataPackManifestShapeValid(baseManifest({ resources: [] })), /non-empty/);
});

test('assertDataPackManifestShapeValid rejects duplicate resource names', () => {
  const manifest = baseManifest();
  assert.throws(
    () =>
      assertDataPackManifestShapeValid(
        baseManifest({ resources: [...manifest.resources, ...manifest.resources] }),
      ),
    /Duplicate resource name/,
  );
});

test('assertDataPackManifestShapeValid rejects an unknown license verdict', () => {
  assert.throws(
    () =>
      assertDataPackManifestShapeValid(
        baseManifest({
          license: { name: 'nonsense', verdict: 'not-a-real-verdict' as never },
        }),
      ),
    /Unknown license verdict/,
  );
});

test('signDataPackManifest + verifySignedDataPackManifest round-trip on a valid signature', () => {
  const signed = signDataPackManifest(baseManifest(), {
    keyId: 'datapack-key-1',
    publicKeyId: 'datapack-key-1',
    privateKey,
  });
  assert.equal(verifySignedDataPackManifest(signed, publicKey), true);
});

test('verifySignedDataPackManifest rejects a tampered manifest payload', () => {
  const signed = signDataPackManifest(baseManifest(), {
    keyId: 'datapack-key-1',
    publicKeyId: 'datapack-key-1',
    privateKey,
  });
  const tampered = {
    ...signed,
    manifest: { ...signed.manifest, datasetVersion: '9999.9' },
  };
  assert.equal(verifySignedDataPackManifest(tampered, publicKey), false);
});

test('verifySignedDataPackManifest rejects a tampered signature value', () => {
  const signed = signDataPackManifest(baseManifest(), {
    keyId: 'datapack-key-1',
    publicKeyId: 'datapack-key-1',
    privateKey,
  });
  const tampered = {
    ...signed,
    signature: { ...signed.signature, value: Buffer.from('not-a-real-signature').toString('base64') },
  };
  assert.equal(verifySignedDataPackManifest(tampered, publicKey), false);
});

test('verifySignedDataPackManifest rejects a signature verified against the wrong public key', () => {
  const signed = signDataPackManifest(baseManifest(), {
    keyId: 'datapack-key-1',
    publicKeyId: 'datapack-key-1',
    privateKey,
  });
  assert.equal(verifySignedDataPackManifest(signed, OTHER_KEYS.publicKey), false);
});
