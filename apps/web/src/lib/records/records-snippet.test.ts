import assert from 'node:assert/strict';
import { test } from 'node:test';
import { highlightSegments, matchSnippet } from './records-snippet';

test('every occurrence is marked, case-insensitively, and the text is kept whole', () => {
  const segments = highlightSegments('Church street, First Baptist church', 'church');
  assert.deepEqual(
    segments.map((segment) => [segment.text, segment.match]),
    [
      ['Church', true],
      [' street, First Baptist ', false],
      ['church', true],
    ],
  );
  assert.equal(
    segments.map((segment) => segment.text).join(''),
    'Church street, First Baptist church',
  );
});

test('a snippet starts near the first hit at a word boundary and says it was cut', () => {
  const text = `${'word '.repeat(40)}the congregation built a church here in 1867.`;
  const snippet = matchSnippet(text, 'church');
  assert.ok(snippet);
  const joined = snippet.map((segment) => segment.text).join('');
  assert.ok(joined.startsWith('…'), joined);
  assert.ok(!joined.startsWith('…ord'), 'cut falls on a word boundary');
  assert.ok(joined.indexOf('church') < 60, 'the term lands within the first line');
  assert.equal(snippet.filter((segment) => segment.match).length, 1);
});

test('no hit and no term give no snippet', () => {
  assert.equal(matchSnippet('A school in Georgia.', 'church'), undefined);
  assert.equal(matchSnippet('A school in Georgia.', '  '), undefined);
  assert.equal(matchSnippet('Church first.', 'church')?.[0]?.text, 'Church');
});
