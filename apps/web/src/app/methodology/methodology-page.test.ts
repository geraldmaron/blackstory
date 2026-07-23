/**
 * Methodology v6 page wiring: shared gutter mosaic, preserved trust copy, home beat 04 alignment.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  METHODOLOGY_DIGNITY_LINE,
  METHODOLOGY_INTRO_LEDE,
  METHODOLOGY_MISSION_BEATS,
  METHODOLOGY_PUBLISH_RULES,
} from './methodology-copy';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'MethodologySections.tsx'), 'utf8');
const copySource = readFileSync(join(here, 'methodology-copy.ts'), 'utf8');

test('methodology page uses shared EditionAtmosphereMosaic with route seed', () => {
  assert.match(pageSource, /EditionAtmosphereMosaic/);
  assert.match(pageSource, /METHODOLOGY_EDITION_MOSAIC_SEED/);
  assert.match(pageSource, /data-methodology-edition="v6"/);
  assert.doesNotMatch(pageSource, /methodology\.css/);
});

test('methodology sections preserve core trust copy and evidence pipeline', () => {
  assert.match(sectionsSource, /Released projections with receipts/);
  assert.match(sectionsSource, /Evidence before assertion/);
  assert.match(sectionsSource, /ResearchPipelineSketch compact/);
  assert.match(sectionsSource, /Confidence grades/);
  assert.match(sectionsSource, /Map dignity/);
  for (const beat of METHODOLOGY_MISSION_BEATS) {
    assert.match(copySource, new RegExp(beat.kicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const rule of METHODOLOGY_PUBLISH_RULES) {
    assert.match(copySource, new RegExp(rule.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('methodology user-facing copy avoids em dashes', () => {
  const strings = [
    METHODOLOGY_INTRO_LEDE,
    METHODOLOGY_DIGNITY_LINE,
    ...METHODOLOGY_MISSION_BEATS.flatMap((beat) => [beat.kicker, beat.body]),
    ...METHODOLOGY_PUBLISH_RULES.flatMap((rule) => [rule.title, rule.body]),
  ];
  for (const value of strings) {
    assert.doesNotMatch(value, /—/);
  }
});

test('methodology operations section uses theme-aware edition panel, not ds-band', () => {
  assert.match(
    sectionsSource,
    /methodologyEditionPanelClassName\('operations'\)/,
  );
  assert.doesNotMatch(sectionsSource, /ds-band/);
});
