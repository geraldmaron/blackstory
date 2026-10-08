import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MINIMUM_RECORD_CHECKLIST_KEYS, type ResearchCaseRecord } from '@repo/domain';
import { planAdminCaseChecklist } from './research-case-store';
import { findAdminRouteAccess } from '../auth/route-permissions';

const record: ResearchCaseRecord = {
  id: 'case-school',
  candidateId: 'candidate-school',
  title: 'Documented school',
  state: 'relevance_confirmed',
  checklist: { items: [] },
  history: [],
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
};
const minimum = MINIMUM_RECORD_CHECKLIST_KEYS.map((key) => ({
  key,
  complete: true,
  evidenceIds: [`evidence:${key}`],
}));
const now = '2026-10-08T00:00:00.000Z';
const plan = (checklist: unknown, caseRecord = record, reason = 'Reviewed exact source passages') =>
  planAdminCaseChecklist(caseRecord, checklist, 'verified-staff', reason, now);

test('minimum checklist advances readiness with the authenticated actor and cited history', () => {
  const next = plan({ items: minimum });
  assert.equal(next.state, 'minimum_record');
  assert.equal(next.history[0]?.actorId, 'verified-staff');
  assert.equal(next.history[0]?.reasonCode, 'minimum_record_complete');
  assert.equal(next.history[0]?.evidenceIds.length, 5);
  assert.equal(next.publication, undefined);
  assert.deepEqual(record.checklist.items, []);
});

test('maturity is derived from completed evidence rather than a caller-supplied state', () => {
  const next = plan({
    items: [...minimum, { key: 'dates', complete: true, evidenceIds: ['source:opening-date'] }],
  });
  assert.equal(next.state, 'partial_enrichment');
  assert.equal(next.history[0]?.reasonCode, 'partial_enrichment_complete');
});

test('incomplete, duplicate, unknown and malformed evidence cannot advance a case', () => {
  for (const input of [
    undefined,
    { items: 'not-an-array' },
    { items: [] },
    { items: minimum.slice(1) },
    { items: [...minimum, minimum[0]] },
    { items: [{ ...minimum[0], key: 'imaginary' }, ...minimum.slice(1)] },
    { items: [{ ...minimum[0], complete: 'true' }, ...minimum.slice(1)] },
    { items: [{ ...minimum[0], evidenceIds: [] }, ...minimum.slice(1)] },
    { items: [{ ...minimum[0], evidenceIds: [' '] }, ...minimum.slice(1)] },
    { items: [{ ...minimum[0], note: 42 }, ...minimum.slice(1)] },
  ])
    assert.throws(() => plan(input));
  assert.throws(() => plan({ items: minimum }, record, ' '), /reason/);
});

test('checklist submission cannot skip relevance or reopen excluded/merged cases', () => {
  for (const state of ['candidate', 'relevance_review', 'excluded', 'merged'] as const) {
    assert.throws(() => plan({ items: minimum }, { ...record, state }), /cannot transition/);
  }
});

test('checklist route requires research write permission and grants no publication authority', () => {
  assert.equal(
    findAdminRouteAccess('POST', '/admin/api/research-cases/case-school/checklist'),
    'research:write',
  );
  assert.equal(
    findAdminRouteAccess('DELETE', '/admin/api/research-cases/case-school/checklist'),
    undefined,
  );
});
