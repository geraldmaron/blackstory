/**
 * The page kit's contract, and the guard that keeps the v6 edition system from growing back.
 *
 * Two kinds of assertion live here. The first is ordinary component coverage: every block in
 * the kit renders its documented structure. The second is the structural guard — no new
 * `*-edition.css` or `*-panel-chrome.ts` under `apps/web/src/app`, and exactly one header per
 * page — which is the whole reason SP-22 exists. Restyling twenty-one screens without a shared
 * kit reproduces the patchwork exactly, and a reviewer's memory is not a control.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PageFrame } from './PageFrame';
import { parentCrumb, resolveTrail } from './crumb-trail';
import { PageSection, RelatedLink } from './PageSection';
import { ContentsList } from './ContentsList';
import { ChoiceField, Field, NumberedStep, fieldControlProps } from '../forms/fields';
import { Prose } from './Prose';
import { ReadingProgress } from './ReadingProgress';
import { CLASSIFIED_PATHS, surfaceClassFor } from '../../lib/nav/surface-classes';

void React;

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../app');

/**
 * Prevents per-route edition stylesheets and panel-chrome modules from returning. The empty
 * exemption list is intentional; any new matching file must fail this guard.
 */
const LEGACY_EDITION_CHROME: readonly string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('page kit · page titles are plain words', () => {
  // A quoted title attribute holding markup renders the literal tags.
  it('no page passes markup inside a quoted title attribute', () => {
    const offenders = walk(APP_DIR)
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) => /title="[^"]*<[a-z]/i.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_DIR, file));

    assert.deepEqual(offenders, []);
  });

  // The copper italic accent word in a headline is retired (direction contract, hard rule 4).
  it('no PageHeader title carries an <em> accent word', () => {
    const offenders = walk(APP_DIR)
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) =>
        /<PageHeader\b[^>]*?title=\{\s*<>[^]*?<em>/.test(readFileSync(file, 'utf8')),
      )
      .map((file) => path.relative(APP_DIR, file));

    assert.deepEqual(offenders, []);
  });
});

describe('page kit · the v6 edition system stays retired', () => {
  it('no *-edition.css or *-panel-chrome.ts is added under app/, and none is left behind', () => {
    const onDisk = walk(APP_DIR)
      .map((file) => path.relative(APP_DIR, file))
      .filter((rel) => rel.endsWith('-edition.css') || rel.endsWith('-panel-chrome.ts'))
      .sort();

    const declared = [...LEGACY_EDITION_CHROME].sort();

    const added = onDisk.filter((rel) => !declared.includes(rel));
    assert.deepEqual(
      added,
      [],
      `Per-route edition chrome is retired. Use the page kit (components/page) with one of ` +
        `reading-page.css, record-page.css or utility.css. New offending files: ${added.join(', ')}`,
    );

    const stale = declared.filter((rel) => !onDisk.includes(rel));
    assert.deepEqual(
      stale,
      [],
      `These screens have moved onto the kit — drop them from LEGACY_EDITION_CHROME so the ` +
        `ratchet keeps tightening: ${stale.join(', ')}`,
    );
  });

  it('the three surface stylesheets exist and each imports the shared kit', () => {
    for (const sheet of ['reading-page.css', 'record-page.css', 'utility.css']) {
      const css = readFileSync(path.join(APP_DIR, sheet), 'utf8');
      assert.match(
        css,
        /@import\s+'\.\.\/components\/page\/page-kit\.css'/,
        `${sheet} must layer over the shared kit rather than restate it`,
      );
    }
  });

  it('the kit styles an unclassed content link at zero specificity', () => {
    // A byline "Neo" and an anatomy "3 sources" rendered in the browser default link color
    // because only `.ds-doc-prose a` had a rule. The base rule must stay inside `:where()` so
    // it never outranks a classed link or a block-level `.x a` rule.
    const kitCss = readFileSync(path.join(APP_DIR, '../components/page/page-kit.css'), 'utf8');
    assert.match(
      kitCss,
      /:where\(\.ds-doc\) :where\(a:not\(\[class\]\)\) \{\s*color: var\(--ds-accent\);/,
    );
  });
});

describe('page kit · a catalog block a second page renders is styled by the kit', () => {
  // /law reused the Records find field while its rules shipped only in the Records stylesheet,
  // which /law never loads, so the search rendered as bare browser controls. Any `ds-records-*`
  // class used outside app/records must be defined in page-kit.css, which every page loads.
  it('every ds-records-* class used outside app/records is defined in page-kit.css', () => {
    const kitCss = readFileSync(path.join(APP_DIR, '../components/page/page-kit.css'), 'utf8');
    const recordsDir = path.join(APP_DIR, 'records') + path.sep;
    const missing = new Set<string>();

    for (const file of walk(APP_DIR)) {
      if (!file.endsWith('.tsx') || file.endsWith('.test.tsx') || file.startsWith(recordsDir)) {
        continue;
      }
      const source = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const [className] of source.matchAll(/\bds-records-[a-z0-9_-]+/g)) {
        if (!new RegExp(`\\.${className}(?![a-z0-9_-])`).test(kitCss)) {
          missing.add(`${path.relative(APP_DIR, file)}: ${className}`);
        }
      }
    }

    assert.deepEqual(
      [...missing].sort(),
      [],
      'move the block into components/page/page-kit.css rather than importing a route stylesheet',
    );
  });
});

