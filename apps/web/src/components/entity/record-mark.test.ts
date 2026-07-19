/**
 * Unit tests for record mark shape selection, alt copy, and caption constants.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RECORD_MARK_CAPTION,
  kindLabelForMark,
  recordMarkAlt,
  selectRecordMarkShape,
} from './record-mark.ts';

test('selectRecordMarkShape maps person and movement to arch', () => {
  assert.equal(selectRecordMarkShape('person'), 'arch');
  assert.equal(selectRecordMarkShape('movement'), 'arch');
});

test('selectRecordMarkShape maps place and event to pin', () => {
  assert.equal(selectRecordMarkShape('place'), 'pin');
  assert.equal(selectRecordMarkShape('event'), 'pin');
});

test('selectRecordMarkShape maps institutional kinds to book', () => {
  for (const kind of [
    'school',
    'institution',
    'organization',
    'publication',
    'law',
    'case',
  ] as const) {
    assert.equal(selectRecordMarkShape(kind), 'book');
  }
});

test('selectRecordMarkShape defaults to pin for unknown kinds', () => {
  assert.equal(selectRecordMarkShape(undefined), 'pin');
  assert.equal(selectRecordMarkShape('artifact'), 'pin');
});

test('kindLabelForMark returns title-case labels', () => {
  assert.equal(kindLabelForMark('school'), 'School');
  assert.equal(kindLabelForMark('person'), 'Person');
  assert.equal(kindLabelForMark(undefined), undefined);
});

test('alt text refuses likeness and photograph framing', () => {
  const alt = recordMarkAlt({
    entityName: 'Test Person',
    shape: 'arch',
    kindLabel: 'Person',
  });
  assert.match(alt, /symbolic record mark/i);
  assert.match(alt, /not a photograph/i);
  assert.match(alt, /Test Person/);
  assert.doesNotMatch(alt, /^Photograph of/i);
});

test('RECORD_MARK_CAPTION is present and honest', () => {
  assert.match(RECORD_MARK_CAPTION, /record mark/i);
  assert.match(RECORD_MARK_CAPTION, /rights-cleared photo/i);
});
