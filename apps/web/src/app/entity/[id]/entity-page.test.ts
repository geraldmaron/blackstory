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

test('entity page does not mount EditionAtmosphereMosaic and edition stack', () => {
  assert.doesNotMatch(pageSource, /EditionAtmosphereMosaic/);
  assert.doesNotMatch(pageSource, /entityEditionMosaicSeedFor/);
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

test('entity sections gate beats on content and disclose gaps once via approved copy', () => {
  // Adaptive stack: no per-section apology cards; sparse beats simply do not render.
  assert.doesNotMatch(sectionsSource, /<RecordGapNotice/);
  assert.match(sectionsSource, /resolveSectionPresence/);
  // The closing provenance panel discloses every gap with the approved vocabulary.
  assert.match(sectionsSource, /RECORD_GAP_COPY/);
  assert.match(sectionsSource, /resolveResearchGaps/);
  assert.match(sectionsSource, /not an absence of history/);
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
