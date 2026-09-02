/**
 * SP-11e acceptance criterion 1: every chart card on /data carries, in order, a source label,
 * an as-of line, a plain-language limits sentence, and a "Show the numbers" disclosure. Asserted
 * per card by counting occurrences of each marker against the number of `ChartCard` instances,
 * so a card silently dropping one of the four fails this test rather than a manual review.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sectionsSource = readFileSync(join(here, 'DataSections.tsx'), 'utf8');

function countOccurrences(source: string, pattern: RegExp): number {
  return (source.match(pattern) ?? []).length;
}

test('every chart card renders through the shared ChartCard anatomy', () => {
  const cardCount = countOccurrences(sectionsSource, /<ChartCard\b/g);
  // Population, wealth, housing, justice. Kind composition is not a chart on this page.
  assert.equal(cardCount, 4);
});

test('every ChartCard instance is passed a source label, an as-of line, and limits copy', () => {
  const cardCount = countOccurrences(sectionsSource, /<ChartCard\b/g);
  assert.equal(countOccurrences(sectionsSource, /sourceLabel=/g), cardCount);
  assert.equal(countOccurrences(sectionsSource, /asOf=/g), cardCount);
  assert.equal(countOccurrences(sectionsSource, /limits=\{/g), cardCount);
});

test('ChartCard renders the four elements in order: chart slot, source, as-of, limits, disclosure', () => {
  const start = sectionsSource.indexOf('function ChartCard(');
  const end = sectionsSource.indexOf('\nfunction racePairRows(');
  assert.ok(start >= 0 && end > start, 'ChartCard definition not found');
  const body = sectionsSource.slice(start, end);

  const childrenIndex = body.indexOf('{children}');
  const sourceIndex = body.indexOf('kind="SOURCE"');
  const asOfIndex = body.indexOf('kind="AS OF"');
  const limitsIndex = body.indexOf('<p>{limits}</p>');
  const disclosureIndex = body.indexOf('summary="Show the numbers"');

  assert.ok(childrenIndex >= 0, 'chart slot missing');
  assert.ok(sourceIndex > childrenIndex, 'source label must follow the chart');
  assert.ok(asOfIndex > sourceIndex, 'as-of line must follow the source label');
  assert.ok(limitsIndex > asOfIndex, 'limits sentence must follow the as-of line');
  assert.ok(disclosureIndex > limitsIndex, '"Show the numbers" disclosure must be last');
});

test('kind composition is not a chart on this page, and the page does not send a reader to the list', () => {
  assert.doesNotMatch(sectionsSource, /id="composition"/);
  assert.doesNotMatch(sectionsSource, /href="\/records"|href="\/explore"/);
});

test('the data page off-ramp stays on the walk, not a fabricated Atlas population handoff', () => {
  const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
  assert.match(pageSource, /WalkOffRamp/);
  assert.doesNotMatch(pageSource, /href: '\/records'/);
  assert.doesNotMatch(pageSource, /\/explore/);
  assert.doesNotMatch(pageSource, /population.*decade|decade.*population/is);
});
