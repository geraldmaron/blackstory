/**
 * The figure contract on `/data`: every chart is a registry figure rendered by `Figure`, which
 * carries, in order, the finding as its heading, what is plotted, the view switch, the drawing in
 * an exhibit frame, and a receipt holding the sources, Cite and the limits, always visible.
 * Asserted against the source so a figure silently dropping one of them fails here rather than in
 * review.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FIGURE_IDS } from '../../components/data/figures/figure-ids';
import { DATA_FIGURE_GROUPS, DATA_LEGACY_ANCHORS } from './data-copy';

const here = dirname(fileURLToPath(import.meta.url));
const sectionsSource = readFileSync(join(here, 'DataSections.tsx'), 'utf8');
const dataDir = join(here, '..', '..', 'components', 'data');
const bodySource = readFileSync(join(dataDir, 'figures', 'FigureBody.tsx'), 'utf8');
const chartsCss = readFileSync(join(dataDir, 'data-charts.css'), 'utf8');
const figureCss = readFileSync(join(dataDir, 'figures', 'figure.css'), 'utf8');
const pageCss = readFileSync(join(here, 'data-page.css'), 'utf8');

test('all sixteen figures stay on the page, each placed once under a heading', () => {
  // Figures are an owner decision; the count is sixteen (phase 6a, owner brief 2026-11-23).
  const placed = Object.values(DATA_FIGURE_GROUPS).flat();
  assert.equal(FIGURE_IDS.length, 16);
  assert.deepEqual([...placed].sort(), [...FIGURE_IDS].sort());
  assert.equal(new Set(placed).size, placed.length);
  // The page draws nothing of its own: one `Figure` call renders every id.
  assert.equal((sectionsSource.match(/<Figure\b/g) ?? []).length, 1);
  assert.doesNotMatch(sectionsSource, /Chart\b|DataChartFrame|FigureFoot/);
});

test('an address a figure had before it had an id still lands on it', () => {
  // `lib/lives/world-beat-fixtures.ts` publishes `/data#justice-imprisonment`.
  assert.equal(DATA_LEGACY_ANCHORS['D-15'], 'justice-imprisonment');
  const kept = Object.values(DATA_LEGACY_ANCHORS);
  assert.equal(kept.length, 14);
  assert.equal(new Set(kept).size, 14);
  assert.match(sectionsSource, /id=\{DATA_LEGACY_ANCHORS\[id\]\}/);
});

test('the figure renders the anatomy in order: finding, plotted line, switch, drawing, receipt', () => {
  const body = bodySource.slice(bodySource.lastIndexOf('return ('));
  assert.match(bodySource, /<strong>Limits\.<\/strong> \{data\.limits\}/);
  const order = [
    'ds-figure__title',
    'ds-figure__subtitle',
    '<Segmented',
    '<ExhibitFrame',
    '<Receipt',
    'ds-figure__object',
  ];
  let cursor = -1;
  for (const marker of order) {
    const at = body.indexOf(marker);
    assert.ok(at > cursor, `"${marker}" is out of order in the figure`);
    cursor = at;
  }
  // The finding is a real heading, so the page outline lists every figure.
  assert.match(bodySource, /<Heading id=\{`\$\{id\}-finding`\} className="ds-figure__title">/);
  // The figure brings its own stylesheets, so no consumer can render one unstyled.
  assert.match(bodySource, /import '\.\.\/data-charts\.css';/);
  assert.match(bodySource, /import '\.\/figure\.css';/);
});

test('sources and limits are always visible, and the old frame is gone', () => {
  // Nothing in the receipt is behind a disclosure, and the body holds no state.
  assert.doesNotMatch(bodySource, /aria-expanded|\shidden=|useState|'use client'/);
  for (const file of ['DataChartFrame.tsx', 'FigureFoot.tsx']) {
    assert.ok(!existsSync(join(dataDir, file)), `${file} was retired in phase 6b`);
  }
  assert.doesNotMatch(chartsCss + figureCss + pageCss, /ds-datafig/);
});

// A 1,200px table opened at 375px widened the whole figure past the viewport, and the shell's
// overflow clip hid the overflow instead of letting it scroll. Two halves keep it fixed: the figure
// track cannot grow to the table's min-content, and the table's scroller is reachable by keyboard.
test('a numbers table scrolls inside the figure instead of widening it', () => {
  const figureRule = figureCss.match(/\.ds-figure \{[^}]*\}/)?.[0] ?? '';
  assert.match(figureRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(chartsCss, /\.ds-figure__numbers \{[^}]*overflow-x:\s*auto/);
  const scroller = bodySource.slice(bodySource.indexOf('className="ds-figure__numbers"'));
  assert.match(scroller, /role="region"/);
  assert.match(scroller, /aria-label=\{`Numbers for figure \$\{id\}`\}/);
  assert.match(scroller, /tabIndex=\{0\}/);
});

test('copper is not a series color in any figure', () => {
  const seriesRules = chartsCss
    .split('}')
    .filter((rule) =>
      /\.ds-fig-bar|\.ds-lines__|\.ds-dot|\.ds-hbar__fill|\.ds-ratio__unit-mark/.test(rule),
    );
  for (const rule of seriesRules) assert.doesNotMatch(rule, /accent/);
});

test('no count is set in display type and no section is a color band', () => {
  assert.doesNotMatch(sectionsSource, /DisplayNumeral|BandArt|data-ground/);
  assert.doesNotMatch(pageCss, /ds-data-band|text-display/);
  for (const rule of chartsCss
    .split('}')
    .filter((rule) => /ds-ratio__value|ds-delta__value/.test(rule))) {
    assert.doesNotMatch(rule, /font-display|text-display|text-headline|text-title/);
  }
});

test('each section states its as-of date once, in its head', () => {
  assert.match(
    sectionsSource,
    /<Section id="counted" meta=\{`Census figures as of \$\{populationAsOf\}`\}>/,
  );
  assert.match(
    sectionsSource,
    /<Section id="gaps" meta=\{`Indicators as of \$\{indicatorsAsOf\}`\}>/,
  );
});

test('the page ends on its figures, with no off-ramp card and no fabricated Explore handoff', () => {
  const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
  assert.doesNotMatch(pageSource, /WalkOffRamp|DocumentColophon/);
  assert.doesNotMatch(pageSource, /href: '\/records'/);
  assert.doesNotMatch(pageSource, /\/explore/);
  assert.doesNotMatch(sectionsSource, /id="composition"/);
});
