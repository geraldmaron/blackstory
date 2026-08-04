/**
 * The room kit's contract, and the guard that keeps the v6 edition system from growing back.
 *
 * Two kinds of assertion live here. The first is ordinary component coverage: every block in
 * the kit renders its documented structure. The second is the structural guard — no new
 * `*-edition.css` or `*-panel-chrome.ts` under `apps/web/src/app`, and exactly one header per
 * room — which is the whole reason SP-22 exists. Restyling twenty-one screens without a shared
 * kit reproduces the patchwork exactly, and a reviewer's memory is not a control.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Room } from './Room';
import { RoomHeader } from './RoomHeader';
import { Breadcrumb } from './Breadcrumb';
import { resolveTrail } from './room-trail';
import { CardGrid, GroupHeading, RoomCard } from './RoomCards';
import { Prose, RecordRef } from './Prose';
import { Anatomy, Connections, Note, Precision, SourceList, TrustBlock } from './Evidence';
import { HairlineIndex } from './HairlineIndex';
import { DataTable } from './DataTable';
import { Disclosure, Field, UtilityCard, UtilityStep } from './Utility';
import { EmptyList, OffRamp, RecordNav } from './RoomFoot';

void React;

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../app');

/**
 * The v6 edition system as it stands the day the kit lands: twelve per-route stylesheets and
 * nine panel-chrome modules. This is a ratchet, not an allowlist. Each entry is deleted from
 * the repo *and* from this list as its screen moves onto the kit in SP-11, SP-12 and SP-13,
 * and the test fails in both directions — a file here that no longer exists is a stale
 * exemption, a file on disk that is not here is the v6 system growing back.
 *
 * One entry outlives the three surface packages by design: `explore-*` belongs to the Atlas
 * until SP-16 closes. The `history-*` pair left with repo-92n2.27, which deleted the orphaned
 * render components now that /history is a redirect endpoint.
 */
const LEGACY_EDITION_CHROME: readonly string[] = [
  '(map)/explore/explore-edition.css',
  '(map)/explore/explore-panel-chrome.ts',
  'about/about-edition.css',
  'about/about-panel-chrome.ts',
  'books/books-edition.css',
  'books/books-panel-chrome.ts',
  'chapters/articles-edition.css',
  'data/data-edition.css',
  'data/data-panel-chrome.ts',
  'law/law-edition.css',
  'law/law-panel-chrome.ts',
  'memorial/memorial-edition.css',
  'memorial/memorial-panel-chrome.ts',
  'methodology/methodology-edition.css',
  'methodology/methodology-panel-chrome.ts',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('room kit · a title is JSX, never a string of markup', () => {
  // `RoomHeader`'s title is a ReactNode so `<em>` renders in the editorial accent. Passed as a
  // string attribute instead, React escapes it and the reader sees the literal tags: /law shipped
  // reading "Civil rights <em>law</em>" and /about "History, pinned to <em>place</em>.".
  it('no room passes markup inside a quoted title attribute', () => {
    const offenders = walk(APP_DIR)
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) => /title="[^"]*<[a-z]/i.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_DIR, file));

    assert.deepEqual(
      offenders,
      [],
      'pass the title as JSX: title={<>Civil rights <em>law</em></>}',
    );
  });
});

describe('room kit · the v6 edition system stays retired', () => {
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
      `Per-route edition chrome is retired. Use the room kit (components/room) with one of ` +
        `reading-room.css, record-page.css or utility.css. New offending files: ${added.join(', ')}`,
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
    for (const sheet of ['reading-room.css', 'record-page.css', 'utility.css']) {
      const css = readFileSync(path.join(APP_DIR, sheet), 'utf8');
      assert.match(
        css,
        /@import\s+'\.\.\/components\/room\/room-kit\.css'/,
        `${sheet} must layer over the shared kit rather than restate it`,
      );
    }
  });
});

