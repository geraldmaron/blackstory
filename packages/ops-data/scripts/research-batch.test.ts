import assert from 'node:assert/strict';
import test from 'node:test';
import { firstJson, passingEntities, standingDecisions } from './research-batch.ts';

test('firstJson reads the report and ignores the prose a step prints after it', () => {
  const out =
    '== x ==\n{\n  "mode": "dry-run",\n  "refused": [{"a": 1}]\n}\n\nDRY_RUN (default): nothing {written}.';
  assert.deepEqual(firstJson(out), { mode: 'dry-run', refused: [{ a: 1 }] });
  assert.throws(() => firstJson('no report here'), /no JSON report/u);
});

test('a batch stops on missing verdicts or refusals and holds records with a rejected claim', () => {
  const packets = ['a', 'a', 'b'];
  assert.throws(() => passingEntities(packets, 2, {}), /2 verdicts for 3 packets/u);
  assert.throws(() => passingEntities(packets, 3, { refused: [{ packetId: 'p' }] }), /refused 1/u);
  assert.deepEqual(passingEntities(packets, 3, { rejected: [{ entityId: 'b' }] }), ['a']);
  assert.deepEqual(passingEntities(packets, 3, {}), ['a', 'b']);
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
