/**
 * Structural checks on the errata page and its feed route handlers: one shared entry list,
 * absolute feed URLs, and no disclosure markup anywhere on the surface.
 * docs/ui/design-direction-v9-surfaces.md §4.2, §4.5.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'ErrataSections.tsx'), 'utf8');
const jsonRouteSource = readFileSync(join(here, 'feed.json/route.ts'), 'utf8');
const xmlRouteSource = readFileSync(join(here, 'feed.xml/route.ts'), 'utf8');

test('the page and both feeds read from the same entry list', () => {
  for (const source of [pageSource, jsonRouteSource, xmlRouteSource]) {
    assert.match(
      source,
      /from ['"](\.\.\/)+lib\/trust\/errata-seed['"]/,
      'must import from lib/trust/errata-seed, not a second copy of the list',
    );
    assert.match(source, /listErrataEntries\(\)/);
  }
});

test('both feed routes resolve entry URLs absolute against NEXT_PUBLIC_SITE_URL', () => {
  for (const source of [jsonRouteSource, xmlRouteSource]) {
    assert.match(source, /process\.env\.NEXT_PUBLIC_SITE_URL/);
    assert.match(source, /new URL\(entry\.affectedUrl, origin\)\.toString\(\)/);
  }
});

test('no room on this surface renders a details/summary disclosure', () => {
  for (const source of [pageSource, sectionsSource]) {
    assert.doesNotMatch(source, /<details/);
    assert.doesNotMatch(source, /<summary/);
    assert.doesNotMatch(source, /Disclosure/);
  }
});

test('the header carries the two feed links as mono chips', () => {
  assert.match(pageSource, /ds-room-chip/);
  assert.match(pageSource, /href="\/errata\/feed\.json"/);
  assert.match(pageSource, /href="\/errata\/feed\.xml"/);
});

test('the off ramp points at /corrections and /methodology', () => {
  assert.match(pageSource, /href: ['"]\/corrections['"]/);
  assert.match(pageSource, /href: ['"]\/methodology['"]/);
});

test('errata.css is retired', () => {
  assert.doesNotMatch(pageSource, /errata\.css/);
  assert.doesNotMatch(sectionsSource, /errata\.css/);
});