describe('page kit · the trail is computed, never hand-written', () => {
  // An Archive lens crumbs to the Archive and a trust page to About. The site root is never a
  // step: it is the site, not a place in it.
  it('a collection prints its hub, never the site root', () => {
    assert.deepEqual(resolveTrail('/books'), [
      { label: 'Archive', href: '/archive' },
      { label: 'Banned books', href: null },
    ]);
  });

  it("a record's parent is its catalog, not the site root", () => {
    assert.deepEqual(resolveTrail('/books/the-bluest-eye', 'The Bluest Eye'), [
      { label: 'Archive', href: '/archive' },
      { label: 'Banned books', href: '/books' },
      { label: 'The Bluest Eye', href: null },
    ]);
  });

  it("an entity's parent is the Archive, the catalog that lists it", () => {
    // Not the site root: a reader on a record page needs a step up into the archive, and
    // Records is the catalog that lists the record.
    assert.deepEqual(resolveTrail('/entity/abc', 'Isaac McGhie'), [
      { label: 'Archive', href: '/archive' },
      { label: 'Isaac McGhie', href: null },
    ]);
  });

  it('a nested utility page keeps every intermediate step', () => {
    assert.deepEqual(resolveTrail('/corrections/status/AB12', 'AB12'), [
      { label: 'About', href: '/about' },
      { label: 'Corrections', href: '/corrections' },
      { label: 'AB12', href: null },
    ]);
  });

  it('trailing slashes and query strings do not change the chain', () => {
    assert.deepEqual(resolveTrail('/books/?sort=year', 'Books'), resolveTrail('/books', 'Books'));
  });

  it('neither the site root nor the /pages hub is ever rendered as a crumb step', () => {
    for (const path of ['/books', '/pages', '/entity/abc', '/corrections/status/AB12']) {
      const trail = resolveTrail(path, 'Here');
      assert.ok(
        trail.every((step) => step.href !== '/' && step.href !== '/pages'),
        `${path} must not render a site-root or Pages step`,
      );
    }
  });

  it('an unrecognized path still ends at a non-link final step', () => {
    const trail = resolveTrail('/nope', 'Not found');
    assert.equal(trail.at(-1)?.href, null);
  });

  it('every step above the last is a real link', () => {
    const trail = resolveTrail('/stories/redlining', 'Redlining');
    for (const step of trail.slice(0, -1)) assert.ok(step.href, `${step.label} must be a link`);
  });
});

describe('page kit · the Reading posture is the shared PageHeader', () => {
  it('parentCrumb gives the one step above a page, and nothing for the site root', () => {
    assert.deepEqual(parentCrumb('/books/the-bluest-eye'), {
      href: '/books',
      label: 'Banned books',
    });
    assert.equal(parentCrumb('/about'), undefined, 'the /pages hub is not a crumb');
    assert.equal(parentCrumb('/'), undefined);
  });
});

describe('page kit · prose and inline references', () => {
  it('Prose carries the measure class and nothing else', () => {
    const html = renderToStaticMarkup(
      <Prose>
        <p>Text.</p>
      </Prose>,
    );
    assert.match(html, /<div class="ds-doc-prose"><p>Text\.<\/p><\/div>/);
  });
});

