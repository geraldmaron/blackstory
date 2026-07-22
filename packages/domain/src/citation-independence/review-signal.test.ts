/**
 * Tests for citation independence review flags: claimed-independent pairs with high
 * embedding similarity surface for human review and never imply publish/reject.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CITATION_INDEPENDENCE_SIMILARITY_THRESHOLD,
  findCitationIndependenceReviewFlags,
  independenceKeyForCitation,
} from './review-signal.js';

test('independenceKeyForCitation mirrors promotion coordinated vs independent keys', () => {
  assert.equal(
    independenceKeyForCitation({ independenceGroupId: 'pub-a' }),
    'independent:pub-a',
  );
  assert.equal(
    independenceKeyForCitation({
      independenceGroupId: 'ignored-when-coordinated',
      coordinatedGroupId: 'mirror-net',
    }),
    'coordinated:mirror-net',
  );
});

test('findCitationIndependenceReviewFlags flags high-similarity claimed-independent pairs', () => {
  const flags = findCitationIndependenceReviewFlags([
    {
      citationId: 'cite-a',
      independenceGroupId: 'publisher-a',
      vector: [1, 0, 0],
    },
    {
      citationId: 'cite-b',
      independenceGroupId: 'publisher-b',
      vector: [0.999, 0.001, 0],
    },
  ]);

  assert.equal(flags.length, 1);
  assert.equal(flags[0]!.kind, 'claimed_independence_high_similarity');
  assert.equal(flags[0]!.citationIdA, 'cite-a');
  assert.equal(flags[0]!.citationIdB, 'cite-b');
  assert.equal(flags[0]!.independenceKeyA, 'independent:publisher-a');
  assert.equal(flags[0]!.independenceKeyB, 'independent:publisher-b');
  assert.ok(flags[0]!.similarity >= DEFAULT_CITATION_INDEPENDENCE_SIMILARITY_THRESHOLD);
});

test('findCitationIndependenceReviewFlags ignores pairs in the same independence key', () => {
  const flags = findCitationIndependenceReviewFlags([
    {
      citationId: 'cite-a',
      independenceGroupId: 'same-publisher',
      vector: [1, 0, 0],
    },
    {
      citationId: 'cite-b',
      independenceGroupId: 'same-publisher',
      vector: [0.999, 0.001, 0],
    },
  ]);

  assert.deepEqual(flags, []);
});

test('findCitationIndependenceReviewFlags ignores pairs sharing a coordinated group', () => {
  const flags = findCitationIndependenceReviewFlags([
    {
      citationId: 'cite-a',
      independenceGroupId: 'label-a',
      coordinatedGroupId: 'mirror-net',
      vector: [1, 0, 0],
    },
    {
      citationId: 'cite-b',
      independenceGroupId: 'label-b',
      coordinatedGroupId: 'mirror-net',
      vector: [0.999, 0.001, 0],
    },
  ]);

  assert.deepEqual(flags, []);
});

test('findCitationIndependenceReviewFlags skips citations without vectors', () => {
  const flags = findCitationIndependenceReviewFlags([
    {
      citationId: 'cite-a',
      independenceGroupId: 'publisher-a',
      vector: [1, 0, 0],
    },
    {
      citationId: 'cite-b',
      independenceGroupId: 'publisher-b',
    },
  ]);

  assert.deepEqual(flags, []);
});

test('findCitationIndependenceReviewFlags is deterministic regardless of input order', () => {
  const citations = [
    {
      citationId: 'cite-z',
      independenceGroupId: 'z-group',
      vector: [0, 1, 0],
    },
    {
      citationId: 'cite-a',
      independenceGroupId: 'a-group',
      vector: [0.01, 0.99, 0],
    },
    {
      citationId: 'cite-m',
      independenceGroupId: 'm-group',
      vector: [0, 0, 1],
    },
  ] as const;

  const forward = findCitationIndependenceReviewFlags(citations, { threshold: 0.9 });
  const reversed = findCitationIndependenceReviewFlags([...citations].reverse(), {
    threshold: 0.9,
  });

  assert.deepEqual(forward, reversed);
  assert.deepEqual(
    forward.map((flag) => [flag.citationIdA, flag.citationIdB]),
    [['cite-a', 'cite-z']],
  );
});

test('findCitationIndependenceReviewFlags rejects an out-of-range threshold', () => {
  assert.throws(() =>
    findCitationIndependenceReviewFlags(
      [
        {
          citationId: 'a',
          independenceGroupId: 'x',
          vector: [1, 0],
        },
        {
          citationId: 'b',
          independenceGroupId: 'y',
          vector: [1, 0],
        },
      ],
      { threshold: 1.5 },
    ),
  );
});
