/**
 * Era resolution helpers — buckets, legacy era text, and undated honesty.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entityEraFact, resolveEntityEraBuckets } from './entity-era-facts';

test('resolveEntityEraBuckets prefers structured eraBuckets', () => {
  assert.deepEqual(resolveEntityEraBuckets({ eraBuckets: ['1870s', '1910s'] }), ['1870s', '1910s']);
});

test('resolveEntityEraBuckets derives from legacy era text when buckets are empty', () => {
  assert.deepEqual(resolveEntityEraBuckets({ era: '1870s to 1910s' }), ['1870s', '1910s']);
});

test('resolveEntityEraBuckets derives from eventWindow when no buckets or era text', () => {
  assert.deepEqual(
    resolveEntityEraBuckets({
      eventWindow: { startAt: '1963-08-28', datePrecision: 'day' },
    }),
    ['1960s'],
  );
});

test('entityEraFact shows concrete span and explore href from buckets', () => {
  const fact = entityEraFact({ eraBuckets: ['1860s', '1890s'] });
  assert.match(fact.label, /1860s to 1890s/);
  assert.ok(fact.href?.includes('era=1860s'));
});

test('entityEraFact falls back to legacy era text before Undated', () => {
  assert.equal(entityEraFact({ era: 'Reconstruction through Jim Crow' }).label, 'Reconstruction through Jim Crow');
});

test('entityEraFact is Undated only when no resolvable era signal exists', () => {
  assert.equal(entityEraFact({}).label, 'Undated');
  assert.equal(entityEraFact({ era: 'undated' }).label, 'Undated');
});
