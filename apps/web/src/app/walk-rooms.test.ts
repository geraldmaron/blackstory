/**
 * Archive rooms on the walk share one way back to the map.
 * Atlas is not a room. `/banned-books` is not a path. Shop leaks stay off the copy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const WALK_ROOMS = [
  'about/page.tsx',
  'data/page.tsx',
  'methodology/MethodologySections.tsx',
  'errata/page.tsx',
  'memorial/page.tsx',
  'stories/page.tsx',
  'law/page.tsx',
  'submit/page.tsx',
  'corrections/CorrectionsSections.tsx',
  'support/page.tsx',
  'library/page.tsx',
  'privacy/page.tsx',
] as const;

const WALK_COPY = [
  ...WALK_ROOMS,
  'data/DataSections.tsx',
  'privacy/PrivacySections.tsx',
] as const;

test('each walk room comes back to the map and does not sell Atlas or a missing path', () => {
  for (const relative of WALK_ROOMS) {
    const source = readFileSync(join(here, relative), 'utf8');
    assert.match(source, /WalkOffRamp/, `${relative} uses the shared way back`);
    assert.doesNotMatch(
      source,
      /Open the Atlas|ATLAS_INSTRUMENT/,
      `${relative} must not sell Atlas`,
    );
    assert.doesNotMatch(
      source,
      /['"`]\/banned-books/,
      `${relative} must not link a path that 404s`,
    );
    assert.doesNotMatch(
      source,
      /Zooniverse|Caesar|blackbook\.app/,
      `${relative} must not leak vendor copy`,
    );
    assert.doesNotMatch(
      source,
      /confidenceNote|counterClaims\[\]|home-server/,
      `${relative} must not leak shop tokens`,
    );
    assert.doesNotMatch(
      source,
      /['"`]The place['"`]|The place is the door back/,
      `${relative} must not use a sit-script back label`,
    );
    assert.doesNotMatch(
      source,
      /Straight to the records|The Atlas answers where and when/,
      `${relative} must not advertise the board as a cockpit`,
    );
    assert.doesNotMatch(
      source,
      /mosaic-credits|Mosaic credits|ATMOSPHERE_ATTRIBUTION/,
      `${relative} must not send a reader to shop credits`,
    );
  }
});

test('corrections does not ask for an id in the address bar', () => {
  const form = readFileSync(join(here, 'corrections/CorrectionForm.tsx'), 'utf8');
  assert.doesNotMatch(form, /useSearchParams/);
  assert.doesNotMatch(form, /searchParams\.get\(['"]target/);
  assert.match(form, /Name the place or paste its page address/);
});

test('walk copy does not send a reader to shop credits or leftover products', () => {
  for (const relative of WALK_COPY) {
    const source = readFileSync(join(here, relative), 'utf8');
    assert.doesNotMatch(
      source,
      /mosaic-credits|Mosaic credits|ATMOSPHERE_ATTRIBUTION/,
      `${relative} must not send a reader to shop credits`,
    );
    assert.doesNotMatch(
      source,
      /Zooniverse|Caesar|blackbook\.app|native reader|app store/i,
      `${relative} must not leak leftover product copy`,
    );
  }
});
