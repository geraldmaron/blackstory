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
import { memorialEditionRootClassName } from './memorial-panel-chrome';

const here = dirname(fileURLToPath(import.meta.url));

test('memorial edition root does not use photo mosaic atmosphere', () => {
  const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
  assert.match(pageSource, /MemorialWallAtmosphere/);
  assert.doesNotMatch(pageSource, /EditionAtmosphereMosaic/);
  assert.match(memorialEditionRootClassName(), /ds-memorial-edition/);
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
