/**
 * Unit tests for memorial name breath pick/apply helpers.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { MemorialNameEntry } from './memorial-names';
import {
  applyMemorialNameSwap,
  memorialBreathBatchSize,
  pickMemorialNameSwap,
  type MemorialNameLayers,
} from './select-memorial-swap';

const pool: MemorialNameEntry[] = [
  { name: 'A', year: 1901, category: 'police_violence' },
  { name: 'B', year: 1902, category: 'police_violence' },
  { name: 'C', year: 1903, category: 'racial_terror' },
  { name: 'D', year: 1904, category: 'racial_terror' },
  { name: 'E', year: 1905, category: 'police_violence' },
  { name: 'F', year: 1906, category: 'police_violence' },
  { name: 'G', year: 1907, category: 'racial_terror' },
  { name: 'H', year: 1908, category: 'racial_terror' },
  { name: 'I', year: 1909, category: 'police_violence' },
  { name: 'J', year: 1910, category: 'police_violence' },
];

function cell(entry: MemorialNameEntry | null, present = true): MemorialNameLayers {
  return { a: entry, b: entry, showB: false, fading: false, present };
}

test('pickMemorialNameSwap returns a name not currently visible on replace/arrive', () => {
  const cells = [cell(pool[0]!), cell(pool[1]!), cell(pool[2]!), cell(null, false)];
  const swap = pickMemorialNameSwap(cells, pool, 'seed', 1);
  assert.ok(swap);
  if (swap!.kind === 'evacuate') {
    assert.equal(swap!.next, null);
    return;
  }
  assert.ok(swap!.next);
  const visible = new Set(['A|1901', 'B|1902', 'C|1903']);
  assert.equal(visible.has(`${swap!.next!.name}|${swap!.next!.year}`), false);
});

test('applyMemorialNameSwap replace flips into the incoming layer', () => {
  const cells = [cell(pool[0]!), cell(pool[1]!)];
  const next = applyMemorialNameSwap(cells, { cellIndex: 0, kind: 'replace', next: pool[3]! });
  assert.equal(next[0]!.showB, true);
  assert.equal(next[0]!.b!.name, 'D');
  assert.equal(next[0]!.fading, true);
  assert.equal(next[0]!.present, true);
});

test('applyMemorialNameSwap evacuate clears presence', () => {
  const cells = [cell(pool[0]!), cell(pool[1]!)];
  const next = applyMemorialNameSwap(cells, { cellIndex: 1, kind: 'evacuate', next: null });
  assert.equal(next[1]!.present, false);
  assert.equal(next[1]!.fading, true);
});

test('applyMemorialNameSwap arrive fills a vacant slot', () => {
  const cells = [cell(pool[0]!), cell(null, false)];
  const next = applyMemorialNameSwap(cells, { cellIndex: 1, kind: 'arrive', next: pool[4]! });
  assert.equal(next[1]!.present, true);
  assert.equal(next[1]!.a!.name, 'E');
  assert.equal(next[1]!.fading, true);
});

test('pickMemorialNameSwap is deterministic for seed+tick', () => {
  const cells = [
    cell(pool[0]!),
    cell(pool[1]!),
    cell(pool[2]!),
    cell(pool[3]!),
    cell(null, false),
    cell(null, false),
  ];
  const a = pickMemorialNameSwap(cells, pool, 'map', 7);
  const b = pickMemorialNameSwap(cells, pool, 'map', 7);
  assert.deepEqual(a, b);
});

test('memorialBreathBatchSize stays in 1–3 and is seed-stable', () => {
  assert.equal(memorialBreathBatchSize('map', 3), memorialBreathBatchSize('map', 3));
  const size = memorialBreathBatchSize('map', 3);
  assert.ok(size >= 1 && size <= 3);
});
