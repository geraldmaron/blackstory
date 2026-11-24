/**
 * The header and the phone tab bar: one search, four tabs from the registry, one breakpoint.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { SHELL_TABS, currentTabFor } from './shell-tabs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(join(here, file), 'utf8');

test('the tabs are Archive, Stories, Data and Memorial, in that order, from the registry', () => {
  assert.deepEqual(
    SHELL_TABS.map((tab) => tab.label),
    ['Archive', 'Stories', 'Data', 'Memorial'],
  );
  assert.deepEqual(
    SHELL_TABS.map((tab) => tab.href),
    ['/archive', '/stories', '/data', '/memorial'],
  );
  assert.match(read('shell-tabs.ts'), /primaryNavDestinations\(\)/);
});

test('a record and a lens belong to the Archive; a president is a story; Lives is Data', () => {
  assert.equal(currentTabFor('/'), null);
  assert.equal(currentTabFor('/archive'), '/archive');
  assert.equal(currentTabFor('/entity/abc'), '/archive');
  assert.equal(currentTabFor('/place/abc'), '/archive');
  assert.equal(currentTabFor('/invention/abc'), '/archive');
  assert.equal(currentTabFor('/law'), '/archive');
  assert.equal(currentTabFor('/law/fair-housing-act-1968'), '/archive');
  assert.equal(currentTabFor('/books/beloved'), '/archive');
  assert.equal(currentTabFor('/stories/the-count'), '/stories');
  assert.equal(currentTabFor('/presidents/abraham-lincoln'), '/stories');
  assert.equal(currentTabFor('/data/D-09'), '/data');
  assert.equal(currentTabFor('/lives/explorer'), '/data');
  assert.equal(currentTabFor('/memorial'), '/memorial');
  assert.equal(currentTabFor('/methodology'), null);
});

test('the header and the tab bar read the same tab set', () => {
  for (const file of ['CommandBar.tsx', 'PhoneTabBar.tsx']) {
    const source = read(file);
    assert.match(source, /SHELL_TABS/);
    assert.match(source, /currentTabFor/);
    // A literal axis href is a second registry waiting to drift from the first.
    assert.doesNotMatch(source, /href="\/(?:archive|explore|records|stories|data|memorial)"/);
  }
});

test('the header has one search field and no floating island, pill track or Rooms menu', () => {
  const source = read('CommandBar.tsx');
  const css = read('command-bar.css');
  assert.equal(source.match(/<CommandBarSearch\b/g)?.length, 1);
  assert.doesNotMatch(source, /onOpenPalette \?/, 'the palette never replaces the search field');
  assert.doesNotMatch(source, /RoomsMenu|RoomsList|ds-bar__modes/);
  assert.match(source, /<Tabs\b/);
  // Home is the lockup, never a tab.
  assert.match(source, /ds-bar__brand[\s\S]*href="\/"/);
  // Flush and full bleed: fixed to the top edge on the ink ground (ink in the dark theme, paper in
  // the light one, by tokens.css), no inset or radius; the search is a paper field on it.
  assert.match(css, /\.ds-bar \{[^}]*top:\s*0;[^}]*left:\s*0;/s);
  assert.match(source, /className=\{cx\('ds-bar', className\)\}\s*data-ground="ink"/);
  assert.match(read('CommandBarSearch.tsx'), /data-ground="paper"/);
  assert.doesNotMatch(css, /\.ds-bar \{[^}]*border-radius/s);
});

test('below 48rem the header is in flow and the tab bar takes the tabs; never at 48rem and up', () => {
  const css = read('command-bar.css');
  const tabCss = read('tab-bar.css');
  const phone = css.slice(css.indexOf('@media (max-width: 47.9375rem)'));
  assert.match(phone, /\.ds-bar \{\s*position:\s*relative/);
  assert.match(phone, /\.ds-bar__tabs \{\s*display:\s*none/);
  assert.match(
    phone,
    /\.ds-bar\[data-search-open\] \.ds-bar__search-region \{[^}]*position:\s*fixed/s,
  );
  // The tab bar exists only below the brand's 48rem breakpoint.
  assert.match(tabCss, /^\.ds-tabbar \{\s*display:\s*none;\s*\}/m);
  assert.match(tabCss, /@media \(max-width: 47\.9375rem\)/);
  assert.doesNotMatch(css + tabCss, /819px/);
  assert.match(tabCss, /--ds-tabbar-h:\s*calc\(56px \+ env\(safe-area-inset-bottom/);
  assert.match(tabCss, /pointer-events:\s*auto/);
});

test('the current tab is marked by more than color', () => {
  const tabCss = read('tab-bar.css');
  // A heavier label and the copper pin under it: shape and weight, not the hue alone, no fill.
  assert.match(tabCss, /\.ds-tabbar__tab\[aria-current='page'\] \{[^}]*font-weight:\s*650/s);
  assert.match(
    tabCss,
    /\.ds-tabbar__tab\[aria-current='page'\]::after \{[^}]*border-radius:\s*var\(--ds-radius-full\)/s,
  );
  assert.doesNotMatch(tabCss, /\[aria-current='page'\] \{[^}]*background:/s);
  assert.match(read('PhoneTabBar.tsx'), /aria-label="Main"/);
});
