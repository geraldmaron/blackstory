/**
 * About v6 page wiring: shared gutter mosaic, preserved mission copy, no legacy mast.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ABOUT_MISSION_BEATS, ABOUT_PILLARS, ABOUT_DESTINATIONS } from './about-copy';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const copySource = readFileSync(join(here, 'about-copy.ts'), 'utf8');

test('about page uses shared EditionAtmosphereMosaic instead of legacy mast', () => {
  assert.match(pageSource, /EditionAtmosphereMosaic/);
  assert.match(pageSource, /ABOUT_EDITION_MOSAIC_SEED/);
  assert.doesNotMatch(pageSource, /AboutMosaicMast/);
  assert.doesNotMatch(pageSource, /LivingAtmosphereMosaic/);
});

test('about page preserves core mission headline and pillars', () => {
  assert.match(pageSource, /History, pinned to/);
  assert.match(pageSource, /People\. Places\. Evidence\. Context\./);
  for (const pillar of ABOUT_PILLARS) {
    assert.match(copySource, new RegExp(pillar.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const beat of ABOUT_MISSION_BEATS) {
    assert.match(copySource, new RegExp(beat.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('about user-facing copy avoids em dashes', () => {
  const strings = [
    ...ABOUT_PILLARS.flatMap((pillar) => [pillar.kicker, pillar.title, pillar.body]),
    ...ABOUT_MISSION_BEATS.flatMap((beat) => [beat.title, beat.body]),
    ...ABOUT_DESTINATIONS.flatMap((item) => [item.label, item.detail]),
  ];
  for (const value of strings) {
    assert.doesNotMatch(value, /—/);
  }
});
