/**
 * Themes v6 page wiring: shared gutter mosaic, edition Surface stack, no em dashes
 * in user-facing copy on touched surfaces.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listCatalogThemeIds, THEME_IMPACT_CATALOG } from '../../lib/theme-impact/catalog';

const here = dirname(fileURLToPath(import.meta.url));

const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const browseSource = readFileSync(join(here, 'ThemeBrowseSections.tsx'), 'utf8');
const detailSource = readFileSync(join(here, '[themeId]', 'page.tsx'), 'utf8');
const questionSource = readFileSync(join(here, '[themeId]', 'questions', '[questionId]', 'page.tsx'), 'utf8');

test('themes index does not mount EditionAtmosphereMosaic and edition stack', () => {
  assert.doesNotMatch(pageSource, /EditionAtmosphereMosaic/);
  assert.doesNotMatch(pageSource, /THEMES_EDITION_MOSAIC_SEED/);
  assert.match(pageSource, /themesEditionRootClassName/);
  assert.match(pageSource, /data-themes-edition="v6"/);
  assert.doesNotMatch(pageSource, /ds-page__title/);
});

test('themes public routes are gated behind THEMES_PUBLIC_SURFACE_ENABLED', () => {
  assert.match(pageSource, /THEMES_PUBLIC_SURFACE_ENABLED/);
  assert.match(pageSource, /notFound\(\)/);
  assert.match(detailSource, /THEMES_PUBLIC_SURFACE_ENABLED/);
  assert.match(detailSource, /notFound\(\)/);
  assert.match(questionSource, /THEMES_PUBLIC_SURFACE_ENABLED/);
  assert.match(questionSource, /notFound\(\)/);
});

test('themes detail and question routes use per-theme mosaic seed', () => {
  for (const source of [detailSource, questionSource]) {
    assert.doesNotMatch(source, /EditionAtmosphereMosaic/);
    assert.doesNotMatch(source, /themesEditionMosaicSeedForTheme/);
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

test('theme catalog covers the adjudicated themes with unique ids and full metadata', () => {
  const themeIds = listCatalogThemeIds();
  for (const expected of [
    'redlining',
    'drug_policy_state',
    'wealth_gap',
    'urban_renewal',
    'mass_incarceration',
    'environmental_racism',
    'school_segregation',
    'voting_rights',
  ]) {
    assert.ok(themeIds.includes(expected), `catalog missing theme ${expected}`);
  }
  assert.equal(new Set(themeIds).size, themeIds.length, 'catalog theme ids must be unique');
  for (const entry of THEME_IMPACT_CATALOG) {
    assert.ok(entry.title.length > 0);
    assert.ok(entry.lede.length > 0);
    assert.ok(entry.priority === 'P0' || entry.priority === 'P1');
  }
  // Availability is derived from the active release at request time (resolveAvailableThemeIds),
  // so it is deliberately not pinned here.
});

test('themes browse no longer describes available P1 themes as coming soon', () => {
  assert.match(browseSource, /Extended evidence themes/);
  assert.doesNotMatch(browseSource, />\s*Coming soon\s*</);
  assert.doesNotMatch(browseSource, /P1 themes coming soon/);
});
