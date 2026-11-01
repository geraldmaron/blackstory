import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicSearchIndexDoc } from '@repo/domain/search';
import { resolveRecordsCatalog } from './records-catalog';

test('a grading-ready released index is shared without hydrating entities', async () => {
  const docs = [{ evidenceInputs: {} }] as unknown as readonly PublicSearchIndexDoc[];
  const result = await resolveRecordsCatalog({
    search: async () => docs,
    entities: async () => {
      throw new Error('unexpected full hydrate');
    },
  });
  assert.equal(result.data, docs);
  assert.equal(result.catalogSource, 'search_index');
});

test('unready evidence inputs retain the established full-entity fallback', async () => {
  const entities: readonly never[] = [];
  const result = await resolveRecordsCatalog({
    search: async () => [],
    entities: async () => entities,
  });
  assert.equal(result.data, entities);
  assert.equal(result.catalogSource, 'entities');
});

test('an unavailable index falls back to the real entity release', async () => {
  const entities: readonly never[] = [];
  const result = await resolveRecordsCatalog({
    search: async () => {
      throw new Error('index unavailable');
    },
    entities: async () => entities,
  });
  assert.equal(result.data, entities);
  assert.equal(result.catalogSource, 'entities');
});

test('failure of both release reads is never presented as an empty collection', async () => {
  await assert.rejects(
    resolveRecordsCatalog({
      search: async () => {
        throw new Error('index unavailable');
      },
      entities: async () => {
        throw new Error('release unavailable');
      },
    }),
    /release unavailable/,
  );
});
