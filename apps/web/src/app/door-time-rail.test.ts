import assert from 'node:assert/strict';
import test from 'node:test';
import { timeRailText } from './door-time-rail';
import { lightThroughDecade } from './door-field-frame';

test('the rail says the decade and the counts in words', () => {
  assert.equal(timeRailText(null, 4393, 0), 'All time. 4,393 records');
  assert.equal(timeRailText(1920, 1, 0), 'Through the 1920s. 1 record');
  assert.equal(timeRailText(1860, 310, 12), 'Through the 1860s. 310 records, 12 undated');
});

test('a record with no decade stays lit at every position', () => {
  const decades = [1770, 1860, 1960, null];
  assert.deepEqual(
    decades.map((decade) => lightThroughDecade(decade, 1860)),
    [true, true, false, true],
  );
  assert.ok(decades.every((decade) => lightThroughDecade(decade, null)));
});
