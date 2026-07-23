/**
 * Themes v6 page wiring: shared gutter mosaic, edition Surface stack, no em dashes
 * in user-facing copy on touched surfaces.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  listAvailableThemeIds,
  listPacketsForTheme,
} from '../../components/theme-impact/fixtures';

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

test('all adjudicated themes are available with researched packets', () => {
  const themeIds = listAvailableThemeIds();
  assert.deepEqual(themeIds, [
    'redlining',
    'drug_policy_state',
    'urban_renewal',
    'mass_incarceration',
    'environmental_racism',
    'school_segregation',
    'voting_rights',
  ]);
  assert.equal(
    themeIds.reduce((count, themeId) => count + listPacketsForTheme(themeId).length, 0),
    11,
  );
  for (const themeId of themeIds) {
    assert.ok(listPacketsForTheme(themeId).length > 0);
  }
});

test('themes browse no longer describes available P1 themes as coming soon', () => {
  assert.match(browseSource, /Extended evidence themes/);
  assert.doesNotMatch(browseSource, />\s*Coming soon\s*</);
  assert.doesNotMatch(browseSource, /P1 themes coming soon/);
});
