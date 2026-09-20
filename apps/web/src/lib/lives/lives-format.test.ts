import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeLivesCell,
  formatInForceYears,
  formatLivesMargin,
  formatLivesPercent,
} from './lives-format';

test('percentages and margins read plainly', () => {
  assert.equal(formatLivesPercent(41.6), '42%');
  assert.equal(formatLivesMargin(3.2), '±3 points');
  assert.equal(formatLivesMargin(1.1), '±1 point');
  assert.equal(formatLivesMargin(0.3), 'within 1 point');
});

test('a published cell shows value, margin and partial coverage', () => {
  assert.deepEqual(
    describeLivesCell({
      state: 'published',
      estimate: 41.2,
      marginOfError: 3.1,
      coveragePct: 86.4,
    }),
    { text: '41%', detail: '±3 points · covers 86% of the group', tone: 'value' },
  );
});

test('a proxy says where it was counted, and a wide margin says so first', () => {
  assert.equal(
    describeLivesCell({ state: 'published', estimate: 30, countedIn: ['Texas'] }).detail,
    'counted only in Texas',
  );
  const wide = describeLivesCell({ state: 'wide_margin', estimate: 30, marginOfError: 12 });
  assert.equal(wide.tone, 'wide');
  assert.equal(wide.detail, 'Wide margin · ±12 points');
});

test('missing values always say why', () => {
  assert.deepEqual(describeLivesCell({ state: 'suppressed', reason: 'Too few counted to say.' }), {
    text: 'Withheld',
    detail: 'Too few counted to say.',
    tone: 'muted',
  });
  assert.equal(describeLivesCell({ state: 'not_measured', reason: 'x' }).text, 'Not published');
  assert.equal(describeLivesCell({ state: 'pending' }).text, 'Not yet counted');
});

test('in-force years read open-ended or bounded', () => {
  assert.equal(formatInForceYears(1968, null), 'In force from 1968');
  assert.equal(formatInForceYears(1896, 1954), 'In force 1896–1954');
});

test('a figure is printed and drawn in its own unit, never as a percent it is not', async () => {
  const { formatLivesValue, livesBarShare, livesBarScaleNote, describeLivesCell } =
    await import('./lives-format');
  assert.equal(formatLivesValue(44.4), '44%');
  assert.equal(formatLivesValue(71.8, 'years'), '71.8 years');
  assert.equal(formatLivesValue(14.1, 'per_1000'), '14.1 per 1,000');
  // 14.1 deaths per 1,000 is a short bar on a 200 scale, not a 14% bar.
  assert.equal(Math.round(livesBarShare(14.1, 'per_1000') * 100) / 100, 7.05);
  assert.equal(livesBarShare(71.8, 'years'), 71.8);
  assert.equal(livesBarShare(250, 'per_1000'), 100);
  assert.equal(livesBarScaleNote('percent'), null);
  assert.match(livesBarScaleNote('per_1000') ?? '', /200 deaths per 1,000/);
  assert.equal(
    describeLivesCell({ state: 'published', estimate: 71.8 }, 'years').text,
    '71.8 years',
  );
});
