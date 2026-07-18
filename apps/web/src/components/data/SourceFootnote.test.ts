/**
 * Tests for shared vs compact source partitioning and DataStatStrip markup.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { DataStatStrip } from './DataStatStrip';
import {
  dedupeSources,
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
  assert.match(html, /bp-citation__list/);
  assert.match(html, /fbi-ucr-hate-crime/);
  assert.match(html, /census/);
});

test('DataStatStrip renders one group Source for matching sources, not one per item', () => {
  const html = renderToStaticMarkup(
    createElement(DataStatStrip, {
      sources: [FBI],
      items: [
        { value: '11,508', label: 'Reported incidents' },
        { value: '3,128', label: 'Anti-Black bias' },
        { value: '74.2%', label: 'Agencies participating' },
      ],
    }),
  );
  const sourceLabels = html.match(/bp-citation__label/g) ?? [];
  assert.equal(sourceLabels.length, 1);
  assert.match(html, /bp-citation--group/);
  assert.doesNotMatch(html, /bp-citation--compact/);
  assert.match(html, /11,508/);
  assert.match(html, /3,128/);
});

test('DataStatStrip keeps compact unique extras under the owning figure', () => {
  const html = renderToStaticMarkup(
    createElement(DataStatStrip, {
      sources: [FBI],
      items: [
        { value: '1', label: 'Shared only' },
        { value: '2', label: 'Has extra', sources: [CENSUS] },
      ],
    }),
  );
  assert.match(html, /bp-citation--group/);
  assert.match(html, /bp-citation--compact/);
  assert.match(html, /census/);
});
