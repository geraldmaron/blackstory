/**
 * `/collections` hub contracts.
 *
 * The hub's *content* is not asserted here: it is generated from the destination registry, and
 * `lib/nav/destination-registry.test.ts` is what proves no collection is missing from it. What
 * this file asserts is what the generation cannot guarantee: that rows reach the page as real
 * anchors with no hand-written hrefs, that the page needs no JavaScript, and that `L` opens it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { COMMANDS } from '../../components/patterns/command-palette/command-registry';
import { GLOBAL_BINDINGS } from '../../lib/keyboard/bindings';
import { resolveTrail } from '../../components/room/room-trail';
import { destinationsInGroup } from '../../lib/nav/destination-registry';

const pageSource = readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8');

describe('/collections · renders without JavaScript', () => {
  it('is a server component: no "use client", no event handlers', () => {
    assert.doesNotMatch(pageSource, /['"]use client['"]/);
    assert.doesNotMatch(pageSource, /onClick=/);
  });

  it('rows come from the registry rather than being written out here', () => {
    assert.match(pageSource, /destinationsInGroup\('read'\)/);
    for (const destination of destinationsInGroup('read')) {
      assert.doesNotMatch(
        pageSource,
        new RegExp(`href="${destination.path}"`),
        `${destination.path} is hand-linked on the hub; it should come from the registry`,
      );
    }
  });

  it('lists collections only, never a trust page or a form', () => {
    const listed = destinationsInGroup('read').map((destination) => destination.path);
    assert.ok(listed.includes('/presidents'));
    for (const path of ['/about', '/methodology', '/submit', '/corrections']) {
      assert.ok(!listed.includes(path), `${path} is not a collection`);
    }
  });
});

describe('/collections · reachable', () => {
  it('L opens it, and the shortcut sheet says so', () => {
    const command = COMMANDS.find((entry) => entry.id === 'view.library');
    assert.notEqual(command, undefined, 'no command opens Collections');
    assert.deepEqual(command?.keys, ['L']);
    assert.equal(command?.title, 'Open Collections');
    assert.equal(command?.section, 'View');
  });

  it('L does not collide with an existing chord', () => {
    const chords = [...GLOBAL_BINDINGS, ...COMMANDS].map((entry) => entry.keys.join('+'));
    assert.equal(new Set(chords).size, chords.length, 'two shortcuts share a chord');
  });

  it('a collection crumbs to Collections; a trust page crumbs to About', () => {
    assert.deepEqual(resolveTrail('/books'), [
      { label: 'Collections', href: '/collections' },
      { label: 'Banned books', href: null },
    ]);
    assert.deepEqual(resolveTrail('/errata'), [
      { label: 'About', href: '/about' },
      { label: 'Errata', href: null },
    ]);
  });
});
