/**
 * The Data Figure contract on `/data`: every chart renders through `DataChartFrame`, and the
 * frame carries, in order, a figure label, the title, a reading sentence, the graphic, a limits
 * caption, the source line, and a "Show the numbers" disclosure. Asserted against the source so
 * a figure silently dropping one of them fails here rather than in review.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sectionsSource = readFileSync(join(here, 'DataSections.tsx'), 'utf8');
const frameSource = readFileSync(
  join(here, '..', '..', 'components', 'data', 'DataChartFrame.tsx'),
  'utf8',
);

function countOccurrences(source: string, pattern: RegExp): number {
  return (source.match(pattern) ?? []).length;
}

const CHART_TAGS = [
  'PopulationByDecadeChart',
  'BlackPopulationShareChart',
  'StatePopulationShiftChart',
  'RacePairComparisonChart',
  'GroupedBarIndicatorChart',
  'DeltaFigure',
];

test('every figure on the page is numbered and carries a reading', () => {
  const figureCount = CHART_TAGS.reduce(
    (sum, tag) => sum + countOccurrences(sectionsSource, new RegExp(`<${tag}\\b`, 'g')),
    0,
  );
  // 4 population, 2 wealth, 3 housing, 2 justice.
  assert.equal(figureCount, 11);
  assert.equal(countOccurrences(sectionsSource, /figureLabel="Figure \d+"/g), figureCount);
  // DeltaFigure writes its own reading; every chart is handed one.
  assert.equal(countOccurrences(sectionsSource, /reading=\{/g), figureCount);
});

test('figure labels run 1 to 11 in document order', () => {
  const labels = [...sectionsSource.matchAll(/figureLabel="Figure (\d+)"/g)].map((match) =>
    Number(match[1]),
  );
  assert.deepEqual(
    labels,
    labels.map((_, index) => index + 1),
  );
});

test('the frame renders the anatomy in order: label, title, reading, graphic, caption, source, numbers', () => {
  const start = frameSource.indexOf('return (');
  const body = frameSource.slice(start);
  const order = [
    'ds-datafig__label',
    'ds-datafig__title',
    'ds-datafig__reading',
    '{children}',
    'ds-datafig__caption',
    'ds-datafig__source',
    'Show the numbers',
  ];
  let cursor = -1;
  for (const marker of order) {
    const at = body.indexOf(marker);
    assert.ok(at > cursor, `"${marker}" is out of order in the figure`);
    cursor = at;
  }
  // The numbers are a native disclosure, so they open with JavaScript off.
  assert.match(body, /<details className="ds-datafig__numbers">/);
});

test('every section states its as-of date once, in its head', () => {
  assert.match(sectionsSource, /`As of \$\{populationAsOf\}`/);
  assert.match(sectionsSource, /const indicatorMeta = \[`As of \$\{indicatorsAsOf\}`\]/);
  for (const id of ['wealth', 'housing', 'justice']) {
    assert.match(sectionsSource, new RegExp(`<Section id="${id}" meta=\\{indicatorMeta\\}>`));
  }
});

test('the page off-ramp stays on the walk, not a fabricated Explore population handoff', () => {
  const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
  assert.match(pageSource, /WalkOffRamp/);
  assert.doesNotMatch(pageSource, /href: '\/records'/);
  assert.doesNotMatch(pageSource, /\/explore/);
  assert.doesNotMatch(sectionsSource, /id="composition"/);
});
