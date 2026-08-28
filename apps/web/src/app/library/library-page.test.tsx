/**
 * `/library` room contracts (SP-21, repo-92n2.29).
 *
 * The room's *content* is not asserted here — it is generated from the destination registry, and
 * `lib/nav/destination-registry.test.ts` is what proves no public route is missing from it.
 * What this file asserts is the things the generation cannot guarantee: that the cards reach the
 * page as real anchors, that the room does not end on a control that needs JavaScript, and that
 * `L` opens it from the keyboard as the mock's keymap says.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { COMMANDS } from '../../components/patterns/command-palette/command-registry';
import { GLOBAL_BINDINGS } from '../../lib/keyboard/bindings';
import { resolveTrail } from '../../components/room/room-trail';
import { LIBRARY_CARD_GROUPS, destinationsInGroup } from '../../lib/nav/destination-registry';

const pageSource = readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8');

describe('/library · the room renders without JavaScript', () => {
  it('is a server component: no "use client", no event handlers', () => {
    assert.doesNotMatch(pageSource, /['"]use client['"]/);
    assert.doesNotMatch(pageSource, /onClick=/);
  });

  it('cards come from the registry rather than being written out here', () => {
    assert.match(pageSource, /destinationsInGroup\(group\)/);
    // A hand-written card is the failure this room exists to prevent, so the room must not
    // contain a literal href for any of the routes it lists.
    for (const group of LIBRARY_CARD_GROUPS) {
      for (const destination of destinationsInGroup(group)) {
        assert.doesNotMatch(
          pageSource,
          new RegExp(`href="${destination.path}"`),
          `${destination.path} is hand-linked in the library; it should come from the registry`,
        );
      }
    }
  });

  it('the off-ramp offers links, not a palette button that would be dead without JS', () => {
    assert.match(pageSource, /href: ATLAS_INSTRUMENT_HREF/);
    assert.match(pageSource, /href: '\/records'/);
    assert.doesNotMatch(pageSource, /onOpenPalette|setPaletteOpen/);
  });
});

describe('/library · the room is reachable', () => {
  it('L opens it, and the shortcut sheet says so because it renders the same registry', () => {
    const command = COMMANDS.find((entry) => entry.id === 'view.library');
    assert.notEqual(command, undefined, 'no command opens the library');
    assert.deepEqual(command?.keys, ['L']);
    assert.equal(command?.title, 'Open the library');

    // The sheet renders `COMMANDS` grouped by section, so being in a real section is what puts
    // this row in front of a reader. A command in no rendered section is invisible.
    assert.equal(command?.section, 'View');
  });

  it('L does not collide with an existing chord', () => {
    const chords = [...GLOBAL_BINDINGS, ...COMMANDS].map((entry) => entry.keys.join('+'));
    assert.equal(new Set(chords).size, chords.length, 'two shortcuts share a chord');
  });

  it('is the first breadcrumb step for a reading room and a utility room alike', () => {
    // The Atlas root is resolved as a parent but not rendered as a step, so the library leads.
    for (const path of ['/books', '/methodology', '/corrections', '/submit']) {
      const trail = resolveTrail(path);
      assert.equal(trail[0]?.label, 'The library');
      assert.equal(trail[0]?.href, '/library', 'the library step must be a working link');
    }
  });

  it('the library does not parent itself', () => {
    assert.deepEqual(resolveTrail('/library'), [{ label: 'The library', href: null }]);
  });
});
