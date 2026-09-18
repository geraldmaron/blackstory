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
import { ReadingEntry, DocumentColophon } from './EntryPosture';
import { Breadcrumb } from './Breadcrumb';
import { resolveTrail } from './room-trail';
import { CardGrid, GroupHeading, RoomCard } from './RoomCards';
import { RoomSection, RoomHandoff } from './RoomSection';
import { RoomJump } from './RoomJump';
import { Prose, RecordRef } from './Prose';
import { Anatomy, Connections, Note, Precision, SourceList, TrustBlock } from './Evidence';
import { HairlineIndex } from './HairlineIndex';
import { DataTable } from './DataTable';
import { Disclosure, Field, UtilityCard, UtilityStep } from './Utility';
import { EmptyList, OffRamp, RecordNav } from './RoomFoot';
import {
  MapMoment,
  momentIsVisible,
  pickLiveMoment,
  resolveMomentCamera,
  resolveMomentVisibility,
} from './MapMoment';
import { ReadingProgress } from './ReadingProgress';
import { CLASSIFIED_PATHS, surfaceClassFor } from '../../lib/nav/surface-classes';

void React;

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../app');

/**
 * The v6 edition system as it stands the day the kit lands: twelve per-route stylesheets and
 * nine panel-chrome modules. This is a ratchet, not an allowlist. Each entry is deleted from
 * the repo *and* from this list as its screen moves onto the kit in SP-11, SP-12 and SP-13,
 * and the test fails in both directions — a file here that no longer exists is a stale
 * exemption, a file on disk that is not here is the v6 system growing back.
 *
 * The `history-*` pair left once /history became a redirect endpoint and its orphaned render
 * components were deleted. The `explore-*` pair left once the one live dependency — a direct
 * stylesheet import on the Explore surface — was broken: the v9 atlas instruments (TimePanel,
 * CameraConsole, LensPanel, ResultsRail) had already replaced everything the two files styled.
 *
 * The list is now EMPTY, and that is the end state, not a gap: `memorial/memorial-edition.css`
 * and `memorial/memorial-panel-chrome.ts` were the last two, retired in repo-92n2.30 when
 * /memorial moved onto the Reading room class. The ratchet still runs in both directions, so
 * it now reads simply as "no route may grow a per-route stylesheet or panel-chrome module
 * under app/ again".
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

describe('room kit · a title is JSX, never a string of markup', () => {
  // ReadingEntry title is a ReactNode so `<em>` renders in the editorial accent. Passed as a
  // string attribute instead, React escapes it and the reader sees the literal tags.
  it('no room passes markup inside a quoted title attribute', () => {
    const offenders = walk(APP_DIR)
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) => /title="[^"]*<[a-z]/i.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_DIR, file));

    assert.deepEqual(offenders, [], 'pass the title as JSX: title={<>Banned <em>books</em></>}');
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

  it('the kit styles an unclassed content link at zero specificity', () => {
    // A byline "Neo" and an anatomy "3 sources" rendered in the browser default link color
    // because only `.ds-room-prose a` had a rule. The base rule must stay inside `:where()` so
    // it never outranks a classed link or a block-level `.x a` rule.
    const kitCss = readFileSync(path.join(APP_DIR, '../components/room/room-kit.css'), 'utf8');
    assert.match(
      kitCss,
      /:where\(\.ds-room\) :where\(a:not\(\[class\]\)\) \{\s*color: var\(--ds-accent\);/,
    );
  });
});

describe('room kit · a catalog block a second room renders is styled by the kit', () => {
  // /law reused the Records find field while its rules shipped only in the Records stylesheet,
  // which /law never loads, so the search rendered as bare browser controls. Any `ds-records-*`
  // class used outside app/records must be defined in room-kit.css, which every room loads.
  it('every ds-records-* class used outside app/records is defined in room-kit.css', () => {
    const kitCss = readFileSync(path.join(APP_DIR, '../components/room/room-kit.css'), 'utf8');
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
      'move the block into components/room/room-kit.css rather than importing a route stylesheet',
    );
  });
});

describe('room kit · the trail is computed, never hand-written', () => {
  // SP-21 (repo-92n2.29) shipped /rooms, so a reading room's parent is Rooms rather than
  // the site root — matching `SURF_PARENT` in the mock, where Rooms is the default up-link. These
  // chains were one step short while the route was held. The site root itself is resolved but
  // not rendered as a step (see resolveTrail).
  it('a reading room hangs off Rooms', () => {
    assert.deepEqual(resolveTrail('/books'), [
      { label: 'Rooms', href: '/rooms' },
      { label: 'Banned books', href: null },
    ]);
  });

  it("a record's parent is its catalog, not the site root", () => {
    assert.deepEqual(resolveTrail('/books/the-bluest-eye', 'The Bluest Eye'), [
      { label: 'Rooms', href: '/rooms' },
      { label: 'Banned books', href: '/books' },
      { label: 'The Bluest Eye', href: null },
    ]);
  });

  it("an entity's parent is Records — the catalog that lists it", () => {
    // Not the site root: a reader on a record page needs a step up into the archive, and
    // Records is the catalog that lists the record.
    assert.deepEqual(resolveTrail('/entity/abc', 'Isaac McGhie'), [
      { label: 'Records', href: '/records' },
      { label: 'Isaac McGhie', href: null },
    ]);
  });

  it('a nested utility room keeps every intermediate step', () => {
    assert.deepEqual(resolveTrail('/corrections/status/AB12', 'AB12'), [
      { label: 'Rooms', href: '/rooms' },
      { label: 'Corrections', href: '/corrections' },
      { label: 'AB12', href: null },
    ]);
  });

  it('trailing slashes and query strings do not change the chain', () => {
    assert.deepEqual(resolveTrail('/books/?sort=year', 'Books'), resolveTrail('/books', 'Books'));
  });

  it('the site root is never rendered as a crumb step', () => {
    for (const path of ['/books', '/rooms', '/entity/abc', '/corrections/status/AB12']) {
      const trail = resolveTrail(path, 'Here');
      assert.ok(
        trail.every((step) => step.href !== '/'),
        `${path} must not render a site-root step`,
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

describe('room kit · ReadingEntry is the Reading posture mast', () => {
  it('renders title and lede without a kicker or mono meta row', () => {
    const html = renderToStaticMarkup(
      <ReadingEntry
        pathname="/books"
        title="Banned books"
        lede="Every title removed from a public shelf, with the order that removed it."
        showCrumb={false}
      />,
    );

    assert.match(html, /data-posture="reading"/);
    assert.match(html, /<h1 class="ds-entry__title">Banned books<\/h1>/);
    assert.match(html, /ds-entry__lede/);
    assert.doesNotMatch(html, /kicker|ds-room-header/);
    assert.equal(html.match(/<h1/g)?.length, 1, 'a room renders exactly one h1');
    assert.equal(html.match(/<header/g)?.length, 1, 'a room renders exactly one header');
  });

  it('DocumentColophon carries mono citation facts at the foot', () => {
    const html = renderToStaticMarkup(
      <DocumentColophon facts={['1,204 titles', '1963 to 2024']} />,
    );
    assert.match(html, /data-posture-colophon/);
    assert.match(html, /1,204 titles/);
  });

  it('the breadcrumb marks the current step and does not link it', () => {
    const html = renderToStaticMarkup(<Breadcrumb pathname="/law" />);
    assert.match(html, /aria-current="page"/);
    assert.match(html, /ds-room-crumb__here[^>]*>Law/);
    assert.match(html, /href="\/rooms"/);
    assert.doesNotMatch(html, /href="\/"/);
  });
});

describe('room kit · catalog blocks', () => {
  it('a RoomCard is a link, so a catalog entry is a destination; kind no longer renders as a tag', () => {
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

  it('RoomSection is a labelled chapter with a destination plate', () => {
    const html = renderToStaticMarkup(
      <RoomSection
        id="grades"
        icon="evidence"
        kicker="Grades"
        title="What the grades mean"
        tone="sunk"
      >
        <p>A grade is never a color on its own.</p>
      </RoomSection>,
    );
    assert.match(html, /id="grades"/);
    assert.match(html, /ds-room-section--sunk/);
    assert.match(html, /ds-room-section__plate/);
    assert.match(html, /id="grades-heading"/);
    assert.match(html, /ds-destination-icon--lg/);
  });

  it('RoomHandoff is a link with a plate, never a buried paragraph', () => {
    const html = renderToStaticMarkup(
      <RoomHandoff href="/sources" icon="source" title="Source library" line="Publisher kinds." />,
    );
    assert.match(html, /href="\/sources"/);
    assert.match(html, /ds-room-handoff/);
    assert.match(html, /Source library/);
  });

  it('RoomJump is a list of hash links that work without JavaScript', () => {
    const html = renderToStaticMarkup(
      <RoomJump sections={[{ id: 'origin', label: 'Why this exists', icon: 'about' }]} />,
    );
    assert.match(html, /href="#origin"/);
    assert.match(html, /ds-room-jump/);
    assert.doesNotMatch(html, /aria-current/);
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

  it('Precision states the resolution, and an optional caveat when given', () => {
    const html = renderToStaticMarkup(
      <Precision resolution="county centroid" caveat="This is not the address of the event." />,
    );
    assert.match(html, /Located to county centroid\./);
    assert.match(html, /This is not the address of the event\./);

    const bare = renderToStaticMarkup(<Precision resolution="site precision" />);
    assert.match(bare, /Located to site precision\./);
    assert.doesNotMatch(bare, /never draws a point sharper/);
  });

  it('TrustBlock and Anatomy render label/value pairs in a labeled group', () => {
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

  it('a DataTable scrolls inside its own labeled, focusable container', () => {
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

  it('RecordNav renders nothing when the session has no neighbors', () => {
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
    assert.match(
      html,
      /<main class="ds-room" id="main"><div class="ds-room__body"><div class="ds-room__doc">/,
    );
    assert.doesNotMatch(html, /max-width/);
  });

  it('puts the masthead and the apparatus band outside the measure, around the body', () => {
    const html = renderToStaticMarkup(
      <Room masthead={<p>Hero.</p>} foot={<p>Sources.</p>} rail={<p>Rail.</p>}>
        <p>Body.</p>
      </Room>,
    );

    // Order is the contract: mast, then the railed body, then the band. The two full-bleed
    // blocks are siblings of the body rather than children of the column, which is what lets
    // them run wider than the measure the column is pinned to.
    assert.match(
      html,
      /ds-room__mast[^]*ds-room__body ds-room__body--railed[^]*ds-room__doc[^]*ds-room__rail[^]*ds-room__foot/,
    );
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

  it('derives STILL from a violence-adjacent subject with no plain prop at all (SP-26)', () => {
    // The gap this closes: an author who forgets to set `plain` on a moment about violence used
    // to get LIVE by default. Passing the subject instead means there is nothing to forget.
    const html = renderToStaticMarkup(
      <MapMoment
        camera={{ center: [-92.1, 46.78] }}
        note="Duluth, 1920."
        subject={{ topicTags: ['Lynching'] }}
      />,
    );
    assert.match(html, /data-plain="1"/);
    assert.match(html, /Plate · Still/);
  });

  it('a non-violent subject stays LIVE, and an explicit plain still overrides a subject either way', () => {
    const ordinary = renderToStaticMarkup(
      <MapMoment
        camera={{ center: [-87.6, 41.9] }}
        note="A neighborhood."
        subject={{ topicTags: ['neighborhood'] }}
      />,
    );
    assert.match(ordinary, /Plate · Live/);

    const forcedStill = renderToStaticMarkup(
      <MapMoment
        camera={{ center: [-87.6, 41.9] }}
        note="A neighborhood, held still for a documented reason."
        subject={{ topicTags: ['neighborhood'] }}
        plain
      />,
    );
    assert.match(forcedStill, /Plate · Still/);

    const forcedLive = renderToStaticMarkup(
      <MapMoment
        camera={{ center: [-92.1, 46.78] }}
        note="Overridden live for a documented reason."
        subject={{ topicTags: ['Lynching'] }}
        plain={false}
      />,
    );
    assert.match(forcedLive, /Plate · Live/);
  });

  it('the Explore hand-off renders only when a destination is given', () => {
    const without = renderToStaticMarkup(
      <MapMoment camera={{ center: [-90, 35] }} note="A place." />,
    );
    assert.doesNotMatch(without, /ds-mapmoment__open/);

    const with_ = renderToStaticMarkup(
      <MapMoment camera={{ center: [-90, 35] }} note="A place." atlasHref="/explore?find=place" />,
    );
    assert.match(with_, /href="\/explore\?find=place"/);
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

describe('room kit · map moment visibility', () => {
  // repo-kz9z: MapMoment derived LIVE from `stage.liveId === reactId` alone, so on a browser with
  // no WebGL — or any run where MapStage called `markMapUnavailable()` — a moment still went
  // transparent and printed PLATE · LIVE over an empty box. These pin the fix at the seam, since
  // no test in this file can drive an actual WebGL failure through SSR.
  it('a stage being mounted is not the same as the plate being able to paint', () => {
    const resolved = resolveMomentVisibility({
      plateAvailable: true,
      mapCanPaint: false,
      isLiveCandidate: true,
    });
    assert.equal(resolved.live, false);
    assert.equal(resolved.unavailable, true);
  });

  it('claims live only once the stage says the map can actually paint', () => {
    const resolved = resolveMomentVisibility({
      plateAvailable: true,
      mapCanPaint: true,
      isLiveCandidate: true,
    });
    assert.equal(resolved.live, true);
    assert.equal(resolved.unavailable, false);
  });

  it('being the live candidate does not matter once the map cannot paint', () => {
    // The exact case that reads wrong without the fix: this moment IS the one holding the slot,
    // but the plate behind it has nothing to show.
    const resolved = resolveMomentVisibility({
      plateAvailable: true,
      mapCanPaint: false,
      isLiveCandidate: true,
    });
    assert.equal(resolved.live, false);
  });

  it('no stage mounted is unavailable the same way a failed plate is', () => {
    const resolved = resolveMomentVisibility({
      plateAvailable: false,
      mapCanPaint: false,
      isLiveCandidate: false,
    });
    assert.equal(resolved.live, false);
    assert.equal(resolved.unavailable, true);
  });

  it('an idle moment on a healthy plate is neither live nor unavailable', () => {
    const resolved = resolveMomentVisibility({
      plateAvailable: true,
      mapCanPaint: true,
      isLiveCandidate: false,
    });
    assert.equal(resolved.live, false);
    assert.equal(resolved.unavailable, false);
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

  it('keeps rect-only behavior where checkVisibility is unsupported, rather than losing every moment', () => {
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
    assert.match(
      liveRule[1]!,
      /pointer-events:\s*none/,
      'a live slot must not intercept hover over the aligned map layer',
    );
  });
});

describe('room kit · a live plate never sits behind a prose column', () => {
  /*
   * repo-92n2.11.2. The bead's rule is "never full bleed behind prose, enforced in CSS rather
   * than left to authors", and the enforcement is a two-part invariant rather than one rule:
   *
   *   1. the ladder — the plate is fixed at `--ds-z-map-plate` and document content sits at
   *      `--ds-z-content`, so the plate paints UNDER the page and an opaque ground hides it;
   *   2. the one window — the only selector that makes a box transparent over that plate is the
   *      live map-moment slot, which is bounded, in flow, and released on scroll out.
   *
   * Either half alone is not the rule. Raise the plate above content, or let some other
   * container go transparent, and a live map reads straight through body text.
   */
  const tokens = readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../../packages/ui/src/styles/tokens.css',
    ),
    'utf8',
  );

  it('the plate token sits below the content token, so the plate paints under the page', () => {
    const plate = /--ds-z-map-plate:\s*(-?\d+)/.exec(tokens);
    const content = /--ds-z-content:\s*(-?\d+)/.exec(tokens);
    assert.ok(plate && content, 'both z tokens must be defined');
    assert.ok(
      Number(plate[1]) < Number(content[1]),
      `plate (${plate[1]}) must sit below content (${content[1]})`,
    );
  });

  it('the live map-moment slot is the only box that opens a window onto the plate', () => {
    // Any rule that drops a background to transparent inside the room kit is a candidate
    // window. Exactly one is legitimate: the live moment slot.
    const css = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'room-kit.css'),
      'utf8',
    );
    const windows = [...css.matchAll(/([^{}]+)\{([^}]*background:\s*transparent[^}]*)\}/g)].map(
      (match) => match[1]!.trim().split('\n').pop()!.trim(),
    );
    assert.equal(
      windows.length,
      1,
      `expected exactly one plate window, found ${windows.length}: ${windows.join(' | ')}`,
    );
    assert.match(windows[0]!, /\.ds-mapmoment\[data-live='1'\]\s+\.ds-mapmoment__plate/);
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

