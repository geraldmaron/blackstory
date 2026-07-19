/**
 * Tests for research-case queue pure helpers: detail parsing, selection, and title heuristics.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RESEARCH_CASE_QUEUE_BULK_LIMIT,
  allVisibleResearchCasesSelected,
  formatResearchCaseWhen,
  isEntityLikeTitle,
  parseCandidateIdFromDetail,
  parseUpdatedAtFromDetail,
  toggleAllResearchCaseSelection,
  toggleResearchCaseSelection,
} from './research-case-queue.ts';

test('parseCandidateIdFromDetail reads live row detail format', () => {
  assert.equal(
    parseCandidateIdFromDetail(
      'submission CAN-1042 · updated 2026-07-18T12:00:00.000Z · private research case · not published',
    ),
    'CAN-1042',
  );
  assert.equal(parseCandidateIdFromDetail('5/5 publication requirements'), null);
});

test('parseUpdatedAtFromDetail reads iso timestamp segment', () => {
  assert.equal(
    parseUpdatedAtFromDetail(
      'submission CAN-1042 · updated 2026-07-18T12:00:00.000Z · private research case',
    ),
    '2026-07-18T12:00:00.000Z',
  );
});

test('isEntityLikeTitle detects person and organization titles', () => {
  assert.equal(isEntityLikeTitle('Lillian Parker'), true);
  assert.equal(isEntityLikeTitle('Ada L. Thompson'), true);
  assert.equal(isEntityLikeTitle('Southside Nurses Association'), true);
  assert.equal(isEntityLikeTitle('Greenwood Mutual Aid register'), false);
});

test('selection helpers respect bulk limit', () => {
  let selected = new Set<string>();
  for (let index = 0; index < RESEARCH_CASE_QUEUE_BULK_LIMIT + 5; index += 1) {
    selected = toggleResearchCaseSelection(selected, `case-${index}`);
  }
  assert.equal(selected.size, RESEARCH_CASE_QUEUE_BULK_LIMIT);

  const visible = Array.from({ length: 10 }, (_, index) => `visible-${index}`);
  const allSelected = toggleAllResearchCaseSelection(new Set(), visible, true);
  assert.equal(allSelected.size, 10);
  assert.equal(allVisibleResearchCasesSelected(allSelected, visible), true);
});

test('formatResearchCaseWhen returns em dash for empty input', () => {
  assert.equal(formatResearchCaseWhen(''), '—');
});
