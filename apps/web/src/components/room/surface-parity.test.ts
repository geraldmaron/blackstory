/**
 * The structural half of the SP-24 surface parity gate (repo-92n2.31), as a test rather than an
 * observation.
 *
 * SP-24 is a per-screen pass: open each room beside its mock at three breakpoints in two themes
 * and record a verdict. The judgment half of that — does the block order match the display spec —
 * needs a person and a mock. The half below does not: "no screen renders a header, panel frame or
 * kicker that came from the v6 edition chrome" is a fact about the source, and a fact about the
 * source is something a test should hold, not something a human should re-derive every time the
 * gate is run. Run once by hand, it was true on the day it was run and unenforced the day after.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE ROOM-KIT RATCHET. `room-kit.test.tsx` already forbids
 * `*-edition.css` and `*-panel-chrome.ts`, and its list is empty since repo-92n2.30. But it walks
 * `app/` only:
 *
 *     const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../app');
 *
 * so a v6 stylesheet that lives anywhere else was never in scope. The parity gate found exactly
 * that: `components/patterns/utility-edition/utility-edition.css` is a live v6 edition sheet with a
 * `__kicker`, outside the ratchet since the day it was written. This file walks `src/`.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const SOURCES = walk(SRC_DIR).filter((file) => /\.(tsx|ts|css)$/.test(file));

/**
 * The v6 edition class families still in the tree, with the element count each renders on its
 * busiest live surface, measured 2026-09-13 on the dev server.
 *
 * A RATCHET, NOT AN ALLOWLIST, and it fails in both directions: a family here that no longer
 * appears is a stale exemption to delete, a family in the tree that is not here is the v6
 * vocabulary spreading again. Every entry is tracked by repo-ps0rm, which also has to decide the
 * question this test deliberately does not: whether these are v6 markup to rebuild onto the room
 * kit, or only v6 names on markup that already looks right.
 *
 * `history` is the clearest case for deletion — /history was dissolved in repo-92n2.27 and the
 * route does not exist.
 */
const V6_EDITION_FAMILIES: readonly string[] = [
  'ds-books-edition',
  'ds-data-edition',
  'ds-entity-edition',
  'ds-explore-edition',
  'ds-history-edition',
  'ds-utility-edition',
];

function editionFamilies(): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const file of SOURCES) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bds-[a-z-]+?-edition\b/g)) {
      const family = match[0];
      counts.set(family, (counts.get(family) ?? 0) + 1);
    }
  }
  return counts;
}

describe('surface parity · the v6 edition vocabulary only shrinks', () => {
  it('no new ds-*-edition class family appears, and a retired one is not left listed', () => {
    const found = [...editionFamilies().keys()].sort();
    assert.deepEqual(
      found,
      [...V6_EDITION_FAMILIES].sort(),
      'v6 edition class families changed — shrink the list when one goes (repo-ps0rm), never grow it',
    );
  });

  it('no *-edition.css or *-panel-chrome.ts lives anywhere under src, not just under app/', () => {
    // The blind spot the parity gate found: room-kit.test.tsx walks app/ only, so a v6 sheet in
    // components/ was never gated. utility-edition.css is the one that got through.
    const offenders = SOURCES.filter((file) =>
      /(-edition\.css|-panel-chrome\.ts)$/.test(path.basename(file)),
    )
      .map((file) => path.relative(SRC_DIR, file))
      .sort();

    assert.deepEqual(
      offenders,
      ['components/patterns/utility-edition/utility-edition.css'],
      'a per-route stylesheet or panel-chrome module appeared outside app/ (repo-ps0rm)',
    );
  });
});

describe('surface parity · the page body is rendered once', () => {
  it('ShellPageTransition does not pass children into both the fallback and the boundary', () => {
    /*
     * repo-bko39. The component hands `{children}` to the Suspense fallback AND to the boundary
     * content, so React streams the whole page twice and every shipped document carries two
     * <main> landmarks, two h1s and a duplicate of every id. Measured in the production build:
     * about.html, data.html, support.html and corrections.html each contain id="main" twice, and
     * the duplicate is ~25% of the document.
     *
     * It is invisible — the retained fallback frame measured 0x0 — which is why it survived every
     * functional check and why it needs a test rather than an eye. Fixed by deleting the boundary,
     * whose two branches were the same function: useSurfaceClass() reads usePathname() only, so
     * nothing there ever suspended.
     */
    const raw = readFileSync(path.join(SRC_DIR, 'components/ShellPageTransition.tsx'), 'utf8');
    // Strip comments first: the file's own doc comment quotes the defective JSX on purpose, so
    // that a reader who reintroduces it has been told why not. Asserting against the raw text
    // would fail on the explanation rather than on the code.
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    // No Suspense boundary may wrap the page root at all. A fallback here necessarily renders
    // `children` a second time, which is the whole defect; if a surface ever needs
    // useSearchParams, the boundary belongs around that component, not around every page.
    assert.doesNotMatch(
      source,
      /<Suspense/,
      'a Suspense boundary at the page root ships the body twice (repo-bko39)',
    );
    // Exactly one element may carry the frame class. Two render sites is what a fallback plus a
    // boundary produced, and it is the shape to watch for however it is reintroduced.
    assert.equal(
      (source.match(/className="ds-shell-page-transition"/g) ?? []).length,
      1,
      'the page frame must be rendered from exactly one place (repo-bko39)',
    );
  });
});

describe('surface parity · three entry postures only', () => {
  it('does not invent a fourth page-header posture beyond Field, Record and Reading', () => {
    const allowed = new Set([
      'ReadingEntry',
      'DocumentColophon',
      'OrientationInstrument',
      'EntryPosture',
      'SiteShellHeader', // site chrome, not a room entry posture
    ]);
    const offenders: string[] = [];
    for (const file of SOURCES) {
      if (!/\.(tsx|ts)$/.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(
        /\b(?:export\s+function|function)\s+([A-Z][A-Za-z0-9]*(?:Entry|Header|Masthead|Posture))\b/g,
      )) {
        const name = match[1]!;
        if (allowed.has(name)) continue;
        if (name === 'UtilityEditionIntro') continue;
        offenders.push(`${path.relative(SRC_DIR, file)}:${name}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `fourth entry posture invented: ${offenders.join(', ') || '(none)'}`,
    );
  });

  it('EntryPosture module declares the three legal postures', () => {
    const source = readFileSync(path.join(SRC_DIR, 'components/room/EntryPosture.tsx'), 'utf8');
    assert.match(source, /export type EntryPosture = 'field' \| 'record' \| 'reading'/);
  });
});
