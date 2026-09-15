import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeLivesCell,
  formatInForceYears,
  formatLivesEstimate,
  formatLivesMargin,
} from './lives-format';

test('estimates format by unit', () => {
  assert.equal(formatLivesEstimate(41.6, 'percent'), '42%');
  assert.equal(formatLivesEstimate(42_349, 'usd_2024'), '$42,300');
  assert.equal(formatLivesEstimate(3.44, 'persons'), '3.4');
});

test('margins read as points, dollars or persons', () => {
  assert.equal(formatLivesMargin(3.2, 'percent'), '±3 points');
  assert.equal(formatLivesMargin(1.1, 'percent'), '±1 point');
  assert.equal(formatLivesMargin(0.3, 'percent'), 'within 1 point');
  assert.equal(formatLivesMargin(2_460, 'usd_2024'), '±$2,500');
  assert.equal(formatLivesMargin(0.24, 'persons'), '±0.2');
});

test('a published cell shows value, margin and record count', () => {
  assert.deepEqual(
    describeLivesCell(
      { state: 'published', estimate: 41.2, marginOfError: 3.1, unweightedN: 1812 },
      'percent',
    ),
    { text: '41%', detail: '±3 points · 1,812 census records', tone: 'value' },
  );
});

test('a wide-margin cell says so before the margin', () => {
  const display = describeLivesCell(
    { state: 'wide_margin', estimate: 30, marginOfError: 12, unweightedN: 90 },
    'percent',
  );
  assert.equal(display.tone, 'wide');
  assert.equal(display.detail, 'Wide margin · ±12 points · 90 census records');
});

test('missing values always say why', () => {
  assert.deepEqual(
    describeLivesCell({ state: 'suppressed', reason: 'unweighted n 12 is below 50' }, 'percent'),
    { text: 'Too few records', detail: 'unweighted n 12 is below 50', tone: 'muted' },
  );
  assert.equal(
    describeLivesCell({ state: 'not_measured', reason: 'x' }, 'percent').text,
    'Not asked',
  );
  assert.equal(describeLivesCell({ state: 'pending' }, 'usd_2024').text, 'Not yet counted');
});

test('in-force years read open-ended or bounded', () => {
  assert.equal(formatInForceYears(1968, null), 'In force from 1968');
  assert.equal(formatInForceYears(1896, 1954), 'In force 1896–1954');
});
