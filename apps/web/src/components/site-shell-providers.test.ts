/**
 * `SiteShellProviders` must render the shell — header, search, footer — during SSR, not only
 * after hydration.
 *
 * A map provider imported with `next/dynamic({ ssr: false })` would suppress its entire nested
 * subtree on the server, including `.ds-shell`, the search form, the footer, and the `<noscript>`
 * fallback. Both providers therefore render synchronously during SSR.
 *
 * This is a source-shape guard rather than an SSR render test because this package has no DOM/
 * SSR harness (see `command-bar-search.test.tsx`'s doc comment for the same constraint). The
 * source guard prevents either provider from becoming a dynamic, `ssr: false` import.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'SiteShellProviders.tsx'), 'utf8');
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('the shell renders on the server', () => {
  it('does not opt either map provider out of SSR', () => {
    assert.doesNotMatch(code, /next\/dynamic/);
    assert.doesNotMatch(code, /ssr:\s*false/);
  });

  it('imports both providers as plain, synchronously-rendered components', () => {
    assert.match(code, /import \{ MapMomentStage \} from '\.\/room\/MapMoment'/);
    assert.match(code, /import \{ MapStageProvider \} from '\.\/map-stage\/MapStage'/);
  });

  it('keeps the header, search, and footer inside both providers rather than beside them', () => {
    // Keeping `.ds-shell` inside the synchronous providers preserves the complete server-rendered
    // shell. Neither provider has SSR-unsafe behavior.
    const stageOpen = code.indexOf('<MapStageProvider>');
    const shellDiv = code.indexOf('className="ds-shell"');
    const stageClose = code.indexOf('</MapStageProvider>');
    assert.ok(stageOpen >= 0 && shellDiv > stageOpen && shellDiv < stageClose);
  });
});
