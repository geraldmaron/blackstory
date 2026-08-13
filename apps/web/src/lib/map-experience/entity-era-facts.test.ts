/**
 * Era resolution helpers — buckets, legacy era text, and honesty about what is not documented.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ERA_NOT_DOCUMENTED_LABEL,
  entityEraFact,
  resolveEntityEraBuckets,
} from './entity-era-facts';

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

test('entityEraFact falls back to legacy era text before reporting no era', () => {
  assert.equal(
    entityEraFact({ era: 'Reconstruction through Jim Crow' }).label,
    'Reconstruction through Jim Crow',
  );
});

test('entityEraFact reports no era only when no resolvable signal exists', () => {
  assert.equal(entityEraFact({}).label, ERA_NOT_DOCUMENTED_LABEL);
  assert.equal(entityEraFact({ era: 'undated' }).label, ERA_NOT_DOCUMENTED_LABEL);
});

test('entityEraFact recovers decades named by historical claims', () => {
  const fact = entityEraFact({
    claims: [
      { predicate: 'first_black_graduate', object: 'earned his law degree in 1962' },
      { predicate: 'elected_position', object: 'became president of the bar association in 1988' },
    ],
  });
  // 1970s is absent on purpose — the record attests 1962 and 1988, not the span between them.
  assert.match(fact.label, /1960s to 1980s/);
  assert.equal(fact.state, 'documented');
});

test('entityEraFact separates a research gap from a genuinely undated record', () => {
  // A listing date means a real era exists and has not been ingested yet.
  assert.equal(
    entityEraFact({
      statusHistory: [{ validFrom: '2001', datePrecision: 'year' }],
      claims: [
        { predicate: 'listing', object: 'on the National Register of Historic Places in 2001' },
      ],
    }).state,
    'awaiting_research',
  );
  assert.equal(entityEraFact({}).state, 'undocumented');
});
