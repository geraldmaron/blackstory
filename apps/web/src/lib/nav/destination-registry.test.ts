/**
 * Destination registry coverage and room-parent tests.
 *
 * The coverage suite is the acceptance criterion "a registry test fails when a public route is
 * absent" and "a registry test fails when a public reading room, record class or utility route
 * has no card here". It reads the classified-route list from `surface-classes.ts` rather than
 * restating it, so adding a route to the site and forgetting the footer fails here.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CLASSIFIED_PATHS, ENDPOINT_ROUTES } from './surface-classes';
import {
  DESTINATION_GROUPS,
  BROWSE_GROUPS,
  allDestinations,
  browsableDestinations,
  cardTitleFor,
  destinationById,
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

  it('the four product axes parent to the door, not to each other', () => {
    // Stories and Records used to parent through the old hub, which was the old Library hierarchy
    // surviving a rename: it told a reader that the archive index was a supporting page rather
    // than one of the four ways into the product.
    for (const path of ['/explore', '/stories', '/records', '/collections']) {
      assert.equal(destinationFor(path)?.parent, '/', `${path} is an axis and parents to the door`);
    }
  });

  it('/collections and /about are the two hubs every supporting page hangs off', () => {
    assert.notEqual(destinationFor('/collections'), undefined);
    assert.equal(destinationFor('/rooms'), undefined);

    for (const path of ['/presidents', '/books', '/law', '/data', '/lives', '/memorial']) {
      assert.equal(destinationFor(path)?.parent, '/collections', `${path} is a collection`);
    }
    for (const path of [
      '/faq',
      '/methodology',
      '/sources',
      '/errata',
      '/submit',
      '/corrections',
      '/support',
      '/privacy',
    ]) {
      assert.equal(destinationFor(path)?.parent, '/about', `${path} should hang off About`);
    }
    assert.equal(destinationFor('/about')?.parent, '/');
  });

  it('a record goes up to the catalog that lists it', () => {
    // An entity and a place both parent to Records. A breadcrumb states where a page SITS; the
    // way back to a map selection is return state, not hierarchy.
    assert.equal(parentPathFor('/entity/tulsa-greenwood'), '/records');
    assert.equal(parentPathFor('/place/paul-laurence-dunbar-high-school'), '/records');
    assert.equal(parentPathFor('/books/beloved'), '/books');
    assert.equal(parentPathFor('/law/plessy'), '/law');
    assert.equal(parentPathFor('/stories/redlining'), '/stories');
    assert.equal(parentPathFor('/presidents/abraham-lincoln'), '/presidents');
    assert.equal(parentPathFor('/corrections/status/ABC123'), '/corrections');
  });
});

describe('destination registry · card content', () => {
  it('every carded destination carries the kind tag and description a card needs', () => {
    for (const group of BROWSE_GROUPS) {
      const destinations = destinationsInGroup(group);
      assert.ok(destinations.length > 0, `group "${group}" would render an empty card grid`);
      for (const destination of destinations) {
        assert.ok(destination.kind, `${destination.path} has no kind`);
        assert.ok(destination.description, `${destination.path} has no card description`);
      }
    }
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

  it('the groups render in family order', () => {
    // Stories is not here: it is a product axis, and listing an axis as an ordinary row is
    // what made Records read as a supporting page.
    assert.deepEqual(
      destinationsInGroup('read').map((destination) => destination.path),
      ['/presidents', '/law', '/data', '/lives', '/books', '/memorial'],
    );
    assert.deepEqual(
      destinationsInGroup('check').map((destination) => destination.path),
      ['/about', '/faq', '/methodology', '/sources', '/errata'],
    );
    assert.deepEqual(
      destinationsInGroup('take-part').map((destination) => destination.path),
      ['/submit', '/corrections', '/support'],
    );
  });

  it('puts Find in the footer; the palette stays editorial without Explore or records', () => {
    const columns = footerColumns();
    const find = columns.find((column) => column.title === 'Find');
    assert.ok(find);
    // The door is not a Find item: the footer wordmark already links home, on every surface.
    assert.deepEqual(
      find.items.map((item) => item.href),
      ['/explore', '/stories', '/records', '/collections'],
    );
    const hrefs = columns.flatMap((column) => column.items.map((item) => item.href));
    const palette = browsableDestinations().map((destination) => destination.path);
    assert.ok(hrefs.includes('/stories'));
    assert.ok(hrefs.includes('/about'));
    assert.ok(hrefs.includes('/data'));
    assert.ok(hrefs.includes('/lives'));
    assert.ok(hrefs.includes('/sources'));
    assert.ok(hrefs.includes('/submit'));
    assert.ok(hrefs.includes('/explore'));
    assert.ok(hrefs.includes('/records'));
    assert.ok(!hrefs.includes('/history'));
    assert.ok(!hrefs.includes('/banned-books'));
    assert.ok(!hrefs.includes('/how-it-works'));
    assert.ok(!palette.includes('/explore'));
    assert.ok(!palette.includes('/records'));
    assert.ok(!palette.includes('/collections'));
    for (const path of palette) {
      assert.ok(hrefs.includes(path), `${path} missing from footer`);
    }
  });

  it('does not invent a second home lede', () => {
    const home = destinationFor('/');
    assert.ok(home);
    assert.equal(home.description, undefined);
    const explore = destinationFor('/explore');
    assert.equal(explore?.label, 'Map');
    assert.equal(explore?.description, 'The map.');
  });

  it('ships banned books as a browsable room without listing /banned-books', () => {
    assert.equal(destinationFor('/books')?.browsable, true);
    assert.equal(destinationFor('/books')?.path, '/books');
    const hrefs = footerColumns().flatMap((column) => column.items.map((item) => item.href));
    assert.ok(hrefs.includes('/books'));
    assert.ok(!hrefs.includes('/banned-books'));
    assert.equal(destinationFor('/banned-books'), undefined);
  });

  it('lists every carded destination exactly once', () => {
    const hrefs = footerColumns().flatMap((column) => column.items.map((item) => item.href));
    assert.equal(new Set(hrefs).size, hrefs.length, 'a destination is listed twice in the footer');
    for (const group of BROWSE_GROUPS) {
      for (const destination of destinationsInGroup(group)) {
        assert.ok(
          hrefs.includes(destination.path),
          `${destination.path} is carded but not in the footer`,
        );
      }
    }
  });

  it('links only catalog destinations, labeled as the catalog labels them', () => {
    for (const column of footerColumns()) {
      for (const item of column.items) {
        const destination = destinationFor(item.href);
        assert.ok(destination, `${item.href} must be a catalog destination`);
        assert.equal(item.label, destination.label);
      }
    }
  });
});

describe('destination registry · id lookup', () => {
  it('resolves trust and read rooms by catalog id', () => {
    assert.equal(destinationById('how-it-works'), undefined);
    assert.equal(destinationById('about')?.path, '/about');
    assert.equal(destinationById('methodology')?.icon, 'methodology');
    assert.equal(destinationById('books')?.label, 'Banned books');
    assert.equal(destinationById('data')?.browsable, true);
    assert.equal(destinationById('lives')?.path, '/lives');
    assert.equal(destinationById('lives')?.family, 'read');
    assert.equal(destinationById('sources')?.path, '/sources');
    assert.equal(destinationById('sources')?.family, 'trust');
    assert.equal(destinationById('nope'), undefined);
  });
});
