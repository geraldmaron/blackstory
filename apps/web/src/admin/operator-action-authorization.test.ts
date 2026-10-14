import assert from 'node:assert/strict';
import { test } from 'node:test';
import { submitQuickAdd } from '../app/admin/quick-add/actions';
import { submitEvidenceAttach } from '../app/admin/evidence/actions';

test('operator intake actions refuse a forged form identity without a verified staff session', async () => {
  const form = new FormData();
  form.set('operatorId', 'forged-admin@example.invalid');
  form.set('url', 'https://example.org/source');
  form.set('researchCaseId', 'case-qa');
  form.set('description', 'A source supporting the opening year.');
  form.set('sourceUrl', 'https://example.org/source');
  form.set('commit', '1');
  for (const action of [submitQuickAdd, submitEvidenceAttach]) {
    const result = await action({ status: 'idle' }, form);
    assert.equal(result.status, 'error');
    assert.ok(result.status === 'error' && /staff session/.test(result.error));
  }
});
