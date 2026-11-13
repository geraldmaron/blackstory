import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decadeBars } from './door-chapters';

const facet = (id: string, count: number) => ({
  id,
  label: id,
  count,
  href: `/records?era=${id}`,
  nofollow: false,
});

test('the decade axis is a true time scale: empty decades take their width at zero', () => {
  const bars = decadeBars([
    facet('1630s', 1),
    facet('1530s', 1),
    facet('undated', 9),
    facet('1550s', 2),
  ]);
  assert.deepEqual(
    bars.map((bar) => `${bar.label}:${bar.count}`),
    [
      '1530s:1',
      '1540s:0',
      '1550s:2',
      '1560s:0',
      '1570s:0',
      '1580s:0',
      '1590s:0',
      '1600s:0',
      '1610s:0',
      '1620s:0',
      '1630s:1',
    ],
  );
  assert.deepEqual(decadeBars([facet('undated', 3)]), []);
});
