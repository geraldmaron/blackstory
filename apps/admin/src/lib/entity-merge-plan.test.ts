/**
 * Rules a merge has to obey before any SQL runs (repo-gyq6.5).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_ABSORBED_PER_MERGE,
  countLeftBehind,
  countMoved,
  describeMerge,
  mergeLedgerIdFor,
  planMerge,
  type MergeReversalRecord,
} from './entity-merge-plan';

test('a plan needs a survivor and at least one record to absorb', () => {
  assert.equal(planMerge('', ['ent_b']).status, 'invalid');
  assert.equal(planMerge('   ', ['ent_b']).status, 'invalid');
  assert.equal(planMerge('ent_a', []).status, 'invalid');
  assert.equal(planMerge('ent_a', ['  ', '']).status, 'invalid');
});

test('duplicate absorbed ids collapse, whitespace is trimmed', () => {
  const result = planMerge(' ent_a ', ['ent_b', ' ent_b ', 'ent_c']);
  assert.equal(result.status, 'ok');
  assert.equal(result.status === 'ok' && result.plan.survivorId, 'ent_a');
  assert.deepEqual(result.status === 'ok' ? result.plan.absorbedIds : [], ['ent_b', 'ent_c']);
});

test('the survivor appearing in the absorbed list is an error, not something to drop silently', () => {
  // Silently dropping it would turn a mis-clicked radio into a merge the operator did not intend.
  const result = planMerge('ent_a', ['ent_a', 'ent_b']);
  assert.equal(result.status, 'invalid');
  assert.match(result.status === 'invalid' ? result.message : '', /cannot also be absorbed/i);
});

test('an implausibly large selection is refused rather than run', () => {
  const many = Array.from({ length: MAX_ABSORBED_PER_MERGE + 1 }, (_, index) => `ent_${index}`);
  const result = planMerge('ent_survivor', many);
  assert.equal(result.status, 'invalid');

  const atLimit = planMerge('ent_survivor', many.slice(0, MAX_ABSORBED_PER_MERGE));
  assert.equal(atLimit.status, 'ok');
});

test('the ledger id is stable, prefixed, and safe as a text key', () => {
  const id = mergeLedgerIdFor('1b4e28ba-2fa1-11d2-883f-0016d3cca427');
  assert.equal(id, mergeLedgerIdFor('1b4e28ba-2fa1-11d2-883f-0016d3cca427'));
  assert.match(id, /^merge_admin_[0-9a-f]{24}$/);
});

const RECORD: MergeReversalRecord = {
  mergeId: 'merge_admin_x',
  survivorId: 'ent_survivor',
  absorbedIds: ['ent_a', 'ent_b'],
  tables: {
    claims: {
      moved: [
        { id: 'c1', from: { entity: 'ent_a' } },
        { id: 'c2', from: { entity: 'ent_b' } },
      ],
      leftBehind: [],
    },
    entity_identifiers: {
      moved: [{ id: 'i1', from: { entity: 'ent_a' } }],
      leftBehind: [{ id: 'i2', reason: 'The survivor already carries this namespace and value.' }],
    },
  },
};

test('the reversal record counts what moved and what stayed', () => {
  assert.equal(countMoved(RECORD), 3);
  assert.equal(countLeftBehind(RECORD), 1);
  assert.equal(
    describeMerge(RECORD),
    '2 records absorbed into ent_survivor — 3 rows moved, 1 left behind',
  );
});

test('a clean merge does not mention rows left behind', () => {
  const clean: MergeReversalRecord = {
    ...RECORD,
    absorbedIds: ['ent_a'],
    tables: { claims: { moved: [{ id: 'c1', from: { entity: 'ent_a' } }], leftBehind: [] } },
  };
  assert.equal(describeMerge(clean), '1 record absorbed into ent_survivor — 1 row moved');
});

test('every moved row records where it came from — reversal has nothing else to go on', () => {
  for (const outcome of Object.values(RECORD.tables)) {
    for (const row of outcome.moved) {
      assert.ok(Object.keys(row.from).length > 0, `${row.id} has no origin recorded`);
    }
  }
});
