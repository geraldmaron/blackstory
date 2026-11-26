import assert from 'node:assert/strict';
import test from 'node:test';
import { assessmentBrief, combineAssessments } from './source-assess.ts';

test('the brief names the host and never mentions a record or claim to unblock', () => {
  const brief = assessmentBrief('seattlemedium.com');
  assert.match(brief, /seattlemedium\.com/u);
  assert.doesNotMatch(brief, /record id|entity|claim/iu);
});

test('assessments pair by host and an unpaired host is reported, not applied', () => {
  const { rows, unpaired } = combineAssessments(
    [
      { host: 'a.org', label: 'A', assessment: { actorId: 'claude' } },
      { host: 'b.org', label: 'B', assessment: { actorId: 'claude' } },
    ],
    [
      { host: 'a.org', label: 'A', assessment: { actorId: 'sol' } },
      { host: 'c.org', label: 'C', assessment: { actorId: 'sol' } },
    ],
  );
  assert.deepEqual(rows, [
    { host: 'a.org', label: 'A', assessments: [{ actorId: 'claude' }, { actorId: 'sol' }] },
  ]);
  assert.deepEqual(unpaired.sort(), ['b.org', 'c.org']);
});
