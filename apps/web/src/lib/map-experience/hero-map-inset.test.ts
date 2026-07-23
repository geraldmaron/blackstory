/**
 * Hero map inset geometry contracts for ADR-017 single-canvas home hero.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  HERO_MAP_INSET_MIN_VISIBLE_RATIO,
  heroMapStageGeometryForRect,
  insetClipPathForRect,
} from './hero-map-inset';

const SAMPLE_RECT = {
  top: 120,
  left: 640,
  right: 980,
  bottom: 420,
  width: 340,
  height: 300,
  x: 640,
  y: 120,
  toJSON() {
    return {};
  },
} as DOMRect;

describe('hero-map-inset', () => {
  it('builds viewport-fixed geometry from a DOMRect', () => {
    assert.deepEqual(heroMapStageGeometryForRect(SAMPLE_RECT), {
      top: 120,
      left: 640,
      width: 340,
      height: 300,
    });
  });

  it('returns null when the hero column has zero size', () => {
    assert.equal(
      heroMapStageGeometryForRect({
        ...SAMPLE_RECT,
        width: 0,
        height: 0,
      }),
      null,
    );
  });

  it('returns null when the hero column is fully off-screen', () => {
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

  it('clamps geometry to the viewport-visible hero column intersection', () => {
    assert.deepEqual(
      heroMapStageGeometryForRect(
        { ...SAMPLE_RECT, top: -40, bottom: 260 } as DOMRect,
        { width: 1320, height: 840 },
      ),
      {
        top: 0,
        left: 640,
        width: 340,
        height: 260,
      },
    );
  });

  it('hides the inset when the hero column is mostly off-screen', () => {
    assert.equal(
      heroMapStageGeometryForRect(
        { ...SAMPLE_RECT, top: -280, bottom: 20 } as DOMRect,
        { width: 1320, height: 840 },
      ),
      null,
    );
    assert.ok(HERO_MAP_INSET_MIN_VISIBLE_RATIO > 0);
  });

  it('applyHeroMapInset removes clip-path (Safari WebGL regression guard)', () => {
    assert.match(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'hero-map-inset.ts'), 'utf8'),
      /removeProperty\('clip-path'\)/,
    );
  });

  it('documents the superseded clip-path inset math (Safari WebGL regression guard)', () => {
    const clip = insetClipPathForRect(SAMPLE_RECT, { width: 1320, height: 840 });
    assert.equal(clip, 'inset(120px 340px 420px 640px)');
  });
});
