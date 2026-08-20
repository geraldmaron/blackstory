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
import { MapMoment, momentIsVisible, pickLiveMoment, resolveMomentCamera } from './MapMoment';

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
  // Retained by /books/[slug], which is still on the v6 detail chrome. SP-12b deletes both.
  'books/books-edition.css',
  'books/books-panel-chrome.ts',
  'explore/explore-edition.css',
  'explore/explore-panel-chrome.ts',
  // Retained by /law/[slug], which is still on the v6 detail chrome. SP-12c deletes both.
  'law/law-edition.css',
  'law/law-panel-chrome.ts',
  'memorial/memorial-edition.css',
  'memorial/memorial-panel-chrome.ts',
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
    const trail = resolveTrail('/stories/redlining', 'Redlining');
    for (const step of trail.slice(0, -1)) assert.ok(step.href, `${step.label} must be a link`);
  });
});

describe('room kit · RoomHeader is the only header a room renders', () => {
  it('renders breadcrumb, title, lede and mono meta in one block; the kicker prop no longer renders', () => {
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
    // Ink direction: the kicker prop is kept on the type so existing callers do not have to
    // change, but the title takes its space instead of rendering a mono-caps line above it.
    assert.doesNotMatch(html, /ds-room-header__kicker/);
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
  it('a RoomCard is a link, so a catalogue entry is a destination; kind no longer renders as a tag', () => {
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
    // Ink direction: kind is implied by the group a card sits in, not drawn as its own tag —
    // the `kind` prop is kept on the type so existing callers do not have to change.
    assert.doesNotMatch(html, /ds-room-card__kind/);
    assert.match(html, /ds-room-card__meta[^>]*>Federal · 1989/);
  });

  it('CardGrid defaults to the index shape and opts into the hub shape', () => {
    const index = renderToStaticMarkup(<CardGrid>{null}</CardGrid>);
    assert.match(index, /class="ds-room-cards"/);
    assert.doesNotMatch(index, /ds-room-cards--hub/);

    const hub = renderToStaticMarkup(<CardGrid variant="hub">{null}</CardGrid>);
    assert.match(hub, /class="ds-room-cards ds-room-cards--hub"/);
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

describe('room kit · map moment', () => {
  it('renders the slot, the tag and the caption, and starts idle', () => {
    const html = renderToStaticMarkup(
      <MapMoment camera={{ center: [-90.049, 35.1495], zoom: 12 }} note="Memphis, 1866." />,
    );
    assert.match(html, /class="ds-mapmoment"/);
    assert.match(html, /data-live="0"/);
    assert.match(html, /ds-mapmoment__plate/);
    assert.match(html, /<figcaption[^>]*>Memphis, 1866\.<\/figcaption>/);
  });

  it('says the map is unavailable when no stage is mounted, rather than inviting a scroll', () => {
    // The §10 degrade. A slot with no plate behind it must not tell the reader to scroll for a
    // map that will never arrive; the caption is what carries the point.
    const html = renderToStaticMarkup(
      <MapMoment camera={{ center: [-87.63, 41.9] }} note="Chicago." />,
    );
    assert.match(html, /The map is unavailable\. The caption below carries the point\./);
    assert.doesNotMatch(html, /Scroll to bring the map here/);
  });

  it('a plain moment is tagged STILL, not LIVE', () => {
    const html = renderToStaticMarkup(
      <MapMoment camera={{ center: [-92.1, 46.78] }} note="Duluth, 1920." plain />,
    );
    assert.match(html, /data-plain="1"/);
    assert.match(html, /Plate · Still/);
    assert.doesNotMatch(html, /Plate · Live/);
  });

  it('the Atlas hand-off renders only when a destination is given', () => {
    const without = renderToStaticMarkup(
      <MapMoment camera={{ center: [-90, 35] }} note="A place." />,
    );
    assert.doesNotMatch(without, /ds-mapmoment__open/);

    const with_ = renderToStaticMarkup(
      <MapMoment camera={{ center: [-90, 35] }} note="A place." atlasHref="/?find=place" />,
    );
    assert.match(with_, /href="\/\?find=place"/);
  });

  it('refuses pitch and bearing on a plain moment, and cuts instead of flying', () => {
    // The dignity rule lives at the camera layer, not at the call site: passing a pitch to a
    // plain moment must not tilt it.
    const resolved = resolveMomentCamera(
      { center: [-92.1, 46.78], zoom: 12, pitch: 45, bearing: 30 },
      { plain: true },
    );
    assert.equal(resolved.pitch, 0);
    assert.equal(resolved.bearing, 0);
    assert.equal(resolved.move, 'cut');
  });

  it('reduced motion cuts too, without being told the subject', () => {
    const resolved = resolveMomentCamera(
      { center: [-87.63, 41.9], zoom: 13, pitch: 40, bearing: -12 },
      { reducedMotion: true },
    );
    assert.equal(resolved.move, 'cut');
    assert.equal(resolved.pitch, 0);
  });

  it('an ordinary moment keeps its composition', () => {
    const resolved = resolveMomentCamera(
      { center: [-87.63, 41.9], zoom: 13, pitch: 40, bearing: -12 },
      {},
    );
    assert.equal(resolved.move, 'fly');
    assert.equal(resolved.pitch, 40);
    assert.equal(resolved.bearing, -12);
  });
});

describe('room kit · map moment arbitration', () => {
  const slot = (id: string, top: number, height = 300) => ({
    id,
    top,
    bottom: top + height,
    height,
  });

  it('a room with four moments frames exactly one', () => {
    // Chapter detail is the case: four moments, one plate.
    const live = pickLiveMoment(
      [slot('a', -400), slot('b', 100), slot('c', 700), slot('d', 1200)],
      800,
    );
    assert.equal(live, 'b');
  });

  it('no moment takes the plate until it is properly on screen', () => {
    // Just peeking over the fold is not enough; below the floor the plate stays parked.
    assert.equal(pickLiveMoment([slot('a', 700)], 800), null);
    assert.equal(pickLiveMoment([slot('a', 500)], 800), 'a');
  });

  it('a zero-height slot never wins', () => {
    // A moment inside a collapsed disclosure has a rect, and it is all zeroes.
    assert.equal(pickLiveMoment([{ id: 'hidden', top: 0, bottom: 0, height: 0 }], 800), null);
  });

  it('scrolling hands the plate forward one moment at a time', () => {
    const two = [slot('first', 0), slot('second', 320)];
    assert.equal(pickLiveMoment(two, 800), 'first');
    const scrolled = [slot('first', -260), slot('second', 60)];
    assert.equal(pickLiveMoment(scrolled, 800), 'second');
  });

  it('nothing is framed when every moment has scrolled away', () => {
    assert.equal(pickLiveMoment([slot('a', -900), slot('b', 1400)], 800), null);
  });
});

describe('room kit · a slot that is laid out but not visible is not a candidate', () => {
  it('refuses a slot the browser reports as not visible, so the plate is released', () => {
    // A moment inside a closed <details>: Chrome collapses the drawer but keeps the contents
    // laid out, so the slot still reports a full-size rect at its old position. Judging by
    // rect alone handed that slot the plate, and the map painted over the prose that had
    // taken the space — the "map bleeding through the text" report.
    const hidden = { checkVisibility: () => false } as unknown as Element;
    const shown = { checkVisibility: () => true } as unknown as Element;
    assert.equal(momentIsVisible(hidden), false);
    assert.equal(momentIsVisible(shown), true);
  });

  it('keeps rect-only behaviour where checkVisibility is unsupported, rather than losing every moment', () => {
    assert.equal(momentIsVisible({} as unknown as Element), true);
  });
});

describe('room kit · a live moment is a window onto the borrowed plate', () => {
  it('drops the slot background when live, or the plate paints behind an opaque box', () => {
    // The regression this guards was invisible for a long time and hid EVERY map on the site.
    // The plate is fixed at --ds-z-map-plate (0) and the document column sits at
    // --ds-z-content (1), so a plate holding a slot paints behind the column by design. The
    // slot kept its opaque idle ground when live, so the map was positioned perfectly over the
    // slot and then covered by it: every MapMoment rendered an empty box. Nothing failed, no
    // error was logged, and the moment still reported itself live.
    const css = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'room-kit.css'),
      'utf8',
    );
    const liveRule = /\.ds-mapmoment\[data-live='1'\]\s+\.ds-mapmoment__plate\s*\{([^}]*)\}/.exec(
      css,
    );
    assert.ok(liveRule, 'the live-slot rule must exist');
    assert.match(
      liveRule[1]!,
      /background:\s*transparent/,
      'a live slot must drop its background so the borrowed plate shows through',
    );
  });
});

describe('room kit · no room invents its own map moment', () => {
  it('no route defines moment markup outside the kit', () => {
    // The gap this package closed: the mock renders a moment in seven rooms and the kit had no
    // component for it, so six of them would each have grown their own.
    const offenders = walk(APP_DIR)
      .filter((file) => /\.(tsx|ts|css)$/.test(file))
      .filter((file) => /ds-mapmoment__plate|mm-plate/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_DIR, file));
    assert.deepEqual(offenders, [], 'map moment markup belongs to components/room/MapMoment.tsx');
  });
});
