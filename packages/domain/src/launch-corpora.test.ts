/**
 * Launch-corpus vetting-record registrations.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInMemorySourceRegistry } from './adapters/registry.js';
import { assertCorpusVettedForBulkImport, createInMemoryCorpusVettingStore } from './corpus-vetting.js';
import {
  BOUNDARY_EXCLUDED_CORPUS_SLUGS,
  LAUNCH_CORPUS_SLUGS,
  buildLaunchCorpusVettingInputs,
  registerLaunchCorpora,
} from './launch-corpora.js';

const NOW = '2026-07-17T12:00:00.000Z';

test('all 7 named launch corpora are registered with a recorded license verdict', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  const records = registerLaunchCorpora(registryStore, vettingStore, {
    vettedBy: 'operator-gerald',
    vettedAt: NOW,
  });

  assert.equal(records.length, 7);
  assert.deepEqual(
    records.map((record) => record.corpus).sort(),
    [...LAUNCH_CORPUS_SLUGS].sort(),
  );
  for (const record of records) {
    assert.ok(record.licenseVerdict, `${record.corpus} must record a license verdict`);
    assert.ok(record.licenseNotes.trim().length > 0, `${record.corpus} must record license notes`);
    assert.ok(record.vettedBy, `${record.corpus} must record who vetted it`);
    assert.ok(record.vettedAt, `${record.corpus} must record when it was vetted`);
  }
});

test('Rosenwald schools is registered but marked deferred/unverified, and fails closed for bulk import', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  registerLaunchCorpora(registryStore, vettingStore, { vettedBy: 'operator-gerald', vettedAt: NOW });

  const rosenwald = vettingStore.get('rosenwald-schools');
  assert.ok(rosenwald, 'rosenwald-schools should still be registered as a vetting record');
  assert.equal(rosenwald?.licenseVerdict, 'deferred-unverified');

  assert.throws(
    () => assertCorpusVettedForBulkImport(registryStore, vettingStore, 'rosenwald-schools'),
    /not cleared for bulk import/iu,
  );
});

test('the other 6 launch corpora are cleared for bulk import', () => {
  const registryStore = createInMemorySourceRegistry();
  const vettingStore = createInMemoryCorpusVettingStore();
  registerLaunchCorpora(registryStore, vettingStore, { vettedBy: 'operator-gerald', vettedAt: NOW });

  const clearedSlugs = LAUNCH_CORPUS_SLUGS.filter((slug) => slug !== 'rosenwald-schools');
  assert.equal(clearedSlugs.length, 6);
  for (const slug of clearedSlugs) {
    assert.doesNotThrow(
      () => assertCorpusVettedForBulkImport(registryStore, vettingStore, slug),
      `${slug} should be cleared for bulk import`,
    );
  }
});

test('Mapping Inequality is onboarded with requiresPolygonGeometry and a locality precision expectation', () => {
  const inputs = buildLaunchCorpusVettingInputs({ vettedBy: 'operator-gerald', vettedAt: NOW });
  const mappingInequality = inputs.find((input) => input.corpus === 'mapping-inequality-holc');
  assert.ok(mappingInequality, 'mapping-inequality-holc must be present');
  assert.equal(mappingInequality?.requiresPolygonGeometry, true);
  assert.equal(mappingInequality?.precisionExpectation, 'locality');
  // DSL's downloadable vector dataset is CC BY-NC-SA — noncommercial, attribution required.
  // Still bulk-import eligible, but never wholly public-domain (corrected 2026-07-18).
  assert.equal(mappingInequality?.licenseVerdict, 'restricted-attribution-required');
  assert.ok(mappingInequality?.rights.prohibitedUses.includes('commercial_reuse'));
  assert.ok(mappingInequality?.boundaryNotes?.includes('BB-070'));
});

test('every launch corpus notability criterion is a valid BB-090 criterion, distinct where corpus class differs', () => {
  const inputs = buildLaunchCorpusVettingInputs({ vettedBy: 'operator-gerald', vettedAt: NOW });
  const byCorpus = new Map(inputs.map((input) => [input.corpus, input.notabilityCriterion]));
  assert.equal(byCorpus.get('nrhp'), 'landmark_or_national_register');
  assert.equal(byCorpus.get('habs-haer'), 'landmark_or_national_register');
  assert.equal(byCorpus.get('hbcu-list'), 'community_anchor');
  assert.equal(byCorpus.get('rosenwald-schools'), 'community_anchor');
  assert.equal(byCorpus.get('mapping-inequality-holc'), 'documented_site');
});

test('statutes/cases (BB-087) and Tougaloo sundown data (BB-082) are not in the launch corpus list', () => {
  const inputs = buildLaunchCorpusVettingInputs({ vettedBy: 'operator-gerald', vettedAt: NOW });
  const slugs = new Set(inputs.map((input) => input.corpus));
  for (const excluded of BOUNDARY_EXCLUDED_CORPUS_SLUGS) {
    assert.equal(slugs.has(excluded.slug), false, `${excluded.slug} (${excluded.ownerBead}) must not appear here`);
  }
  assert.equal(slugs.has('statutes'), false);
  assert.equal(slugs.has('cases'), false);
  assert.equal(slugs.has('tougaloo-sundown-data'), false);
  assert.equal(slugs.has('tougaloo'), false);
});
