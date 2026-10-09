import assert from 'node:assert/strict';
import test from 'node:test';
import { validateWorkProposal, workDigest } from './work-store.js';

const quote =
  'The school opened in September 1924 at the address recorded in the nomination and remains in operation.';
function proposal() {
  const evidence = ['https://nps.gov/nomination', 'https://district.example.org/school'].map(
    (sourceUrl) => ({
      sourceUrl,
      title: 'Opened source',
      locator: 'Opening section',
      quote,
      contentHash: 'a'.repeat(64),
      retrievedAt: '2026-10-08T00:00:00Z',
      fitness: 'strong',
      fitnessReason: 'Contemporary school record',
      lineage: sourceUrl,
      limitations: [],
    }),
  );
  return {
    summary: 'Create one school record.',
    interpretation: 'Research the requested school.',
    held: [],
    researchRunIds: [],
    changes: [
      {
        entityId: 'school-1',
        operation: 'create',
        beforeHash: null,
        record: {
          entityId: 'school-1',
          displayName: 'School',
          summary: quote,
          jurisdiction: 'Atlanta, Georgia',
          topicIds: ['education'],
          topicTags: ['education'],
          eraBuckets: ['1920s'],
          sources: [
            {
              url: 'https://nps.gov/nomination',
              title: 'Nomination',
              excerpt: quote,
              fitness: 'strong',
            },
            {
              url: 'https://district.example.org/school',
              title: 'District',
              excerpt: quote,
              fitness: 'strong',
            },
          ],
        },
        assertions: [
          {
            id: 'opening',
            statement: quote,
            finding: 'supported',
            reasoning: 'The passage states the opening.',
            counterevidenceSearch: 'Checked conflicting opening dates.',
            evidence,
          },
        ],
        sentenceClaims: [{ sentence: quote, assertionIds: ['opening'] }],
        identityReview: 'Address and register identifier match.',
        proseReview: 'Every sentence checked.',
        rightsReview: 'Short citation only.',
        reviewBasis: 'self_review',
        reviewerActorId: 'author',
        producerActorId: 'author',
        blockers: [],
        omissions: [],
      },
    ],
  };
}
test('review permits honestly labeled self-review without a numeric confidence', () => {
  assert.equal(validateWorkProposal(proposal()).changes.length, 1);
});
test('research can hold every record but must explain what is held', () => {
  const value = {
    ...proposal(),
    changes: [],
    held: [{ subject: 'School', reason: 'Identity remains unresolved.' }],
  };
  assert.equal(validateWorkProposal(value).changes.length, 0);
  assert.throws(() => validateWorkProposal({ ...value, held: [] }));
  assert.throws(() =>
    validateWorkProposal({ ...value, held: [{ subject: 'School', reason: '' }] }),
  );
});
test('review rejects self-review disguised as independence', () => {
  const value = proposal();
  value.changes[0]!.reviewBasis = 'independent_review';
  assert.throws(() => validateWorkProposal(value), /Self-review/);
});
test('review rejects unsupported final prose and mismatched record identities', () => {
  const value = proposal();
  value.changes[0]!.record.summary += ' Extra unsupported claim.';
  assert.throws(() => validateWorkProposal(value), /Every public/);
  const other = proposal();
  other.changes[0]!.record.entityId = 'namesake';
  assert.throws(() => validateWorkProposal(other), /identity/);
});
test('review cannot map final prose to disputed claims', () => {
  const value = proposal();
  value.changes[0]!.assertions[0]!.finding = 'disputed';
  assert.throws(() => validateWorkProposal(value), /unresolved/);
});
test('version hashing ignores object key order but binds exact content', () => {
  assert.equal(workDigest({ a: 1, b: 2 }), workDigest({ b: 2, a: 1 }));
  assert.notEqual(workDigest(proposal()), workDigest({ ...proposal(), summary: 'Changed' }));
});

test('context and replacement assertions require exact supported sentence coverage', () => {
  const value = {
    ...proposal(),
    changes: [
      {
        ...proposal().changes[0]!,
        contextRevision: { text: 'Unsupported context.', reason: 'Correction', sentenceClaims: [] },
      },
    ],
  };
  assert.throws(() => validateWorkProposal(value), /context sentence/);
  assert.throws(
    () =>
      validateWorkProposal({
        ...proposal(),
        changes: [
          {
            ...proposal().changes[0]!,
            claimRevisions: [
              { claimId: 'old', reason: 'Incorrect', replacementAssertionIds: ['absent'] },
            ],
          },
        ],
      }),
    /unresolved/,
  );
});

// New assertions need inspected underlying works, while legitimate primary mirrors remain usable.
test('discovery statements cannot support new claims; inspected Wikimedia documents can', () => {
  for (const url of ['https://en.wikipedia.org/wiki/School', 'https://www.wikidata.org/wiki/Q1']) {
    const value = proposal();
    value.changes[0]!.assertions[0]!.evidence.forEach((e) => (e.sourceUrl = url));
    value.changes[0]!.record.sources.forEach((e) => (e.url = url));
    assert.throws(() => validateWorkProposal(value), /underlying/);
  }
  const value = proposal();
  value.changes[0]!.assertions[0]!.evidence.forEach(
    (e) => (e.sourceUrl = 'https://en.wikisource.org/wiki/School_ledger'),
  );
  value.changes[0]!.record.sources.forEach(
    (e) => (e.url = 'https://en.wikisource.org/wiki/School_ledger'),
  );
  assert.equal(validateWorkProposal(value).changes.length, 1);
});

test('a different actor or model family does not establish independent review', () => {
  const value = proposal();
  value.changes[0]!.reviewBasis = 'independent_review';
  value.changes[0]!.reviewerActorId = 'other-actor';
  assert.throws(() => validateWorkProposal(value), /documented basis/);
  value.changes[0]!.independenceBasis =
    'Another researcher inspected the raw evidence before receiving the conclusions';
  assert.equal(validateWorkProposal(value).changes.length, 1);
});
