/**
 * Pins the shape of the shared label expression and asserts both OpenMapTiles style builders
 * consume it, so a future style edit cannot quietly reintroduce a bare `name:en` lookup.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { MAP_LABEL_NAME_FIELD } from './label-expression';

test('label expression coalesces localised names down to the raw name', () => {
  assert.deepEqual(MAP_LABEL_NAME_FIELD, [
    'coalesce',
    ['get', 'name:en'],
    ['get', 'name:latin'],
    ['get', 'name'],
  ]);
});

test('fallback order runs most specific to least specific', () => {
  const [operator, ...fallbacks] = MAP_LABEL_NAME_FIELD;
  assert.equal(operator, 'coalesce');
  assert.deepEqual(
    fallbacks.map((entry) => (entry as [string, string])[1]),
    ['name:en', 'name:latin', 'name'],
  );
});

test('OpenMapTiles style builders reference the shared expression', () => {
  // `entity-location-map-style.ts` stood here until SP-08 retired the second MapLibre instance it
  // styled. One style builder is now the whole list, which is the point of the persistent plate:
  // there is one map, so there is one place a label expression can drift.
  const styleFiles = [new URL('../../app/map/explore-style.ts', import.meta.url)];

  for (const file of styleFiles) {
    const source = readFileSync(file, 'utf8');
    assert.ok(
      source.includes('MAP_LABEL_NAME_FIELD'),
      `${file.pathname} must use the shared label expression`,
    );
    assert.ok(
      !/'text-field':\s*\['coalesce',\s*\['get',\s*'name:en'\]/.test(source),
      `${file.pathname} must not inline its own name:en coalesce`,
    );
  }
});
