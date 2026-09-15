import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLivesCountNotes } from './count-notes.js';

const good = {
  id: 'n1930-mexican-race',
  decade: 1930,
  appliesTo: ['hispanic'],
  heading: 'Mexican, listed as a race once',
  body: 'In 1930 census takers were told to record many Mexican Americans as “Mexican.”',
  citations: [{ label: 'National Archives', url: 'https://www.archives.gov/' }],
  status: 'published',
};

test('a well-formed note passes and defaults its areas and order', () => {
  const { records, errors } = validateLivesCountNotes([good]);
  assert.deepEqual(errors, []);
  assert.equal(records[0]!.sortOrder, 0);
  assert.deepEqual(records[0]!.areaIds, []);
});

test('bad decades, lenses, citations and research markers are reported by note', () => {
  const { records, errors } = validateLivesCountNotes([
    good,
    { ...good },
    { ...good, id: 'n1935', decade: 1935 },
    { ...good, id: 'n-lens', appliesTo: ['black_nh'] },
    { ...good, id: 'n-cite', citations: [{ label: 'x', url: 'http://insecure.example' }] },
    { ...good, id: 'n-marker', body: 'The 2.5% figure is UNVERIFIED.' },
    { ...good, id: 'n-dash', heading: 'Counted — once' },
    { ...good, id: 'n-area', areaIds: ['region:chicago-il'] },
  ]);
  assert.equal(records.length, 1);
  assert.equal(errors.length, 7);
  assert.match(errors[0]!, /duplicate id/);
  assert.match(errors.join('\n'), /timeline decade/);
  assert.match(errors.join('\n'), /spaced em dash/);
});

test('the file must be an array', () => {
  assert.deepEqual(validateLivesCountNotes({}).errors, ['notes file must be a JSON array']);
});
