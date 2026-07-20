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
    assert.match(shellCss, /\.ds-shell-body\s*\{[^}]*padding-top:\s*calc\(var\(--ds-island-clearance\)\)/s);
    assert.match(
      shellCss,
      /\.ds-shell-body:has\(\[data-surface='map'\]\)\s*\{[^}]*padding-top:\s*0/s,
    );
  });

  it('clears the fixed header above the footer mast', () => {
    assert.match(shellCss, /\.ds-shell-footer\s*\{[^}]*padding-top:\s*max\(var\(--ds-space-16\),\s*var\(--ds-island-clearance\)\)/s);
    assert.match(shellCss, /\.ds-shell-footer\s*\{[^}]*scroll-margin-top:\s*var\(--ds-island-clearance\)/s);
  });
});

describe('shell explore header condensation selectors', () => {
  it('scopes explore bar rules from .ds-shell so the sibling header matches', () => {
    assert.match(shellCss, /\.ds-shell:has\(\.ds-explore-stage\)\s+\.ds-shell-header__inner/);
    assert.match(shellCss, /\.ds-shell:has\(\.ds-explore-stage\)\s+\.ds-shell-nav--desktop/);
    assert.doesNotMatch(shellCss, /\.ds-shell-body:has\(\.ds-explore-stage\)\s+\.ds-shell-header/);
  });
});

describe('on-map shell header treatment', () => {
  it('restyles the bar with fixed ink tokens over map surfaces', () => {
    assert.match(
      uiShellHeaderCss,
      /\.ds-shell:has\(\[data-surface='map'\]\)\s+\.ds-shell-header__inner\s*\{[^}]*background:\s*var\(--ds-fixed-charcoal\)/s,
    );
    assert.match(uiShellHeaderCss, /background:\s*var\(--ds-surface\)/);
  });
});
