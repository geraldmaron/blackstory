/**
 * Unit tests for Data Pack v1 validation functions (the related workstream): checksum mismatch,
 * budget rejection, and license rejection. Signature verification round-trip lives in
 * ./manifest.test.ts alongside the sign/verify functions it exercises.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sha256Bytes } from '../publication/index.js';
import { DATA_PACK_SCHEMA_VERSION, type DataPackManifest } from './manifest.js';
import {
  assertWithinDataPackImportBudget,
  checkDataPackImportBudget,
  checkDataPackLicense,
  isDataPackLicenseImportEligible,
  verifyResourceChecksumBytes,
  verifyResourceChecksumJson,
} from './validate.js';

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
        recordCount: 5,
      },
    ],
    ...overrides,
  };
}

test('verifyResourceChecksumBytes passes when bytes match the declared sha256', () => {
  const entry = baseManifest().resources[0]!;
  const result = verifyResourceChecksumBytes(entry, '[]');
  assert.deepEqual(result, { ok: true });
});

test('verifyResourceChecksumBytes detects a checksum mismatch', () => {
  const entry = baseManifest().resources[0]!;
  const result = verifyResourceChecksumBytes(entry, '[{"externalId":"x"}]');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'checksum_mismatch');
    assert.match(result.message, /sha256 mismatch/);
  }
});

test('verifyResourceChecksumJson detects a checksum mismatch on the canonicalized value', () => {
  const entry = baseManifest().resources[0]!;
  const result = verifyResourceChecksumJson(entry, [{ externalId: 'x' }]);
  assert.equal(result.ok, false);
});

test('checkDataPackImportBudget passes within budget', () => {
  const result = checkDataPackImportBudget(baseManifest(), {
    maxResources: 10,
    maxTotalBytes: 1_000,
    maxRecordsPerResource: 100,
  });
  assert.deepEqual(result, { ok: true });
});

test('checkDataPackImportBudget rejects when resource count exceeds the cap', () => {
  const manifest = baseManifest({
    resources: [
      ...baseManifest().resources,
      {
        name: 'claims',
        path: 'claims.json',
        kind: 'claims',
        sha256: sha256Bytes('[]'),
        byteSize: 2,
      },
    ],
  });
  const result = checkDataPackImportBudget(manifest, { maxResources: 1, maxTotalBytes: 1_000 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'budget_exceeded');
});

test('checkDataPackImportBudget rejects when total bytes exceed the cap', () => {
  const result = checkDataPackImportBudget(baseManifest(), { maxResources: 10, maxTotalBytes: 1 });
  assert.equal(result.ok, false);
});

test('checkDataPackImportBudget rejects when a resource declares more records than the per-resource cap', () => {
  const result = checkDataPackImportBudget(baseManifest(), {
    maxResources: 10,
    maxTotalBytes: 1_000,
    maxRecordsPerResource: 1,
  });
  assert.equal(result.ok, false);
});

test('assertWithinDataPackImportBudget throws with a fail-closed message when over budget', () => {
  assert.throws(
    () => assertWithinDataPackImportBudget(baseManifest(), { maxResources: 10, maxTotalBytes: 1 }),
    /fail-closed/,
  );
});

test('isDataPackLicenseImportEligible allows public-domain and attribution-required only', () => {
  assert.equal(isDataPackLicenseImportEligible('public-domain'), true);
  assert.equal(isDataPackLicenseImportEligible('attribution-required'), true);
  assert.equal(isDataPackLicenseImportEligible('noncommercial'), false);
  assert.equal(isDataPackLicenseImportEligible('unverified'), false);
});

test('checkDataPackLicense passes for a public-domain manifest', () => {
  assert.deepEqual(checkDataPackLicense(baseManifest()), { ok: true });
});

test('checkDataPackLicense rejects a noncommercial-licensed manifest', () => {
  const manifest = baseManifest({
    license: { name: 'CC BY-NC 4.0', verdict: 'noncommercial' },
  });
  const result = checkDataPackLicense(manifest);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'license_ineligible');
});

test('checkDataPackLicense rejects an unverified-licensed manifest', () => {
  const manifest = baseManifest({
    license: { name: 'unknown terms', verdict: 'unverified' },
  });
  assert.equal(checkDataPackLicense(manifest).ok, false);
});
