/**
 * `/entity/{id}` renders the record room for non-holding records, and 308s to
 * `/place/{slug}` only when that place address actually holds. Column rules for
 * `EntityRoomSections` still apply on first paint.
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

test('standable records 308 to /place; non-standable records still render here', () => {
  assert.match(pageSource, /permanentRedirect\(placeHrefForEntity/);
  assert.match(pageSource, /canStandHere/);
  assert.match(pageSource, /<Room/);
  assert.doesNotMatch(pageSource, /getSharedPublicEntities|listPublicEntityViews\(/);
});

test('a beat renders only when the record has that content', () => {
  assert.match(sectionsSource, /hasContext \?/);
  assert.match(sectionsSource, /evidenceClaims\.length > 0 \?/);
  assert.match(sectionsSource, /entity\.timeline\.length > 0 \?/);
  assert.doesNotMatch(sectionsSource, /<RecordGapNotice/);
});

test('a related record states its relation in words', () => {
  assert.match(sectionsSource, /relationPhrase/);
  assert.match(sectionsSource, /RelationshipConstellation/);
  assert.match(sectionsSource, /Worth investigating next/);
  assert.match(sectionsSource, /Nearby on the map is not the same as related/);
  assert.match(sectionsSource, /toSuggestedConnections/);
  assert.doesNotMatch(
    sectionsSource,
    /firstPaintRelatedHeading\(\[\s*\.\.\.\(entity\.relatedNeighbors/,
  );
});

test('neighbor hrefs stay off internal entity paths', () => {
  assert.match(sectionsSource, /neighborHref/);
  assert.doesNotMatch(sectionsSource, /`\/entity\/\$\{neighbor\.id\}`/);
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

test('entity page renders visit handoff for geo-anchored records', () => {
  assert.match(pageSource, /RecordVisitBlock/);
  assert.match(pageSource, /buildEntityAnatomyInputs/);
  assert.match(pageSource, /whereLabel/);
  assert.match(pageSource, /shouldShowVisitBlock/);
  assert.match(pageSource, /placeAdvisories/);
  assert.match(pageSource, /claims: entity\.claims/);
  assert.match(pageSource, /MapsExternalLink/);
  assert.match(pageSource, /linkWhereToMaps|whereMapsHref|showVisit/);
});

test('entity column renders archived Internet Archive sources when cited', () => {
  assert.match(sectionsSource, /RecordArchiveSources/);
  assert.match(sectionsSource, /resolveInternetArchiveSources/);
  assert.match(sectionsSource, /Archived copies/);
});

test('entity user-facing copy avoids em dashes on touched surfaces', () => {
  for (const source of [pageSource, sectionsSource]) {
    assert.doesNotMatch(source, /—/);
  }
});
