/**
 * Enforces map color rules: density stays non-red (presence, not crime-heat);
 * kind shades stay non-red except the allowlisted massacre tone (product
 * direction the related workstream). Every kind still carries a glyph so color is never
 * the only signal (WCAG 1.4.1).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DENSITY_TIER_FILL, DIGNITY_PALETTE, POPULATION_SHARE_TIER_FILL, plateForScheme } from './dignity-style';
import {
  displayEncodingFor,
  kindEncodingFor,
  KIND_ENCODING_ENTRIES,
  KIND_FAMILY_ENTRIES,
  MAP_SEMANTIC_TONE_ENCODING,
} from './kind-encoding';
import { brandPalette } from '@repo/ui';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Intentionally red (massacre) semantic tone — product allowlist. */
const RED_ALLOWLIST = new Set<string>([DIGNITY_PALETTE.kindMassacre]);

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

/** "Red-hued": saturated color in the red band. Warm copper/brown/orange (hue ~15-45) allowed. */
function isRedHued(rgb: readonly [number, number, number]): boolean {
  const h = hue(rgb);
  const s = saturation(rgb);
  const inRedBand = h < 15 || h > 345;
  return inRedBand && s > 0.25;
}

function relativeLuminance(rgb: readonly [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(hexToRgb(fg));
  const L2 = relativeLuminance(hexToRgb(bg));
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

test('history relationship edge plate colors meet WCAG 1.4.11 (≥3:1) on both themes', () => {
  const light = plateForScheme('light');
  const dark = plateForScheme('dark');
  assert.equal(light.historyEdge, brandPalette.copperTextLight);
  assert.equal(dark.historyEdge, brandPalette.copperDark);
  assert.notEqual(light.historyEdge, DIGNITY_PALETTE.pointHalo);
  assert.notEqual(dark.historyEdge, DIGNITY_PALETTE.pointHalo);
  assert.ok(
    contrastRatio(light.historyEdge, light.ocean) >= 3,
    `light historyEdge ${light.historyEdge} on ${light.ocean} must be ≥3:1`,
  );
  assert.ok(
    contrastRatio(dark.historyEdge, dark.ocean) >= 3,
    `dark historyEdge ${dark.historyEdge} on ${dark.ocean} must be ≥3:1`,
  );
  assert.ok(contrastRatio(DIGNITY_PALETTE.pointHalo, light.ocean) < 3, 'pageSand must fail on white');
});

test('no color in DIGNITY_PALETTE is red-hued except the allowlisted massacre tone', () => {
  for (const color of Object.values(DIGNITY_PALETTE)) {
    if (RED_ALLOWLIST.has(color)) continue;
    const rgb = color.startsWith('#') ? hexToRgb(color) : rgbaToRgb(color);
    assert.ok(rgb, `expected a parseable color for ${color}`);
    assert.equal(isRedHued(rgb!), false, `${color} must not be red-hued (dignity rule)`);
  }
  assert.equal(
    isRedHued(hexToRgb(DIGNITY_PALETTE.kindMassacre)),
    true,
    'massacre tone must be red',
  );
});

test('every micro-kind keeps a non-color glyph channel (WCAG 1.4.1)', () => {
  for (const [kind, entry] of KIND_ENCODING_ENTRIES) {
    assert.ok(
      typeof entry.glyph === 'string' && entry.glyph.length > 0,
      `kind "${kind}" must have a glyph`,
    );
  }
});

test('kind families share shades but micro-kinds keep distinct glyphs where needed', () => {
  const placeShade = KIND_FAMILY_ENTRIES.find(([family]) => family === 'places')?.[1].shade;
  assert.ok(placeShade);
  assert.equal(displayEncodingFor('place').shade, placeShade);
  assert.equal(displayEncodingFor('school').shade, placeShade);
  assert.notEqual(
    kindEncodingFor('place').glyph,
    kindEncodingFor('school').glyph,
    'place vs school must differ on glyph even within Places family',
  );
});

test('semantic tones keep distinct shades for massacre, plantation, and epicenter', () => {
  const tones = Object.entries(MAP_SEMANTIC_TONE_ENCODING);
  assert.equal(tones.length, 3);
  assert.equal(MAP_SEMANTIC_TONE_ENCODING.massacre.shade, DIGNITY_PALETTE.kindMassacre);
  assert.equal(MAP_SEMANTIC_TONE_ENCODING.plantation.shade, DIGNITY_PALETTE.kindPlantation);
  assert.equal(MAP_SEMANTIC_TONE_ENCODING.epicenter.shade, DIGNITY_PALETTE.kindEpicenter);
});

test('no status or skin framing in kind labels or legend prose', () => {
  const bannedPattern = /\b(skin|racial|complexion|light[- ]skinned|dark[- ]skinned|caste)\b/i;
  for (const [kind, entry] of KIND_ENCODING_ENTRIES) {
    assert.doesNotMatch(
      entry.label,
      bannedPattern,
      `kind "${kind}" label must not use status/skin framing`,
    );
  }

  const legendSource = readFileSync(
    path.join(__dirname, '../../components/map-experience/MapExperienceLegend.tsx'),
    'utf8',
  );
  const jsxTextLines = legendSource
    .split('\n')
    .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'));
  const renderedProse = jsxTextLines.join('\n');
  assert.doesNotMatch(
    renderedProse,
    bannedPattern,
    'MapExperienceLegend.tsx JSX copy must not use status/skin framing',
  );
  assert.match(
    renderedProse,
    /kind groups/i,
    'the legend must state that color encodes kind groups (and historical tones)',
  );
});

test('no density-tier fill is red-hued — never a crime-heat gradient', () => {
  for (const [tier, value] of Object.entries(DENSITY_TIER_FILL)) {
    const rgb = rgbaToRgb(value);
    assert.ok(rgb, `expected a parseable rgba() for density tier ${tier}`);
    assert.equal(isRedHued(rgb!), false, `density tier "${tier}" must not be red-hued`);
  }
});

test('density tiers share the same hue family (opacity scale, not hue-shift toward red)', () => {
  const hues = Object.values(DENSITY_TIER_FILL)
    .map((value) => rgbaToRgb(value))
    .filter((rgb): rgb is readonly [number, number, number] => rgb !== undefined)
    .map(hue);
  const [first, ...rest] = hues;
  for (const h of rest) {
    assert.ok(
      Math.abs(h - first!) < 1,
      'all density tiers must share one hue, varying only opacity',
    );
  }
});

test('population share tiers deepen monotonically in the same copper hue (no sand break)', () => {
  const order = ['trace', 'low', 'mid', 'high', 'majority'] as const;
  const alphas: number[] = [];
  const hues: number[] = [];
  for (const tier of order) {
    const value = POPULATION_SHARE_TIER_FILL[tier];
    const match = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/.exec(value);
    assert.ok(match, `expected rgba() for share tier ${tier}`);
    const rgb = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
    assert.equal(isRedHued(rgb), false, `share tier "${tier}" must not be red-hued`);
    hues.push(hue(rgb));
    alphas.push(Number(match[4]));
  }
  for (let i = 1; i < hues.length; i += 1) {
    assert.ok(Math.abs(hues[i]! - hues[0]!) < 1, 'share tiers must share one copper hue');
    assert.ok(alphas[i]! > alphas[i - 1]!, 'share opacity must deepen monotonically');
  }
});
