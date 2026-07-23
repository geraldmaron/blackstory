/**
 * Contract tests for the /memorial edition page wiring.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { memorialNamesAlphabetical, MEMORIAL_NAMES } from '../../components/patterns/memorial-wall/memorial-names';
import {
  memorialEditionPanelClassName,
  memorialEditionRootClassName,
} from './memorial-panel-chrome';

const here = dirname(fileURLToPath(import.meta.url));

test('memorial edition root does not use photo mosaic atmosphere', () => {
  const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
  assert.match(pageSource, /MemorialWallAtmosphere/);
  assert.doesNotMatch(pageSource, /EditionAtmosphereMosaic/);
  assert.match(memorialEditionRootClassName(), /ds-memorial-edition/);
});

test('memorial panels expose intro and list variants', () => {
  assert.equal(memorialEditionPanelClassName('intro'), 'ds-memorial-edition__panel ds-memorial-edition__panel--intro');
  assert.equal(memorialEditionPanelClassName('list'), 'ds-memorial-edition__panel ds-memorial-edition__panel--list');
});

test('memorial name list is unique and alphabetical helper sorts', () => {
  assert.equal(new Set(MEMORIAL_NAMES).size, MEMORIAL_NAMES.length);
  const sorted = memorialNamesAlphabetical();
  assert.equal(sorted.length, MEMORIAL_NAMES.length);
  assert.ok(sorted.includes('Trayvon Martin'));
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(
      sorted[i - 1]!.localeCompare(sorted[i]!, 'en', { sensitivity: 'base' }) <= 0,
    );
  }
});

test('memorial sections render full list anchor and no em dashes in copy', () => {
  const sections = readFileSync(join(here, 'MemorialSections.tsx'), 'utf8');
  const copy = readFileSync(join(here, 'memorial-copy.ts'), 'utf8');
  assert.match(sections, /id="memorial-names"/);
  assert.match(sections, /memorialNamesAlphabetical/);
  assert.doesNotMatch(copy, /\u2014/);
  assert.doesNotMatch(sections, /\u2014/);
});
