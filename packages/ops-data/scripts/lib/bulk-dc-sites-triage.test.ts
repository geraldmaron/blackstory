/**
 * Unit tests for bulk DC sites fixture validation and triage.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DC_BBOX,
  pointInDcBounds,
  triageBulkDcSitesFixture,
  validateBulkDcCandidate,
  type BulkDcSiteCandidate,
  type BulkDcSitesFixture,
} from './bulk-dc-sites-triage.ts';
import { buildCatalogMatchIndex } from './catalog-entity-match.ts';

function baseCandidate(overrides: Partial<BulkDcSiteCandidate> = {}): BulkDcSiteCandidate {
  return {
    id: 'dc-black-history-sites-test1',
    kind: 'place',
    displayName: 'Test Site',
    summary: 'Institution site in Washington, DC, documented in the DC HPO inventory.',
    canonicalUrl: 'https://historicsites.dcpreservation.org/items/show/1',
    lat: 38.9,
    lng: -77.03,
    researchLaneOnly: true,
    provenance: {
      sourceId: 'dc-black-history-sites',
      sourceItemId: 'test1',
      sourceCategory: 'Institution',
      rights: 'CC BY 4.0',
    },
    ...overrides,
  };
}

test('pointInDcBounds accepts U Street corridor coordinates', () => {
  assert.equal(pointInDcBounds(38.917, -77.029, DC_BBOX), true);
});

test('validateBulkDcCandidate flags researchLaneOnly and rights', () => {
  const issues = validateBulkDcCandidate(
    baseCandidate({ researchLaneOnly: undefined, provenance: { sourceId: 'dc-black-history-sites' } }),
  );
  assert.ok(issues.some((issue) => issue.includes('researchLaneOnly')));
  assert.ok(issues.some((issue) => issue.includes('CC BY 4.0')));
});

test('triageBulkDcSitesFixture buckets geo_hold for missing coordinates', () => {
  const fixture: BulkDcSitesFixture = {
    candidates: [baseCandidate({ lat: undefined, lng: undefined })],
  };
  const report = triageBulkDcSitesFixture({
    fixture,
    fixturePath: 'test-fixture.json',
    bytes: 100,
    catalogIndex: buildCatalogMatchIndex([]),
    now: '2026-07-21T00:00:00.000Z',
  });
  assert.equal(report.dispositions.geo_hold, 1);
  assert.equal(report.samples.geoHold[0]?.candidateId, 'dc-black-history-sites-test1');
});

test('triageBulkDcSitesFixture routes People category to privacy_review', () => {
  const fixture: BulkDcSitesFixture = {
    candidates: [
      baseCandidate({
        provenance: {
          sourceId: 'dc-black-history-sites',
          sourceItemId: 'p1',
          sourceCategory: 'People',
          rights: 'CC BY 4.0',
        },
      }),
    ],
  };
  const report = triageBulkDcSitesFixture({
    fixture,
    fixturePath: 'test-fixture.json',
    bytes: 100,
    catalogIndex: buildCatalogMatchIndex([]),
    now: '2026-07-21T00:00:00.000Z',
  });
  assert.equal(report.dispositions.privacy_review, 1);
  assert.equal(report.counts.peopleCategory, 1);
});

test('triageBulkDcSitesFixture detects catalog_enrich when name matches', () => {
  const fixture: BulkDcSitesFixture = {
    candidates: [
      baseCandidate({
        displayName: 'Howard University',
        id: 'dc-black-history-sites-hu',
      }),
    ],
  };
  const index = buildCatalogMatchIndex([
    { id: 'ent_howard_university_001', displayName: 'Howard University', aliases: [] },
  ]);
  const report = triageBulkDcSitesFixture({
    fixture,
    fixturePath: 'test-fixture.json',
    bytes: 100,
    catalogIndex: index,
    now: '2026-07-21T00:00:00.000Z',
  });
  assert.equal(report.dispositions.catalog_enrich, 1);
});
