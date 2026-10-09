import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceLibraryQueryFromParams, querySourceLibrary } from './source-library.js';
import { validateContract } from '@repo/research-kernel';

test('shared query rejects unknown fields, duplicate parameters and unbounded pagination', () => {
  for (const query of [
    'limit=101',
    'offset=-1',
    'question=a&question=b',
    'reliability=0.99',
    'limit=abc',
  ])
    assert.throws(() => sourceLibraryQueryFromParams(new URLSearchParams(query)));
  assert.deepEqual(sourceLibraryQueryFromParams(new URLSearchParams('question=school&offset=20')), {
    question: 'school',
    offset: 20,
  });
});
test('malformed reviewed guidance cannot receive profile authority', () => {
  assert.equal(
    validateContract('CollectionGuidance', { schemaVersion: '1.0.0', reviewStatus: 'reviewed' }).ok,
    false,
  );
});
test('question terms remain parameters and an empty page retains total accounting', async () => {
  let values: unknown[] | undefined;
  const result = await querySourceLibrary(
    {
      async query(_sql, args) {
        values = args;
        return { rows: [{ items: [], total: 12 }] };
      },
    },
    { question: "School'); DELETE FROM evidence.source_items; --", offset: 100, limit: 10 },
  );
  assert.equal(result.total, 12);
  assert.equal(result.nextOffset, null);
  assert.ok(!String(values![0]).includes("'"));
});
