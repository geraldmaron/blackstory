/**
 * Atlas pointer-events contract: wrappers pass through; only interactive surfaces take hits.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const atlasCss = readFileSync(join(here, 'atlas.css'), 'utf8');

describe('atlas pointer-events', () => {
  it('keeps the atlas wrapper pass-through so map gaps stay pannable', () => {
    assert.match(atlasCss, /\.ds-atlas\s*\{[^}]*pointer-events:\s*none/s);
    assert.doesNotMatch(atlasCss, /\.ds-atlas\s*>\s*\*\s*\{[^}]*pointer-events:\s*auto/s);
  });

  it('passes hits through every covering shell ancestor, not only the inner wrappers', () => {
    assert.match(atlasCss, /\.ds-shell:has\(\.ds-atlas\)/);
    assert.match(atlasCss, /\.ds-shell:has\(\.ds-atlas\)\s+\.ds-shell-body/);
    assert.match(
      atlasCss,
      /\.ds-shell:has\(\.ds-atlas\),[\s\S]*?\.ds-shell-body,[\s\S]*?pointer-events:\s*none/s,
    );
    assert.match(
      atlasCss,
      /\.ds-shell:has\(\.ds-atlas\)\s+\.ds-shell-offline\s*\{[^}]*pointer-events:\s*auto/s,
    );
  });

  it('re-enables hits only on interactive instrument surfaces', () => {
    for (const selector of [
      '.ds-bar',
      '.ds-lens',
      '.ds-results',
      '.ds-sheet',
      '.ds-time-panel',
      '.ds-camera',
      '.ds-atlas__dock',
      '.ds-palette',
      '.ds-shortcuts',
      '.ds-saved',
    ]) {
      assert.match(
        atlasCss,
        new RegExp(`\\.ds-atlas\\s*>\\s*${selector.replace('.', '\\.')}`),
        `missing allowlist entry for ${selector}`,
      );
    }
    assert.match(atlasCss, /\.ds-atlas\s*>\s*\.ds-bar[\s\S]*?pointer-events:\s*auto/s);
  });

  it('keeps full-bleed chrome and the toast stack transparent to the pointer', () => {
    for (const selector of [
      '.ds-annotation',
      '.ds-atlas__spotlight',
      '.ds-atlas__readout',
      '.ds-toast-stack',
    ]) {
      assert.match(
        atlasCss,
        new RegExp(
          `\\.ds-atlas\\s*>\\s*${selector.replace(/\./g, '\\.')}[\\s\\S]*?pointer-events:\\s*none`,
        ),
        `missing pass-through for ${selector}`,
      );
    }
  });
});
