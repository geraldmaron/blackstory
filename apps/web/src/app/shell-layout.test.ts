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
  it('gives document surfaces top clearance', () => {
    assert.match(
      shellCss,
      /\.ds-shell-body\s*\{[^}]*padding-top:\s*calc\(var\(--ds-island-clearance\)\)/s,
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
    // exactly what happened when `/` became Explore.
    assert.doesNotMatch(shellCss, /\.ds-shell:has\(\.ds-explore-stage\)/);
    assert.doesNotMatch(shellCss, /\.ds-shell:has\(\.ds-home-hero\)/);
    assert.doesNotMatch(shellCss, /\.ds-shell-body:has\(\.ds-home-hero\)/);
    // The retired marker value must not linger either.
    assert.doesNotMatch(shellCss, /data-surface='map'/);
  });

  it('never strips the command bar or its wordmark on a document surface', () => {
    // SiteShellHeader mounts CommandBar on every reading surface; a surface-keyed rule in any
    // stylesheet that styles the bar could still hide it, which no render-gate test would see.
    const commandBarCss = readFileSync(join(here, '../components/shell/command-bar.css'), 'utf8');
    for (const css of [shellCss, commandBarCss, uiShellHeaderCss]) {
      assert.doesNotMatch(css, /\[data-surface='reading'\][^{]*\.ds-bar\b/);
      assert.doesNotMatch(css, /\[data-surface='reading'\][^{]*\.ds-shell-wordmark\b/);
    }
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

describe('instrument shell layout', () => {
  it('a live plate takes touch itself, and a covered one does not track the phone toolbar', () => {
    assert.match(
      shellCss,
      /\.ds-map-stage\[data-plate-posture='live'\]\s*\{[^}]*touch-action:\s*none/s,
    );
    // A plate under a scrolling document must not track the phone toolbar: a `dvh` plate resizes
    // mid-scroll, uncovers a band of page ground and re-fires the Door's camera refit.
    assert.match(
      shellCss,
      /\.ds-map-stage:not\(\[data-plate-posture='live'\]\):not\(\[data-plate-slot\]\)\s*\{[^}]*height:\s*100lvh/s,
    );
  });

  it('leaves no transform on the page-root wrapper, which would trap the fixed plate', () => {
    // `animation-fill-mode: both` with a transform keyframe leaves a permanently non-none
    // computed transform, making this wrapper the containing block for the fixed plate.
    assert.doesNotMatch(shellCss, /@keyframes ds-shell-page-enter/);
    assert.doesNotMatch(shellCss, /\.ds-shell-page-transition\s*\{[^}]*animation:/s);
  });
});

describe('shell wordmark theme swap', () => {
  it('never freezes the wordmark on dark-kit artwork for a surface class', () => {
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
    const columnCss = readFileSync(
      join(here, '../components/map-experience/explore-column.css'),
      'utf8',
    );
    for (const source of [mapSurfacesCss, columnCss]) {
      assert.doesNotMatch(source, /calc\(\s*100vw/);
      assert.doesNotMatch(source, /min\(\s*\d+vw/);
    }
    // The column and the histogram dock are inset from the viewport edges, never sized to it.
    // Both float one gutter in from the edges.
    assert.match(
      columnCss,
      /\.ds-xcol\s*\{[^}]*left:\s*var\(--ds-xfloat[^}]*width:\s*var\(--ds-xcol-w\)/s,
    );
    assert.match(
      columnCss,
      /\.ds-xdock\s*\{[^}]*right:\s*var\(--ds-xfloat\)[^}]*left:\s*calc\(var\(--ds-xcol-w\)/s,
    );
  });

  it('the header is solid: no blur, no see-through ground, no elevation (DESIGN.md 7.4)', () => {
    const commandBarCss = readFileSync(join(here, '../components/shell/command-bar.css'), 'utf8');
    assert.doesNotMatch(commandBarCss, /backdrop-filter/);
    assert.match(commandBarCss, /\.ds-bar\s*\{[^}]*background:\s*var\(--ds-canvas\);/s);
    assert.doesNotMatch(commandBarCss, /box-shadow:\s*0\s+\d+px/, 'command-bar must not elevate');
  });

  it('Explore chrome never blurs: the column, dock and controls are solid sheets (DESIGN.md 7.4)', () => {
    const mapCss = (file: string) =>
      readFileSync(join(here, '../components/map-experience', file), 'utf8');
    const atlasCss = readFileSync(join(here, 'explore/explore.css'), 'utf8');
    for (const [name, source] of [
      ['column', mapCss('explore-column.css')],
      ['controls', mapCss('map-controls.css')],
      ['list', mapCss('explore-record-list.css')],
      ['inspector', mapCss('record-inspector.css')],
      ['histogram', mapCss('decade-brush.css')],
      ['atlas', atlasCss],
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
  // The footer is plain navigation on the table's ground: no slogan, no card, no copper block,
  // and every color from the ground.
  it('styles the footer as plain navigation on the table ground, its type from the ground', () => {
    assert.doesNotMatch(shellCss, /\.ds-shell-footer__card|\.ds-shell-footer__line/);
    const footer = readFileSync(join(here, '../components/SiteFooter.tsx'), 'utf8');
    assert.match(footer, /className="ds-shell-footer" data-ground="ink"/);
    assert.doesNotMatch(footer, /<Sheet|History, pinned to place|data-ground="(copper|sand)"/);
    // The AI-help disclosure stays.
    assert.match(footer, /AI helps with the research and drafting here/);
    assert.match(shellCss, /\.ds-shell-footer__links a\s*\{[^}]*color:\s*var\(--ds-ink\)/s);
    const footerRules = shellCss.slice(
      shellCss.indexOf('/* —— Footer: plain navigation'),
      shellCss.indexOf('/* Maker credit'),
    );
    assert.doesNotMatch(footerRules, /#[0-9a-f]{3,6}\b/i);
    assert.doesNotMatch(footerRules, /text-transform:\s*uppercase/);
    assert.doesNotMatch(
      shellCss,
      /\.ds-shell-footer\s*\{[^}]*background:\s*var\(--ds-fixed-charcoal\)/s,
    );
  });
});

describe('maker credit theme marks', () => {
  it('swaps inline GD marks by the nearest ground, like the shell wordmark', () => {
    assert.match(
      shellCss,
      /\.ds-maker-credit__mark--theme-light\s*\{[^}]*display:\s*var\(--ds-lockup-on-light, block\)/s,
    );
    assert.match(
      shellCss,
      /\.ds-maker-credit__mark--theme-dark\s*\{[^}]*display:\s*var\(--ds-lockup-on-dark, none\)/s,
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
    // and state labels read through the prose column. Only reproduces after visiting Explore
    // first, which is why a cold load of /rooms looked fine.
    // The Door is another surface whose plate is content (posture `ambient`). It is excluded from
    // the cover in the same rule rather than uncovered by a second one. A record page is covered:
    // its map is an exhibit in the page (DESIGN.md section 9.1).
    assert.doesNotMatch(shellCss, /ds-recpage\[data-ground\]/);
    assert.match(
      shellCss,
      /body:not\(:has\(\[data-surface='instrument'\]\)\):not\(:has\(\[data-surface='door'\]\)\)\s+\.ds-map-stage:not\(\[data-plate-slot\]\)::after\s*\{[^}]*background:\s*var\(--ds-canvas\)/s,
    );
    // Covered, not hidden: the cover is what keeps the MapLibre instance alive across
    // navigation (`docs/decisions-carryover.md`, "Persistent map canvas").
    assert.doesNotMatch(
      shellCss,
      /body:not\(:has\(\[data-surface='instrument'\]\)\)\s+\.ds-map-stage\s*\{[^}]*display:\s*none/s,
    );
  });

  it('hides MapLibre controls on covered plates so a compass cannot sit on a record', () => {
    assert.match(
      shellCss,
      /body:not\(:has\(\[data-surface='instrument'\]\)\):not\(:has\(\[data-surface='door'\]\)\)\s+\.ds-map-stage:not\(\[data-plate-slot\]\)\s+\.maplibregl-ctrl\s*\{[^}]*display:\s*none/s,
    );
  });

  it('never covers a plate that is holding a MapMoment slot', () => {
    // Regression: a plate holding a slot was uncovered by a SECOND rule setting `content: none`,
    // and that rule lost. Both selectors computed to (0,3,2) — `:not(:has([data-surface='…']))`
    // contributes its argument's (0,1,0), exactly as `[data-plate-slot]` does — so the cover won
    // on file order alone and painted `--ds-canvas` over every MapMoment on every reading
    // surface: a copper-edged, PLATE · LIVE-tagged box in the page's own color, with no map.
    // The cover must therefore be GATED, never overridden after the fact.
    assert.match(shellCss, /\.ds-map-stage:not\(\[data-plate-slot\]\)::after/);
    assert.doesNotMatch(
      shellCss,
      /\.ds-map-stage\[data-plate-slot\]::after\s*\{[^}]*content:\s*none/s,
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

  it('anchors the slotted plate in document space via a positioned body', () => {
    // Without this, `plateBoxForSlot`'s stable document offsets resolve against the viewport
    // and the map drifts from its MapMoment frame while the reader scrolls.
    assert.match(shellCss, /body\s*\{[^}]*position:\s*relative/s);
  });

  it('clips the slotted plate to the same radius as the MapMoment frame', () => {
    assert.match(shellCss, /\.ds-map-stage\[data-plate-slot\]\s*\{[^}]*border-radius:\s*0/s);
  });
});

describe('nothing blurs what is behind it', () => {
  it('no public or kit stylesheet declares a backdrop-filter', () => {
    const files = [
      join(here, 'shell.css'),
      join(here, '../components/shell/command-bar.css'),
      join(here, '../components/map-embed/record-map.css'),
      join(here, '../components/patterns/toast.css'),
      join(here, '../components/page/page-kit.css'),
      join(here, '../../../../packages/ui/src/styles/components.css'),
      join(here, '../../../../packages/ui/src/styles/workbench.css'),
    ];
    for (const file of files)
      assert.doesNotMatch(readFileSync(file, 'utf8'), /backdrop-filter/, file);
  });
});

it('Orbit hides the tokens and their tethers together, never the tokens alone', () => {
  // The tethers are a sibling SVG, not children of the tokens. Hidden tokens with visible tethers
  // drew a burst of white spikes across the globe between the count zoom and the national frame.
  const rule = shellCss.match(
    /\.ds-map-stage:is\(\[data-orbit\], \[data-tokens-off\]\)\s*:is\(([^)]*)\)\s*\{\s*visibility:\s*hidden/,
  );
  assert.ok(rule, 'the stand-down rule exists');
  for (const part of ['.ds-place-token', '.ds-site-name', '.ds-place-leaders']) {
    assert.ok(rule[1]!.includes(part), part);
  }
});
