/**
 * Themes v6 page wiring: shared gutter mosaic, edition Surface stack, no em dashes
 * in user-facing copy on touched surfaces.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const browseSource = readFileSync(join(here, 'ThemeBrowseSections.tsx'), 'utf8');
const detailSource = readFileSync(join(here, '[themeId]', 'page.tsx'), 'utf8');
const questionSource = readFileSync(join(here, '[themeId]', 'questions', '[questionId]', 'page.tsx'), 'utf8');

test('themes index uses shared EditionAtmosphereMosaic and edition stack', () => {
  assert.match(pageSource, /EditionAtmosphereMosaic/);
  assert.match(pageSource, /THEMES_EDITION_MOSAIC_SEED/);
  assert.match(pageSource, /themesEditionRootClassName/);
  assert.match(pageSource, /data-themes-edition="v6"/);
  assert.doesNotMatch(pageSource, /ds-page__title/);
});

test('themes detail and question routes use per-theme mosaic seed', () => {
  for (const source of [detailSource, questionSource]) {
    assert.match(source, /EditionAtmosphereMosaic/);
    assert.match(source, /themesEditionMosaicSeedForTheme/);
    assert.match(source, /themesEditionStackClassName/);
  }
});

test('themes browse preserves P0 and P1 anchor ids for deep links', () => {
  assert.match(browseSource, /id="p0-themes"/);
  assert.match(browseSource, /id="p1-themes"/);
  assert.match(browseSource, /listP0Themes/);
  assert.match(browseSource, /listP1Themes/);
});

test('themes user-facing copy on touched surfaces avoids em dashes', () => {
  const userFacingPattern =
    /(?:title|description|lede|body|label|kicker|heading|meta)[^'"]*['"]([^'"]+)['"]/gi;
  const sources = [pageSource, browseSource, detailSource, questionSource];
  for (const source of sources) {
    for (const match of source.matchAll(userFacingPattern)) {
      const value = match[1];
      if (!value || value.includes('http') || value.includes('className') || value.includes('${')) {
        continue;
      }
      assert.doesNotMatch(value, /—/, `unexpected em dash in: ${value.slice(0, 80)}`);
    }
  }
});

test('themes method notice cites methodology without legacy notice chrome', () => {
  assert.match(browseSource, /Juxtaposition, not causation/);
  assert.match(browseSource, /href="\/methodology"/);
  assert.doesNotMatch(browseSource, /ds-theme-impact__notice-title/);
});
