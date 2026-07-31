/**
 * Destination registry tests (SP-15, repo-92n2.15 · SP-21, repo-92n2.29).
 *
 * The coverage suite is the acceptance criterion "a registry test fails when a public route is
 * absent" and "a registry test fails when a public reading room, record class or utility route
 * has no card here". It reads the classified-route list from `surface-classes.ts` rather than
 * restating it, so adding a route to the site and forgetting the library fails here.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CLASSIFIED_PATHS, ENDPOINT_ROUTES, surfaceClassFor } from './surface-classes';
import {
  DESTINATION_GROUPS,
  LIBRARY_CARD_GROUPS,
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

  it('the parent chain terminates at the Atlas from every destination', () => {
    for (const destination of allDestinations()) {
      let cursor: string | null = destination.path;
      let hops = 0;
      while (cursor !== null && cursor !== '/' && hops < 16) {
        cursor = parentPathFor(cursor);
        hops += 1;
      }
      assert.equal(cursor, '/', `${destination.path} does not resolve up to the Atlas`);
    }
  });

  it('/library exists and is the parent of every reading and utility room', () => {
    assert.notEqual(destinationFor('/library'), undefined);

    // The rooms the mock parents through the library. Records is included: the index is one of
    // the library's own answers to "which room", even though it also appears in the off-ramp.
    for (const path of [
      '/records',
      '/chapters',
      '/books',
      '/law',
      '/data',
      '/memorial',
      '/about',
      '/methodology',
      '/errata',
      '/submit',
      '/corrections',
      '/support',
    ]) {
      assert.equal(
        destinationFor(path)?.parent,
        '/library',
        `${path} should resolve up through the library`,
      );
    }
  });

  it('an entity goes up to the Atlas and a record goes up to its catalogue', () => {
    assert.equal(parentPathFor('/entity/tulsa-greenwood'), '/');
    assert.equal(parentPathFor('/books/beloved'), '/books');
    assert.equal(parentPathFor('/law/plessy'), '/law');
    assert.equal(parentPathFor('/chapters/redlining'), '/chapters');
    assert.equal(parentPathFor('/corrections/status/ABC123'), '/corrections');
  });
});

describe('destination registry · card content', () => {
  it('every carded destination carries the kind tag and description a card needs', () => {
    for (const group of LIBRARY_CARD_GROUPS) {
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
    assert.equal(classLabelFor(destinationFor('/chapters')!), 'READING ROOM');
  });

  it('a card title may be a verb where the breadcrumb label cannot be', () => {
    assert.equal(cardTitleFor(destinationFor('/submit')!), 'Submit a lead');
    assert.equal(destinationFor('/submit')?.label, 'Submit', 'the crumb stays short');
    assert.equal(cardTitleFor(destinationFor('/chapters')!), 'Chapters');
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

  it('lists the library and the record index, and no longer lists /history', () => {
    const hrefs = footerColumns().flatMap((column) => column.items.map((item) => item.href));
    assert.ok(hrefs.includes('/library'));
    assert.ok(hrefs.includes('/records'));
    assert.ok(!hrefs.includes('/history'));
  });

  it('lists every carded destination exactly once', () => {
    const hrefs = footerColumns().flatMap((column) => column.items.map((item) => item.href));
    assert.equal(new Set(hrefs).size, hrefs.length, 'a destination is listed twice in the footer');
    for (const group of LIBRARY_CARD_GROUPS) {
      for (const destination of destinationsInGroup(group)) {
        assert.ok(
          hrefs.includes(destination.path),
          `${destination.path} is carded but not in the footer`,
        );
      }
    }
  });
});
