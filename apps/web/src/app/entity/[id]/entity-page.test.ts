/**
 * `/entity/{id}` renders the record page for non-holding records, and 308s to the record's
 * own family (`/place/{slug}`, or `/invention/{slug}` for an invention) only when that address
 * actually holds. Rendered behavior lives in `EntityRecordPage.test.tsx`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
// The page body lives outside the route file: Next lets a page export only its own known
// members, and `/place/{slug}` and `/invention/{slug}` render the same body.
const roomSource = readFileSync(join(here, 'EntityRecordPage.tsx'), 'utf8');
const placeSource = readFileSync(join(here, '../../../components/map-embed/RecordMap.tsx'), 'utf8');
const imageSource = readFileSync(join(here, '../../../components/entity/RecordImage.tsx'), 'utf8');

test('standable records 308 to /place; non-standable records still render here', () => {
  // The address itself is computed by `publicAddressOf`, shared with the merge-redirect path.
  assert.match(pageSource, /return publicRecordHref\(entity, collisions\)/);
  assert.match(pageSource, /permanentRedirect\(withQuery\(address, arrivalQuery\)\)/);
  assert.match(pageSource, /canStandHere/);
  assert.match(roomSource, /<RecordPage/);
  assert.doesNotMatch(pageSource, /getSharedPublicEntities|listPublicEntityViews\(/);
  assert.doesNotMatch(roomSource, /getSharedPublicEntities|listPublicEntityViews\(/);
});

test('a merged-away id forwards to its survivor instead of 404ing', () => {
  // Unpublishing an absorbed record is correct, but its URL must redirect to the survivor. The route
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

test('entity page stays CDN-cacheable and prerenders nothing', () => {
  assert.match(pageSource, /export const revalidate = 3600/);
  assert.match(pageSource, /export const dynamicParams = true/);
  assert.doesNotMatch(pageSource, /export const dynamic = 'force-dynamic'/);
  const body = /generateStaticParams\(\)[\s\S]*?\n}/.exec(pageSource)?.[0] ?? '';
  assert.ok(body.length > 0, 'generateStaticParams should exist');
  assert.match(body, /return \[\];/);
  assert.doesNotMatch(body, /getPublicSearchIndex/);
});

test('a record photo fails closed to nothing, never a placeholder plate', () => {
  assert.match(imageSource, /onError/);
  assert.match(imageSource, /if \(src === undefined\) return null/);
  assert.doesNotMatch(imageSource, /EntityRecordMark/);
});

test('entity map fail-closed: the place block still makes its point with no plate', () => {
  // The place and its precision in words are HTML outside the canvas (the plate ground, and the
  // caption where a page asks for one); when WebGL fails the canvas is hidden and the ground stays.
  assert.match(placeSource, /<figcaption className="ds-record-map__caption">/);
  assert.match(placeSource, /precisionInWords\(precision\)/);
  assert.match(placeSource, /<p className="ds-record-map__ground">/);
  assert.match(
    readFileSync(join(here, '../../../components/map-embed/record-map.css'), 'utf8'),
    /\[data-status='failed'\] \.ds-record-map__canvas \{\s*display: none;/,
  );
  assert.doesNotMatch(placeSource, /idle=/);
  assert.doesNotMatch(placeSource, /^import .*MapsExternalLink/m);
  assert.doesNotMatch(placeSource, /<MapsExternalLink/);
});

test('every record family renders the one record page, not a copy', () => {
  assert.match(roomSource, /export async function EntityRecordPage/);
  assert.match(pageSource, /EntityRecordPage\(\{ entity, arrival:/);
  for (const route of ['../../invention/[slug]/page.tsx', '../../place/[slug]/page.tsx']) {
    const source = readFileSync(join(here, route), 'utf8');
    assert.match(
      source,
      /EntityRecordPage\(\{ entity: \w+, arrival:|EntityRecordPage\(\{ entity, arrival:/,
    );
    assert.match(source, /familyForKind/);
  }
});

test('entity user-facing copy avoids em dashes', () => {
  for (const source of [pageSource, roomSource]) {
    assert.doesNotMatch(source, /—/);
  }
});
