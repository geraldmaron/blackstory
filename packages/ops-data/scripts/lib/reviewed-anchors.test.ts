import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertReviewedPublicationAnchors,
  publicationAssertionDigest,
} from './reviewed-anchors.js';

test('missing declarations, arbitrary uploads, student pages and catalog URLs have no publication authority', async () => {
  const db = {
    query: async () => {
      throw new Error('Unexpected database access');
    },
  } as never;
  for (const anchors of [
    undefined,
    [],
    [{ url: 'https://archive.org/details/upload' }],
    [{ url: 'https://student.edu/blog' }],
    [{ url: 'https://worldcat.org/title/1' }],
  ])
    await assert.rejects(
      assertReviewedPublicationAnchors(db, { replicationVerified: true }, anchors),
      /exact claim-version/,
    );
});
test('review binding covers changed captions, numbers and qualifiers, independent of field order', () => {
  assert.equal(
    publicationAssertionDigest({ estimate: 5, caption: 'Recorded', anchors: [] }),
    publicationAssertionDigest({ caption: 'Recorded', estimate: 5, replicationVerified: true }),
  );
  assert.notEqual(
    publicationAssertionDigest({ estimate: 5 }),
    publicationAssertionDigest({ estimate: 6 }),
  );
  assert.notEqual(
    publicationAssertionDigest({ caption: 'A school' }),
    publicationAssertionDigest({ caption: 'The first school' }),
  );
});

test('alternate encyclopedia URL forms remain discovery only', async () => {
  for (const url of ['https://en.wikipedia.org/?curid=123', 'https://www.wikidata.org/?id=Q1'])
    await assert.rejects(
      assertReviewedPublicationAnchors({} as never, {}, [
        { url, claimId: 'c', claimVersionId: 'v', selectorId: 's' },
      ]),
      /encyclopedia statements/,
    );
});
