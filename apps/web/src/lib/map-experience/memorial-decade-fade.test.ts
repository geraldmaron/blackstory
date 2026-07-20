/**
 * Unit tests for memorial decade fade plans and stagger schedules.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { MemorialNameFeature } from './build-memorial-name-features';
import {
  memorialStaggerDelays,
  parseAmbientDecadeStart,
  planMemorialDecadeFade,
} from './memorial-decade-fade';

function feature(id: string, decadeStart: number): MemorialNameFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: {
      id,
      name: id,
      year: decadeStart + 4,
      decadeStart,
      ink: 0.3,
      size: 12,
      rotate: 0,
      priority: 1,
    },
  };
}

test('parseAmbientDecadeStart reads 2010s and rejects Today', () => {
  assert.equal(parseAmbientDecadeStart('2010s'), 2010);
  assert.equal(parseAmbientDecadeStart('Today'), undefined);
  assert.equal(parseAmbientDecadeStart(undefined), undefined);
});

test('complete frame restores every name', () => {
  const features = [feature('a', 1990), feature('b', 2010)];
  const plan = planMemorialDecadeFade(features, { isComplete: true });
  assert.deepEqual([...plan.restoreImmediate].sort(), ['a', 'b']);
  assert.equal(plan.staggerPass.length, 0);
  assert.equal(plan.passImmediate.length, 0);
});

test('newest→oldest: current decade staggers, newer already passed, older wait', () => {
  const features = [feature('newer', 2020), feature('current', 2010), feature('older', 1990)];
  const plan = planMemorialDecadeFade(features, { decade: '2010s' });
  assert.deepEqual(plan.passImmediate, ['newer']);
  assert.deepEqual(plan.staggerPass, ['current']);
  assert.deepEqual(plan.restoreImmediate, ['older']);
});

test('scrub back to a newer decade restores older-than-current deaths', () => {
  const features = [feature('a', 2010), feature('b', 2020), feature('c', 1990)];
  const plan = planMemorialDecadeFade(features, { decade: '2020s' });
  assert.deepEqual(plan.staggerPass, ['b']);
  assert.ok(plan.restoreImmediate.includes('a'));
  assert.ok(plan.restoreImmediate.includes('c'));
  assert.equal(plan.passImmediate.length, 0);
});

test('stagger delays spread across the window in small batches', () => {
  const ids = Array.from({ length: 9 }, (_, i) => `n${i}`);
  const schedule = memorialStaggerDelays(ids, 2700);
  assert.equal(schedule.length, 9);
  assert.equal(schedule[0]!.delayMs, 0);
  assert.ok(schedule[schedule.length - 1]!.delayMs <= 2700);
  const uniqueDelays = new Set(schedule.map((entry) => entry.delayMs));
  assert.ok(uniqueDelays.size >= 3, 'must not wipe all names on one tick');
});
