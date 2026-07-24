/**
 * Hero map inset geometry contracts for ADR-017 single-canvas home hero.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CAMERA_PRESETS } from './camera-presets';
import {
  HERO_COPY_COLUMN_FR,
  HERO_MAP_COLUMN_FR,
  HERO_MAP_INSET_MIN_VISIBLE_RATIO,
  heroMapStageGeometryForRect,
  heroNationalCameraPadding,
  insetClipPathForRect,
} from './hero-map-inset';

const SAMPLE_RECT = {
  top: 120,
  left: 200,
  right: 980,
  bottom: 420,
  width: 780,
  height: 300,
  x: 200,
  y: 120,
  toJSON() {
    return {};
  },
} as DOMRect;

describe('hero-map-inset', () => {
  it('builds viewport-fixed geometry from a DOMRect', () => {
    assert.deepEqual(heroMapStageGeometryForRect(SAMPLE_RECT), {
      top: 120,
      left: 200,
      width: 780,
      height: 300,
    });
  });

  it('returns null when the hero panel has zero size', () => {
    assert.equal(
      heroMapStageGeometryForRect({
        ...SAMPLE_RECT,
        width: 0,
        height: 0,
      }),
      null,
    );
  });

  it('returns null when the hero panel is fully off-screen', () => {
    assert.equal(
      heroMapStageGeometryForRect(
        { ...SAMPLE_RECT, top: -500, bottom: -200 } as DOMRect,
        { width: 1320, height: 840 },
      ),
      null,
    );
    assert.equal(
      heroMapStageGeometryForRect(
        { ...SAMPLE_RECT, top: 900, bottom: 1200 } as DOMRect,
        { width: 1320, height: 840 },
      ),
      null,
    );
  });

  it('clamps geometry to the viewport-visible hero panel intersection', () => {
    assert.deepEqual(
      heroMapStageGeometryForRect(
        { ...SAMPLE_RECT, top: -40, bottom: 260 } as DOMRect,
        { width: 1320, height: 840 },
      ),
      {
        top: 0,
        left: 200,
        width: 780,
        height: 260,
      },
    );
  });

  it('hides the inset when the hero panel is mostly off-screen', () => {
    assert.equal(
      heroMapStageGeometryForRect(
        { ...SAMPLE_RECT, top: -280, bottom: 20 } as DOMRect,
        { width: 1320, height: 840 },
      ),
      null,
    );
    assert.ok(HERO_MAP_INSET_MIN_VISIBLE_RATIO > 0);
  });

  it('documents the desktop copy/map fr split used for camera notes', () => {
    assert.equal(HERO_COPY_COLUMN_FR, 46);
    assert.equal(HERO_MAP_COLUMN_FR, 54);
  });

  it('pads left by a fraction of the copy column so coast reads under the words', () => {
    const panel = { width: 1000, height: 400, left: 100, top: 80 };
    const copy = {
      width: 460,
      height: 400,
      left: 100,
      top: 80,
      right: 560,
      bottom: 480,
    };
    const padding = heroNationalCameraPadding({ panel, copy });
    assert.deepEqual(padding, {
      top: CAMERA_PRESETS.national.padding,
      right: CAMERA_PRESETS.national.padding,
      bottom: CAMERA_PRESETS.national.padding,
      left: Math.round(460 * 0.22),
    });
  });

  it('pads top by partial copy height when the hero stacks on mobile', () => {
    const panel = { width: 390, height: 520, left: 16, top: 64 };
    const copy = {
      width: 390,
      height: 280,
      left: 16,
      top: 64,
      right: 406,
      bottom: 344,
    };
    const padding = heroNationalCameraPadding({ panel, copy });
    assert.deepEqual(padding, {
      top: Math.round(280 * 0.35),
      right: CAMERA_PRESETS.national.padding,
      bottom: CAMERA_PRESETS.national.padding,
      left: CAMERA_PRESETS.national.padding,
    });
  });

  it('falls back to uniform national padding when copy metrics are missing', () => {
    assert.deepEqual(
      heroNationalCameraPadding({
        panel: { width: 800, height: 400, left: 0, top: 0 },
        copy: null,
      }),
      {
        top: CAMERA_PRESETS.national.padding,
        right: CAMERA_PRESETS.national.padding,
        bottom: CAMERA_PRESETS.national.padding,
        left: CAMERA_PRESETS.national.padding,
      },
    );
  });

  it('applyHeroMapInset removes clip-path (Safari WebGL regression guard)', () => {
    assert.match(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'hero-map-inset.ts'), 'utf8'),
      /removeProperty\('clip-path'\)/,
    );
  });

  it('documents the superseded clip-path inset math (Safari WebGL regression guard)', () => {
    const clip = insetClipPathForRect(SAMPLE_RECT, { width: 1320, height: 840 });
    assert.equal(clip, 'inset(120px 340px 420px 200px)');
  });
});
