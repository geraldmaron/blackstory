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
  it('gives document surfaces top clearance and zeros it on the instrument', () => {
    assert.match(
      shellCss,
      /\.ds-shell-body\s*\{[^}]*padding-top:\s*calc\(var\(--ds-island-clearance\)\)/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell-body:has\(\[data-surface='instrument'\]\)\s*\{[^}]*padding-top:\s*0/s,
    );
  });

  it('keeps scroll clearance under the sticky header when the footer is focused', () => {
    assert.match(
      shellCss,
      /\.ds-shell-footer\s*\{[^}]*scroll-margin-top:\s*var\(--ds-island-clearance\)/s,
    );
  });
});

describe('surface class is the only shell switch', () => {
  it('reads data-surface, never a marker class a route happens to set', () => {
    // `.ds-explore-stage` and `.ds-home-hero` were the two markers shell layout used to key
    // off. Both are rules that silently stop applying the moment the markup changes, which is
    // exactly what happened when `/` became the Atlas.
    assert.doesNotMatch(shellCss, /\.ds-shell:has\(\.ds-explore-stage\)/);
    assert.doesNotMatch(shellCss, /\.ds-shell:has\(\.ds-home-hero\)/);
    assert.doesNotMatch(shellCss, /\.ds-shell-body:has\(\.ds-home-hero\)/);
    // The retired marker value must not linger either.
    assert.doesNotMatch(shellCss, /data-surface='map'/);
  });

  it('never strips the desktop nav, mobile menu, or CTA on a document surface', () => {
    assert.doesNotMatch(shellCss, /\[data-surface='reading'\][^{]*\.ds-shell-nav--desktop/);
    assert.doesNotMatch(shellCss, /\[data-surface='reading'\][^{]*\.ds-shell-menu\b/);
    assert.doesNotMatch(shellCss, /\[data-surface='reading'\][^{]*\.ds-shell-header__cta/);
  });

  it('scopes shell-level surface rules from .ds-shell so the sibling header can match', () => {
    // The header is a sibling of `.ds-shell-body`, so a rule scoped from the body never
    // reaches it. This is the structural bug the guard exists for.
    assert.doesNotMatch(
      shellCss,
      /\.ds-shell-body:has\(\[data-surface='instrument'\]\)\s+\.ds-shell-header/,
    );
  });
});

describe('explore decade dock hit target', () => {
  const exploreEditionCss = readFileSync(join(here, 'explore/explore-edition.css'), 'utf8');

  it('keeps the decade dock above pass-through layers and in the Engaged hit list', () => {
    assert.match(
      exploreEditionCss,
      /\.ds-explore-stage__decade-dock\s*\{[^}]*pointer-events:\s*auto/s,
    );
    assert.match(
      exploreEditionCss,
      /\.ds-explore-stage__decade-dock\s*\{[^}]*z-index:\s*var\(--ds-z-decade-dock\)/s,
    );
    assert.match(
      exploreEditionCss,
      /\.ds-explore-stage__decade-dock\s*\{[^}]*touch-action:\s*none/s,
    );
    assert.match(exploreEditionCss, /\.ds-explore-stage__decade-scroll\s*\{[^}]*flex:\s*1 1 auto/s);
    // The two assertions that stood here read `cinematic-map.css` for the Engaged state's
    // pointer-events and header visibility. SP-08 deleted that stylesheet with the rest of the
    // Rest/Engaged layer: it existed for `EntityLocationCinematicMap`, the second MapLibre
    // instance, and the plate postures replaced the whole model. There is no Engaged state left
    // to assert, so the assertions go rather than being pointed at a file that no longer governs
    // anything. The dock's own pointer-events and z-index above are unaffected.
  });
});

describe('instrument shell layout', () => {
  it('locks the instrument to the viewport (not a footer-over-map document)', () => {
    assert.match(
      shellCss,
      /html:has\(\[data-surface='instrument'\]\)\s*\{[^}]*overflow:\s*hidden/s,
    );
    assert.match(
      shellCss,
      /\.ds-map-stage\[data-plate-posture='live'\]\s*\{[^}]*touch-action:\s*none/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell:has\(\[data-surface='instrument'\]\)\s*\{[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell:has\(\[data-surface='instrument'\]\)\s+\.ds-shell-body\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s,
    );
    assert.match(
      shellCss,
      /\.ds-shell:has\(\[data-surface='instrument'\]\)\s+\.ds-shell-page-transition,[\s\S]*?\.ds-shell-page-transition__content\s*\{[^}]*height:\s*100%/s,
    );
  });

  it('leaves no transform on the page-root wrapper, which would trap the fixed plate', () => {
    // `animation-fill-mode: both` with a transform keyframe leaves a permanently non-none
    // computed transform, making this wrapper the containing block for the fixed plate.
    assert.doesNotMatch(shellCss, /@keyframes ds-shell-page-enter/);
    assert.doesNotMatch(shellCss, /\.ds-shell-page-transition\s*\{[^}]*animation:/s);
  });
});

describe('shell header theme tokens', () => {
  it('uses a flush opaque bar with theme surface/ink (no floating top gap)', () => {
    assert.match(uiShellHeaderCss, /\.ds-shell-header\s*\{[^}]*top:\s*0/s);
    assert.match(uiShellHeaderCss, /\.ds-shell-header\s*\{[^}]*background:\s*var\(--ds-surface\)/s);
    assert.match(uiShellHeaderCss, /\.ds-shell-header__inner\s*\{[^}]*background:\s*transparent/s);
    assert.match(uiShellHeaderCss, /\.ds-shell-header__inner\s*\{[^}]*color:\s*var\(--ds-ink\)/s);
    // Regression: no surface class may freeze the navbar on charcoal / dark-kit artwork.
    assert.doesNotMatch(
      uiShellHeaderCss,
      /\[data-surface='[a-z]+'\]\)?\s+\.ds-shell-header__inner\s*\{[^}]*--ds-fixed-charcoal/s,
    );
    assert.doesNotMatch(
      uiShellHeaderCss,
      /\[data-surface='[a-z]+'\]\)?[\s\S]*ds-shell-wordmark__img--theme-dark\s*\{[^}]*display:\s*block/s,
    );
  });
});

describe('horizontal overflow guards', () => {
  const baseCss = readFileSync(join(here, '../../../../packages/ui/src/styles/base.css'), 'utf8');
  const mapSurfacesCss = readFileSync(join(here, 'explore/explore.css'), 'utf8');

  it('clips document sideways overflow without clipping the shell or orphaning overflow-y', () => {
    assert.match(baseCss, /html\s*\{[^}]*overflow-x:\s*clip/s);
    assert.match(baseCss, /html\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(baseCss, /body\s*\{[^}]*overflow-x:\s*clip/s);
    assert.match(shellCss, /\.ds-shell\s*\{[^}]*max-width:\s*100%[^}]*min-width:\s*0/s);
    assert.doesNotMatch(shellCss, /\.ds-shell\s*\{[^}]*overflow-x:\s*clip/s);
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
    assert.doesNotMatch(mapSurfacesCss, /\.ds-explore-stage__instruments\s*\{[^}]*--ds-fixed-/s);
  });

  it('Atlas chrome is matte surface, not shop blur or elevation', () => {
    const commandBarCss = readFileSync(join(here, '../components/shell/command-bar.css'), 'utf8');
    const lensCss = readFileSync(join(here, '../components/map-experience/lens-panel.css'), 'utf8');
    const resultsCss = readFileSync(
      join(here, '../components/map-experience/results-rail.css'),
      'utf8',
    );
    const sheetCss = readFileSync(
      join(here, '../components/map-experience/record-sheet.css'),
      'utf8',
    );
    const cameraCss = readFileSync(
      join(here, '../components/map-experience/camera-console.css'),
      'utf8',
    );
    const atlasCss = readFileSync(join(here, 'explore/atlas.css'), 'utf8');
    const timeCss = readFileSync(join(here, '../components/map-experience/time-panel.css'), 'utf8');
    for (const [name, source] of [
      ['command-bar', commandBarCss],
      ['lens', lensCss],
      ['results', resultsCss],
      ['sheet', sheetCss],
      ['camera', cameraCss],
      ['atlas', atlasCss],
      ['time', timeCss],
    ] as const) {
      assert.doesNotMatch(source, /backdrop-filter/, `${name} must not blur`);
      assert.doesNotMatch(source, /box-shadow:\s*0\s+\d+px/, `${name} must not elevate`);
      assert.doesNotMatch(
        source,
        /color-mix\(in srgb, var\(--ds-surface\) 94%/,
        `${name} stays opaque`,
      );
    }
  });
});

describe('shell footer theme tokens', () => {
  // Ink direction: the Surface card frame comes off the footer — it sits directly on the page
  // ground above a hairline, the same move RoomCard makes (see room-kit.css).
  it('styles the footer as a theme-aware ground with a top hairline, not a Surface card', () => {
    assert.doesNotMatch(shellCss, /\.ds-shell-footer__card\s*\{[^}]*background:/s);
    assert.match(shellCss, /\.ds-shell-footer__card\s*\{[^}]*color:\s*var\(--ds-ink\)/s);
    assert.match(
      shellCss,
      /\.ds-shell-footer__card\s*\{[^}]*border-top:\s*var\(--ds-border-width\)\s*solid\s*var\(--ds-rule\)/s,
    );
    assert.match(shellCss, /\.ds-shell-footer__column-title\s*\{[^}]*color:\s*var\(--ds-accent\)/s);
    assert.match(shellCss, /\.ds-shell-footer__links a\s*\{[^}]*color:\s*var\(--ds-ink-muted\)/s);
    assert.match(
      shellCss,
      /\.ds-shell-footer__links a:hover\s*\{[^}]*color:\s*var\(--ds-accent\)/s,
    );
    assert.match(shellCss, /\.ds-shell-footer__operator\s*\{[^}]*color:\s*var\(--ds-ink-muted\)/s);
    assert.doesNotMatch(
      shellCss,
      /\.ds-shell-footer\s*\{[^}]*background:\s*var\(--ds-fixed-charcoal\)/s,
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

describe('the plate is styled globally, not from the route group', () => {
  const mapSurfacesCss = readFileSync(join(here, 'explore/explore.css'), 'utf8');

  it('styles the plate from the sheet the root layout loads on every route', () => {
    // The provider was hoisted to the root shell, so `.ds-map-stage` renders as a sibling of
    // `.ds-shell`, not a descendant of the group's `.ds-map-surface`. Every plate rule left in
    // the group's sheet was a rule that had silently stopped matching.
    assert.match(shellCss, /\.ds-map-stage\s*\{[^}]*position:\s*fixed/s);
    assert.match(shellCss, /\.ds-map-stage\s*\{[^}]*isolation:\s*isolate/s);
    assert.match(shellCss, /\.ds-map-stage__canvas\s*\{/);
    assert.doesNotMatch(mapSurfacesCss, /\.ds-map-stage\b/);
  });

  it('covers the plate on every surface class but the Instrument', () => {
    // Regression: the plate is fixed on every route and the room sheets set no background, so
    // once the Instrument built MapLibre the live map stayed lit under every subsequent route
    // and state labels read through the prose column. Only reproduces after visiting the Atlas
    // first, which is why a cold load of /library looked fine.
    // The Door is the one other surface whose plate is content (posture `ambient`), so it is
    // excluded from the cover in the same rule rather than uncovered by a second one.
    assert.match(
      shellCss,
      /body:not\(:has\(\[data-surface='instrument'\]\)\):not\(:has\(\[data-surface='door'\]\)\)\s+\.ds-map-stage::after\s*\{[^}]*background:\s*var\(--ds-canvas\)/s,
    );
    // Covered, not hidden: ADR-017 keeps the MapLibre instance alive across navigation.
    assert.doesNotMatch(
      shellCss,
      /body:not\(:has\(\[data-surface='instrument'\]\)\)\s+\.ds-map-stage\s*\{[^}]*display:\s*none/s,
    );
  });

  it('never scopes a plate rule under .ds-map-surface, which is not its ancestor', () => {
    assert.doesNotMatch(shellCss, /\.ds-map-surface[^{,]*\s\.ds-map-stage/);
    assert.doesNotMatch(shellCss, /\.ds-map-surface[^{,]*\s\.maplibregl-/);
  });

  it('gates plate chrome on data-surface, never on a marker class', () => {
    // `.ds-explore-stage` is route content. Whether the zoom control parks bottom-right is a
    // question about the surface class, so it reads the attribute; whether it clears an open
    // panel is runtime state, so those rules keep the stage's own [data-*] attributes.
    assert.match(
      shellCss,
      /body:has\(\[data-surface='instrument'\]\)\s+\.ds-map-stage\s+\.maplibregl-ctrl-top-right\s*\{/,
    );
    assert.doesNotMatch(shellCss, /:has\(\.ds-explore-stage\)/);
  });

  it('leaves the fixed plate no containing block but the viewport', () => {
    // transform/filter/perspective/backdrop-filter/contain and will-change on any of them make
    // an ancestor the containing block for a fixed descendant — the plate would then scroll
    // with the document instead of holding the viewport. `.ds-shell` and `body` are the only
    // ancestors the plate has, so no rule targeting either may declare one.
    const trapping = /(transform|filter|perspective|backdrop-filter|contain|will-change)\s*:/;
    for (const selector of ['body', '.ds-shell']) {
      const pattern = new RegExp(
        `(^|\\n)${selector.replace('.', '\\.')}\\s*(:has\\([^)]*\\))?\\s*\\{([^}]*)\\}`,
        'g',
      );
      for (const match of shellCss.matchAll(pattern)) {
        const body = match[3] ?? '';
        assert.doesNotMatch(
          body.replace(/text-transform\s*:/g, ''),
          trapping,
          `${selector} must not establish a containing block for the fixed plate`,
        );
      }
    }
  });
});
