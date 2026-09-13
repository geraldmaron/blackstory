/**
 * Contract tests for the /memorial edition page wiring.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  memorialNameInitial,
  memorialNamesAlphabetical,
  memorialNamesByInitial,
  MEMORIAL_NAMES,
} from '../../components/patterns/memorial-wall/memorial-names';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemorialSections } from './MemorialSections';
import { commandBarIsQuiet } from '../../components/shell/CommandBar';
import { CLASSIFIED_PATHS, surfaceClassFor } from '../../lib/nav/surface-classes';
import { defaultPostureFor } from '../../components/map-stage/plate-posture';

const here = dirname(fileURLToPath(import.meta.url));

test('the memorial root is the wall atmosphere on the room class, not a photo mosaic', () => {
  const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
  assert.match(pageSource, /MemorialWallAtmosphere/);
  assert.doesNotMatch(pageSource, /EditionAtmosphereMosaic/);
  // The positioned root the wall is measured against. Was a helper in the route's own
  // panel-chrome module until repo-92n2.30 retired it; it is a literal class now.
  assert.match(pageSource, /className="ds-memorial"/);
  // The route carries the class stylesheet and no per-route stylesheet of its own.
  assert.match(pageSource, /import '\.\.\/reading-room\.css'/);
  assert.doesNotMatch(pageSource, /memorial-edition\.css/);
});

test('the memorial list is not drawn as a panel', () => {
  const sectionsSource = readFileSync(join(here, 'MemorialSections.tsx'), 'utf8');
  // No card frame, no section numeral, no mono-caps kicker over the names.
  assert.doesNotMatch(sectionsSource, /__panel/);
  assert.doesNotMatch(sectionsSource, /__index/);
  assert.doesNotMatch(sectionsSource, /__kicker/);
});

test('memorial name list is unique and alphabetical helper sorts', () => {
  assert.equal(new Set(MEMORIAL_NAMES).size, MEMORIAL_NAMES.length);
  const sorted = memorialNamesAlphabetical();
  assert.equal(sorted.length, MEMORIAL_NAMES.length);
  assert.ok(sorted.includes('Trayvon Martin'));
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(sorted[i - 1]!.localeCompare(sorted[i]!, 'en', { sensitivity: 'base' }) <= 0);
  }
});

test('memorial name grouping keeps every name exactly once, in order', () => {
  const groups = memorialNamesByInitial();
  const flattened = groups.flatMap((group) => group.names);

  // The list is the record: grouping it for navigation must not drop or
  // duplicate a single name.
  assert.equal(flattened.length, MEMORIAL_NAMES.length);
  assert.deepEqual(
    [...flattened].sort((a, b) => a.localeCompare(b, 'en')),
    [...MEMORIAL_NAMES].sort((a, b) => a.localeCompare(b, 'en')),
  );

  for (const group of groups) {
    assert.ok(group.names.length > 0, `group ${group.letter} is empty`);
    for (const name of group.names) {
      assert.equal(memorialNameInitial(name), group.letter);
    }
    for (let i = 1; i < group.names.length; i += 1) {
      assert.ok(
        group.names[i - 1]!.localeCompare(group.names[i]!, 'en', { sensitivity: 'base' }) <= 0,
      );
    }
  }

  // Groups themselves run A..Z with the `#` catch-all last.
  const letters = groups.map((group) => group.letter);
  assert.deepEqual(
    letters,
    [...letters].sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b, 'en'))),
  );
});

test('memorial name initial ignores leading punctuation and diacritics', () => {
  assert.equal(memorialNameInitial('"General" Lee'), 'G');
  assert.equal(memorialNameInitial('Ahmaud Arbery'), 'A');
  assert.equal(memorialNameInitial('Élan Doe'), 'E');
});

test('memorial sections render full list anchor and no em dashes in copy', () => {
  const sections = readFileSync(join(here, 'MemorialSections.tsx'), 'utf8');
  const copy = readFileSync(join(here, 'memorial-copy.ts'), 'utf8');
  assert.match(sections, /id="memorial-names"/);
  assert.match(sections, /memorialNamesByInitial/);
  assert.doesNotMatch(copy, /\u2014/);
  assert.doesNotMatch(sections, /\u2014/);
});

test('memorial scroll cue does not auto-scroll on load', () => {
  const scrollCue = readFileSync(join(here, 'MemorialScrollCue.tsx'), 'utf8');
  assert.doesNotMatch(scrollCue, /MutationObserver/);
  assert.doesNotMatch(scrollCue, /data-anchored === 'true'/);
});

/*
 * repo-92n2.30 acceptance. The three clauses that are behavior rather than file hygiene: the
 * name-link rule, the quiet command bar, and the plate posture.
 */

test('a name with a record is a link, a name without one is not, and the difference is stated', () => {
  const names = memorialNamesAlphabetical();
  const linked = names[0];
  assert.ok(linked, 'fixture needs at least one name');

  const withLink = renderToStaticMarkup(
    <MemorialSections entityLinksByName={{ [linked]: 'ent_example_001' }} />,
  );
  // The linked name is an anchor to its record.
  assert.match(withLink, /<a[^>]+href="\/entity\/ent_example_001"[^>]*>/);
  // And the difference is explained in words rather than left to color.
  assert.match(withLink, /their name is a link to it/);
  assert.match(withLink, /the name is written plainly/);

  // Every other name stays plain text: exactly one anchor into /entity/ on the whole list.
  assert.equal((withLink.match(/href="\/entity\//g) ?? []).length, 1);

  // With no record for any name there is no difference to explain, so the sentence is absent
  // rather than describing a distinction the reader cannot see.
  const withoutLinks = renderToStaticMarkup(<MemorialSections />);
  assert.doesNotMatch(withoutLinks, /href="\/entity\//);
  assert.doesNotMatch(withoutLinks, /their name is a link to it/);
});

test('the command bar is quiet on /memorial and on no other classified route', () => {
  assert.equal(commandBarIsQuiet('/memorial'), true);
  const others = CLASSIFIED_PATHS.filter((route) => route !== '/memorial');
  assert.deepEqual(
    others.filter((route) => commandBarIsQuiet(route)),
    [],
  );
  // Exact match: a child route is not the memorial wall.
  assert.equal(commandBarIsQuiet('/memorial/names'), false);
});

test('no plate posture other than Parked is reachable on /memorial', () => {
  // Structural, not a per-route override: /memorial is classed Reading, and Reading parks the
  // plate. A reclassification would have to change surface-classes.ts, which this asserts too.
  assert.equal(surfaceClassFor('/memorial'), 'reading');
  assert.equal(defaultPostureFor('reading'), 'parked');
  assert.equal(defaultPostureFor(surfaceClassFor('/memorial')), 'parked');
});
