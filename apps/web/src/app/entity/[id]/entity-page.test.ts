/**
 * Legacy `/entity/{id}` is a hop to `/place/{slug}`. The record room lives on the
 * place door. This file keeps the ISR / empty-static-params guard and the
 * column rules that first paint still mounts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'EntityRoomSections.tsx'), 'utf8');
const placeSource = readFileSync(
  join(here, '../../../components/patterns/RecordPlacePreview.tsx'),
  'utf8',
);
const mediaSource = readFileSync(
  join(here, '../../../components/entity/EntityMastMedia.tsx'),
  'utf8',
);

test('entity addresses 308 to the public place slug', () => {
  assert.match(pageSource, /permanentRedirect\(placeHref/);
  assert.match(pageSource, /from '\.\.\/\.\.\/\.\.\/lib\/place\/public-place-path'/);
  assert.doesNotMatch(pageSource, /<Room/);
  assert.doesNotMatch(pageSource, /getSharedPublicEntities|listPublicEntityViews\(/);
  assert.doesNotMatch(pageSource, /getPublicSearchIndex/);
});

test('a beat renders only when the record has that content', () => {
  assert.match(sectionsSource, /hasContext \?/);
  assert.match(sectionsSource, /evidenceClaims\.length > 0 \?/);
  assert.match(sectionsSource, /entity\.timeline\.length > 0 \?/);
  assert.doesNotMatch(sectionsSource, /<RecordGapNotice/);
});

test('a related record states its relation in words', () => {
  assert.match(sectionsSource, /relationPhrase/);
  assert.match(sectionsSource, /<Connections/);
});

test('first-paint neighbor hrefs stay off internal ids', () => {
  assert.match(sectionsSource, /neighborHref/);
  assert.doesNotMatch(sectionsSource, /firstPaint \? `\/entity\/\$\{neighbor\.id\}`/);
});

test('entity page stays CDN-cacheable and prerenders nothing', () => {
  assert.match(pageSource, /export const revalidate = 3600/);
  assert.match(pageSource, /export const dynamicParams = true/);
  assert.doesNotMatch(pageSource, /export const dynamic = 'force-dynamic'/);
  const body = /generateStaticParams\(\)[\s\S]*?\n}/.exec(pageSource)?.[0] ?? '';
  assert.ok(body.length > 0, 'generateStaticParams should exist');
  assert.match(body, /return \[\];/);
  assert.doesNotMatch(body, /getPublicSearchIndex/);
});

test('entity media fail-closed: mark fallback on photo exhaustion', () => {
  assert.match(mediaSource, /EntityRecordMark/);
  assert.match(mediaSource, /reason: 'exhausted'/);
  assert.match(mediaSource, /onError/);
});

test('entity map fail-closed: the place block still makes its point with no plate', () => {
  assert.match(placeSource, /<figcaption className="ds-record-anatomy__place-caption">\{label\}/);
  assert.doesNotMatch(placeSource, /idle=/);
  assert.doesNotMatch(placeSource, /^import .*MapsExternalLink/m);
  assert.doesNotMatch(placeSource, /<MapsExternalLink/);
});

test('entity user-facing copy avoids em dashes on touched surfaces', () => {
  for (const source of [pageSource, sectionsSource]) {
    assert.doesNotMatch(source, /—/);
  }
});
