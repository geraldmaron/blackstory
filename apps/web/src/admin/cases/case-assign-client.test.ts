import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSIGN_TO_SELF_DEFAULT_REASON,
  assigneeLabel,
  buildAssignToMeBody,
} from './case-assign-client';

test('buildAssignToMeBody falls back to the default reason when blank', () => {
  assert.deepEqual(buildAssignToMeBody('  '), { reason: ASSIGN_TO_SELF_DEFAULT_REASON });
});

test('buildAssignToMeBody trims a written reason', () => {
  assert.deepEqual(buildAssignToMeBody('  taking this one '), { reason: 'taking this one' });
});

test('assigneeLabel names the reviewer or says Unassigned', () => {
  assert.equal(assigneeLabel({ reviewerId: 'uid-1' }), 'uid-1');
  assert.equal(assigneeLabel(undefined), 'Unassigned');
  assert.equal(assigneeLabel(null), 'Unassigned');
  assert.equal(assigneeLabel({ reviewerId: '' }), 'Unassigned');
});
