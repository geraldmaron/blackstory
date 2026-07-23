/**
 * Shell layout CSS contracts: sticky clearance + explore header selectors.
 * Guards the structural bug where header is a sibling of `.ds-shell-body`, so
 * explore condensation must use `.ds-shell:has(...)` not `.ds-shell-body:has(...)`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shellCss = readFileSync(join(here, 'shell.css'), 'utf8');
const uiShellHeaderCss = readFileSync(
  join(here, '../../../../packages/ui/src/styles/shell-header.css'),
  'utf8',
);

describe('shell sticky clearance', () => {
  it('gives non-map body top clearance and zeros it on map surfaces', () => {
    assert.match(
      shellCss,
      /\.ds-shell-body\s*\{[^}]*padding-top:\s*calc\(var\(--ds-island-clearance\)\)/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell-body:has\(\[data-surface='map'\]\)\s*\{[^}]*padding-top:\s*0/s,
    );
  });

  it('keeps scroll clearance under the sticky header when the footer is focused', () => {
    assert.match(
      shellCss,
      /\.ds-shell-footer\s*\{[^}]*scroll-margin-top:\s*var\(--ds-island-clearance\)/s,
    );
  });
});

describe('shell explore header keeps the shared primary nav', () => {
  it('never strips the desktop nav, mobile menu, or CTA on the explore surface', () => {
    // Regression guard: explore is a map surface that must show the same header
    // navigation as the homepage hero and every other route (no explore-only
    // display:none on nav chrome).
    assert.doesNotMatch(shellCss, /\.ds-shell:has\(\.ds-explore-stage\)\s+\.ds-shell-nav--desktop/);
    assert.doesNotMatch(shellCss, /\.ds-shell:has\(\.ds-explore-stage\)\s+\.ds-shell-menu\b/);
    assert.doesNotMatch(shellCss, /\.ds-shell:has\(\.ds-explore-stage\)\s+\.ds-shell-header__cta/);
  });

  it('scopes any explore rule from .ds-shell so the sibling header can match', () => {
    assert.doesNotMatch(shellCss, /\.ds-shell-body:has\(\.ds-explore-stage\)\s+\.ds-shell-header/);
  });
});

describe('explore map shell layout', () => {
  it('locks the dedicated explore shell to the viewport (not a footer-over-map document)', () => {
    assert.match(
      shellCss,
      /\.ds-shell:has\(\.ds-explore-stage\)\s*\{[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell:has\(\.ds-explore-stage\)\s+\.ds-shell-body\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell:has\(\.ds-explore-stage\)\s+\.ds-map-surface\s*\{[^}]*height:\s*100%/s,
    );
  });
});

describe('shell header theme tokens', () => {
  it('uses theme surface/ink tokens and does not force fixed-ink over map surfaces', () => {
    assert.match(
      uiShellHeaderCss,
      /\.ds-shell-header__inner\s*\{[^}]*background:\s*var\(--ds-surface\)/s,
    );
    assert.match(uiShellHeaderCss, /\.ds-shell-header__inner\s*\{[^}]*color:\s*var\(--ds-ink\)/s);
    // Regression: map routes must not freeze the navbar on charcoal / dark-kit artwork.
    assert.doesNotMatch(
      uiShellHeaderCss,
      /\.ds-shell:has\(\[data-surface='map'\]\)\s+\.ds-shell-header__inner\s*\{[^}]*--ds-fixed-charcoal/s,
    );
    assert.doesNotMatch(
      uiShellHeaderCss,
      /\.ds-shell:has\(\[data-surface='map'\]\)[\s\S]*ds-shell-wordmark__img--theme-dark\s*\{[^}]*display:\s*block/s,
    );
  });
});

describe('horizontal overflow guards', () => {
  const baseCss = readFileSync(join(here, '../../../../packages/ui/src/styles/base.css'), 'utf8');
  const mapSurfacesCss = readFileSync(join(here, '(map)/map-surfaces.css'), 'utf8');

  it('clips document and shell sideways overflow without orphaning overflow-y', () => {
    assert.match(baseCss, /html\s*\{[^}]*overflow-x:\s*clip/s);
    assert.match(baseCss, /html\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(baseCss, /body\s*\{[^}]*overflow-x:\s*clip/s);
    assert.match(shellCss, /\.ds-shell\s*\{[^}]*overflow-x:\s*clip/s);
  });

  it('does not size explore chrome with 100vw (scrollbar gutter / hide-translate overflow)', () => {
    assert.doesNotMatch(mapSurfacesCss, /calc\(\s*100vw/);
    assert.doesNotMatch(mapSurfacesCss, /min\(\s*\d+vw/);
    assert.match(
      mapSurfacesCss,
      /\.ds-explore-stage__instruments\s*\{[^}]*left:\s*var\(--ds-explore-edge\)/s,
    );
    assert.match(
      mapSurfacesCss,
      /\.ds-explore-stage__results\s*\{[^}]*right:\s*var\(--ds-explore-edge\)/s,
    );
    assert.match(
      mapSurfacesCss,
      /@media\s*\(max-width:\s*39\.9375rem\)\s*\{[^}]*--ds-explore-instruments-width:\s*auto/s,
    );
    assert.match(
      mapSurfacesCss,
      /@media\s*\(max-width:\s*39\.9375rem\)\s*\{[^}]*--ds-explore-results-width:\s*auto/s,
    );
  });

  it('explore v6 panels use opaque Surface fills without backdrop blur or fixed-ink cockpit', () => {
    assert.match(
      mapSurfacesCss,
      /\.ds-explore-stage__instruments\s*\{[^}]*background:\s*var\(--ds-surface\)/s,
    );
    assert.match(
      mapSurfacesCss,
      /\.ds-explore-stage__results\s*\{[^}]*background:\s*var\(--ds-surface\)/s,
    );
    assert.doesNotMatch(mapSurfacesCss, /backdrop-filter/);
    assert.doesNotMatch(
      mapSurfacesCss,
      /\.ds-explore-stage__instruments\s*\{[^}]*--ds-fixed-/s,
    );
  });
});

describe('shell footer theme tokens', () => {
  it('styles the footer as a theme-aware Surface card', () => {
    assert.match(shellCss, /\.ds-shell-footer__card\s*\{[^}]*background:\s*var\(--ds-surface\)/s);
    assert.match(shellCss, /\.ds-shell-footer__card\s*\{[^}]*color:\s*var\(--ds-ink\)/s);
    assert.match(
      shellCss,
      /\.ds-shell-footer__card\s*\{[^}]*border:\s*var\(--ds-border-width\)\s*solid\s*var\(--ds-rule\)/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell-footer__column-title\s*\{[^}]*color:\s*var\(--ds-accent\)/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell-footer__links a\s*\{[^}]*color:\s*var\(--ds-ink-muted\)/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell-footer__links a:hover\s*\{[^}]*color:\s*var\(--ds-accent\)/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell-footer__operator\s*\{[^}]*color:\s*var\(--ds-ink-muted\)/s,
    );
    assert.doesNotMatch(
      shellCss,
      /\.ds-shell-footer\s*\{[^}]*background:\s*var\(--ds-fixed-charcoal\)/s,
    );
  });

  it('aligns the home footer card with the edition stack width', () => {
    assert.match(
      shellCss,
      /\.ds-shell:has\(\.ds-home-hero\)\s+\.ds-shell-footer\s*\{[^}]*width:\s*min\(100%\s*-\s*\(var\(--ds-gutter\)\s*\*\s*2\),\s*var\(--ds-grid-max\)\)/s,
    );
  });
});

describe('maker credit theme marks', () => {
  it('swaps inline GD marks with [data-theme] like the shell wordmark', () => {
    assert.match(shellCss, /\.ds-maker-credit__mark--theme-light\s*\{[^}]*display:\s*block/s);
    assert.match(shellCss, /\.ds-maker-credit__mark--theme-dark\s*\{[^}]*display:\s*none/s);
    assert.match(
      shellCss,
      /\[data-theme='dark'\]\s+\.ds-maker-credit__mark--theme-light\s*\{[^}]*display:\s*none/s,
    );
    assert.match(
      shellCss,
      /\[data-theme='dark'\]\s+\.ds-maker-credit__mark--theme-dark\s*\{[^}]*display:\s*block/s,
    );
  });
});

describe('home how-this-works pipeline sketch', () => {
  it('keeps theme tokens — no fixed-ink remapping on the homepage sketch', () => {
    assert.match(shellCss, /\.ds-home-how__sketch\s+\.ds-pipeline-sketch\s*\{[^}]*margin:\s*0/s);
    assert.doesNotMatch(
      shellCss,
      /\.ds-home-how__sketch\s+\.ds-pipeline-sketch\s*\{[^}]*--ds-fixed-/s,
    );
    assert.doesNotMatch(
      shellCss,
      /\.ds-home-how__sketch\s+\.ds-pipeline-sketch\s*\{[^}]*--ds-ink:\s*var\(--ds-fixed-/s,
    );
  });
});
