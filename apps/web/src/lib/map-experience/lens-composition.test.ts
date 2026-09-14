/**
 * The lens-level composition gate — repo-92n2.18 / design-direction-v9-surfaces.md's
 * "composition dignity gate". Exercises the same violence vocabulary `camera-dignity.test.ts`
 * pins, applied to a lens's active topic constraint rather than a selected record.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AREA_FILL_REFUSAL_NOTE,
  isSubjectViolenceConstrained,
  lensPermitsAreaFill,
  lensPermitsUnselectedMove,
  type LensSubject,
} from './lens-composition';

const VIOLENCE_TOPICS: readonly LensSubject[] = [
  { topicId: 'lynching', topicLabel: 'Lynching' },
  { topicId: 'racial-massacres', topicLabel: 'Racial massacres' },
  { topicId: 'sundown-towns', topicLabel: 'Sundown towns' },
  { topicId: 'racial-terror', topicLabel: 'Racial terror' },
];

const NON_VIOLENCE_TOPICS: readonly LensSubject[] = [
  { topicId: 'civil-rights', topicLabel: 'Civil rights movement' },
  { topicId: 'education', topicLabel: 'Education' },
  { topicId: null, topicLabel: null },
  {},
];

test('a lens with no active topic permits area fill and unselected moves', () => {
  for (const lens of NON_VIOLENCE_TOPICS) {
    assert.equal(isSubjectViolenceConstrained(lens), false, JSON.stringify(lens));
    assert.equal(lensPermitsAreaFill(lens), true, JSON.stringify(lens));
    assert.equal(lensPermitsUnselectedMove('spotlight', lens), true, JSON.stringify(lens));
    assert.equal(lensPermitsUnselectedMove('trace', lens), true, JSON.stringify(lens));
  }
});

test('a violence-constrained lens refuses area fill', () => {
  for (const lens of VIOLENCE_TOPICS) {
    assert.equal(isSubjectViolenceConstrained(lens), true, JSON.stringify(lens));
    assert.equal(lensPermitsAreaFill(lens), false, JSON.stringify(lens));
  }
});

test('a violence-constrained lens refuses spotlight and trace even with nothing selected', () => {
  for (const lens of VIOLENCE_TOPICS) {
    assert.equal(lensPermitsUnselectedMove('spotlight', lens), false, JSON.stringify(lens));
    assert.equal(lensPermitsUnselectedMove('trace', lens), false, JSON.stringify(lens));
  }
});

test('a violence-constrained lens does not refuse geography moves', () => {
  const lens: LensSubject = { topicId: 'lynching', topicLabel: 'Lynching' };
  for (const move of ['wide', 'push', 'orbit', 'tilt', 'flyToRecord'] as const) {
    assert.equal(lensPermitsUnselectedMove(move, lens), true, move);
  }
});

test('the topic label alone can carry the violence signal when only a display label is known', () => {
  assert.equal(isSubjectViolenceConstrained({ topicLabel: 'Racial violence' }), true);
});

test('matching is case insensitive, consistent with camera-dignity', () => {
  assert.equal(isSubjectViolenceConstrained({ topicId: 'LYNCHING' }), true);
});

test('the refusal note is plain language: no bead ids, no design-doc references', () => {
  assert.doesNotMatch(AREA_FILL_REFUSAL_NOTE, /repo-|design-direction|SP-\d/i);
  assert.ok(AREA_FILL_REFUSAL_NOTE.length > 0);
});
