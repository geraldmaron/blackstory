/**
 * Source contracts for the home hero headline morph component: sequence wiring,
 * reduced-motion jump to Black Story, and happened-here trailer markup.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const morphSource = readFileSync(join(here, 'HeroHeadlineMorph.tsx'), 'utf8');
const shellCss = readFileSync(join(here, '../shell.css'), 'utf8');

describe('HeroHeadlineMorph component', () => {
  it('imports the phase model and renders the morph sequence shell', () => {
    assert.match(morphSource, /HERO_HEADLINE_PHASES/);
    assert.match(morphSource, /resolveHeroHeadlinePhaseIndex/);
    assert.match(morphSource, /HERO_HEADLINE_FINAL_PHASE_ID/);
    assert.match(morphSource, /data-phase=\{phase\.id\}/);
    assert.match(morphSource, /data-split=\{split \? 'true' : 'false'\}/);
  });

  it('jumps to Black Story when reduced motion is preferred', () => {
    assert.match(morphSource, /prefersReducedMotion/);
    assert.match(morphSource, /readClientMotionPreference/);
    assert.match(morphSource, /if \(next\.reduced\)/);
    assert.match(morphSource, /setPhaseIndex\(FINAL_INDEX\)/);
  });

  it('exposes Black Story happened here as the accessible end state', () => {
    assert.match(morphSource, /aria-label=\{phase\.accessibleLabel\}/);
    assert.match(morphSource, /happened <em>here<\/em>\./);
    assert.match(morphSource, /className="ds-home-hero__headline"/);
  });

  it('uses prefix crossfade with width interpolation for smooth transitions', () => {
    assert.match(morphSource, /MorphingPrefix/);
    assert.match(morphSource, /ds-hero-headline-morph__prefix-out/);
    assert.match(morphSource, /ds-hero-headline-morph__prefix-in/);
    assert.match(morphSource, /setSlotWidthPx/);
  });

  it('styles reduced-motion morph transitions off in shell.css', () => {
    assert.match(
      shellCss,
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ds-home-hero__headline[\s\S]*\.ds-hero-headline-morph__gap/s,
    );
  });
});
