/**
 * The shared investigation return: one component for every public record family, with real
 * builder hrefs and no pin promise for a record that has no public location.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { placeDiscoveryReturn } from '../../lib/discovery/discovery-state';
import { investigationReturnLabels } from './record-investigation-return';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '../../app');
const read = (path: string) => readFileSync(path, 'utf8');

describe('record investigation return labels', () => {
  const bare = placeDiscoveryReturn('ent_a', {});
  const narrowed = placeDiscoveryReturn('ent_a', { query: 'school', view: 'list' });

  it('keeps the builder wording for places', () => {
    const labels = investigationReturnLabels({ returns: bare, family: 'place' });
    assert.equal(labels.mapLabel, bare.mapLabel);
    assert.equal(labels.listLabel, bare.listLabel);
  });

  it('uses neutral record wording and no pin promise for an unmapped record', () => {
    const labels = investigationReturnLabels({ returns: bare, family: 'record', pinned: false });
    assert.equal(labels.mapLabel, 'Browse the map');
    assert.doesNotMatch(labels.mapLabel, /place/i);
  });

  it('uses record wording for a pinned non-place record', () => {
    const labels = investigationReturnLabels({ returns: bare, family: 'record', pinned: true });
    assert.equal(labels.mapLabel, 'See this record on the map');
  });

  it('keeps the narrowing labels whenever the arrival was narrowed', () => {
    const labels = investigationReturnLabels({
      returns: narrowed,
      family: 'record',
      narrowed: true,
      pinned: false,
    });
    assert.match(labels.mapLabel, /narrowing/i);
    assert.match(labels.listLabel, /narrowing/i);
  });
});

describe('record family wiring', () => {
  const component = read(join(here, 'record-investigation-return.tsx'));
  const place = read(join(appDir, 'HomeFirstPaint.tsx'));
  const room = read(join(appDir, 'entity/[id]/EntityRecordRoom.tsx'));
  const entityPage = read(join(appDir, 'entity/[id]/page.tsx'));
  const inventionPage = read(join(appDir, 'invention/[slug]/page.tsx'));
  const firstPaint = read(join(appDir, 'record-first-paint.tsx'));

  it('renders native links with hrefs taken from the builder', () => {
    assert.match(component, /href=\{returns\.mapHref\}/);
    assert.match(component, /href=\{returns\.listHref\}/);
    assert.match(component, /returns\.positionLabel/);
    assert.doesNotMatch(component, /encodeURIComponent|buildExploreHref|recordsHref/);
  });

  it('is the one bar for Place and the record room', () => {
    assert.match(place, /<RecordInvestigationReturn/);
    assert.match(room, /<RecordInvestigationReturn/);
    assert.doesNotMatch(place, /ds-record-return/);
    assert.doesNotMatch(room, /ds-record-return/);
  });

  it('record room map CTA follows the arrival instead of an unfiltered link', () => {
    assert.match(room, /href=\{returns\.mapHref\}/);
    assert.doesNotMatch(room, /buildExploreHref/);
  });

  it('entity and invention routes carry normalized arrival through every redirect', () => {
    assert.match(entityPage, /searchParams\?: Promise</);
    assert.match(entityPage, /permanentRedirect\(withQuery\(address, arrivalQuery\)\)/);
    assert.match(entityPage, /withQuery\([\s\S]*?arrivalQuery/);
    assert.match(inventionPage, /searchParams\?: Promise</);
    assert.match(inventionPage, /withQuery\(`\/place\/\$\{slug\}`, recordArrivalQuery/);
    assert.match(firstPaint, /withQuery\(`\/\$\{owner\}\/\$\{slug\}`, recordArrivalQuery/);
  });

  it('canonical metadata stays identity-only', () => {
    const metadata =
      /export async function generateMetadata[\s\S]*?\n}/.exec(entityPage)?.[0] ?? '';
    assert.ok(metadata.length > 0);
    assert.doesNotMatch(metadata, /searchParams|arrival/);
  });

  it('list neighbors reuse the released records catalog', () => {
    assert.match(firstPaint, /loadRecordsCatalog/);
    assert.doesNotMatch(firstPaint, /getSharedPublicEntities|getPublicSearchIndex/);
  });
});
