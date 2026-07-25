/**
 * Home hero panel structure contracts (single Surface panel, live map inset).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const heroStageSource = readFileSync(join(here, 'HeroStage.tsx'), 'utf8');
const shellCss = readFileSync(join(here, '../shell.css'), 'utf8');
const mapSurfacesCss = readFileSync(join(here, 'map-surfaces.css'), 'utf8');
const heroMapInsetSource = readFileSync(
  join(here, '../../lib/map-experience/hero-map-inset.ts'),
  'utf8',
);
const homeEditionCss = readFileSync(
  join(here, '../../components/home/home-edition.css'),
  'utf8',
);
const editionAtmosphereCss = readFileSync(
  join(here, '../../components/patterns/edition-atmosphere/edition-atmosphere.css'),
  'utf8',
);

describe('home hero panel structure', () => {
  it('renders a single ds-home-hero grid with copy column and map readout', () => {
    assert.match(heroStageSource, /className=\{[^}]*'ds-home-hero ds-hero-stage'/s);
    assert.match(heroStageSource, /className="ds-home-hero__copy"/);
    assert.match(heroStageSource, /className="ds-home-hero__map"/);
    assert.match(heroStageSource, /copyColumnRef/);
    assert.match(heroStageSource, /data-hero-map-panel="true"/);
    assert.match(heroStageSource, /heroPanelRef/);
    // Map row carries a ref so the fixed plate can pin to it (not the full panel) on the
    // mobile stacked layout — see the mobile inset test below.
    assert.match(heroStageSource, /mapColumnRef/);
    assert.doesNotMatch(heroStageSource, /data-hero-map-frame/);
    assert.doesNotMatch(heroStageSource, /ds-home-hero__map-frame/);
  });

  it('pins the plate to the map row (not the full panel) on the mobile stacked layout', () => {
    // Breakpoint matches shell.css `.ds-home-hero` stacked query.
    assert.match(heroStageSource, /max-width:\s*47\.9375rem/);
    assert.match(heroStageSource, /matchMedia/);
    assert.match(heroStageSource, /heroInsetTarget/);
    // Inset helper accepts an explicit target box (map row) beyond the panel.
    assert.match(heroMapInsetSource, /insetTarget/);
    // Mobile inset plate is a non-interactive preview so it never traps vertical page scroll.
    assert.match(
      mapSurfacesCss,
      /@media\s*\(max-width:\s*47\.9375rem\)[\s\S]*?\.ds-map-stage--hero-inset\s*\{[^}]*pointer-events:\s*none/s,
    );
  });

  it('uses morphing headline and place-connected micro-facts strip', () => {
    assert.match(heroStageSource, /Place-connected archive/);
    assert.match(heroStageSource, /HeroHeadlineMorph/);
    assert.match(heroStageSource, /Find what happened near you/);
    assert.match(heroStageSource, /Explore the map/);
    assert.match(heroStageSource, /Your place/);
    assert.match(heroStageSource, /ds-home-hero__micro-facts/);
    assert.doesNotMatch(heroStageSource, /HeroCoverageSketch/);
    assert.doesNotMatch(heroStageSource, /ds-hero-timeline/);
  });

  it('positions the persistent MapStage over the full hero panel under copy', () => {
    assert.match(heroStageSource, /orientationchange/);
    assert.match(heroStageSource, /applyHeroMapInset/);
    assert.match(heroStageSource, /clearHeroMapInset/);
    assert.match(heroStageSource, /heroNationalCameraPadding/);
    assert.match(heroStageSource, /\.resize\(\)/);
    assert.match(heroMapInsetSource, /HERO_MAP_INSET_CLASS/);
    assert.match(heroMapInsetSource, /heroMapStageGeometryForRect/);
    assert.match(heroMapInsetSource, /heroNationalCameraPadding/);
    assert.match(heroMapInsetSource, /full hero panel/i);
    assert.match(heroMapInsetSource, /under the copy column/i);
  });

  it('styles one Surface panel with side-by-side copy and map columns', () => {
    assert.match(shellCss, /\.ds-home-hero\s*\{[^}]*grid-template-columns:\s*46fr 54fr/s);
    assert.match(shellCss, /\.ds-home-hero\s*\{[^}]*background:\s*transparent/s);
    assert.match(
      shellCss,
      /\.ds-home-hero__copy\s*\{[^}]*background:\s*transparent/s,
    );
    assert.match(
      shellCss,
      /\[data-theme='dark'\]\s+\.ds-home-hero__copy\s*\{[^}]*background:\s*transparent/s,
    );
    // repo-pyyw: one continuous canvas wash across the FULL hero, faded by a long
    // horizontal mask ramp — never a flat column-1 plate with a hard edge.
    assert.match(
      shellCss,
      /\.ds-home-hero::before\s*\{[^}]*color-mix\(in srgb,\s*var\(--ds-canvas\)\s*78%/s,
    );
    assert.match(
      shellCss,
      /\[data-theme='dark'\]\s+\.ds-home-hero::before\s*\{[^}]*color-mix\(in srgb,\s*var\(--ds-canvas\)\s*84%/s,
    );
    assert.match(
      shellCss,
      /\.ds-home-hero::before\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*background-image:\s*var\(--ds-edition-pattern-grain\)/s,
    );
    assert.match(
      shellCss,
      /\.ds-home-hero::before\s*\{[^}]*mask-image:\s*linear-gradient\(\s*90deg/s,
    );
    assert.match(shellCss, /\.ds-home-hero__copy\s*\{[^}]*color:\s*var\(--ds-ink\)/s);
    assert.match(shellCss, /\.ds-home-hero__copy\s*\{[^}]*grid-column:\s*1/s);
    // No border seam between copy and map (repo-pyyw).
    assert.doesNotMatch(
      shellCss,
      /\.ds-home-hero__copy\s*\{[^}]*border-right:[^}]*var\(--ds-border\)/s,
    );
    assert.match(shellCss, /\.ds-home-hero__map\s*\{[^}]*grid-column:\s*2/s);
    assert.match(shellCss, /\.ds-home-hero__map\s*\{[^}]*background:\s*transparent/s);
    assert.doesNotMatch(shellCss, /\.ds-home-hero__map-frame/);
    assert.doesNotMatch(shellCss, /\.ds-home-hero__copy::after/);
    assert.doesNotMatch(shellCss, /backdrop-filter/);
    assert.match(shellCss, /--ds-home-panel-padding/);
  });

  it('keeps hero copy above the full-panel map plate', () => {
    assert.match(
      mapSurfacesCss,
      /\.ds-map-surface:has\(\.ds-home-hero\)\s+\.ds-map-stage--hero-inset\s*\{[^}]*z-index:\s*1/s,
    );
    assert.match(
      mapSurfacesCss,
      /\.ds-map-surface:has\(\.ds-home-hero\)\s+\.ds-map-stage--hero-inset\s*\{[^}]*overflow:\s*hidden/s,
    );
    assert.match(
      mapSurfacesCss,
      /\.ds-map-surface:has\(\.ds-home-hero\)\s+\.ds-map-stage--hero-inset\s*\{[^}]*border-radius:\s*var\(--ds-radius-md\)/s,
    );
    assert.match(shellCss, /\.ds-home-hero__copy\s*\{[^}]*z-index:\s*2/s);
    assert.match(shellCss, /\.ds-home-hero__map\s*\{[^}]*pointer-events:\s*none/s);
    assert.match(
      homeEditionCss,
      /\.ds-map-surface:has\(\.ds-home-hero\)\s+\.ds-home\s*\{[^}]*background:\s*transparent/s,
    );
    assert.match(
      homeEditionCss,
      /\.ds-map-surface:has\(\.ds-home-hero\)\s+main\s*\{[^}]*background:\s*transparent/s,
    );
    assert.match(
      homeEditionCss,
      /\.ds-home-edition\s*\{[^}]*background:\s*transparent/s,
    );
    assert.match(shellCss, /\.ds-home\s*\{[^}]*background:\s*transparent/s);
  });

  it('gives copy column scroll ownership so the map under copy cannot steal swipe', () => {
    // map-surfaces.css loads after shell.css — copy must stay `auto` here (not `none`).
    assert.match(
      mapSurfacesCss,
      /\.ds-home-hero__copy\s*\{[^}]*pointer-events:\s*auto/s,
    );
    assert.match(mapSurfacesCss, /\.ds-home-hero__copy\s*\{[^}]*touch-action:\s*pan-y/s);
    assert.match(
      mapSurfacesCss,
      /\.ds-home-hero__map[\s\S]*?\.ds-home-hero__map-readout[\s\S]*?\.ds-home-hero__map-caption\s*\{[^}]*pointer-events:\s*none/s,
    );
    // Regression: never list the copy column in a shared `pointer-events: none` group.
    assert.doesNotMatch(
      mapSurfacesCss,
      /\.ds-home-hero__copy\s*,[\s\S]*?\{[^}]*pointer-events:\s*none/,
    );
    assert.match(shellCss, /\.ds-home-hero__copy\s*\{[^}]*pointer-events:\s*auto/s);
  });

  it('lets explore stage gaps hit the map while Surface panels own vertical scroll', () => {
    assert.match(mapSurfacesCss, /\.ds-explore-stage\s*\{[^}]*pointer-events:\s*none/s);
    assert.match(
      mapSurfacesCss,
      /\.ds-explore-stage__instruments\s*\{[^}]*pointer-events:\s*auto/s,
    );
    assert.match(
      mapSurfacesCss,
      /\.ds-explore-stage__instruments\s*\{[^}]*touch-action:\s*pan-y/s,
    );
    assert.match(
      mapSurfacesCss,
      /\.ds-explore-stage__results\s*\{[^}]*pointer-events:\s*auto/s,
    );
    assert.match(
      mapSurfacesCss,
      /\.ds-explore-stage__results\s*\{[^}]*touch-action:\s*pan-y/s,
    );
    assert.match(
      mapSurfacesCss,
      /\.ds-explore-stage__results\s*\{[^}]*overscroll-behavior:\s*contain/s,
    );
  });

  it('documents ADR-017 live map inset on home', () => {
    assert.match(mapSurfacesCss, /ADR-017/);
    assert.match(mapSurfacesCss, /hero-map-inset/);
    assert.match(
      mapSurfacesCss,
      /\.ds-map-surface:has\(\.ds-home-hero\)\s+\.ds-map-stage\s*\{[^}]*visibility:\s*visible/s,
    );
  });
});

describe('home shell-on-home', () => {
  it('uses inset sticky shell panel aligned to home edition width', () => {
    assert.match(
      shellCss,
      /\.ds-shell:has\(\.ds-home-hero\)\s+\.ds-shell-header\s*\{[^}]*position:\s*sticky/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell:has\(\.ds-home-hero\)\s+\.ds-shell-header__inner\s*\{[^}]*border-radius:\s*var\(--ds-radius-md\)/s,
    );
    assert.doesNotMatch(shellCss, /\.ds-shell:has\(\.ds-home-hero\)\s+\.ds-shell-wordmark::after/);
  });
});

describe('home edition atmosphere', () => {
  it('uses shared grain + archive grid canvas without gutter mosaic tiles', () => {
    const homePageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
    assert.doesNotMatch(homeEditionCss, /pattern-crumple/);
    assert.doesNotMatch(editionAtmosphereCss, /pattern-crumple/);
    assert.match(homeEditionCss, /@import\s+['"]\.\.\/patterns\/edition-atmosphere\/edition-atmosphere\.css/);
    assert.match(editionAtmosphereCss, /--ds-edition-pattern-grain/);
    assert.match(editionAtmosphereCss, /--ds-edition-pattern-archive-grid/);
    assert.doesNotMatch(homePageSource, /EditionAtmosphereMosaic/);
    assert.doesNotMatch(homePageSource, /HomeAtmosphereMosaic/);
    assert.doesNotMatch(editionAtmosphereCss, /box-shadow/);
  });
});
