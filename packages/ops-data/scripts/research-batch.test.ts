import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleIds, firstJson, passingEntities, standingDecisions } from './research-batch.ts';

test('firstJson reads the report and ignores the prose a step prints after it', () => {
  const out =
    '== x ==\n{\n  "mode": "dry-run",\n  "refused": [{"a": 1}]\n}\n\nDRY_RUN (default): nothing {written}.';
  assert.deepEqual(firstJson(out), { mode: 'dry-run', refused: [{ a: 1 }] });
  assert.throws(() => firstJson('no report here'), /no JSON report/u);
});

test('a record is held alone for a blocked, unreviewed, refused or rejected claim', () => {
  const packets = [
    { packetId: 'p1', entityId: 'a' },
    { packetId: 'p2', entityId: 'a' },
    { packetId: 'p3', entityId: 'b' },
    { packetId: 'p4', entityId: 'c' },
    { packetId: 'p5', entityId: 'd' },
  ];
  const result = passingEntities(
    packets,
    ['p1', 'p2', 'p3', 'p4'],
    { rejected: [{ entityId: 'b' }], refused: [{ packetId: 'p4' }] },
    ['e'],
  );
  assert.deepEqual(result.passing, ['a']);
  assert.deepEqual(result.held, {
    e: 'a claim has no reviewable capture',
    d: 'a claim got no verdict',
    c: 'the ledger refused a verdict',
    b: 'a claim was rejected',
  });
  assert.deepEqual(passingEntities(packets, ['p1', 'p2', 'p3', 'p4', 'p5'], {}).passing, [
    'a',
    'b',
    'c',
    'd',
  ]);
});

test('the standing capture rule covers recognized publishers only and never allows archiving', () => {
  const decisions = standingDecisions(
    [
      'https://www.loc.gov/item/1',
      'https://www.loc.gov/item/1',
      'https://en.wikipedia.org/wiki/X',
      'https://loc.gov.evil.example/x',
      'not a url',
    ],
    new Date('2026-11-25T00:00:00Z'),
  );
  assert.deepEqual(
    decisions.map((decision) => decision.sourceUrl),
    ['https://www.loc.gov/item/1'],
  );
  assert.equal(decisions[0]!.allowArchive, false);
  assert.equal(decisions[0]!.expiresAt, '2027-11-25T00:00:00.000Z');
});

test('only the asked-for ids the publisher lists as eligible are published', () => {
  const out =
    'Eligible: 1\nSkipped: 1\n\nEligible IDs:\n  rec-a (basis=independent_review)\n  rec-x (basis=independent_review)\n\nSkip counts:\n  claim_assessment_required: 1\n';
  assert.deepEqual(eligibleIds(out, ['rec-a', 'rec-b']), ['rec-a']);
  assert.deepEqual(eligibleIds('Eligible: 0', ['rec-a']), []);
});
