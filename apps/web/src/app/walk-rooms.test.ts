/**
 * Archive rooms on the walk share one way back to the place.
 * Atlas and Banned books are not rooms. Shop leaks stay off the copy.
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
] as const;

test('each walk room comes back to the place and does not sell Atlas or Banned books', () => {
  for (const relative of WALK_ROOMS) {
    const source = readFileSync(join(here, relative), 'utf8');
    assert.match(source, /WalkOffRamp/, `${relative} uses the shared way back`);
    assert.doesNotMatch(source, /Open the Atlas|ATLAS_INSTRUMENT/, `${relative} must not sell Atlas`);
    assert.doesNotMatch(source, /Banned books|\/banned-books/, `${relative} must not sell Banned books`);
    assert.doesNotMatch(source, /Zooniverse|Caesar|blackbook\.app/, `${relative} must not leak vendor copy`);
    assert.doesNotMatch(
      source,
      /confidenceNote|counterClaims\[\]|home-server/,
      `${relative} must not leak shop tokens`,
    );
  }
});
