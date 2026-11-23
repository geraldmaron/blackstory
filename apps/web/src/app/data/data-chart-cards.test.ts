/**
 * The figure contract on `/data`: every chart renders through `DataChartFrame` or, for the
 * registry figures (`D-01`, `D-02`), through `Figure`. The frame
 * carries, in order, the finding as its heading, the plotted line, the graphic, and one footer row
 * holding the source, Limits and Numbers. Asserted against the source so a figure silently
 * dropping one of them fails here rather than in review.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sectionsSource = readFileSync(join(here, 'DataSections.tsx'), 'utf8');
const dataDir = join(here, '..', '..', 'components', 'data');
const frameSource = readFileSync(join(dataDir, 'DataChartFrame.tsx'), 'utf8');
const footSource = readFileSync(join(dataDir, 'FigureFoot.tsx'), 'utf8');
const chartsCss = readFileSync(join(dataDir, 'data-charts.css'), 'utf8');

function countOccurrences(source: string, pattern: RegExp): number {
  return (source.match(pattern) ?? []).length;
}

const CHART_TAGS = [
  'PopulationByDecadeChart',
  'StatePopulationShiftChart',
  'DeltaFigure',
  'GapMagnitudeSight',
  'RacePairComparisonChart',
  'GroupedBarIndicatorChart',
  'TrendLineChart',
];

/** Registry figures: `Figure` supplies the finding, the three views and the receipt itself. */
const REGISTRY_FIGURES = countOccurrences(sectionsSource, /<Figure\b/g);

test('all sixteen figures stay on the page, each with an anchor and a finding', () => {
  const framed = CHART_TAGS.reduce(
    (sum, tag) => sum + countOccurrences(sectionsSource, new RegExp(`<${tag}\\b`, 'g')),
    0,
  );
  // Figures are an owner decision. Phase 6a (owner brief, 2026-11-23) made the share spine and
  // the share line one figure, D-01, and added D-02; the count stays sixteen.
  assert.equal(REGISTRY_FIGURES, 2);
  assert.equal(framed + REGISTRY_FIGURES, 16);
  // Every framed chart is handed a finding; DeltaFigure's own frame call carries the last.
  assert.equal(countOccurrences(sectionsSource, /reading=\{/g), framed);
  assert.equal(countOccurrences(sectionsSource, /\bid="[A-Za-z0-9-]+"/g) >= framed - 1, true);
});

test('every figure anchor has a short name for the contents list', () => {
  const copy = readFileSync(join(here, 'data-copy.ts'), 'utf8');
  const anchors = [...sectionsSource.matchAll(/\bid: '([A-Za-z0-9-]+)'/g)].map(
    (match) => match[1]!,
  );
  assert.ok(anchors.length >= 16, 'no figure anchors found — the markup changed');
  for (const anchor of anchors) assert.match(copy, new RegExp(`'${anchor}':`));
});

test('the frame renders the anatomy in order: finding, plotted line, graphic, one footer row', () => {
  const body = frameSource.slice(frameSource.indexOf('return ('));
  const order = ['ds-datafig__title', 'ds-datafig__subtitle', '{children}', '<FigureFoot'];
  let cursor = -1;
  for (const marker of order) {
    const at = body.indexOf(marker);
    assert.ok(at > cursor, `"${marker}" is out of order in the figure`);
    cursor = at;
  }
  // The finding is a real heading, so the page outline lists every figure.
  assert.match(
    frameSource,
    /<Heading className="ds-datafig__title">\{reading \?\? title\}<\/Heading>/,
  );
  // The frame brings its own stylesheet, so no consumer can render a figure unstyled.
  assert.match(frameSource, /import '\.\/data-charts\.css';/);
});

test('the footer row names the source and opens Limits and Numbers as disclosures', () => {
  assert.match(footSource, /\{panel === 'limits' \? 'Limits' : 'Numbers'\}/);
  assert.match(footSource, /aria-expanded=\{open === panel\}/);
  assert.match(footSource, /aria-controls=\{`\$\{id\}-\$\{panel\}`\}/);
  // The limits and the table are in the server HTML, hidden until opened, never omitted.
  assert.match(footSource, /hidden=\{open !== 'limits'\}/);
  assert.match(footSource, /hidden=\{open !== 'numbers'\}/);
});

// A 1,200px table opened at 375px widened the whole figure past the viewport, and the shell's
// overflow clip hid the overflow instead of letting it scroll. Two halves keep it fixed: the figure
// track cannot grow to the table's min-content, and the table's scroller is reachable by keyboard.
test('an open numbers table scrolls inside the figure instead of widening it', () => {
  const figureRule = chartsCss.match(/\.ds-datafig \{[^}]*\}/)?.[0] ?? '';
  assert.match(figureRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(chartsCss, /\.ds-datafig__numbers \{[^}]*overflow-x:\s*auto/);
  const scroller = footSource.slice(
    footSource.indexOf('className="ds-datafig__panel ds-datafig__numbers"'),
  );
  assert.match(scroller, /role="region"/);
  assert.match(scroller, /aria-label=\{`Numbers for \$\{title\}`\}/);
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
