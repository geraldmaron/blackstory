import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFixtureFact } from './fixtures.js';
import { assertNeverClaimReview, buildFactArticleJsonLd } from './jsonld.js';

test('buildFactArticleJsonLd always emits @type Article, never ClaimReview', () => {
  const jsonLd = buildFactArticleJsonLd(buildFixtureFact());
  assert.equal(jsonLd['@type'], 'Article');
  assert.doesNotThrow(() => assertNeverClaimReview(jsonLd));
});

test('buildFactArticleJsonLd absolutizes the canonical URL when a baseUrl is given', () => {
  const fact = buildFixtureFact();
  const jsonLd = buildFactArticleJsonLd(fact, { baseUrl: 'https://blackbook.example.org' });
  assert.equal(jsonLd['@id'], `https://blackbook.example.org/facts/${fact.slug}`);
});

test('buildFactArticleJsonLd carries the current revision number as version', () => {
  const fact = buildFixtureFact();
  const jsonLd = buildFactArticleJsonLd(fact);
  assert.equal(jsonLd.version, 1);
});

test('buildFactArticleJsonLd includes a schema.org Correction only when status is corrected', () => {
  const published = buildFactArticleJsonLd(buildFixtureFact({ status: 'published' }));
  assert.equal('correction' in published, false);

  const corrected = buildFactArticleJsonLd(
    buildFixtureFact({ status: 'corrected', confidence: 'contested', confidenceNote: 'Date corrected from Dec 2 to Dec 1.' }),
  );
  assert.equal((corrected.correction as { '@type': string })['@type'], 'CorrectionComment');
});

test('assertNeverClaimReview throws when a document is @type ClaimReview', () => {
  assert.throws(() => assertNeverClaimReview({ '@type': 'ClaimReview' }));
  assert.doesNotThrow(() => assertNeverClaimReview({ '@type': 'Article' }));
});

test('buildFactArticleJsonLd emits one about entry per subject, typed from claimType', () => {
  const fact = buildFixtureFact();
  const jsonLd = buildFactArticleJsonLd(fact);
  const about = jsonLd.about as { '@type': string; identifier: string }[];
  assert.equal(about.length, 1);
  assert.equal(about[0]!['@type'], 'Event');
  assert.equal(about[0]!.identifier, 'ent_rosa_parks');
});
