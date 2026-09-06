/**
 * `SiteShellProviders` must render the shell — header, search, footer — during SSR, not only
 * after hydration.
 *
 * Regression for repo-afe24: both map providers were mounted through `next/dynamic({ ssr:
 * false })`, which does not just skip the map — it skips everything nested inside it, because
 * `ssr: false` unmounts the whole subtree on the server. That subtree was `.ds-shell` itself
 * (header, search form, footer), so `curl /about` returned zero `ds-bar`, zero `ds-shell`, zero
 * `<main>`: no page shipped a server-rendered search, `/records`' own progressive-enhancement
 * form included, and the `<noscript>` fallback in `CommandBar.tsx` was unreachable dead code —
 * a noscript block inside a client-only subtree never reaches a no-JS reader.
 *
 * This is a source-shape guard rather than an SSR render test because this package has no DOM/
 * SSR harness (see `command-bar-search.test.tsx`'s doc comment for the same constraint). The
 * actual server-rendered-HTML claim is verified by hand against `next build` output and
 * `next start` — see the repo-afe24 fix commit — and pinned here so it cannot silently regress
 * back to a dynamic, `ssr: false` import.
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
    // A future refactor that hoists `.ds-shell` above the providers "to be safe" would silently
    // reintroduce a reason to reach for `ssr: false` on the providers, since the point of this
    // fix is that the providers themselves have nothing SSR cannot handle.
    const stageOpen = code.indexOf('<MapStageProvider>');
    const shellDiv = code.indexOf('className="ds-shell"');
    const stageClose = code.indexOf('</MapStageProvider>');
    assert.ok(stageOpen >= 0 && shellDiv > stageOpen && shellDiv < stageClose);
  });
});
