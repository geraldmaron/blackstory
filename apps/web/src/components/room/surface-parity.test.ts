/**
 * The structural half of the surface parity gate, expressed as a test rather than an observation.
 *
 * Visual parity still requires a person to compare each room with its mock across breakpoints and
 * themes. Source-level invariants do not: this suite ensures no screen renders a header, panel
 * frame, or kicker from the v6 edition chrome.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE ROOM-KIT RATCHET. `room-kit.test.tsx` already forbids
 * `*-edition.css` and `*-panel-chrome.ts`, but it walks `app/` only:
 *
 *     const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../app');
 *
 * This file walks all of `src/` so shared component styles are covered too.
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
 * The v6 edition class families still present in source.
 *
 * A RATCHET, NOT AN ALLOWLIST, and it fails in both directions: a family here that no longer
 * appears is a stale exemption to delete, and a family in the tree that is not here means the v6
 * vocabulary is spreading again. This test deliberately does not decide whether the remaining
 * entries need a room-kit rebuild or only a class rename.
 *
 * `history` remains in the ratchet while its class family is present in source, even though no
 * `/history` page renders.
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
      'v6 edition class families changed: shrink the list when one goes; never grow it',
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
      'a per-route stylesheet or panel-chrome module appeared outside app/',
    );
  });
});

describe('surface parity · the page body is rendered once', () => {
  it('ShellPageTransition does not pass children into both the fallback and the boundary', () => {
    /*
     * Passing `{children}` to both a Suspense fallback and the boundary content streams the page
     * twice, producing duplicate landmarks, headings, and ids. Page-root Suspense is prohibited;
     * any component that can suspend must own its boundary locally.
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
      'a Suspense boundary at the page root ships the body twice',
    );
    // Exactly one element may carry the frame class. Two render sites is what a fallback plus a
    // boundary produced, and it is the shape to watch for however it is reintroduced.
    assert.equal(
      (source.match(/className="ds-shell-page-transition"/g) ?? []).length,
      1,
      'the page frame must be rendered from exactly one place',
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
