import assert from 'node:assert/strict';
import { test } from 'node:test';
import { revisionMetadataV1Schema } from './revision.js';

test('round-trips full revision metadata', () => {
  const input = { releaseId: 'release-2026-07-19', generatedAt: '2026-07-19T00:00:00.000Z', recordUpdatedAt: '2026-07-19T00:00:00.000Z' };
  assert.deepEqual(revisionMetadataV1Schema.parse(input), input);
});

test('accepts empty-string generatedAt/recordUpdatedAt (honest "unknown" on bootstrap-window stubs)', () => {
  const input = { releaseId: 'release-bootstrap-window', generatedAt: '', recordUpdatedAt: '' };
  assert.deepEqual(revisionMetadataV1Schema.parse(input), input);
});

test('rejects a missing releaseId', () => {
  assert.throws(() => revisionMetadataV1Schema.parse({ generatedAt: '', recordUpdatedAt: '' }));
});
