/**
 * The by-theme and by-id packet readers are filters over one cached release-wide list. These
 * pin the two filters so the reader contract (`themeId` for a theme, `id` for an article's
 * packet references, reader order preserved) cannot drift silently.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ThemeImpactPacket } from '@repo/domain';
import { packetsForTheme, packetsWithIds } from './source.js';

function packet(id: string, themeId: string): ThemeImpactPacket {
  return { id, themeId } as unknown as ThemeImpactPacket;
}

const packets = [
  packet('tip_a', 'redlining'),
  packet('tip_b', 'wealth_gap'),
  packet('tip_c', 'redlining'),
];

test('packetsForTheme keeps only that theme, in reader order', () => {
  assert.deepEqual(
    packetsForTheme(packets, 'redlining').map((p) => p.id),
    ['tip_a', 'tip_c'],
  );
  assert.deepEqual(packetsForTheme(packets, 'urban_renewal'), []);
});

test('packetsWithIds matches on packet id, ignores unknown ids, keeps reader order', () => {
  assert.deepEqual(
    packetsWithIds(packets, ['tip_c', 'tip_zzz', 'tip_a']).map((p) => p.id),
    ['tip_a', 'tip_c'],
  );
  assert.deepEqual(packetsWithIds(packets, []), []);
});
