import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertFactRevisionValid,
  assertRevisionsAppendOnly,
  buildNextRevision,
  currentFactRevision,
  type FactRevision,
} from './revision.js';

const agent = { id: 'user-1', type: 'user' as const, displayName: 'Editor' };

function revision(overrides: Partial<FactRevision> = {}): FactRevision {
  return {
    revisionNumber: 1,
    timestamp: '2026-01-01T00:00:00.000Z',
    agent,
    changeType: 'update',
    summary: 'Initial publication.',
    diff: [],
    ...overrides,
  };
}

test('a well-formed revision passes validation', () => {
  assert.doesNotThrow(() => assertFactRevisionValid(revision()));
});

test('a revision with an empty summary is rejected (mandatory edit summary)', () => {
  assert.throws(() => assertFactRevisionValid(revision({ summary: '' })));
  assert.throws(() => assertFactRevisionValid(revision({ summary: '   ' })));
});

test('a revision with an unknown changeType is rejected', () => {
  assert.throws(() => assertFactRevisionValid(revision({ changeType: 'rewrite' as never })));
});

test('buildNextRevision appends a gapless sequence number', () => {
  const first = buildNextRevision({
    previousRevisions: [],
    timestamp: '2026-01-01T00:00:00.000Z',
    agent,
    changeType: 'update',
    summary: 'Initial publication.',
    diff: [],
  });
  const second = buildNextRevision({
    previousRevisions: [first],
    timestamp: '2026-02-01T00:00:00.000Z',
    agent,
    changeType: 'correction',
    summary: 'Fixed the date.',
    diff: [{ field: 'when.validFrom', before: '1955', after: '1955-12-01' }],
  });
  assert.equal(first.revisionNumber, 1);
  assert.equal(second.revisionNumber, 2);
  assert.equal(currentFactRevision([first, second]), second);
});

test('assertRevisionsAppendOnly accepts a valid append', () => {
  const previous = [revision()];
  const next = [revision(), revision({ revisionNumber: 2, changeType: 'correction', summary: 'Fixed a typo.' })];
  assert.doesNotThrow(() => assertRevisionsAppendOnly(previous, next));
});

test('assertRevisionsAppendOnly rejects mutating a prior revision', () => {
  const previous = [revision()];
  const mutated = [revision({ summary: 'Rewritten history.' })];
  assert.throws(() => assertRevisionsAppendOnly(previous, mutated));
});

test('assertRevisionsAppendOnly rejects a shrinking revision list', () => {
  const previous = [revision(), revision({ revisionNumber: 2 })];
  assert.throws(() => assertRevisionsAppendOnly(previous, [revision()]));
});

test('assertRevisionsAppendOnly rejects a gap in revisionNumber sequence', () => {
  const next = [revision(), revision({ revisionNumber: 3 })];
  assert.throws(() => assertRevisionsAppendOnly([], next));
});

test('currentFactRevision returns undefined for an empty revision list', () => {
  assert.equal(currentFactRevision([]), undefined);
});