describe('page kit · the column', () => {
  it('PageFrame renders one main on one of the three shared containers, and sets no width itself', () => {
    const read = renderToStaticMarkup(
      <PageFrame width="read">
        <p>Body.</p>
      </PageFrame>,
    );
    assert.match(
      read,
      /<main class="ds-doc" id="main"><div class="ds-doc__body ds-wrap ds-wrap--read"><div class="ds-doc__column">/,
    );
    assert.doesNotMatch(read, /max-width|style=/);
    assert.match(
      renderToStaticMarkup(<PageFrame width="wide">{null}</PageFrame>),
      /class="ds-doc__body ds-wrap"/,
    );
    assert.match(renderToStaticMarkup(<PageFrame>{null}</PageFrame>), /ds-wrap ds-wrap--record/);
  });

  it('puts the masthead and the apparatus band outside the measure, around the body', () => {
    const html = renderToStaticMarkup(
      <PageFrame masthead={<p>Hero.</p>} foot={<p>Sources.</p>} rail={<p>Rail.</p>}>
        <p>Body.</p>
      </PageFrame>,
    );

    // Order is the contract: mast, then the railed body, then the band. The two full-bleed
    // blocks are siblings of the body rather than children of the column, which is what lets
    // them run wider than the measure the column is pinned to.
    assert.match(
      html,
      /ds-doc__mast[^]*ds-doc__body ds-wrap ds-wrap--record ds-doc__body--railed[^]*ds-doc__column[^]*ds-doc__rail[^]*ds-doc__foot/,
    );
  });
});

describe('page kit · the reading progress rule is class-wide', () => {
  // Apply the rule to every page registered in the surface catalog so new routes are covered
  // automatically.
  it('renders on every route the registry resolves to Reading, and only those', () => {
    for (const routePath of CLASSIFIED_PATHS) {
      const surface = surfaceClassFor(routePath);
      const html = renderToStaticMarkup(<ReadingProgress surface={surface} />);
      if (surface === 'reading') {
        assert.match(
          html,
          /class="ds-reading-progress"/,
          `${routePath} resolves to Reading and must render the gauge`,
        );
      } else {
        assert.equal(
          html,
          '',
          `${routePath} resolves to ${String(surface)}, not Reading, and must not render the gauge`,
        );
      }
    }
  });

  it('covers /memorial and /records, the two Reading pages filed outside SP-11', () => {
    // Named explicitly in the bead because a hand-written route list is exactly what missed
    // them the first time; the registry-driven test above already covers both, this just pins
    // the two routes the gap named so a future edit to the registry cannot quietly drop them.
    assert.equal(surfaceClassFor('/memorial'), 'reading');
    assert.equal(surfaceClassFor('/records'), 'reading');
  });

  it('no screen defines its own progress element', () => {
    const offenders = walk(APP_DIR)
      .filter((file) => /\.(tsx|jsx)$/.test(file))
      .filter((file) => path.relative(APP_DIR, file) !== 'reading-page.css')
      .filter((file) => /ds-reading-progress|docprog/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_DIR, file));
    assert.deepEqual(
      offenders,
      [],
      'the reading progress rule belongs to components/page/ReadingProgress.tsx and reading-page.css alone',
    );
  });

  it('the visibility rule is scoped to the Reading surface class in reading-page.css', () => {
    const css = readFileSync(path.join(APP_DIR, 'reading-page.css'), 'utf8');
    assert.match(
      css,
      /\[data-surface='reading'\]\s+\.ds-reading-progress\s*\{\s*display:\s*block;\s*\}/,
    );
  });

  it('the width transition reads a duration token, so reduced motion updates it without animation', () => {
    // packages/ui/src/styles/tokens.css collapses every --ds-duration-* token to 0.01ms under
    // prefers-reduced-motion: reduce, so the gauge needs no reduced-motion handling of its own —
    // only a duration that actually comes from a token rather than a literal millisecond value.
    const css = readFileSync(path.join(APP_DIR, 'reading-page.css'), 'utf8');
    const rule = /\.ds-reading-progress\s*\{([^}]*)\}/.exec(css);
    assert.ok(rule, 'the base .ds-reading-progress rule must exist');
    assert.match(rule[1]!, /transition:\s*width\s+var\(--ds-duration-\w+\)/);
    assert.doesNotMatch(
      rule[1]!,
      /transition:\s*width\s+\d/,
      'the duration must come from a token, not a literal value the reduced-motion media query cannot reach',
    );
  });
});

/**
 * `tokens.css` defines the type steps and says a surface may choose which step a thing is, not
 * what the step measures. On 2026-09-20, 172 of 182 `font-size` declarations in these six files
 * were literals in about 25 values, which is how one index row rendered at 13.5px on /law and
 * 18px on /books. A literal size in a page stylesheet is how that drift returns.
 */

