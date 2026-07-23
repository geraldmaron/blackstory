/**
 * Methodology v6 edition CSS contracts: operations and secondary content follow
 * [data-theme] with ordinary --ds-* tokens, never fixed-ink bands.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const editionCss = readFileSync(join(here, 'methodology-edition.css'), 'utf8');
const sectionsTsx = readFileSync(join(here, 'MethodologySections.tsx'), 'utf8');

describe('methodology operations section theme', () => {
  it('renders operations as a theme-aware edition panel, not ds-band', () => {
    assert.match(sectionsTsx, /methodologyEditionPanelClassName\('operations'\)/);
    assert.doesNotMatch(sectionsTsx, /ds-band/);
  });

  it('styles operations content with theme tokens, not fixed-ink palette', () => {
    assert.match(
      editionCss,
      /\.ds-methodology-edition__operations-title\s*\{[^}]*color:\s*var\(--ds-ink\)/s,
    );
    assert.match(
      editionCss,
      /\.ds-methodology-edition__operations-body\s*\{[^}]*color:\s*var\(--ds-ink-muted\)/s,
    );
    assert.match(
      editionCss,
      /\.ds-methodology-edition__operations-kicker\s*\{[^}]*color:\s*var\(--ds-accent\)/s,
    );
    assert.match(
      editionCss,
      /\.ds-methodology-edition__operations-body a\s*\{[^}]*color:\s*var\(--ds-accent\)/s,
    );
    assert.doesNotMatch(editionCss, /\.ds-methodology-edition__operations[^{]*\{[^}]*--ds-fixed-/s);
  });
});
