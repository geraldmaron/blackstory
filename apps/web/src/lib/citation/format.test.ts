/**
 * Citations must be byte-stable for a fixed record and injected date, so two readers citing the
 * same record on the same day produce the same string.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatAccessedDate, formatCitation, type CitationInput } from './format';

const SAMPLE: CitationInput = {
  name: 'A.G. Gaston Motel',
  place: 'Birmingham, Alabama',
  era: '1954 to 1968',
  grade: 'A',
  sourceCount: 4,
  url: 'https://blackstory.example/entity/ag-gaston-motel',
  accessed: new Date('2026-07-30T18:22:04.000Z'),
};

test('citation renders the documented format exactly', () => {
  assert.equal(
    formatCitation(SAMPLE),
    '"A.G. Gaston Motel." BlackStory Archive, Birmingham, Alabama, 1954 to 1968. ' +
      'Evidence grade A, 4 sources. Accessed 2026-07-30. ' +
      'https://blackstory.example/entity/ag-gaston-motel',
  );
});

test('citation is stable across repeated calls', () => {
  assert.equal(formatCitation(SAMPLE), formatCitation({ ...SAMPLE }));
});

test('a single source reads as singular', () => {
  assert.match(formatCitation({ ...SAMPLE, sourceCount: 1 }), /Evidence grade A, 1 source\./);
});

test('zero sources still renders rather than throwing', () => {
  assert.match(formatCitation({ ...SAMPLE, sourceCount: 0 }), /0 sources\./);
});

test('accessed date is UTC calendar date regardless of local offset', () => {
  // Late-evening UTC would roll back a day under a negative local offset if the formatter
  // used local time.
  assert.equal(formatAccessedDate(new Date('2026-07-30T23:59:59.000Z')), '2026-07-30');
  assert.equal(formatAccessedDate(new Date('2026-01-01T00:00:00.000Z')), '2026-01-01');
});

test('an invalid accessed date is refused rather than rendered as NaN', () => {
  assert.throws(() => formatAccessedDate(new Date('not a date')), /invalid accessed date/);
});

test('citation carries no em dash', () => {
  assert.ok(!formatCitation(SAMPLE).includes('—'));
});
