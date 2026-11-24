/**
 * Tests for shared vs compact source partitioning.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import {
  dedupeSources,
  humanSourceLabel,
  partitionStripSources,
  sourcesEqual,
  SourceFootnote,
} from './SourceFootnote';

const FBI = { label: 'fbi-ucr-hate-crime', url: 'https://www.fbi.gov/hate-crime' };
const CENSUS = { label: 'census', url: 'https://www.census.gov/' };
const ACS = { label: 'acs', url: 'https://www.census.gov/programs-surveys/acs' };

test('dedupeSources keeps first occurrence by URL', () => {
  assert.deepEqual(dedupeSources([FBI, { ...FBI, label: 'FBI UCR' }, CENSUS]), [FBI, CENSUS]);
});

test('sourcesEqual is order-independent', () => {
  assert.equal(sourcesEqual([FBI, CENSUS], [CENSUS, FBI]), true);
  assert.equal(sourcesEqual([FBI], [CENSUS]), false);
});

test('identical per-item sources hoist to a shared group footer', () => {
  const partitioned = partitionStripSources({
    itemSources: [[FBI], [FBI], [FBI]],
  });
  assert.deepEqual(partitioned.groupSources, [FBI]);
  assert.deepEqual(partitioned.itemExtras, [[], [], []]);
});

test('explicit group sources leave only unique extras on items', () => {
  const partitioned = partitionStripSources({
    groupSources: [FBI],
    itemSources: [[FBI], [FBI, CENSUS], []],
  });
  assert.deepEqual(partitioned.groupSources, [FBI]);
  assert.deepEqual(partitioned.itemExtras, [[], [CENSUS], []]);
});

test('distinct per-item sources stay compact under each figure', () => {
  const partitioned = partitionStripSources({
    itemSources: [[FBI], [CENSUS], [ACS]],
  });
  assert.deepEqual(partitioned.groupSources, []);
  assert.deepEqual(partitioned.itemExtras, [[FBI], [CENSUS], [ACS]]);
});

test('SourceFootnote pluralizes and lists multiple sources', () => {
  const html = renderToStaticMarkup(
    createElement(SourceFootnote, { sources: [FBI, CENSUS], density: 'group' }),
  );
  assert.match(html, />Sources</);
  assert.match(html, /ds-citation__list/);
  assert.match(html, /FBI Hate Crime Statistics/);
  assert.match(html, /U\.S\. Census Bureau, Decennial Census/);
});

test('humanSourceLabel keeps prose labels and remaps ingest ids', () => {
  assert.equal(humanSourceLabel('FBI Crime Data Explorer'), 'FBI Crime Data Explorer');
  assert.equal(
    humanSourceLabel('us-census-acs5-2024'),
    'U.S. Census Bureau, American Community Survey',
  );
  assert.equal(
    humanSourceLabel('opportunity-insights-tract-outcomes'),
    'Opportunity Insights, Opportunity Atlas',
  );
});