describe('room kit · the reading progress rule is class-wide', () => {
  // SP-27 (repo-92n2.34). The gap the ticket named: the rule appeared once, prose-only, inside
  // SP-11's umbrella body, so /memorial and /records — Reading rooms filed outside SP-11 —
  // and every other room had no reason to know it applied to them too. Driven from the surface
  // registry rather than a hand-written route list, so a route added to it later is covered
  // without anyone remembering to update this file.
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

  it('covers /memorial and /records, the two Reading rooms filed outside SP-11', () => {
    // Named explicitly in the bead because a hand-written route list is exactly what missed
    // them the first time; the registry-driven test above already covers both, this just pins
    // the two routes the gap named so a future edit to the registry cannot quietly drop them.
    assert.equal(surfaceClassFor('/memorial'), 'reading');
    assert.equal(surfaceClassFor('/records'), 'reading');
  });

  it('no screen defines its own progress element', () => {
    const offenders = walk(APP_DIR)
      .filter((file) => /\.(tsx|ts|css)$/.test(file))
      .filter((file) => path.relative(APP_DIR, file) !== 'reading-room.css')
      .filter((file) => /ds-reading-progress|docprog/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_DIR, file));
    assert.deepEqual(
      offenders,
      [],
      'the reading progress rule belongs to components/room/ReadingProgress.tsx and reading-room.css alone',
    );
  });

  it('the visibility rule is scoped to the Reading surface class in reading-room.css', () => {
    const css = readFileSync(path.join(APP_DIR, 'reading-room.css'), 'utf8');
    assert.match(
      css,
      /\[data-surface='reading'\]\s+\.ds-reading-progress\s*\{\s*display:\s*block;\s*\}/,
    );
  });

  it('the width transition reads a duration token, so reduced motion updates it without animation', () => {
    // packages/ui/src/styles/tokens.css collapses every --ds-duration-* token to 0.01ms under
    // prefers-reduced-motion: reduce, so the gauge needs no reduced-motion handling of its own —
    // only a duration that actually comes from a token rather than a literal millisecond value.
    const css = readFileSync(path.join(APP_DIR, 'reading-room.css'), 'utf8');
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
