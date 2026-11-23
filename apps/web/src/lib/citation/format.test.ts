/**
 * Citations must be byte-stable for a fixed record and injected date, so two readers citing the
 * same record on the same day produce the same string.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatAccessedDate,
  formatApa,
  formatChicago,
  formatCitation,
  formatMla,
  formatStyledCitations,
  type CitationInput,
  type StyledCitationInput,
  type StyledCitationPart,
} from './format';

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

const text = (parts: readonly StyledCitationPart[]) =>
  parts.map((part) => (typeof part === 'string' ? part : part.i)).join('');

const PAGE: StyledCitationInput = {
  title: 'Roberts Chapel',
  url: 'https://blackstory.example/place/roberts-chapel',
  accessed: new Date('2026-11-23T23:30:00.000Z'),
  published: new Date('2026-08-07T02:00:00.000Z'),
};

test('MLA: title in quotes, site italic, page date, URL, access date', () => {
  const parts = formatMla(PAGE);
  assert.equal(
    text(parts),
    '"Roberts Chapel." BlackStory, 7 Aug. 2026, https://blackstory.example/place/roberts-chapel. Accessed 23 Nov. 2026.',
  );
  assert.deepEqual(parts[1], { i: 'BlackStory' });
});

test('APA: site as author, title italic, retrieval date', () => {
  const parts = formatApa(PAGE);
  assert.equal(
    text(parts),
    'BlackStory. (2026, August 7). Roberts Chapel. Retrieved November 23, 2026, from https://blackstory.example/place/roberts-chapel',
  );
  assert.deepEqual(parts[1], { i: 'Roberts Chapel.' });
});

test('Chicago: site as author, title in quotes, last modified, accessed', () => {
  assert.equal(
    text(formatChicago(PAGE)),
    'BlackStory. "Roberts Chapel." Last modified August 7, 2026. Accessed November 23, 2026. https://blackstory.example/place/roberts-chapel.',
  );
});

test('a page with no date on record: APA says n.d., MLA and Chicago leave the date out', () => {
  const undated = { ...PAGE, published: undefined };
  assert.match(text(formatApa(undated)), /^BlackStory\. \(n\.d\.\)\. /);
  assert.equal(
    text(formatMla(undated)),
    '"Roberts Chapel." BlackStory, https://blackstory.example/place/roberts-chapel. Accessed 23 Nov. 2026.',
  );
  assert.doesNotMatch(text(formatChicago(undated)), /Last modified/);
});

test('a title that already ends a sentence gets no second period', () => {
  assert.match(text(formatMla({ ...PAGE, title: 'Who Counts?' })), /^"Who Counts\?" BlackStory/);
});

test('dates are UTC and an invalid access date is refused', () => {
  const late = { ...PAGE, accessed: new Date('2026-11-23T23:59:59.000Z') };
  assert.match(text(formatChicago(late)), /Accessed November 23, 2026/);
  assert.throws(() => formatMla({ ...PAGE, accessed: new Date('nope') }), /invalid accessed date/);
});

test('all three styles come back in display order', () => {
  assert.deepEqual(
    formatStyledCitations(PAGE).map((format) => format.style),
    ['MLA', 'APA', 'Chicago'],
  );
});
