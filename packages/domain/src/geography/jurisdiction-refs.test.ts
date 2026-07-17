/**
 * Tests for the BB-091 fail-closed jurisdiction-reference gate.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertJurisdictionReferencesResolve,
  createInMemoryJurisdictionResolver,
  evaluateJurisdictionReferences,
  jurisdictionReferenceFromLaw,
  jurisdictionReferenceFromLocation,
} from './jurisdiction-refs.js';

const KNOWN_IDS = ['us-06', 'us-06-001', 'us-36'];

test('evaluateJurisdictionReferences: all references resolve', async () => {
  const resolver = createInMemoryJurisdictionResolver(KNOWN_IDS);
  const result = await evaluateJurisdictionReferences(
    [
      { subjectId: 'law_1', jurisdictionIds: ['us-06'] },
      { subjectId: 'loc_1', jurisdictionIds: ['us-06-001', 'us-36'] },
    ],
    resolver,
  );
  assert.equal(result.ok, true);
});

test('evaluateJurisdictionReferences: reports every dangling reference, not just the first', async () => {
  const resolver = createInMemoryJurisdictionResolver(KNOWN_IDS);
  const result = await evaluateJurisdictionReferences(
    [
      { subjectId: 'law_1', jurisdictionIds: ['us-99'] },
      { subjectId: 'loc_1', jurisdictionIds: ['us-06-001', 'us-77-999'] },
    ],
    resolver,
  );
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('unreachable');
  assert.equal(result.dangling.length, 2);
  assert.deepEqual(
    result.dangling.map((d) => d.jurisdictionId).sort(),
    ['us-77-999', 'us-99'],
  );
});

test('evaluateJurisdictionReferences: an empty/whitespace jurisdictionId is dangling', async () => {
  const resolver = createInMemoryJurisdictionResolver(KNOWN_IDS);
  const result = await evaluateJurisdictionReferences(
    [{ subjectId: 'law_1', jurisdictionIds: ['  '] }],
    resolver,
  );
  assert.equal(result.ok, false);
});

test('assertJurisdictionReferencesResolve throws (fails closed) on a dangling reference', async () => {
  const resolver = createInMemoryJurisdictionResolver(KNOWN_IDS);
  await assert.rejects(
    () =>
      assertJurisdictionReferencesResolve(
        [{ subjectId: 'law_42', jurisdictionIds: ['us-not-real'] }],
        resolver,
      ),
    /dangling jurisdiction reference/,
  );
});

test('assertJurisdictionReferencesResolve resolves cleanly when every reference is valid', async () => {
  const resolver = createInMemoryJurisdictionResolver(KNOWN_IDS);
  await assert.doesNotReject(() =>
    assertJurisdictionReferencesResolve(
      [{ subjectId: 'law_42', jurisdictionIds: ['us-06'] }],
      resolver,
    ),
  );
});

test('assertJurisdictionReferencesResolve supports an async Firestore-shaped resolver', async () => {
  const resolver = {
    async exists(jurisdictionId: string) {
      await Promise.resolve();
      return jurisdictionId === 'us-06';
    },
  };
  await assert.doesNotReject(() =>
    assertJurisdictionReferencesResolve(
      [{ subjectId: 'law_1', jurisdictionIds: ['us-06'] }],
      resolver,
    ),
  );
  await assert.rejects(() =>
    assertJurisdictionReferencesResolve(
      [{ subjectId: 'law_2', jurisdictionIds: ['us-07'] }],
      resolver,
    ),
  );
});

test('jurisdictionReferenceFromLaw / jurisdictionReferenceFromLocation build subjects correctly', () => {
  assert.deepEqual(jurisdictionReferenceFromLaw('law_1', 'us-06'), {
    subjectId: 'law_1',
    jurisdictionIds: ['us-06'],
  });
  assert.equal(jurisdictionReferenceFromLaw('law_1', undefined), undefined);

  assert.deepEqual(jurisdictionReferenceFromLocation('loc_1', ['us-06', 'us-06-001']), {
    subjectId: 'loc_1',
    jurisdictionIds: ['us-06', 'us-06-001'],
  });
  assert.equal(jurisdictionReferenceFromLocation('loc_1', undefined), undefined);
  assert.equal(jurisdictionReferenceFromLocation('loc_1', []), undefined);
});
