/**
 * Tests for admin case-queue filter/sort/selection helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RESEARCH_CASE_BULK_LIMIT,
  applyCaseQueue,
  commonActionsForSelection,
  countCaseQueue,
  toggleCaseSelection,
} from './case-queue.ts';
import type { AdminCaseListItem } from './research-case-types.ts';
import {
  CASE_QUEUE_INTENT_COPY,
  CASE_TRIAGE_STEPS,
  actionHelp,
  filterChipLabel,
  legalActionsForState,
  missingDecisionReasonMessage,
  stateLabel,
} from './research-case-types.ts';
import { parseResearchCaseRecord } from './parse-research-case.ts';

const sample: AdminCaseListItem = {
  id: 'case-1',
  title: 'Ada Thompson',
  state: 'candidate',
  candidateId: 'sub-1',
  updatedAt: '2026-07-18T12:00:00.000Z',
  createdAt: '2026-07-18T11:00:00.000Z',
  checklistComplete: 0,
  checklistTotal: 0,
  placeHint: 'Tulsa',
};

test('applyCaseQueue filters inbox and search', () => {
  const rows: AdminCaseListItem[] = [
    sample,
    { ...sample, id: 'case-2', state: 'excluded', title: 'Other' },
    {
      ...sample,
      id: 'case-3',
      state: 'relevance_review',
      title: 'Review me',
      placeHint: 'Chicago',
    },
  ];
  const inbox = applyCaseQueue(rows, {
    search: '',
    state: 'inbox',
    sortKey: 'updatedAt',
    sortDirection: 'desc',
  });
  assert.equal(inbox.length, 2);
  const search = applyCaseQueue(rows, {
    search: 'chicago',
    state: 'all',
    sortKey: 'title',
    sortDirection: 'asc',
  });
  assert.equal(search.length, 1);
  assert.equal(search[0]?.id, 'case-3');
});

test('countCaseQueue and selection helpers', () => {
  const rows: AdminCaseListItem[] = [
    sample,
    { ...sample, id: 'case-2', state: 'relevance_review' },
  ];
  const counts = countCaseQueue(rows);
  assert.equal(counts.inbox, 2);
  assert.equal(counts.candidate, 1);

  let selected = new Set<string>();
  for (let i = 0; i < RESEARCH_CASE_BULK_LIMIT + 3; i += 1) {
    selected = toggleCaseSelection(selected, `id-${i}`);
  }
  assert.equal(selected.size, RESEARCH_CASE_BULK_LIMIT);
});

test('commonActionsForSelection intersects legal actions', () => {
  const rows: AdminCaseListItem[] = [
    sample,
    { ...sample, id: 'case-2', state: 'relevance_review' },
  ];
  const actions = commonActionsForSelection(rows, new Set(['case-1', 'case-2']));
  assert.ok(actions.includes('merge'));
  assert.ok(!actions.includes('confirm_relevance'));
});

test('legalActionsForState and stateLabel cover triage states', () => {
  assert.deepEqual(legalActionsForState('candidate'), ['send_to_relevance', 'merge']);
  assert.equal(stateLabel('candidate'), 'Awaiting triage');
  assert.equal(stateLabel('insufficient_evidence'), 'Needs evidence');
  assert.equal(stateLabel('relevance_review'), 'Relevance review');
});

test('filterChipLabel matches state badges for operator-facing filters', () => {
  assert.equal(filterChipLabel('candidate'), stateLabel('candidate'));
  assert.equal(filterChipLabel('candidate'), 'Awaiting triage');
  assert.equal(filterChipLabel('relevance_review'), 'Relevance review');
  assert.equal(filterChipLabel('insufficient_evidence'), 'Needs evidence');
  assert.equal(filterChipLabel('inbox'), 'Inbox');
  assert.equal(filterChipLabel('all'), 'All');
});

test('CASE_QUEUE_INTENT_COPY distinguishes inbox from cases browse', () => {
  assert.match(CASE_QUEUE_INTENT_COPY.inbox, /do not publish/i);
  assert.match(CASE_QUEUE_INTENT_COPY.cases, /Releases/i);
  assert.notEqual(CASE_QUEUE_INTENT_COPY.inbox, CASE_QUEUE_INTENT_COPY.cases);
});

test('CASE_TRIAGE_STEPS and actionHelp explain the decision workflow', () => {
  assert.equal(CASE_TRIAGE_STEPS.length, 3);
  assert.match(CASE_TRIAGE_STEPS[1]!, /reason/i);
  assert.match(actionHelp('send_to_relevance'), /relevance review/i);
  assert.match(missingDecisionReasonMessage('send_to_relevance'), /Send to relevance/);
  assert.match(missingDecisionReasonMessage('send_to_relevance'), /does not publish/i);
});

test('parseResearchCaseRecord coerces sparse stored records', () => {
  const parsed = parseResearchCaseRecord('case-x', {
    title: 'Sparse',
    state: 'candidate',
    candidateId: 'cand-1',
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
  });
  assert.ok(parsed);
  assert.equal(parsed?.record.checklist.items.length, 0);
  assert.equal(parsed?.record.history.length, 0);
});