describe('room kit · the trail is computed, never hand-written', () => {
  // SP-21 (repo-92n2.29) shipped /library, so a reading room's parent is the library rather than
  // the Atlas — matching `SURF_PARENT` in the mock, where library is the default up-link. These
  // chains were one step short while the route was held. The Atlas root itself is resolved but
  // not rendered as a step (see resolveTrail).
  it('a reading room hangs off the library', () => {
    assert.deepEqual(resolveTrail('/books'), [
      { label: 'The library', href: '/library' },
      { label: 'Banned books', href: null },
    ]);
  });

  it("a record's parent is its catalogue, not the Atlas", () => {
    assert.deepEqual(resolveTrail('/books/the-bluest-eye', 'The Bluest Eye'), [
      { label: 'The library', href: '/library' },
      { label: 'Banned books', href: '/books' },
      { label: 'The Bluest Eye', href: null },
    ]);
  });

  it("an entity's parent is the Atlas, not /records — a record is a point, not a row", () => {
    // The Atlas root is not a rendered step, so an entity's chain is the entity alone.
    assert.deepEqual(resolveTrail('/entity/abc', 'Isaac McGhie'), [
      { label: 'Isaac McGhie', href: null },
    ]);
  });

  it('a nested utility room keeps every intermediate step', () => {
    assert.deepEqual(resolveTrail('/corrections/status/AB12', 'AB12'), [
      { label: 'The library', href: '/library' },
      { label: 'Corrections', href: '/corrections' },
      { label: 'AB12', href: null },
    ]);
  });

  it('trailing slashes and query strings do not change the chain', () => {
    assert.deepEqual(resolveTrail('/books/?sort=year', 'Books'), resolveTrail('/books', 'Books'));
  });

  it('the Atlas root is never rendered as a crumb step', () => {
    for (const path of ['/books', '/library', '/entity/abc', '/corrections/status/AB12']) {
      const trail = resolveTrail(path, 'Here');
      assert.ok(
        trail.every((step) => step.href !== '/'),
        `${path} must not render an Atlas step`,
      );
    }
  });

  it('an unrecognised path still ends at a non-link final step', () => {
    const trail = resolveTrail('/nope', 'Not found');
    assert.equal(trail.at(-1)?.href, null);
  });

  it('every step above the last is a real link', () => {
    const trail = resolveTrail('/chapters/redlining', 'Redlining');
    for (const step of trail.slice(0, -1)) assert.ok(step.href, `${step.label} must be a link`);
  });
});

describe('room kit · RoomHeader is the only header a room renders', () => {
  it('renders breadcrumb, kicker, title, lede and mono meta in one block', () => {
    const html = renderToStaticMarkup(
      <RoomHeader
        pathname="/books"
        kicker="Catalogue"
        title="Banned books"
        lede="Every title removed from a public shelf, with the order that removed it."
        meta={['1,204 titles', '1963 to 2024']}
      />,
    );

    assert.match(html, /ds-room-crumb/);
    assert.match(html, /ds-room-header__kicker[^>]*>Catalogue/);
    assert.match(html, /<h1 class="ds-room-header__title">Banned books<\/h1>/);
    assert.match(html, /ds-room-header__lede/);
    assert.match(html, /1,204 titles/);

    // The path leads the meta row, ahead of every count. Mock: `#docmeta`, path then meta.
    assert.match(
      html,
      /ds-room-header__meta"><span class="ds-room-header__path">\/books<\/span><span>1,204 titles<\/span>/,
    );

    assert.equal(html.match(/<h1/g)?.length, 1, 'a room renders exactly one h1');
    assert.equal(html.match(/<header/g)?.length, 1, 'a room renders exactly one header');
  });

  it('omits the meta row entirely when there are no facts and no path', () => {
    const html = renderToStaticMarkup(
      <RoomHeader pathname="/privacy" title="Privacy" showPath={false} />,
    );
    assert.doesNotMatch(html, /ds-room-header__meta/);
  });

  it('the breadcrumb marks the current step and does not link it', () => {
    const html = renderToStaticMarkup(<Breadcrumb pathname="/law" />);
    assert.match(html, /aria-current="page"/);
    assert.match(html, /ds-room-crumb__here[^>]*>Law/);
    assert.match(html, /href="\/library"/);
    assert.doesNotMatch(html, /href="\/"/);
  });
});

describe('room kit · catalogue blocks', () => {
  it('a RoomCard is a link, so a catalogue entry is a destination', () => {
    const html = renderToStaticMarkup(
      <CardGrid>
        <RoomCard
          href="/law/hr-40"
          kind="Statute"
          title="H.R. 40"
          description="A commission to study reparation proposals."
          meta="Federal · 1989"
        />
      </CardGrid>,
    );
    assert.match(html, /<a[^>]+class="ds-room-card"[^>]+href="\/law\/hr-40"/);
    assert.match(html, /ds-room-card__kind[^>]*>Statute/);
    assert.match(html, /ds-room-card__meta[^>]*>Federal · 1989/);
  });

  it('a GroupHeading is an h2, so the room has a real outline', () => {
    const html = renderToStaticMarkup(<GroupHeading>By decade</GroupHeading>);
    assert.match(html, /<h2 class="ds-room-grouphd">By decade<\/h2>/);
  });
});