describe('page kit · page stylesheets size type from the token scale', () => {
  const ROOM_STYLESHEETS = [
    '../components/page/page-kit.css',
    'reading-page.css',
    'data/data-page.css',
    'stories/stories.css',
    'about/about-page.css',
    'support/support.css',
    'records/records-index.css',
  ] as const;

  /** The memorial wall is a protected experience (P-01); its sizes are not this guard's to move. */
  const EXEMPT_SELECTOR = /\.ds-memorial/;

  it('no literal font-size outside the memorial wall', () => {
    const offenders: string[] = [];
    for (const rel of ROOM_STYLESHEETS) {
      const css = readFileSync(path.join(APP_DIR, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (selector === undefined || body === undefined || EXEMPT_SELECTOR.test(selector))
          continue;
        for (const [, value] of body.matchAll(/font-size:\s*([^;]+);/g)) {
          if (value === undefined) continue;
          const size = value.trim();
          // Relative sizes scale with a tokenized parent, so they are not a second scale.
          if (size.startsWith('var(--ds-text-') || size === 'inherit' || /^[\d.]+em$/.test(size)) {
            continue;
          }
          offenders.push(`${rel}: ${selector.trim().split('\n').pop()} { font-size: ${size} }`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      'pick a --ds-text-* step from packages/ui/src/styles/tokens.css',
    );
  });
});

describe('page kit · one public control system', () => {
  const KNOWN_CONTROL_FAMILIES: readonly string[] = [
    // The page kit's own.
    'ds-find',
    'ds-pill-select',
    'ds-records-active',
    'ds-records-facet',
    'ds-doc-chip',
    'ds-typeahead',
    // Explore, Door and record pages. Out of the pages pass; do not add to this half.
    'ds-door',
    'ds-explore',
    'ds-explore-place',
    'ds-lens',
    'ds-privacy',
    'ds-rec-pill',
    'ds-rec-pills',
    // The record page's own capsule (2979d7e2), same exemption as ds-rec-pill above.
    'ds-recpage',
    'ds-relation-chip',
    'ds-sheet',
    'ds-state-chip',
    'ds-state-start',
  ];

  const publicFiles = (extension: string) =>
    [...walk(APP_DIR), ...walk(path.join(APP_DIR, '../components'))].filter(
      (file) =>
        file.endsWith(extension) &&
        !file.includes(`${path.sep}admin${path.sep}`) &&
        !/\.test\.tsx?$/.test(file),
    );

  it('no route grows its own chip, pill or filter class family', () => {
    const found = new Set<string>();
    for (const file of publicFiles('.css')) {
      const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [selector] of css.matchAll(
        /\.ds-[a-z0-9_-]*(?:chip|pill|filter)s?(?![a-z])[a-z0-9_-]*/g,
      )) {
        const family = selector.slice(1).split(/__|--/)[0] as string;
        if (!KNOWN_CONTROL_FAMILIES.includes(family)) {
          found.add(`${path.relative(APP_DIR, file)}: .${family}`);
        }
      }
    }
    assert.deepEqual(
      [...found].sort(),
      [],
      'use the kit Chip and FilterButton, or .ds-doc-chip from page-kit.css',
    );
  });

  it('no public route has an Apply button; controls apply themselves', () => {
    const offenders = publicFiles('.tsx').filter((file) =>
      /<button[^>]*>\s*(?:\{['"`])?\s*Apply\b/.test(readFileSync(file, 'utf8')),
    );
    assert.deepEqual(
      offenders.map((file) => path.relative(APP_DIR, file)),
      [],
      'a chip is a link, a select uses AutoSubmitSelect, a search field submits on Enter',
    );
  });
});

/**
 * docs/ui/archive/design-direction-v10-pages.md: the standalone pages share one look, and it is opt-in on
 * `PageFrame` because Lives, the memorial wall and record pages share the kit. An opt-in drifts the
 * way the chapter pattern did, so the list of pages that must carry it is pinned here.
 */

describe('page kit · every page picks one of the three containers', () => {
  const PAGES = [
    'about/page.tsx',
    'books/(index)/page.tsx',
    'corrections/page.tsx',
    'data/page.tsx',
    'errata/page.tsx',
    'faq/page.tsx',
    'law/(index)/page.tsx',
    'lives/page.tsx',
    'lives/explorer/page.tsx',
    'methodology/page.tsx',
    'privacy/page.tsx',
    'records/RecordsIndex.tsx',
    'presidents/(index)/page.tsx',
    'sources/page.tsx',
    'stories/(index)/page.tsx',
    'submit/page.tsx',
    'support/page.tsx',
    'terms/page.tsx',
  ] as const;

  it('names its width on <PageFrame>', () => {
    const missing = PAGES.filter((rel) => {
      const source = readFileSync(path.join(APP_DIR, rel), 'utf8');
      return !/<PageFrame\s+width="(read|record|wide)"/.test(source);
    });
    assert.deepEqual(missing, []);
  });

  it('no stylesheet sets a per-route page measure', () => {
    const offenders = walk(path.join(APP_DIR, '..'))
      .filter((file) => file.endsWith('.css'))
      .filter((file) => /--doc-doc-w|ds-doc--ledger/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_DIR, file));
    assert.deepEqual(offenders, []);
  });
});

describe('field error contract', () => {
  it('Field links and announces its error, and marks the control invalid', () => {
    const html = renderToStaticMarkup(
      <Field label="Which record is wrong?" htmlFor="rec" hint="A hint" error="An error">
        <input {...fieldControlProps({ htmlFor: 'rec', hint: true, error: 'An error' })} />
      </Field>,
    );
    assert.match(html, /role="alert"/, 'the error must be announced');
    assert.match(html, /id="rec-error"/);
    assert.match(html, /aria-invalid="true"/, 'the control must be marked invalid');
    assert.match(html, /aria-describedby="rec-hint rec-error"/, 'hint then error, in order');
    assert.match(html, /class="ds-doc-field__error"/, 'an error is not styled as a hint');
  });

  it('ChoiceField can render an error, not only a hint', () => {
    const html = renderToStaticMarkup(
      <ChoiceField
        legend="What is wrong with it?"
        name="category"
        choices={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        error="Choose a correction category."
      />,
    );
    assert.match(html, /role="alert"/);
    assert.match(html, /id="category-error"/);
    assert.match(html, /aria-describedby="category-error"/);
    // exactly one radio carries the invalid state, so it announces once not once per choice
    assert.equal((html.match(/aria-invalid="true"/g) ?? []).length, 1);
  });

  it('fieldControlProps stays quiet when there is nothing to describe', () => {
    const props = fieldControlProps({ htmlFor: 'x' });
    assert.deepEqual(props, { id: 'x' });
  });
});

describe('page kit · sections, links and fields', () => {
  it('PageSection is a labelled section under the shared heading, with no plate or kicker', () => {
    const html = renderToStaticMarkup(
      <PageSection id="grades" title="What the grades mean">
        <p>A grade is never a color on its own.</p>
      </PageSection>,
    );
    assert.match(
      html,
      /<section id="grades" class="ds-doc-section" aria-labelledby="grades-heading">/,
    );
    assert.match(
      html,
      /<h2 class="ds-section-heading" id="grades-heading">What the grades mean<\/h2>/,
    );
    assert.doesNotMatch(html, /plate|kicker|--sunk|ds-destination-icon/);
  });

  it('RelatedLink is a link with a plate, never a buried paragraph', () => {
    const html = renderToStaticMarkup(
      <RelatedLink href="/sources" icon="source" title="Source library" line="Publisher kinds." />,
    );
    assert.match(html, /href="\/sources"/);
    assert.match(html, /ds-doc-handoff/);
    assert.match(html, /Source library/);
  });

  it('ContentsList is a plain text list of hash links that work without JavaScript', () => {
    const html = renderToStaticMarkup(
      <ContentsList sections={[{ id: 'origin', label: 'Why this exists' }]} />,
    );
    assert.match(html, /<nav class="ds-doc-toc" aria-label="On this page">/);
    assert.match(html, /href="#origin"/);
    assert.doesNotMatch(html, /aria-current|ds-destination-icon/);
  });

  it('a Field binds its mono label to the control', () => {
    const html = renderToStaticMarkup(
      <Field label="Your email" htmlFor="email">
        <input id="email" type="email" />
      </Field>,
    );
    assert.match(html, /<label class="ds-doc-field__label" for="email">Your email<\/label>/);
  });

  it('a completed NumberedStep swaps its index for a check', () => {
    const done = renderToStaticMarkup(<NumberedStep index={1} title="Received" done />);
    assert.match(done, /data-done="1"/);
    assert.match(done, /✓/);

    const pending = renderToStaticMarkup(<NumberedStep index={2} title="In review" />);
    assert.match(pending, /data-done="0"/);
    assert.match(pending, /ds-doc-ustep__i[^>]*>2</);
  });
});
