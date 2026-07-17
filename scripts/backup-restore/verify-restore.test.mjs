/**
 * Unit tests for BB-020 backup-restore verification helpers (dry-run safe).
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  canonicalJson,
  compareCollectionHashes,
  compareDocumentCounts,
  sha256Hex,
  sha256Json,
  verifyActiveReleasePointer,
  verifyExportMetadata,
  verifyIamMatrixDesign,
  verifyManifestEnvelope,
} from './lib/verification.mjs';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('canonicalJson is stable across key order', () => {
  const left = { beta: [2, 1], alpha: { z: true, a: null } };
  const right = { alpha: { a: null, z: true }, beta: [2, 1] };
  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.equal(sha256Json(left), sha256Json(right));
});

test('compareDocumentCounts detects mismatches', () => {
  const ok = compareDocumentCounts({ a: 1, b: 2 }, { a: 1, b: 2 });
  assert.equal(ok.ok, true);
  const bad = compareDocumentCounts({ a: 2 }, { a: 1 });
  assert.equal(bad.ok, false);
  assert.equal(bad.mismatches[0]?.collection, 'a');
});

test('compareCollectionHashes requires valid sha256 hex', () => {
  const ok = compareCollectionHashes(
    { entities: 'a'.repeat(64) },
    { entities: 'a'.repeat(64) },
  );
  assert.equal(ok.ok, true);
  const bad = compareCollectionHashes({ entities: 'short' }, { entities: 'a'.repeat(64) });
  assert.equal(bad.ok, false);
});

test('verifyManifestEnvelope validates digest for fixture manifest', async () => {
  const metadata = JSON.parse(
    await readFile(path.join(FIXTURES, 'sample-export-metadata.json'), 'utf8'),
  );
  const signed = metadata.releaseManifestChecks[0].signedManifest;
  const result = verifyManifestEnvelope(signed);
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('verifyManifestEnvelope rejects tampered manifestHash', async () => {
  const metadata = JSON.parse(
    await readFile(path.join(FIXTURES, 'sample-export-metadata.json'), 'utf8'),
  );
  const signed = structuredClone(metadata.releaseManifestChecks[0].signedManifest);
  signed.manifestHash.digest = 'b'.repeat(64);
  const result = verifyManifestEnvelope(signed);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /digest does not match/);
});

test('verifyExportMetadata passes sample fixture with baselines', async () => {
  const metadata = JSON.parse(
    await readFile(path.join(FIXTURES, 'sample-export-metadata.json'), 'utf8'),
  );
  const baselineCounts = JSON.parse(
    await readFile(path.join(FIXTURES, 'sample-baseline-counts.json'), 'utf8'),
  );
  const baselineHashes = JSON.parse(
    await readFile(path.join(FIXTURES, 'sample-baseline-hashes.json'), 'utf8'),
  );
  const result = verifyExportMetadata(metadata, { baselineCounts, baselineHashes });
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('verifyActiveReleasePointer aligns pointer and release', async () => {
  const pointer = JSON.parse(
    await readFile(path.join(FIXTURES, 'sample-active-pointer.json'), 'utf8'),
  );
  const release = JSON.parse(await readFile(path.join(FIXTURES, 'sample-release.json'), 'utf8'));
  const result = verifyActiveReleasePointer(pointer, release);
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('verifyIamMatrixDesign accepts retention matrix', async () => {
  const matrixPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../infra/firebase/backup/retention-matrix.json',
  );
  const matrix = JSON.parse(await readFile(matrixPath, 'utf8'));
  const runtime = ['web-runtime', 'api-public', 'publication', 'research'];
  const result = verifyIamMatrixDesign(matrix, runtime);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.ok(!result.deniedDeletePrincipals.includes('backup'));
});

test('sha256Hex produces 64-char hex', () => {
  const digest = sha256Hex('black-book-backup');
  assert.match(digest, /^[a-f0-9]{64}$/);
});
