/**
 * Unit tests for record mark shape selection, alt copy, captions, and photo alt helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RECORD_MARK_CAPTION,
  RECORD_MARK_CAPTION_DATA_SAVER,
  RECORD_MARK_CAPTION_UNAVAILABLE,
  entityPrimaryImageAlt,
  kindLabelForMark,
  primaryImageRightsLabel,
  recordMarkAlt,
  recordMarkCaption,
  selectRecordMarkShape,
} from './record-mark.js';

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

test('alt text refuses likeness framing and avoids person-or-place only wording', () => {
  const alt = recordMarkAlt({
    entityName: 'Howard University',
    shape: 'book',
    kindLabel: 'School',
    jurisdictionLabel: 'Washington, D.C.',
  });
  assert.match(alt, /symbolic record mark/i);
  assert.match(alt, /Howard University/);
  assert.match(alt, /School record/);
  assert.match(alt, /Washington, D\.C\./);
  assert.match(alt, /not a photograph of Howard University/i);
  assert.doesNotMatch(alt, /person or place/i);
  assert.doesNotMatch(alt, /^Photograph of/i);
});

test('visible captions state load failure and data-saver reasons accurately', () => {
  assert.match(recordMarkCaption('exhausted'), /unavailable/i);
  assert.match(recordMarkCaption('prefer_mark'), /data saver/i);
  assert.match(recordMarkCaption('absent'), /rights-cleared photo/i);
});

test('recordMarkCaption maps each reason to an honest visible string', () => {
  assert.equal(recordMarkCaption('absent'), RECORD_MARK_CAPTION);
  assert.equal(recordMarkCaption('exhausted'), RECORD_MARK_CAPTION_UNAVAILABLE);
  assert.equal(recordMarkCaption('prefer_mark'), RECORD_MARK_CAPTION_DATA_SAVER);
  assert.equal(recordMarkCaption(undefined), RECORD_MARK_CAPTION);
});

test('entityPrimaryImageAlt prefers published alt and avoids likeness fallback', () => {
  assert.equal(
    entityPrimaryImageAlt('Official portrait of Kamala Harris, 2021', 'Kamala Harris'),
    'Official portrait of Kamala Harris, 2021',
  );
  assert.equal(
    entityPrimaryImageAlt('  ', 'Kamala Harris'),
    'Photograph associated with Kamala Harris',
  );
  assert.doesNotMatch(entityPrimaryImageAlt('', 'Kamala Harris'), /^Photograph of/i);
});

test('primaryImageRightsLabel expands snake_case statuses', () => {
  assert.equal(primaryImageRightsLabel('public_domain'), 'public domain');
  assert.equal(primaryImageRightsLabel('fair_use'), 'fair use');
  assert.equal(primaryImageRightsLabel('licensed'), 'licensed');
});
