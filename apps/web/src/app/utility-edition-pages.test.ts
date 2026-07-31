/**
 * Utility page wiring, on both sides of the room-kit migration.
 *
 * Rooms move onto `components/room` one at a time, so this file has to describe two states at
 * once. A single table asserting the v6 shell would fail the moment a room converted, which reads
 * as a regression rather than as progress; a single table asserting the kit would stop guarding
 * the rooms that have not moved yet. Move a route between the two lists when you convert it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));

/** Still on the v6 utility shell. Each one is a room-kit conversion still owed. */
const UTILITY_PAGES = [
  { route: 'locate', file: 'locate/page.tsx', seed: 'locate-edition-v6' },
  { route: 'not-found', file: 'not-found.tsx', seed: 'not-found-edition-v6' },
  {
    route: 'error',
    file: 'error.tsx',
    seed: 'error-edition-v6',
    delegate: '../components/patterns/utility-edition/UtilityEditionErrorView.tsx',
  },
  {
    route: 'correction-status',
    file: 'corrections/status/[receiptCode]/page.tsx',
    seed: 'correction-status-edition-v6',
  },
] as const;

/** Converted to the shared room kit. */
const ROOM_KIT_PAGES = [
  { route: 'submit', file: 'submit/page.tsx' },
  { route: 'corrections', file: 'corrections/page.tsx' },
] as const;

for (const page of ROOM_KIT_PAGES) {
  test(`${page.route} renders through the room kit`, () => {
    const source = readFileSync(join(appDir, page.file), 'utf8');
    assert.match(source, /from '\.\.\/\.\.\/components\/room'/);
    assert.match(source, /<Room/);
    assert.match(source, /<RoomHeader/);
    // The v6 shell must be gone rather than merely unused: two chromes on one page is the drift
    // the kit exists to remove, and an unused import is how the second one comes back.
    assert.doesNotMatch(source, /UtilityEditionShell/);
    assert.doesNotMatch(source, /UtilityEditionIntro/);
    assert.doesNotMatch(source, /EditionAtmosphereMosaic/);
  });
}

for (const page of UTILITY_PAGES) {
  test(`${page.route} uses UtilityEditionShell with main landmark`, () => {
    const sourceFile = 'delegate' in page ? join(appDir, page.delegate) : join(appDir, page.file);
    const source = readFileSync(sourceFile, 'utf8');
    assert.match(source, /UtilityEditionShell/);
    assert.match(source, /UtilityEditionIntro/);
    assert.doesNotMatch(source, /mosaicSeed/);
    assert.doesNotMatch(source, /EditionAtmosphereMosaic/);
    assert.match(source, /editionKey="/);
    assert.doesNotMatch(source, /ds-page__eyebrow/);
    assert.doesNotMatch(source, /ds-entity-mast/);
  });
}

test('not-found keeps archive recovery CTA', () => {
  const source = readFileSync(join(appDir, 'not-found.tsx'), 'utf8');
  assert.match(source, /Find in the archive/);
  // `/history` became a permanent redirect to `/records`; the recovery CTA on the 404 must land
  // on the real index rather than teaching a lost reader to take an extra hop (SP-15).
  assert.match(source, /href="\/records"/);
});
