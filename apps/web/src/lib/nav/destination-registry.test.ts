/**
 * Destination registry tests (SP-15, repo-92n2.15 · SP-21, repo-92n2.29).
 *
 * The coverage suite is the acceptance criterion "a registry test fails when a public route is
 * absent" and "a registry test fails when a public reading room, record class or utility route
 * has no card here". It reads the classified-route list from `surface-classes.ts` rather than
 * restating it, so adding a route to the site and forgetting Rooms fails here.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CLASSIFIED_PATHS, ENDPOINT_ROUTES, surfaceClassFor } from './surface-classes';
import {
  DESTINATION_GROUPS,
  ROOMS_CARD_GROUPS,
  allDestinations,
  browsableDestinations,
  cardTitleFor,
  classLabelFor,
  destinationFor,
  destinationsInGroup,
  footerColumns,
  parentPathFor,
} from './destination-registry';

describe('destination registry · coverage', () => {
  it('every classified public route has a registry entry', () => {
    const missing = CLASSIFIED_PATHS.filter((path) => destinationFor(path) === undefined);
    assert.deepEqual(
      missing,
      [],
      `these routes render chrome but are in no reader-facing list: ${missing.join(', ')}`,
    );
  });

  it('no registry entry points at an endpoint — those are redirects, not destinations', () => {
    const endpoints = new Set(ENDPOINT_ROUTES);
    for (const destination of allDestinations()) {
      assert.equal(
        endpoints.has(destination.path),
        false,
        `${destination.path} is an endpoint; linking it sends every reader through a redirect`,
      );
    }
  });

  it('every parent is itself a destination, so no breadcrumb step 404s', () => {
    for (const destination of allDestinations()) {
      if (destination.parent === null) continue;
      assert.notEqual(
        destinationFor(destination.parent),
        undefined,
        `${destination.path} claims parent ${destination.parent}, which is not a destination`,
      );
    }
  });

  it('the parent chain terminates at Explore from every destination', () => {
    for (const destination of allDestinations()) {
      let cursor: string | null = destination.path;
      let hops = 0;
      while (cursor !== null && cursor !== '/' && hops < 16) {
        cursor = parentPathFor(cursor);
        hops += 1;
      }
      assert.equal(cursor, '/', `${destination.path} does not resolve up to Explore`);
    }
  });

  it('the four product axes parent to the door, not to each other or to Rooms', () => {
    // Stories and Records used to parent through Rooms, which was the old Library hierarchy
    // surviving a rename: it told a reader that the archive index was a supporting page rather
    // than one of the four ways into the product.
    for (const path of ['/explore', '/stories', '/records', '/rooms']) {
      assert.equal(destinationFor(path)?.parent, '/', `${path} is an axis and parents to the door`);
    }
  });

  it('/rooms exists and is the parent of every supporting room', () => {
    assert.notEqual(destinationFor('/rooms'), undefined);

    for (const path of [
      '/books',
      '/law',
      '/data',
      '/memorial',
      '/about',
      '/faq',
      '/methodology',
      '/errata',
      '/submit',
      '/corrections',
      '/support',
      '/privacy',
    ]) {
      assert.equal(
        destinationFor(path)?.parent,
        '/rooms',
        `${path} should resolve up through Rooms`,
      );
    }
  });

  it('a record goes up to the catalogue that lists it', () => {
    // An entity and a place both parent to Records. A breadcrumb states where a page SITS; the
    // way back to a map selection is return state, not hierarchy.
    assert.equal(parentPathFor('/entity/tulsa-greenwood'), '/records');
    assert.equal(parentPathFor('/place/paul-laurence-dunbar-high-school'), '/records');
    assert.equal(parentPathFor('/books/beloved'), '/books');
    assert.equal(parentPathFor('/law/plessy'), '/law');
    assert.equal(parentPathFor('/stories/redlining'), '/stories');
    assert.equal(parentPathFor('/corrections/status/ABC123'), '/corrections');
  });
});

describe('destination registry · card content', () => {
  it('every carded destination carries the kind tag and description a card needs', () => {
    for (const group of ROOMS_CARD_GROUPS) {
      const destinations = destinationsInGroup(group);
      assert.ok(destinations.length > 0, `group "${group}" would render an empty card grid`);
      for (const destination of destinations) {
        assert.ok(destination.kind, `${destination.path} has no mono kind tag`);
        assert.ok(destination.description, `${destination.path} has no card description`);
      }
    }
  });

  it('the class label is read from the surface class, not stored beside it', () => {
    // Reclassifying a route must change what its card advertises. Asserting the two agree is the
    // only way a stale `READING ROOM` on a route the shell now renders as Utility gets caught.
    for (const destination of browsableDestinations()) {
      const label = classLabelFor(destination);
      const surfaceClass = surfaceClassFor(destination.path);
      assert.notEqual(surfaceClass, null, `${destination.path} resolves to no surface class`);
      if (surfaceClass === 'reading') assert.match(label, /^READING ROOM/);
      if (surfaceClass === 'utility') assert.match(label, /^UTILITY/);
      if (surfaceClass === 'instrument') assert.match(label, /^INSTRUMENT/);
    }
  });

  it('the modifier is appended to the class rather than replacing it', () => {
    assert.equal(classLabelFor(destinationFor('/law')!), 'READING ROOM · PLAIN LANGUAGE');
    assert.equal(classLabelFor(destinationFor('/memorial')!), 'READING ROOM · STILL');
    assert.equal(classLabelFor(destinationFor('/stories')!), 'READING ROOM');
  });

  it('a card title may be a verb where the breadcrumb label cannot be', () => {
    assert.equal(cardTitleFor(destinationFor('/submit')!), 'Submit a lead');
    assert.equal(destinationFor('/submit')?.label, 'Submit', 'the crumb stays short');
    assert.equal(cardTitleFor(destinationFor('/stories')!), 'Stories');
  });

  it('every group in the type is a group the registry actually populates', () => {
    for (const group of DESTINATION_GROUPS) {
      assert.ok(destinationsInGroup(group).length > 0, `group "${group}" has no destinations`);
    }
  });
});

describe('destination registry · the footer is derived, not authored', () => {
  it('never links a redirect, which is the bug that made this derivation necessary', () => {
    const endpoints = new Set(ENDPOINT_ROUTES);
    for (const column of footerColumns()) {
      for (const item of column.items) {
        assert.equal(
          endpoints.has(item.href),
          false,
          `the footer links ${item.href}, which is a redirect — every page on the site would carry it`,
        );
      }
    }
  });

  it('the room groups render in family order', () => {
    // Stories is not here: it is a product axis, and listing an axis as an ordinary room card is
    // what made Records read as a supporting page.
    assert.deepEqual(
      destinationsInGroup('read').map((destination) => destination.path),
      ['/law', '/data', '/books', '/memorial'],
    );
    assert.deepEqual(
      destinationsInGroup('check').map((destination) => destination.path),
      ['/about', '/faq', '/methodology', '/errata'],
    );
    assert.deepEqual(
      destinationsInGroup('take-part').map((destination) => destination.path),
      ['/submit', '/corrections', '/support'],
    );
  });

  it('puts Find in the footer; Rooms palette stays editorial without Explore or records', () => {
    const columns = footerColumns();
    const find = columns.find((column) => column.title === 'Find');
    assert.ok(find);
    // The door is not a Find item: the footer wordmark already links home, on every surface.
    assert.deepEqual(
      find.items.map((item) => item.href),
      ['/explore', '/stories', '/records', '/rooms'],
    );
    const hrefs = columns.flatMap((column) => column.items.map((item) => item.href));
    const palette = browsableDestinations().map((destination) => destination.path);
    assert.ok(hrefs.includes('/stories'));
    assert.ok(hrefs.includes('/about'));
    assert.ok(hrefs.includes('/submit'));
    assert.ok(hrefs.includes('/explore'));
    assert.ok(hrefs.includes('/records'));
    assert.ok(!hrefs.includes('/history'));
    assert.ok(!hrefs.includes('/banned-books'));
    assert.ok(!palette.includes('/explore'));
    assert.ok(!palette.includes('/records'));
    assert.ok(!palette.includes('/rooms'));
    for (const path of palette) {
      assert.ok(hrefs.includes(path), `${path} missing from footer`);
    }
  });

  it('does not invent a second home lede', () => {
    const home = destinationFor('/');
    assert.ok(home);
    assert.equal(home.description, undefined);
    assert.equal(home.menuLine, undefined);
    const explore = destinationFor('/explore');
    assert.equal(explore?.label, 'Explore');
    assert.equal(explore?.description, 'The map.');
  });

  it('ships /books as a reading room, and never lists /banned-books', () => {
    // `/books` was held off the walk in ab4c1231 while the room was unfinished. It has shipped
    // since — it is in the shell bar, the sitemap and the Rooms menu — so holding it out of the
    // room groups only meant two registries disagreed about the same route.
    assert.equal(destinationFor('/books')?.group, 'read');
    const hrefs = footerColumns().flatMap((column) => column.items.map((item) => item.href));
    assert.ok(hrefs.includes('/books'));
    assert.ok(!hrefs.includes('/banned-books'));
    assert.equal(destinationFor('/banned-books'), undefined);
  });

  it('lists every carded destination exactly once', () => {
    const hrefs = footerColumns().flatMap((column) => column.items.map((item) => item.href));
    assert.equal(new Set(hrefs).size, hrefs.length, 'a destination is listed twice in the footer');
    for (const group of ROOMS_CARD_GROUPS) {
      for (const destination of destinationsInGroup(group)) {
        assert.ok(
          hrefs.includes(destination.path),
          `${destination.path} is carded but not in the footer`,
        );
      }
    }
  });
});
