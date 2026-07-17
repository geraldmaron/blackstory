/**
 * rot-rate telemetry per source class, plus the additive
 * confidence-engine authority signal it feeds.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeRotRateBySourceClass } from './rot-telemetry.js';
import { citationRotRateAuthoritySignal } from '../confidence-engine/engine.js';

test('computes rot rate and attention rate per source class', () => {
  const rows = computeRotRateBySourceClass([
    { sourceClassification: 'federal_archive', linkStatus: 'alive' },
    { sourceClassification: 'federal_archive', linkStatus: 'dead' },
    { sourceClassification: 'federal_archive', linkStatus: 'dead' },
    { sourceClassification: 'federal_archive', linkStatus: 'drifted' },
    { sourceClassification: 'local_news', linkStatus: 'alive' },
    { sourceClassification: 'local_news', linkStatus: 'dead' },
  ]);

  const federal = rows.find((row) => row.sourceClassification === 'federal_archive');
  assert.ok(federal);
  assert.equal(federal?.totalCitations, 4);
  assert.equal(federal?.deadCount, 2);
  assert.equal(federal?.driftedCount, 1);
  assert.equal(federal?.rotRate, 0.5);
  assert.equal(federal?.attentionRate, 0.75);

  const localNews = rows.find((row) => row.sourceClassification === 'local_news');
  assert.equal(localNews?.rotRate, 0.5);
});

test('sorts source classes by descending rot rate', () => {
  const rows = computeRotRateBySourceClass([
    { sourceClassification: 'stable_source', linkStatus: 'alive' },
    { sourceClassification: 'rotten_source', linkStatus: 'dead' },
  ]);
  assert.deepEqual(rows.map((r) => r.sourceClassification), ['rotten_source', 'stable_source']);
});

test('groups citations with no recorded classification under "unclassified" rather than dropping them', () => {
  const rows = computeRotRateBySourceClass([{ sourceClassification: undefined, linkStatus: 'dead' }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.sourceClassification, 'unclassified');
});

test('an empty input produces no rows', () => {
  assert.deepEqual(computeRotRateBySourceClass([]), []);
});

test('citationRotRateAuthoritySignal maps rot rate inversely into a 0..1 durability signal', () => {
  assert.equal(citationRotRateAuthoritySignal(0), 1);
  assert.equal(citationRotRateAuthoritySignal(1), 0);
  assert.equal(citationRotRateAuthoritySignal(0.25), 0.75);
});

test('citationRotRateAuthoritySignal clamps out-of-range input and rejects non-finite input', () => {
  assert.equal(citationRotRateAuthoritySignal(-1), 1);
  assert.equal(citationRotRateAuthoritySignal(2), 0);
  assert.throws(() => citationRotRateAuthoritySignal(Number.NaN));
});
