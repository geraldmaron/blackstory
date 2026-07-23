/**
 * Entity v6 page wiring: shared gutter mosaic, RecordAnatomyPanel, safe fail states.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'EntityEditionSections.tsx'), 'utf8');
const mapSource = readFileSync(
  join(here, '../../../components/entity/EntityLocationMap.tsx'),
  'utf8',
);
const mediaSource = readFileSync(
  join(here, '../../../components/entity/EntityMastMedia.tsx'),
  'utf8',
);

test('entity page uses shared EditionAtmosphereMosaic and edition stack', () => {
  assert.match(pageSource, /EditionAtmosphereMosaic/);
  assert.match(pageSource, /entityEditionMosaicSeedFor/);
  assert.match(pageSource, /entityEditionRootClassName/);
  assert.match(pageSource, /data-entity-edition="v6"/);
  assert.doesNotMatch(pageSource, /ds-entity-mast/);
  assert.doesNotMatch(pageSource, /ds-at-a-glance/);
  assert.doesNotMatch(pageSource, /ds-entity-layout/);
});

test('entity page orients with RecordAnatomyPanel and EditionFactIcon facts', () => {
  assert.match(pageSource, /RecordAnatomyPanel/);
  assert.match(pageSource, /buildEntityAnatomyInputs/);
  assert.match(pageSource, /record-evidence/);
  assert.match(pageSource, /record-era/);
});

test('entity page preserves session nav and force-dynamic routing', () => {
  assert.match(pageSource, /EntitySessionNavClient/);
  assert.match(pageSource, /export const dynamic = 'force-dynamic'/);
});

test('entity sections use RecordGapNotice fail states for sparse content', () => {
  assert.match(sectionsSource, /RecordGapNotice kind="relevance"/);
  assert.match(sectionsSource, /RecordGapNotice kind="context"/);
  assert.match(sectionsSource, /RecordGapNotice kind="claims"/);
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
