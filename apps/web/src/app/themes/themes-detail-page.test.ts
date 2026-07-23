/**
 * Themes v6 detail and question route wiring: beat order, safe-fail components,
 * and UI chrome copy without em dashes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const detailSource = readFileSync(join(here, '[themeId]', 'page.tsx'), 'utf8');
const questionSource = readFileSync(join(here, '[themeId]', 'questions', '[questionId]', 'page.tsx'), 'utf8');

function panelBeatIndex(source: string, variant: string): number {
  const marker = `themesEditionPanelClassName('${variant}')`;
  const index = source.indexOf(marker);
  assert.ok(index >= 0, `expected ${marker} in page source`);
  return index;
}

test('theme detail DOM order: intro, method, packets, footer', () => {
  const intro = panelBeatIndex(detailSource, 'intro');
  const method = panelBeatIndex(detailSource, 'method');
  const packets = panelBeatIndex(detailSource, 'packets');

  assert.ok(intro < method, 'intro must precede method panel');
  assert.ok(method < packets, 'method must precede packets panel');
  assert.match(detailSource, /ThemeImpactPacketCard/);
  assert.match(detailSource, /ThemeImpactStorytellingPanel/);
});

test('theme question DOM order: intro, optional storytelling, packet, footer', () => {
  const intro = panelBeatIndex(questionSource, 'intro');
  const packet = panelBeatIndex(questionSource, 'packet');

  assert.ok(intro < packet, 'intro must precede packet panel');
  assert.match(questionSource, /shouldShowThemeImpactStorytelling/);
  assert.match(questionSource, /ThemeImpactPacketCard/);
});

test('theme detail and question routes use v6 edition root and per-theme mosaic', () => {
  for (const source of [detailSource, questionSource]) {
    assert.match(source, /data-themes-edition="v6"/);
    assert.match(source, /themesEditionMosaicSeedForTheme/);
    assert.doesNotMatch(source, /ds-page__title/);
  }
});

test('theme detail redlining pilot consumers stay behind themeId guard', () => {
  assert.match(detailSource, /themeId === 'redlining'/);
  assert.match(detailSource, /ThemeImpactMapStrip/);
  assert.match(detailSource, /ThemeImpactStoryEmbed/);
});

test('theme detail and question user-facing copy avoid em dashes', () => {
  const userFacingPattern =
    /(?:title|description|lede|body|label|kicker|heading|meta)[^'"]*['"]([^'"]+)['"]/gi;
  for (const source of [detailSource, questionSource]) {
    for (const match of source.matchAll(userFacingPattern)) {
      const value = match[1];
      if (!value || value.includes('http') || value.includes('className') || value.includes('${')) {
        continue;
      }
      assert.doesNotMatch(value, /—/, `unexpected em dash in: ${value.slice(0, 80)}`);
    }
  }
});
