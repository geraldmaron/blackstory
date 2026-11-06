/**
 * RouteFocus contract. The app had no focus management on route change at all; these guard the
 * three refusals that keep a blanket implementation from breaking more than it fixes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'RouteFocus.tsx'), 'utf8');

test('it keys off the pathname, never the query string', () => {
  assert.match(source, /usePathname/);
  assert.doesNotMatch(
    source,
    /useSearchParams/,
    'the instrument writes camera and filters into the query continuously; treating those as ' +
      'navigations would pull focus out of it mid-interaction',
  );
});

test('it does not fire on first load', () => {
  assert.match(source, /prior === null/, 'the first render must not steal focus');
});

test('it yields to an open dialog', () => {
  assert.match(source, /aria-modal|role="dialog"/);
});

test('main is given a programmatic-only tab stop', () => {
  assert.match(source, /setAttribute\('tabindex', '-1'\)/);
  assert.match(source, /preventScroll/, 'focusing must not jump the page');
});

test('it is mounted in the persistent layout, not the remounting template', () => {
  const layout = readFileSync(path.join(here, '../../app/layout.tsx'), 'utf8');
  assert.match(layout, /<RouteFocus \/>/);
  assert.match(layout, /import \{ RouteFocus \}/);
  const template = readFileSync(path.join(here, '../ShellPageTransition.tsx'), 'utf8');
  assert.doesNotMatch(
    template,
    /RouteFocus/,
    'the template remounts per navigation, which resets the previous-path ref and the effect ' +
      'then never fires',
  );
});
