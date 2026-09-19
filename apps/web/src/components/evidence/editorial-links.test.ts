/**
 * Editorial off-ramp href builders for record evidence chrome.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  livedDecadeHrefForBucket,
  livedDecadeHrefForEra,
  METHODOLOGY_EVIDENCE_GRADES_HREF,
  METHODOLOGY_HOW_IT_HOLDS_TOGETHER_HREF,
  METHODOLOGY_HOW_RECORD_GETS_IN_HREF,
  METHODOLOGY_SOURCE_LIBRARY_HREF,
} from './editorial-links';

test('methodology anchors match the live Methodology section ids', () => {
  assert.equal(METHODOLOGY_HOW_RECORD_GETS_IN_HREF, '/methodology#how-a-record-gets-in');
  assert.equal(METHODOLOGY_EVIDENCE_GRADES_HREF, '/methodology#evidence-grades');
  assert.equal(METHODOLOGY_HOW_IT_HOLDS_TOGETHER_HREF, '/methodology#how-it-holds-together');
  assert.equal(METHODOLOGY_SOURCE_LIBRARY_HREF, '/sources');
});

test('livedDecadeHrefForBucket opens the Lives evidence appendix for supported decades', () => {
  assert.equal(livedDecadeHrefForBucket('1930s'), '/lives/explorer?decade=1930');
  // 1870 is the Lived default decade, so buildLivesHref omits the query param.
  assert.equal(livedDecadeHrefForBucket('1870s'), '/lives/explorer');
  assert.equal(livedDecadeHrefForBucket(''), undefined);
  assert.equal(livedDecadeHrefForBucket('1700s'), undefined);
  assert.equal(livedDecadeHrefForBucket('pre-1900'), undefined);
});

test('livedDecadeHrefForEra uses the first resolvable bucket', () => {
  const href = livedDecadeHrefForEra({ eraBuckets: ['1860s', '1890s'] });
  assert.ok(href?.startsWith('/lives'));
  assert.equal(livedDecadeHrefForEra({ eraBuckets: [] }), undefined);
});
