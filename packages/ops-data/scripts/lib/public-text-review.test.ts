import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessPublicTextReview,
  providerOf,
  publicTextHash,
  type PublicTextEntry,
  type PublicTextReview,
} from './public-text-review.ts';

const entry: PublicTextEntry = {
  id: 'e1',
  displayName: 'Test Person',
  summary: 'Test Person founded the society in 1901.',
  claims: [{ predicate: 'source states', object: 'Founded in 1901.', citationHref: 'https://a.example/x' }],
};
const review = (over: Partial<PublicTextReview> = {}): PublicTextReview => ({
  entityId: 'e1',
  textHash: publicTextHash(entry),
  decision: 'approve',
  reviewerModelFamily: 'openai',
  producerModelFamily: 'claude-opus-5',
  ...over,
});

test('an approval of the exact text from another provider passes', () => {
  assert.deepEqual(assessPublicTextReview(entry, [review()]), { ok: true });
});

test('no review, changed prose and an omitted claim all block', () => {
  assert.equal(assessPublicTextReview(entry, []).ok, false);
  const changed = { ...entry, summary: `${entry.summary} She died in 1950.` };
  assert.equal(assessPublicTextReview(changed, [review()]).ok, false);
  assert.equal(assessPublicTextReview({ ...entry, claims: [] }, [review()]).ok, false);
});

test('a rejection of unchanged text cannot be outvoted by a later approval', () => {
  assert.equal(assessPublicTextReview(entry, [review({ decision: 'reject' }), review()]).ok, false);
  assert.equal(assessPublicTextReview(entry, [review({ decision: 'request_changes' }), review()]).ok, false);
});

test('a review needs two known, different providers', () => {
  assert.equal(assessPublicTextReview(entry, [review({ reviewerModelFamily: 'claude-sonnet-5' })]).ok, false);
  assert.equal(assessPublicTextReview(entry, [review({ producerModelFamily: null })]).ok, false);
  assert.equal(providerOf('gpt-6.1-sol'), 'openai');
  assert.equal(providerOf('mystery'), null);
});
