import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  eraTagsForBuckets,
  humanizeTag,
  mentionedRecordIds,
  suggestTags,
  type RecordMeta,
} from './tag-suggestions';

const meta = (id: string, eraBuckets: string[], topicTags: string[] = []): RecordMeta => ({
  id,
  displayName: id.toUpperCase(),
  kind: 'place',
  published: true,
  eraBuckets,
  topicTags,
});

describe('eraTagsForBuckets', () => {
  it('maps decades into the existing era vocabulary', () => {
    assert.deepEqual(eraTagsForBuckets(['1860s']), ['Civil War', 'Reconstruction']);
    assert.deepEqual(eraTagsForBuckets(['1870s']), ['Reconstruction']);
    assert.deepEqual(eraTagsForBuckets(['1955']), ['Civil rights era']);
    assert.deepEqual(eraTagsForBuckets(['1990s']), ['Modern era']);
    assert.deepEqual(eraTagsForBuckets(['unknown']), []);
  });
});

describe('suggestTags', () => {
  it('ranks by record count, humanizes subjects and skips held or dismissed tags', () => {
    const records = [
      meta('a', ['1950s'], ['school-desegregation']),
      meta('b', ['1960s'], ['school-desegregation', 'voting-rights']),
      meta('c', ['1890s']),
    ];
    const out = suggestTags(records, {
      existing: ['jim crow era'],
      dismissed: new Set(['Voting rights']),
    });
    assert.deepEqual(
      out.map((s) => [s.tag, s.records.length]),
      [
        ['Civil rights era', 2],
        ['School desegregation', 2],
      ],
    );
  });
  it('shows at most six', () => {
    const many = [meta('a', ['1950s'], ['a', 'b', 'c', 'd', 'e', 'f', 'g'])];
    assert.equal(suggestTags(many, { existing: [], dismissed: new Set() }).length, 6);
  });
});

describe('mentionedRecordIds', () => {
  it('reads inline links and map insets', () => {
    const ids = mentionedRecordIds([
      { type: 'paragraph', text: 'See [[abc|Abc Hall]] and [[def]].' },
      { type: 'list', items: ['[[ghi]]'] },
      { type: 'mapInset', entityId: 'jkl' },
    ]);
    assert.deepEqual(ids.sort(), ['abc', 'def', 'ghi', 'jkl']);
  });
  it('humanizes', () => assert.equal(humanizeTag('school-desegregation'), 'School desegregation'));
});
