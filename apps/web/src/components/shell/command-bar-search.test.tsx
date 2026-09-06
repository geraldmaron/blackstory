/**
 * The bar search off Explore, and the reason ⌘K still works when a segment has thrown.
 *
 * The error boundary renders inside `ds-shell-body`, below the shell header. So the shortcut
 * survives a thrown segment if and only if two things hold: the handler lives in the header's
 * search rather than in the palette Explore mounts, and nothing between the root layout and
 * that header can throw on its own. Both are asserted here — the second as a source guard,
 * because a data dependency added to the shell would break the 404 and the error page silently
 * and there is no DOM harness in this package to catch it at runtime.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CommandBarSearch } from './CommandBarSearch';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '../..');
const read = (relative: string) => readFileSync(path.join(srcDir, relative), 'utf8');

/**
 * Source with its prose removed. These files explain at length what they deliberately do *not*
 * await, so matching a banned token against the raw text fails on the comment that documents the
 * rule being kept. Only whole-line `//` is stripped, so a `https://` inside code survives.
 */
const code = (relative: string) =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

describe('bar search', () => {
  it('renders a real combobox, not a link dressed as one', () => {
    const markup = renderToStaticMarkup(<CommandBarSearch placeholder="Search 4,078 records" />);
    assert.match(markup, /role="combobox"/);
    assert.match(markup, /id="bar-search"/);
    assert.match(markup, /placeholder="Search 4,078 records"/);
  });

  it('starts empty when no surface has seeded it', () => {
    const markup = renderToStaticMarkup(<CommandBarSearch placeholder="Search" />);
    assert.match(markup, /value=""/);
  });

  it('submits to /records, so Enter means something on every room off Explore', () => {
    // The regression this locks: the field advertised `enterKeyHint="search"` and sat outside any
    // form, so a reader who typed a phrase and pressed Enter got nothing at all. On the twelve
    // rooms where this is the only search, that was the whole search.
    const markup = renderToStaticMarkup(<CommandBarSearch placeholder="Search" />);
    assert.match(markup, /<form[^>]*action="\/records"/);
    assert.match(markup, /<form[^>]*method="get"/);
    assert.match(markup, /<form[^>]*role="search"/);
    // Without `name="q"` the submit lands on a bare /records and drops what the reader typed.
    assert.match(markup, /name="q"/);
  });

  it('reports a failed lookup as a failure, never as an empty archive', () => {
    const source = code('components/shell/CommandBarSearch.tsx');
    // `/search/api` rate-limits anonymous callers per minute. Returning `[]` on a non-OK response
    // rendered a 429 as "No matching suggestions" — the reader searching hardest was the one told
    // the archive holds nothing.
    assert.match(source, /if \(!response\.ok\)/);
    assert.match(source, /throw new Error/);
    assert.doesNotMatch(source, /if \(!response\.ok\) \{\s*return \[\];/);
  });

  it('hands the abort signal to fetch so a superseded lookup is cancelled', () => {
    const source = code('components/shell/CommandBarSearch.tsx');
    // The endpoint caps concurrent in-flight requests per caller. A lookup the reader has already
    // typed past, still running, is a slot their next keystroke gets denied for.
    assert.match(source, /signal: AbortSignal/);
    assert.match(source, /\bsignal,/);
  });

  it('owns the palette chord off Explore', () => {
    const source = read('components/shell/CommandBarSearch.tsx');
    // The same definition the palette's own opener reads. A second literal `⌘K` check here is
    // how the two drift into disagreeing about what opens search.
    assert.match(source, /matchesPaletteOpen/);
    // `/` must yield to a form field, or the correction form cannot be typed into.
    assert.match(source, /isTypingTarget/);
    assert.match(source, /addEventListener\('keydown'/);
    assert.match(source, /removeEventListener\('keydown'/);
  });
});

describe('CommandBar destinations', () => {
  it('keeps Door, Explore, and Records in Find; Explore bars keep a Door exit', () => {
    const source = code('components/shell/CommandBar.tsx');
    assert.doesNotMatch(source, /href=["'`]\/(?:explore)?#journey["'`]/);
    assert.doesNotMatch(source, /href=["'`]\/journey["'`]/);
    assert.match(source, /href="\/explore"/);
    assert.match(source, /syncCommandBarClearance/);
    assert.match(source, /href="\/records"/);
    assert.match(source, /href="\/"/);
    assert.match(source, /aria-label="Find"/);
    assert.doesNotMatch(source, />\s*Journey\s*</);
    assert.doesNotMatch(source, /onModeChange!\('story'\)/);
  });

  it('does not greet with the catalog count', () => {
    const source = code('components/shell/CommandBar.tsx');
    assert.match(source, /Search records, places, eras/);
    assert.doesNotMatch(source, /toLocaleString/);
    assert.doesNotMatch(source, /Search \$\{/);
  });
});

describe('the shell above the error boundary', () => {
  // Everything the reader needs in order to leave a thrown page renders from these four files.
  const ABOVE_THE_BOUNDARY = [
    'app/layout.tsx',
    'components/SiteShell.tsx',
    'components/SiteShellHeader.tsx',
    'components/shell/CommandBar.tsx',
  ] as const;

  for (const file of ABOVE_THE_BOUNDARY) {
    it(`${file} awaits no data`, () => {
      const source = code(file);
      // An async server component here is a page-level throw the boundary below cannot catch:
      // the shell is its parent, so the failure takes the header with it and the reader is left
      // on a blank document with no search and no way out.
      assert.doesNotMatch(source, /export default async function/);
      assert.doesNotMatch(source, /\bawait\b/);
    });
  }

  it('the shell mounts the plate provider without awaiting its base', () => {
    // `loadMapStageBase()` is the specific dependency SP-07 hoisted this provider away from.
    // Awaiting it here would make every room force-dynamic and give the shell a way to fail.
    assert.doesNotMatch(code('components/SiteShell.tsx'), /loadMapStageBase/);
  });
});

describe('Journey is not advertised as a room', () => {
  it('the off-Explore bar does not link to /journey or /#journey', () => {
    // Verified 2026-08-28: /journey is HTTP 404 on apex and www. About already refuses to
    // list unfinished rooms. A CommandBar href would undo that.
    const source = code('components/shell/CommandBar.tsx');
    assert.doesNotMatch(source, /href=["']\/journey["']/);
    assert.doesNotMatch(source, /href=["']\/#journey["']/);
    // /records/42Cb1758 is also a verified 404; the bar must not mint record-id URLs.
    assert.doesNotMatch(source, /\/records\/42Cb1758/);
  });
});
