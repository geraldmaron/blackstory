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
import { DENSITY_TIER_FILL, DIGNITY_PALETTE, POPULATION_SHARE_TIER_FILL } from './dignity-style';
import { KIND_ENCODING_ENTRIES, MAP_SEMANTIC_TONE_ENCODING } from './kind-encoding';

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

test('every kind shade is paired with a non-color glyph channel (WCAG 1.4.1)', () => {
  for (const [kind, entry] of KIND_ENCODING_ENTRIES) {
    assert.ok(
      typeof entry.glyph === 'string' && entry.glyph.length > 0,
      `kind "${kind}" must have a glyph`,
    );
  }
  const signatures = KIND_ENCODING_ENTRIES.map(([, entry]) => `${entry.shade}::${entry.glyph}`);
  assert.equal(
    new Set(signatures).size,
    signatures.length,
    'no two kinds may share both shade and glyph',
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
    /kind of place or record/i,
    'the legend must state that color encodes kind (and historical tones)',
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