describe('room kit · prose and inline references', () => {
  it('Prose carries the measure class and nothing else', () => {
    const html = renderToStaticMarkup(
      <Prose>
        <p>Text.</p>
      </Prose>,
    );
    assert.match(html, /<div class="ds-room-prose"><p>Text\.<\/p><\/div>/);
  });

  it('a RecordRef announces that it opens a sheet rather than navigating', () => {
    const html = renderToStaticMarkup(
      <RecordRef recordId="r1" onOpen={() => {}}>
        the 1921 ordinance
      </RecordRef>,
    );
    assert.match(html, /<button[^>]+type="button"/);
    assert.match(html, /aria-haspopup="dialog"/);
    assert.doesNotMatch(html, /<a /);
  });
});

describe('room kit · evidence blocks', () => {
  it('SourceList numbers sources and shows an em dash when the year is unknown', () => {
    const html = renderToStaticMarkup(
      <SourceList
        sources={[
          { text: 'Library of Congress, Prints and Photographs', year: '1963' },
          { text: 'County deed book 14' },
        ]}
      />,
    );
    assert.match(html, /ds-room-src__i[^>]*>1</);
    assert.match(html, /ds-room-src__i[^>]*>2</);
    assert.match(html, /ds-room-src__y[^>]*>1963</);
    assert.match(html, /ds-room-src__y[^>]*>—</);
  });

  it('a Connection states the relation in words and never a bare arrow', () => {
    const html = renderToStaticMarkup(
      <Connections
        connections={[{ name: 'Tulsa, 1921', relation: 'same place as', href: '/entity/tulsa' }]}
      />,
    );
    assert.match(html, /ds-room-conn__rel[^>]*>same place as</);
    assert.doesNotMatch(html, /[→←]/);
  });

  it('Precision always says what the coordinate does not claim', () => {
    const html = renderToStaticMarkup(
      <Precision resolution="county centroid" caveat="This is not the address of the event." />,
    );
    assert.match(html, /Located to county centroid\./);
    assert.match(html, /This is not the address of the event\./);
  });

  it('TrustBlock and Anatomy render label/value pairs in a labelled group', () => {
    const trust = renderToStaticMarkup(
      <TrustBlock facts={[{ label: 'Evidence grade', value: 'B' }]} />,
    );
    assert.match(trust, /role="group"/);
    assert.match(trust, /ds-room-trust__k[^>]*>Evidence grade</);

    const anat = renderToStaticMarkup(<Anatomy cells={[{ label: 'Kind', value: 'Ordinance' }]} />);
    assert.match(anat, /ds-room-anat__v[^>]*>Ordinance</);
  });

  it('a Note prefixes its kind in the mono register', () => {
    const html = renderToStaticMarkup(<Note kind="SERIES">Two lanes do not overlap.</Note>);
    assert.match(html, /SERIES · Two lanes do not overlap\./);
  });
});

