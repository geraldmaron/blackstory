import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFixtureCitation, buildFixtureFact } from './fixtures.js';
import { asFactId } from './ids.js';
import {
  assertFactMayPublish,
  assertFactProjectionPublishGate,
  assertFactRemainsResolvable,
  evaluateFactPublishGate,
  evaluateFactProjectionPublishGate,
  isFactSearchIndexable,
} from './publish-gate.js';

test('a published fact with complete citations passes the publish gate', () => {
  const fact = buildFixtureFact();
  assert.deepEqual(evaluateFactPublishGate(fact), { ok: true });
  assert.doesNotThrow(() => assertFactMayPublish(fact));
});

test('a published fact with zero citations fails closed', () => {
  const fact = buildFixtureFact({ citations: [] });
  const result = evaluateFactPublishGate(fact);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'no_citations');
  assert.throws(() => assertFactMayPublish(fact));
});

test('a published fact with an incomplete web citation fails closed', () => {
  const fact = buildFixtureFact({ citations: [buildFixtureCitation({ archivedUrl: undefined })] });
  const result = evaluateFactPublishGate(fact);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'incomplete_citation');
});

test('a draft fact with zero citations is exempt from the publish gate', () => {
  const fact = buildFixtureFact({ status: 'draft', citations: [] });
  assert.deepEqual(evaluateFactPublishGate(fact), { ok: true });
});

test('a contested-confidence fact still passes the publish gate (axes are independent)', () => {
  const fact = buildFixtureFact({ confidence: 'contested', confidenceNote: 'Disputed by a contemporary account.' });
  assert.deepEqual(evaluateFactPublishGate(fact), { ok: true });
});

test('evaluateFactProjectionPublishGate aggregates every failing fact in one pass', () => {
  const good = buildFixtureFact({ id: asFactId('BB-F-000001') });
  const bad1 = buildFixtureFact({ id: asFactId('BB-F-000002'), citations: [] });
  const bad2 = buildFixtureFact({
    id: asFactId('BB-F-000003'),
    citations: [buildFixtureCitation({ accessedAt: undefined })],
  });
  const result = evaluateFactProjectionPublishGate([good, bad1, bad2]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failures.length, 2);
    assert.deepEqual(result.failures.map((f) => f.factId).sort(), ['BB-F-000002', 'BB-F-000003']);
  }
  assert.throws(() => assertFactProjectionPublishGate([good, bad1, bad2]));
});

test('assertFactRemainsResolvable allows superseded/deprecated but rejects draft', () => {
  assert.doesNotThrow(() => assertFactRemainsResolvable(buildFixtureFact({ status: 'superseded' })));
  assert.doesNotThrow(() => assertFactRemainsResolvable(buildFixtureFact({ status: 'deprecated' })));
  assert.throws(() => assertFactRemainsResolvable(buildFixtureFact({ status: 'draft' })));
});

test('isFactSearchIndexable is true only for published/corrected', () => {
  assert.equal(isFactSearchIndexable(buildFixtureFact({ status: 'published' })), true);
  assert.equal(isFactSearchIndexable(buildFixtureFact({ status: 'corrected' })), true);
  assert.equal(isFactSearchIndexable(buildFixtureFact({ status: 'superseded' })), false);
});
