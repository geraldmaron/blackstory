import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldSkipPublish, shouldUploadArtifact } from './release-catalog-publish-decision.ts';

test('shouldSkipPublish: skips when dirty_at is not newer than published_at', () => {
  const published = new Date('2026-08-08T02:00:00.000Z');
  const dirty = new Date('2026-08-08T01:00:00.000Z');
  assert.equal(
    shouldSkipPublish({ dryRun: false, force: false, dirtyAt: dirty, publishedAt: published }),
    true,
  );
});

test('shouldSkipPublish: does not skip when dirty_at is newer than published_at', () => {
  const published = new Date('2026-08-08T01:00:00.000Z');
  const dirty = new Date('2026-08-08T02:00:00.000Z');
  assert.equal(
    shouldSkipPublish({ dryRun: false, force: false, dirtyAt: dirty, publishedAt: published }),
    false,
  );
});

test('shouldSkipPublish: never skips on the very first run (published_at is null)', () => {
  assert.equal(
    shouldSkipPublish({
      dryRun: false,
      force: false,
      dirtyAt: new Date('2026-08-08T02:00:00.000Z'),
      publishedAt: null,
    }),
    false,
  );
});

test('shouldSkipPublish: DRY_RUN always does real work, regardless of watermark state', () => {
  const same = new Date('2026-08-08T02:00:00.000Z');
  assert.equal(
    shouldSkipPublish({ dryRun: true, force: false, dirtyAt: same, publishedAt: same }),
    false,
  );
});

test('shouldSkipPublish: FORCE always does real work, regardless of watermark state', () => {
  const same = new Date('2026-08-08T02:00:00.000Z');
  assert.equal(
    shouldSkipPublish({ dryRun: false, force: true, dirtyAt: same, publishedAt: same }),
    false,
  );
});

test('shouldUploadArtifact: uploads on the very first run (previousHash is null)', () => {
  assert.equal(shouldUploadArtifact({ force: false, newHash: 'abc123', previousHash: null }), true);
});

test('shouldUploadArtifact: skips when the content hash is unchanged', () => {
  // This is the exact case the real bug hit: hashing the full artifact (which embeds a
  // fresh `generatedAt` on every run) instead of just the content meant this comparison
  // could never be true even when nothing had actually changed. The fix hashes only
  // entities/docs; this test locks that behavior in independent of how the hash is derived.
  assert.equal(
    shouldUploadArtifact({ force: false, newHash: 'abc123', previousHash: 'abc123' }),
    false,
  );
});

test('shouldUploadArtifact: uploads when the content hash differs', () => {
  assert.equal(
    shouldUploadArtifact({ force: false, newHash: 'abc123', previousHash: 'def456' }),
    true,
  );
});

test('shouldUploadArtifact: FORCE uploads even when the hash matches', () => {
  assert.equal(
    shouldUploadArtifact({ force: true, newHash: 'abc123', previousHash: 'abc123' }),
    true,
  );
});
