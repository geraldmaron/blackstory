/**
 * `/entity/{id}` renders the record room for non-holding records, and 308s to the record's
 * own family (`/place/{slug}`, or `/invention/{slug}` for an invention) only when that address
 * actually holds. Column rules for `EntityRoomSections` still apply on first paint.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
// The room moved out of the route file: Next lets a page export only its own known members,
// and `/invention/{slug}` renders the same room.
const roomSource = readFileSync(join(here, 'EntityRecordRoom.tsx'), 'utf8');
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
  // The address itself is computed by `publicAddressOf`, shared with the merge-redirect path.
  assert.match(pageSource, /return publicRecordHref\(entity, collisions\)/);
  assert.match(pageSource, /permanentRedirect\(address\)/);
  assert.match(pageSource, /canStandHere/);
  assert.match(roomSource, /<Room/);
  assert.doesNotMatch(pageSource, /getSharedPublicEntities|listPublicEntityViews\(/);
  assert.doesNotMatch(roomSource, /getSharedPublicEntities|listPublicEntityViews\(/);
});

test('a merged-away id forwards to its survivor instead of 404ing', () => {
  // repo-n7p6.29: unpublishing an absorbed record was right; killing its URL was not. The route
  // must consult the published absorbed->survivor map before it renders a miss.
  assert.match(pageSource, /resolvePublicEntityRedirect/);
  // The redirect lookup belongs on the miss path only — a hit must not pay for it.
  const miss = /if \(!entity\) \{[\s\S]*?\n {2}\}/.exec(pageSource)?.[0] ?? '';
  assert.ok(miss.length > 0, 'the miss branch should exist');
  assert.match(miss, /resolvePublicEntityRedirect\(id\)/);
  assert.match(miss, /permanentRedirect\(/);
  // A survivor that is itself unpublished, and every non-merge miss (a withdrawal, a typo),
  // still ends at notFound() — a real 404, not a forward onto a dead address.
  assert.match(miss, /notFound\(\);\n {2}\}/);
  assert.match(miss, /if \(survivor\.data\)/);
});

test('a beat renders only when the record has that content', () => {
  assert.match(sectionsSource, /hasContext \?/);
  assert.match(sectionsSource, /evidenceClaims\.length > 0 \?/);
  assert.match(sectionsSource, /entity\.timeline\.length > 0 \?/);
  assert.doesNotMatch(sectionsSource, /<RecordGapNotice/);
});

test('a related record states its relation in words', () => {
  assert.match(sectionsSource, /relationPhrase/);
  assert.match(sectionsSource, /RelationshipTree/);
  // The flat-list fallback is still what a record with fewer than two graph nodes renders,
  // so both its headings must survive the map landing.
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
  assert.match(roomSource, /RecordVisitBlock/);
  assert.match(roomSource, /buildEntityAnatomyInputs/);
  assert.match(roomSource, /whereLabel/);
  assert.match(roomSource, /shouldShowVisitBlock/);
  assert.match(roomSource, /placeAdvisories/);
  assert.match(roomSource, /claims: entity\.claims/);
  assert.match(roomSource, /MapsExternalLink/);
  assert.match(roomSource, /linkWhereToMaps|whereMapsHref|showVisit/);
});

test('the record room is shared with the invention family, not copied', () => {
  // An invention needs a room that carries an inventor, a patent receipt and an impact beat.
  // Rendering a thinner page there would trade one misrepresentation for another.
  assert.match(roomSource, /export async function EntityRecordRoom/);
  assert.match(pageSource, /EntityRecordRoom\(\{ entity \}\)/);
  const inventionSource = readFileSync(join(here, '../../invention/[slug]/page.tsx'), 'utf8');
  assert.match(inventionSource, /EntityRecordRoom\(\{ entity \}\)/);
  assert.match(inventionSource, /familyForKind/);
});

test('impact renders as its own beat and collapses when absent', () => {
  assert.match(sectionsSource, /entity\.impactStatement \?/);
  assert.match(sectionsSource, /What it changed/);
});

test('the rail numbers what the document numbers', () => {
  // recordSectionIndex builds the "On this record" rail; the beats build the page. A beat present
  // in one and missing from the other shifts every number after it, which is how the impact beat
  // first shipped: the document read 01..05 and the rail read 01..04 for the same page.
  const index = sectionsSource.slice(
    sectionsSource.indexOf('export function recordSectionIndex'),
    sectionsSource.indexOf('export function EntityRoomSections'),
  );
  const railOrder = [...index.matchAll(/label: (?:'([^']+)'|[^\n]*?'([^']+)')/g)]
    .map((match) => match[1] ?? match[2])
    .filter((label): label is string => label !== undefined);
  const beatOrder = ['The history here', 'What it changed'];
  assert.deepEqual(
    railOrder.filter((label) => beatOrder.includes(label)),
    beatOrder,
    'impact follows context in the rail, as it does in the document',
  );
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
