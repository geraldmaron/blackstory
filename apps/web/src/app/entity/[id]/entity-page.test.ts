/**
 * Entity page wiring, now that the record renders as a v9 Record room rather than a v6 edition
 * stack: kit composition, the rail/column split, fail-closed media and map states, and the
 * no-repeated-summary rule the rebuild exists to enforce.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'EntityRoomSections.tsx'), 'utf8');
const mapSource = readFileSync(
  join(here, '../../../components/entity/EntityLocationMap.tsx'),
  'utf8',
);
const mediaSource = readFileSync(
  join(here, '../../../components/entity/EntityMastMedia.tsx'),
  'utf8',
);

test('entity page renders through the room kit, not the retired v6 edition chrome', () => {
  assert.match(pageSource, /<Room rail=/);
  assert.match(pageSource, /<RoomHeader/);
  assert.doesNotMatch(pageSource, /entityEditionRootClassName/);
  assert.doesNotMatch(pageSource, /entityEditionPanelClassName/);
  assert.doesNotMatch(pageSource, /data-entity-edition/);
  assert.doesNotMatch(pageSource, /EditionAtmosphereMosaic/);
  // The measure and the centring belong to the `record` surface class, not to this route.
  assert.doesNotMatch(pageSource, /ds-container ds-page/);
});

test('the apparatus is in the rail and the reading is in the column', () => {
  for (const block of ['<Anatomy', '<SourceList', '<TrustBlock', '<Precision']) {
    assert.match(pageSource, new RegExp(block), `${block} belongs in the rail`);
  }
  assert.match(pageSource, /buildEntityAnatomyInputs/);
  assert.match(pageSource, /EntityRoomSections/);
});

test('the summary is the lede and is never restated as a section', () => {
  // The v6 page printed it three times: lede, "Inclusion evidence", and the accepted claim.
  assert.match(pageSource, /lede=\{[\s\S]*?entity\.summary/);
  assert.doesNotMatch(sectionsSource, /entity\.summary/);
  assert.doesNotMatch(pageSource, /WhyThisAppears/);
});

test('the location is drawn once', () => {
  const rendered = pageSource.match(/<EntityLocationCinematicMap/g) ?? [];
  assert.equal(rendered.length, 1, 'the record must not render two maps for one place');
  assert.doesNotMatch(pageSource, /RecordAnatomyPanel/);
});

test('a beat renders only when the record has that content', () => {
  assert.match(sectionsSource, /hasContext \?/);
  assert.match(sectionsSource, /evidenceClaims\.length > 0 \?/);
  assert.match(sectionsSource, /entity\.timeline\.length > 0 \?/);
  assert.doesNotMatch(sectionsSource, /<RecordGapNotice/);
});

test('gaps are disclosed once, in the rail, in the approved vocabulary', () => {
  assert.match(pageSource, /RECORD_GAP_COPY/);
  assert.match(pageSource, /resolveRecordGaps/);
  assert.match(pageSource, /not an absence of history/);
});

test('a related record states its relation in words', () => {
  assert.match(sectionsSource, /relationPhrase/);
  assert.match(sectionsSource, /<Connections/);
});

test('entity page preserves session nav and force-dynamic routing', () => {
  assert.match(pageSource, /EntitySessionNavClient/);
  assert.match(pageSource, /export const dynamic = 'force-dynamic'/);
});

test('entity intro media renders only when a primary photo exists', () => {
  assert.match(pageSource, /entity\.primaryImage !== undefined \? \(/);
});

test('entity media fail-closed: mark fallback on photo exhaustion', () => {
  assert.match(mediaSource, /EntityRecordMark/);
  assert.match(mediaSource, /reason: 'exhausted'/);
  assert.match(mediaSource, /onError/);
});

test('entity map fail-closed: accessible WebGL unavailable message', () => {
  assert.match(mapSource, /role="status"/);
  assert.match(mapSource, /Map tiles could not load/);
});

test('entity user-facing copy avoids em dashes on touched surfaces', () => {
  for (const source of [pageSource, sectionsSource]) {
    assert.doesNotMatch(source, /—/);
  }
});