describe('room kit · index, table and utility blocks', () => {
  it('index rows are links and the count line is stated in words', () => {
    const html = renderToStaticMarkup(
      <HairlineIndex
        countLabel="1,204 of 3,900 shown"
        filters={[{ id: 'people', label: 'People', count: 812 }]}
        activeFilterId="people"
        rows={[{ href: '/entity/a', name: 'Isaac McGhie', place: 'Duluth, MN', era: '1920s' }]}
      />,
    );
    assert.match(html, /ds-room-idx__count[^>]*>1,204 of 3,900 shown</);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /<a class="ds-room-idx__row" href="\/entity\/a"/);
  });

  it('a filter carrying an href becomes a real GET link, so /records filters without JS', () => {
    const html = renderToStaticMarkup(
      <HairlineIndex
        countLabel="812 of 3,900 shown"
        filters={[
          { id: '', label: 'All kinds', count: 3900, href: '/records' },
          { id: 'people', label: 'People', count: 812, href: '/records?kind=people' },
        ]}
        activeFilterId="people"
        rows={[{ href: '/entity/a', name: 'Isaac McGhie', place: 'Duluth, MN', era: '1920s' }]}
      />,
    );
    assert.match(html, /<a class="ds-room-chip" href="\/records\?kind=people"/);
    assert.doesNotMatch(html, /<button[^>]*ds-room-chip/, 'no chip falls back to a button');
    // A link is not a toggle button: the active filter is `aria-current`, never `aria-pressed`.
    assert.match(html, /aria-current="true"/);
    assert.doesNotMatch(html, /aria-pressed/);
  });

  it('an empty index renders the shared empty state, and it names /submit', () => {
    const html = renderToStaticMarkup(
      <HairlineIndex
        countLabel="0 shown"
        rows={[]}
        empty={<EmptyList title="Nothing here yet">No record matches this filter.</EmptyList>}
      />,
    );
    assert.match(html, /ds-empty/, 'EmptyList reuses the shared EmptyState primitive');
    assert.match(html, /href="\/submit"/);
  });

  it('a DataTable scrolls inside its own labelled, focusable container', () => {
    const html = renderToStaticMarkup(
      <DataTable
        caption="Population by decade"
        columns={[
          { key: 'decade', label: 'Decade' },
          { key: 'count', label: 'Count', numeric: true },
        ]}
        rows={[{ decade: '1920s', count: '1,204' }]}
      />,
    );
    assert.match(html, /class="ds-room-tblwrap"[^>]*role="region"/);
    assert.match(html, /tabindex="0"/);
    assert.match(html, /<th[^>]+scope="col"[^>]+class="ds-room-num">Count/);
    assert.match(html, /ds-visually-hidden/, 'the caption stays available to screen readers');
  });

  it('a Disclosure is a native details element and is collapsed by default', () => {
    const html = renderToStaticMarkup(
      <Disclosure summary="Method">
        <p>How the figure was derived.</p>
      </Disclosure>,
    );
    assert.match(html, /<details class="ds-room-draw">/);
    assert.doesNotMatch(html, /<details[^>]+open/);
  });

  it('a Field binds its mono label to the control', () => {
    const html = renderToStaticMarkup(
      <Field label="Your email" htmlFor="email">
        <input id="email" type="email" />
      </Field>,
    );
    assert.match(html, /<label class="ds-room-field__label" for="email">Your email<\/label>/);
  });

  it('a completed UtilityStep swaps its index for a check', () => {
    const done = renderToStaticMarkup(<UtilityStep index={1} title="Received" done />);
    assert.match(done, /data-done="1"/);
    assert.match(done, /✓/);

    const pending = renderToStaticMarkup(<UtilityStep index={2} title="In review" />);
    assert.match(pending, /data-done="0"/);
    assert.match(pending, /ds-room-ustep__i[^>]*>2</);
  });

  it('a UtilityCard heads its stack with an h2, not a second h1', () => {
    const html = renderToStaticMarkup(
      <UtilityCard title="What we need">
        <p>Three things.</p>
      </UtilityCard>,
    );
    assert.match(html, /<h2 class="ds-room-ucard__title">What we need<\/h2>/);
    assert.doesNotMatch(html, /<h1/);
  });
});

describe('room kit · the ways a room ends', () => {
  it('an OffRamp carries at most one copper action', () => {
    const html = renderToStaticMarkup(
      <OffRamp
        title="Keep going"
        actions={[
          { href: '/records', label: 'Browse the records', emphasis: 'copper' },
          { href: '/methodology', label: 'How this was built' },
        ]}
      >
        This chapter is built out of records you can open.
      </OffRamp>,
    );
    assert.equal(html.match(/ds-cta--copper/g)?.length, 1);
    assert.match(html, /ds-cta--quiet/);
    assert.match(html, /aria-label="Where to go next"/);
  });

  it('RecordNav renders nothing when the session has no neighbours', () => {
    assert.equal(renderToStaticMarkup(<RecordNav />), '');
  });

  it('RecordNav marks prev and next with rel so the relationship is machine-readable', () => {
    const html = renderToStaticMarkup(
      <RecordNav
        previous={{ href: '/entity/a', label: 'Previous record' }}
        next={{ href: '/entity/c', label: 'Next record' }}
      />,
    );
    assert.match(html, /rel="prev"/);
    assert.match(html, /rel="next"/);
  });
});

describe('room kit · the column', () => {
  it('Room renders one main with the document wrapper and sets no width itself', () => {
    const html = renderToStaticMarkup(
      <Room>
        <p>Body.</p>
      </Room>,
    );
    assert.match(html, /<main class="ds-room" id="main"><div class="ds-room__doc">/);
    assert.doesNotMatch(html, /max-width/);
  });
});
