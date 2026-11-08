import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessPublicTextReview,
  providerOf,
  publicTextHash,
  validatePublicTextVerdict,
  type PublicTextEntry,
  type PublicTextPacket,
  type PublicTextReview,
  type PublicTextVerdict,
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

const packet: PublicTextPacket = {
  entityId: 'e1',
  displayName: 'Test Person',
  textHash: 'a'.repeat(64),
  text: { summary: 'Test Person founded the society in 1901. She taught for years.' },
  claims: [{ ref: 'C1', object: 'Founded in 1901.', citationHref: 'https://a.example/x' }],
  sources: [{ url: 'https://a.example/x', text: 'Founded in 1901 by Test Person.' }],
  rejectedFacts: ['She died in 1950.'],
};
const clause = (text: string, status: PublicTextVerdict['clauses'][number]['status'] = 'supported') => ({
  text,
  claimRefs: ['C1'],
  status,
});
const approval = (over: Partial<PublicTextVerdict> = {}): PublicTextVerdict => ({
  decision: 'approve',
  clauses: [clause('Test Person founded the society in 1901.'), clause('She taught for years.')],
  rejectedFactsPresent: [],
  identityConfirmed: true,
  findings: [],
  ...over,
});

test('an approval must account for all of the public text, verbatim', () => {
  assert.equal(validatePublicTextVerdict(packet, approval()).ok, true);
  const partial = approval({ clauses: [clause('Test Person founded the society in 1901.')] });
  assert.equal(validatePublicTextVerdict(packet, partial).ok, false);
  const altered = approval({
    clauses: [clause('Test Person started the society in 1901.'), clause('She taught for years.')],
  });
  assert.equal(validatePublicTextVerdict(packet, altered).ok, false);
});

test('an approval cannot carry an unsupported clause, a rejected fact or an unconfirmed identity', () => {
  const unsupported = approval({
    clauses: [
      clause('Test Person founded the society in 1901.'),
      clause('She taught for years.', 'overstated'),
    ],
  });
  assert.equal(validatePublicTextVerdict(packet, unsupported).ok, false);
  assert.equal(validatePublicTextVerdict(packet, approval({ rejectedFactsPresent: [0] })).ok, false);
  assert.equal(validatePublicTextVerdict(packet, approval({ identityConfirmed: false })).ok, false);
});

test('asking for changes needs a stated finding', () => {
  assert.equal(validatePublicTextVerdict(packet, approval({ decision: 'request_changes' })).ok, false);
  const withFinding = approval({ decision: 'request_changes', findings: ['Remove the 1950 date.'] });
  assert.equal(validatePublicTextVerdict(packet, withFinding).ok, true);
});
