/**
 * Methodology page CSS contracts: operations section must follow [data-theme]
 * with ordinary --ds-* tokens — never a fixed-ink ds-band island.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const methodologyCss = readFileSync(join(here, 'methodology.css'), 'utf8');
const sectionsTsx = readFileSync(join(here, 'MethodologySections.tsx'), 'utf8');

describe('methodology operations section theme', () => {
  it('renders operations as a theme-aware ds-section, not ds-band', () => {
    assert.match(
      sectionsTsx,
      /className="ds-section ds-methodology__secondary"[^>]*id="operations"/s,
    );
    assert.doesNotMatch(sectionsTsx, /ds-band ds-methodology__secondary/);
  });

  it('styles secondary content with theme tokens, not fixed-ink palette', () => {
    assert.match(methodologyCss, /\.ds-methodology__secondary-title\s*\{[^}]*color:\s*var\(--ds-ink\)/s);
    assert.match(
      methodologyCss,
      /\.ds-methodology__secondary-body\s*\{[^}]*color:\s*var\(--ds-ink-muted\)/s,
    );
    assert.match(
      methodologyCss,
      /\.ds-methodology__secondary-kicker\s*\{[^}]*color:\s*var\(--ds-accent\)/s,
    );
    assert.match(
      methodologyCss,
      /\.ds-methodology__secondary-body a\s*\{[^}]*color:\s*var\(--ds-accent\)/s,
    );
    assert.doesNotMatch(methodologyCss, /\.ds-methodology__secondary[^{]*\{[^}]*--ds-fixed-/s);
  });
});
