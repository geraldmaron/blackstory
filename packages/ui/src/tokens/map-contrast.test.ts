/**
 * Map plate legibility contract.
 *
 * The shipped v6 plate put land and water roughly 12 CIE L* points apart in dark theme, and the
 * result was that coastlines and state lines disappeared at continental zoom. These thresholds
 * exist so that cannot happen again silently: they are asserted, not reviewed.
 *
 * Separation uses CIE L* rather than WCAG relative luminance. Y is compressed near black, so on a
 * dark plate two visibly different colors sit a fraction of a Y point apart and any Y-based
 * threshold is either unreachable or meaningless. Text contrast still uses the WCAG ratio, which
 * is what WCAG actually defines.
 *
 * If a token fails one of these, the token is wrong. Do not loosen a threshold to make it pass.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  contrastRatio,
  lightnessDelta,
  mapPalettes,
  perceptualLightness,
  themes,
  type MapPalette,
} from './index.ts';

/** Minimum CIE L* separation between adjacent map roles. */
const MIN_LAND_WATER = 18;
const MIN_LAND_LINE = 18;
const MIN_LAND_LINE_2 = 24;
const MIN_LABEL_LAND = 40;
/** City and town labels carry body-size text, so they meet the WCAG AA text floor. */
const MIN_LABEL_HI_CONTRAST = 4.5;

function describe(theme: string, pair: string, got: number, need: number): string {
  return `${theme}: ${pair} is ${got.toFixed(2)}, needs >= ${need}`;
}

test('every theme ships a complete map palette', () => {
  const roles: ReadonlyArray<keyof MapPalette> = [
    'land',
    'water',
    'green',
    'line',
    'line2',
    'road',
    'label',
    'labelHi',
    'halo',
  ];

  for (const theme of themes) {
    const palette = mapPalettes[theme];
    for (const role of roles) {
      assert.match(
        palette[role],
        /^#[0-9a-f]{6}$/,
        `${theme}.${role} must be a lowercase 6-digit hex`,
      );
    }
  }
});

test('land and water separate enough to read as different surfaces', () => {
  for (const theme of themes) {
    const { land, water } = mapPalettes[theme];
    const got = lightnessDelta(land, water);
    assert.ok(got >= MIN_LAND_WATER, describe(theme, 'land/water', got, MIN_LAND_WATER));
  }
});

test('state boundaries separate from land', () => {
  for (const theme of themes) {
    const { land, line } = mapPalettes[theme];
    const got = lightnessDelta(land, line);
    assert.ok(got >= MIN_LAND_LINE, describe(theme, 'land/line', got, MIN_LAND_LINE));
  }
});

test('country boundaries read heavier than state boundaries', () => {
  for (const theme of themes) {
    const { land, line, line2 } = mapPalettes[theme];
    const got = lightnessDelta(land, line2);
    assert.ok(got >= MIN_LAND_LINE_2, describe(theme, 'land/line2', got, MIN_LAND_LINE_2));

    // A country border that separates from land by less than a state border would invert the
    // hierarchy, which is a legibility bug the raw deltas above would not catch on their own.
    assert.ok(
      lightnessDelta(land, line2) > lightnessDelta(land, line),
      `${theme}: country boundary must separate from land more than the state boundary does`,
    );
  }
});

test('state labels separate from land', () => {
  for (const theme of themes) {
    const { land, label } = mapPalettes[theme];
    const got = lightnessDelta(land, label);
    assert.ok(got >= MIN_LABEL_LAND, describe(theme, 'label/land', got, MIN_LABEL_LAND));
  }
});

test('city labels meet the WCAG AA text floor against land', () => {
  for (const theme of themes) {
    const { land, labelHi } = mapPalettes[theme];
    const got = contrastRatio(labelHi, land);
    assert.ok(
      got >= MIN_LABEL_HI_CONTRAST,
      `${theme}: contrast(labelHi, land) is ${got.toFixed(2)}:1, needs >= ${MIN_LABEL_HI_CONTRAST}:1`,
    );
  }
});

test('the label halo sits opposite the labels it separates', () => {
  for (const theme of themes) {
    const { halo, label, labelHi } = mapPalettes[theme];
    const haloL = perceptualLightness(halo);
    const labelL = perceptualLightness(label);
    const labelHiL = perceptualLightness(labelHi);

    // A halo on the same side of the labels as the plate cannot separate them from it.
    const labelsAreLighter = labelL > haloL && labelHiL > haloL;
    const labelsAreDarker = labelL < haloL && labelHiL < haloL;
    assert.ok(
      labelsAreLighter || labelsAreDarker,
      `${theme}: halo must sit on one side of both label roles`,
    );
  }
});

test('the thresholds actually bite', () => {
  // Guards against the test passing because the helper returns a constant, and against a future
  // edit that relaxes a threshold into uselessness.
  const broken: MapPalette = { ...mapPalettes.dark, water: mapPalettes.dark.land };
  assert.ok(lightnessDelta(broken.land, broken.water) < MIN_LAND_WATER);

  // Sanity-check the L* helper against published reference values.
  assert.ok(Math.abs(perceptualLightness('#808080') - 53.59) < 0.1);
  assert.equal(Math.round(perceptualLightness('#ffffff')), 100);
  assert.equal(Math.round(perceptualLightness('#000000')), 0);
});
