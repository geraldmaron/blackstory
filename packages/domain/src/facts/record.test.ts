import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFixtureCitation, buildFixtureFact } from './fixtures.js';
import { assertFactRecordStructurallyValid, hasCompleteFactCitations } from './record.js';

test('a well-formed FactRecord passes structural validation', () => {
  assert.doesNotThrow(() => assertFactRecordStructurallyValid(buildFixtureFact()));
});

test('an event fact without a geo anchor is rejected (claimType requires geo)', () => {
  const fact = buildFixtureFact({ geo: undefined });
  assert.throws(() => assertFactRecordStructurallyValid(fact));
});

test('an event fact without a when anchor is rejected (claimType requires when)', () => {
  const fact = buildFixtureFact({ when: undefined });
  assert.throws(() => assertFactRecordStructurallyValid(fact));
});

test('a quantity fact needs neither geo nor when', () => {
  const fact = buildFixtureFact({ claimType: 'quantity', geo: undefined, when: undefined });
  assert.doesNotThrow(() => assertFactRecordStructurallyValid(fact));
});

test('a fact with zero subjects is rejected', () => {
  const fact = buildFixtureFact({ subjects: [] });
  assert.throws(() => assertFactRecordStructurallyValid(fact));
});

test('an invalid shortStatement (too long) is rejected', () => {
  const fact = buildFixtureFact({ shortStatement: 'x'.repeat(76) });
  assert.throws(() => assertFactRecordStructurallyValid(fact));
});

test('a fact with a contested confidence and no confidenceNote is rejected', () => {
  const fact = buildFixtureFact({ confidence: 'contested' });
  assert.throws(() => assertFactRecordStructurallyValid(fact));
});

test('a fact with a contested confidence and a confidenceNote passes', () => {
  const fact = buildFixtureFact({ confidence: 'contested', confidenceNote: 'Two sources disagree on the exact date.' });
  assert.doesNotThrow(() => assertFactRecordStructurallyValid(fact));
});

test('a fact with a structurally invalid citation is rejected', () => {
  const fact = buildFixtureFact({ citations: [buildFixtureCitation({ archivedUrl: undefined })] });
  assert.throws(() => assertFactRecordStructurallyValid(fact));
});

test('hasCompleteFactCitations is true only when every citation is complete and at least one exists', () => {
  assert.equal(hasCompleteFactCitations(buildFixtureFact()), true);
  assert.equal(hasCompleteFactCitations(buildFixtureFact({ citations: [] })), false);
  assert.equal(
    hasCompleteFactCitations(buildFixtureFact({ citations: [buildFixtureCitation({ excerpt: '' })] })),
    false,
  );
});
