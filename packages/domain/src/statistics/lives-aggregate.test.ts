import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aggregateDistribution,
  aggregateRate,
  coverageShare,
  estimateBandShares,
  estimateCountBelow,
  estimateMedian,
  sumBrackets,
  type IncomeBracket,
} from './lives-aggregate.js';

const close = (actual: number | null, expected: number, tolerance = 1e-6) =>
  assert.ok(
    actual !== null && Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  );

test('region rates sum counts across member states only', () => {
  const rate = aggregateRate(
    [
      { jurisdictionId: 'state:01', numerator: 30, denominator: 100 },
      { jurisdictionId: 'state:28', numerator: 70, denominator: 100 },
      { jurisdictionId: 'state:36', numerator: 99, denominator: 100 },
    ],
    ['state:01', 'state:28'],
  );
  assert.equal(rate?.ratePct, 50);
  assert.deepEqual(rate?.jurisdictionsCovered, ['state:01', 'state:28']);
  assert.equal(aggregateRate([], ['state:01']), null);
});

test('coverage is the published share of the region population, or unknown', () => {
  const population = new Map([
    ['state:01', 800],
    ['state:28', 200],
  ]);
  close(coverageShare(['state:01'], population, ['state:01', 'state:28']), 0.8);
  assert.equal(coverageShare(['state:01'], population, ['state:01', 'state:13']), null);
});

test('distributions sum buckets across states', () => {
  const result = aggregateDistribution(
    {
      lower: [
        { jurisdictionId: 'state:01', numerator: 60, denominator: 0 },
        { jurisdictionId: 'state:28', numerator: 20, denominator: 0 },
      ],
      upper: [{ jurisdictionId: 'state:01', numerator: 20, denominator: 0 }],
    },
    ['state:01', 'state:28'],
  );
  assert.equal(result?.total, 100);
  assert.equal(result?.sharesPct.lower, 80);
  assert.equal(result?.sharesPct.upper, 20);
});

const brackets: IncomeBracket[] = [
  { lower: 0, upper: 10_000, count: 100 },
  { lower: 10_000, upper: 20_000, count: 100 },
  { lower: 20_000, upper: 40_000, count: 100 },
  { lower: 40_000, upper: null, count: 100 },
];

test('counts below a threshold interpolate linearly inside a closed bracket', () => {
  close(estimateCountBelow(brackets, 15_000), 150);
  close(estimateCountBelow(brackets, 20_000), 200);
  close(estimateCountBelow(brackets, 0), 0);
});

test('the open top bracket uses a Pareto shape from the two highest bounds', () => {
  const alpha = Math.log(200 / 100) / Math.log(40_000 / 20_000);
  const expected = 300 + (100 - 100 * Math.pow(40_000 / 60_000, alpha));
  close(estimateCountBelow(brackets, 60_000), expected);
});

test('band shares sum to 100 and use two-thirds and double the median', () => {
  const bands = estimateBandShares(brackets, 15_000);
  assert.ok(bands);
  close(bands!.lowerPct + bands!.middlePct + bands!.upperPct, 100, 1e-9);
  assert.equal(bands!.lowerThreshold, 10_000);
  assert.equal(bands!.upperThreshold, 30_000);
  close(bands!.lowerPct, 25);
  close(bands!.middlePct, 37.5);
});

test('the median estimate reproduces a known median inside a closed bracket', () => {
  close(estimateMedian(brackets), 20_000);
});

test('bracket sets must share edges to be summed', () => {
  const summed = sumBrackets([brackets, brackets]);
  assert.equal(summed[0]!.count, 200);
  assert.throws(() =>
    sumBrackets([brackets, [{ lower: 0, upper: 5_000, count: 1 }, ...brackets.slice(1)]]),
  );
});

test('malformed brackets are refused', () => {
  assert.throws(() => estimateCountBelow([{ lower: 0, upper: null, count: 1 }], 5));
  assert.throws(() =>
    estimateCountBelow(
      [
        { lower: 0, upper: 10, count: 1 },
        { lower: 20, upper: null, count: 1 },
      ],
      5,
    ),
  );
});
