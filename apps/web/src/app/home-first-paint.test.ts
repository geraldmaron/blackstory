/**
 * First paint loads a featured set by id, never the release-wide catalog.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FEATURED_SEED_IDS, getPublicEntity } from '../data/public-seed';
import { HOME_FEATURED_ENTITY_IDS } from './home-first-paint';

test('the featured set is the two released seed places, Dunbar first', () => {
  assert.deepEqual([...HOME_FEATURED_ENTITY_IDS], [
    'ent_dunbar_school_001',
    'ent_15th_st_church_001',
  ]);
  assert.ok(FEATURED_SEED_IDS.includes(HOME_FEATURED_ENTITY_IDS[0]));
  assert.ok(FEATURED_SEED_IDS.includes(HOME_FEATURED_ENTITY_IDS[1]));
  assert.ok(getPublicEntity(HOME_FEATURED_ENTITY_IDS[0]));
  assert.ok(getPublicEntity(HOME_FEATURED_ENTITY_IDS[1]));
});

test('the loader never asks for the full catalog', () => {
  const source = readFileSync(new URL('./home-first-paint.ts', import.meta.url), 'utf8');
  assert.match(source, /listPublicEntityViewsByIds/);
  assert.doesNotMatch(source, /getSharedPublicEntities|listPublicEntityViews\(/);
  assert.doesNotMatch(source, /\/atlas\/catalog/);
});

test('the door page does not mount AtlasLoader or the catalog fetch on the default path', () => {
  const page = readFileSync(fileURLToPath(new URL('./page.tsx', import.meta.url)), 'utf8');
  assert.match(page, /HomeFirstPaint/);
  assert.match(page, /wantsAtlasInstrument/);
  assert.match(page, /loadHomeFirstPaint/);
  assert.doesNotMatch(page, /Loading \{shell\.totalMatched/);
});
