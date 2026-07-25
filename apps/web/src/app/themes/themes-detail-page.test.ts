/**
 * Themes v6 detail and question route wiring: continuous arc first, instruments
 * beside, packets secondary; UI chrome copy without em dashes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const detailSource = readFileSync(join(here, '[themeId]', 'page.tsx'), 'utf8');
const questionSource = readFileSync(join(here, '[themeId]', 'questions', '[questionId]', 'page.tsx'), 'utf8');
const chapterEssaySource = readFileSync(
  join(here, '..', '..', 'components', 'theme-spine', 'ChapterEssay.tsx'),
  'utf8',
);

function panelBeatIndex(source: string, variant: string): number {
  const marker = `themesEditionPanelClassName('${variant}')`;
  const index = source.indexOf(marker);
  assert.ok(index >= 0, `expected ${marker} in page source`);
  return index;
}

test('theme detail DOM order: intro, method, arc, packets, footer', () => {
  const intro = panelBeatIndex(detailSource, 'intro');
  const method = panelBeatIndex(detailSource, 'method');
  const arc = panelBeatIndex(detailSource, 'arc');
  const packets = panelBeatIndex(detailSource, 'packets');

  assert.ok(intro < method, 'intro must precede method panel');
  assert.ok(method < arc, 'method must precede continuous arc');
  assert.ok(arc < packets, 'arc must precede packets / verify panel');
  assert.match(detailSource, /ThemeImpactArcReading/);
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
    assert.doesNotMatch(source, /themesEditionMosaicSeedForTheme/);
    assert.doesNotMatch(source, /ds-page__title/);
  }
});

test('theme detail redlining pilot consumers stay behind themeId guard', () => {
  assert.match(detailSource, /themeId === 'redlining'/);
  assert.match(detailSource, /ThemeImpactMapStrip/);
  assert.match(detailSource, /ThemeImpactStoryEmbed/);
});

test('theme detail branches cleanly on chapters.length === 0 vs > 0', () => {
  assert.match(detailSource, /resolveThemeSpine/);
  assert.match(detailSource, /const hasChapters = spine\.chapters\.length > 0;/);
  assert.match(detailSource, /\{hasChapters \? \(/);
});

test('theme detail zero-chapter branch preserves the beat-00\/beat-01 arc unchanged', () => {
  assert.match(
    detailSource,
    /: \(\s*<article\s*\n\s*className=\{themesEditionPanelClassName\('arc'\)\}\s*\n\s*aria-labelledby="theme-arc-heading"\s*\n\s*id="arc"/,
  );
  assert.match(detailSource, /ThemeImpactArcReading[\s\S]*themeId=\{themeId\}[\s\S]*packets=\{packets\}/);
  assert.match(detailSource, /Scene by scene through policy, practice, lived place, and measurement\./);
});

test('theme detail chaptered branch renders the continuous chapter essay', () => {
  assert.match(detailSource, /themesEditionPanelClassName\('chapter'\)/);
  assert.match(
    detailSource,
    /<ChapterEssay\s*\n\s*themeTitle=\{entry\.title\}\s*\n\s*chapters=\{spine\.chapters\}\s*\n\s*entityExitsByStoryId=\{entityExitsByStoryId\}\s*\n\s*\/>/,
  );
  assert.match(detailSource, /instruments rail below for hard readers/);
});

test('theme detail keeps the instruments rail (packets) working alongside chapters', () => {
  assert.match(detailSource, /themesEditionPanelClassName\('packets'\)/);
  assert.match(detailSource, /ThemeImpactPacketCard/);
});

test('ChapterEssay renders eyebrow row, headline, dek, hairline, drop cap, and close block', () => {
  assert.match(chapterEssaySource, /ds-chapter-essay__eyebrow-row/);
  assert.match(chapterEssaySource, /Chapter \{chapterIndex\} of \{chapterCount\}/);
  assert.match(chapterEssaySource, /ds-chapter-essay__headline/);
  assert.match(chapterEssaySource, /ds-chapter-essay__dek/);
  assert.match(chapterEssaySource, /ds-chapter-essay__hairline/);
  assert.match(chapterEssaySource, /ds-chapter-essay__paragraph--drop-cap/);
  assert.match(chapterEssaySource, /Next — Chapter \{chapterIndex \+ 1\}: \{nextChapter\.story\.title\}/);
  assert.match(chapterEssaySource, /ds-chapter-essay__entity-exits/);
  assert.match(chapterEssaySource, /Follow \{exit\.entityLabel\} into \{exit\.targetLabel\}/);
});

test('ChapterEssay interleaves moments and disputes per section in document order', () => {
  const sectionBlock = chapterEssaySource.slice(
    chapterEssaySource.indexOf('sections.map'),
    chapterEssaySource.indexOf('entityExitsByStoryId?.get'),
  );
  const paragraphsIndex = sectionBlock.indexOf('section.paragraphs.map');
  const momentsIndex = sectionBlock.indexOf('section.moments.map');
  const disputesIndex = sectionBlock.indexOf('section.disputes.map');
  assert.ok(paragraphsIndex >= 0 && momentsIndex >= 0 && disputesIndex >= 0);
  assert.ok(paragraphsIndex < momentsIndex, 'paragraphs render before moments');
  assert.ok(momentsIndex < disputesIndex, 'moments render before disputes');
  assert.match(chapterEssaySource, /DataMoment/);
  assert.match(chapterEssaySource, /DisputeBlock/);
});

test('ChapterEssay gates reveal and progress hairline on prefers-reduced-motion', () => {
  assert.match(chapterEssaySource, /prefersReducedMotion/);
  assert.match(chapterEssaySource, /setMotionEnabled\(!prefersReducedMotion\(\)\)/);
  assert.match(chapterEssaySource, /revealEnabled/);
  assert.match(chapterEssaySource, /if \(!enabled\) return null;/);
});

test('theme-spine.css gates the moment reveal fade+rise behind no-preference media query', () => {
  const cssSource = readFileSync(
    join(here, '..', '..', 'components', 'theme-spine', 'theme-spine.css'),
    'utf8',
  );
  assert.match(
    cssSource,
    /@media \(prefers-reduced-motion: no-preference\)[\s\S]*\.ds-chapter-essay__reveal[\s\S]*opacity: 0;/,
  );
  assert.match(cssSource, /\.ds-chapter-essay__progress \{/);
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
