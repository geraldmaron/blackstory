/**
 * Enforces the dignity rule programmatically: no color token used for the map's points,
 * clusters, or density layer may be red-hued (no red violence markers, no crime-heat),
 * so this cannot silently regress as the brand palette evolves.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DENSITY_TIER_FILL, DIGNITY_PALETTE } from './dignity-style';

function hexToRgb(hex: string): readonly [number, number, number] {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function rgbaToRgb(value: string): readonly [number, number, number] | undefined {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Hue in degrees [0, 360) from an RGB triple.  */
function hue([r, g, b]: readonly [number, number, number]): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  if (delta === 0) return 0;
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function saturation([r, g, b]: readonly [number, number, number]): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  if (max === min) return 0;
  const delta = max - min;
  return delta / (1 - Math.abs(2 * lightness - 1));
}

/** "Red-hued" per the dignity rule: a saturated color whose hue sits in the red band. Warm
 * copper/brown/orange tones (hue ~15-45) are explicitly allowed the brand's own palette. */
function isRedHued(rgb: readonly [number, number, number]): boolean {
  const h = hue(rgb);
  const s = saturation(rgb);
  const inRedBand = h < 15 || h > 345;
  return inRedBand && s > 0.25;
}

test('no dignity-palette color used for points/clusters/selection is red-hued', () => {
  const colorValues = [
    DIGNITY_PALETTE.point,
    DIGNITY_PALETTE.pointHalo,
    DIGNITY_PALETTE.cluster,
    DIGNITY_PALETTE.clusterText,
    DIGNITY_PALETTE.background,
    DIGNITY_PALETTE.border,
    DIGNITY_PALETTE.selected,
  ];
  for (const color of colorValues) {
    const rgb = color.startsWith('#') ? hexToRgb(color) : rgbaToRgb(color);
    assert.ok(rgb, `expected a parseable color for ${color}`);
    assert.equal(isRedHued(rgb!), false, `${color} must not be red-hued (dignity rule)`);
  }
});

test('no density-tier fill (the coverage/presence layer) is red-hued — never a crime-heat gradient', () => {
  for (const [tier, value] of Object.entries(DENSITY_TIER_FILL)) {
    const rgb = rgbaToRgb(value);
    assert.ok(rgb, `expected a parseable rgba() for density tier ${tier}`);
    assert.equal(isRedHued(rgb!), false, `density tier "${tier}" must not be red-hued`);
  }
});

test('density tiers share the same hue family (a single warm palette scaling by opacity, not by hue-shifting toward red as density increases)', () => {
  const hues = Object.values(DENSITY_TIER_FILL)
    .map((value) => rgbaToRgb(value))
    .filter((rgb): rgb is readonly [number, number, number] => rgb !== undefined)
    .map(hue);
  const [first, ...rest] = hues;
  for (const h of rest) {
    assert.ok(Math.abs(h - first!) < 1, 'all density tiers must share one hue, varying only opacity');
  }
});
