import assert from 'node:assert/strict';
import test from 'node:test';
import type { Verdict } from './lib/claim-review-ledger.ts';
import { mergeReports, verdictsByEntity } from './session-claim-review-apply.ts';

const verdict = (packetId: string) => ({ packetId }) as unknown as Verdict;

test('verdicts go to the record their packet belongs to; an unknown packet goes to the first', () => {
  const split = verdictsByEntity(
    [
      { packetId: 'p1', entityId: 'a' },
      { packetId: 'p2', entityId: 'b' },
      { packetId: 'p3', entityId: 'a' },
    ],
    [verdict('p1'), verdict('p2'), verdict('p3'), verdict('stray')],
  );
  assert.deepEqual(
    [...split].map(([id, list]) => [id, list.map((v) => v.packetId)]),
    [
      ['a', ['p1', 'p3', 'stray']],
      ['b', ['p2']],
    ],
  );
});

test('a record with no verdicts still gets its own run', () => {
  const split = verdictsByEntity([{ packetId: 'p1', entityId: 'a' }], []);
  assert.deepEqual([...split], [['a', []]]);
});

test('per-record reports merge in record order', () => {
  const empty = { approved: [], rejected: [], refused: [], written: [], publishable: [] };
  const merged = mergeReports([
    { ...empty, publishable: ['a'] },
    { ...empty, refused: [{ packetId: 'p2', errors: ['record b rolled back'] }] },
  ]);
  assert.deepEqual(merged.publishable, ['a']);
  assert.equal(merged.refused.length, 1);
});
