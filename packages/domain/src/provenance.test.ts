/**
 * Domain tests for sources, captures, rights gates, hash dedup, and lineage.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertEvidenceMayPublish,
  assertEvidenceRecordValid,
  assertEvidenceResolvesToSourceItem,
  assertEvidenceSourceValid,
  assertLineageEndpointsDistinct,
  assertRightsStatusForPublication,
  assertSourceAdapterCanCreateCandidates,
  assertSourceClassification,
  buildCaptureAfterDedup,
  canPublishWithRights,
  canSourceAdapterCreateCandidates,
  deduplicateCaptureByHash,
  hashUtf8,
  normalizeHostname,
  resolveLineageRoot,
  sourceClassifications,
  type EvidenceRecord,
  type EvidenceSource,
} from './index.ts';

const FIXED_NOW = '2026-07-16T20:00:00.000Z';

function sampleSource(overrides: Partial<EvidenceSource> = {}): EvidenceSource {
  return {
    id: 'src_nara',
    organizationId: 'org_nara',
    displayName: 'NARA Catalog',
    classification: 'primary_archival',
    adapterId: 'nara-catalog-v1',
    stableIdScheme: 'nara-naid',
    policy: {
      snapshotMode: 'selective',
      rights: {
        defaultStatus: 'public_domain',
        publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt', 'display_media'],
        prohibitedUses: ['biometric_extraction'],
      },
    },
    adapterEnabled: true,
    killSwitchId: 'source-adapter-nara-catalog-v1',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

test('constitution source classifications are available', () => {
  assert.ok(sourceClassifications().includes('primary_archival'));
  assert.doesNotThrow(() => assertSourceClassification('government_record'));
  assert.throws(() => assertSourceClassification('not_a_class'), /Unknown source classification/);
});

test('every evidence record must resolve to a source item', () => {
  assert.doesNotThrow(() => assertEvidenceResolvesToSourceItem({ sourceItemId: 'sitm_1' }));
  assert.throws(() => assertEvidenceResolvesToSourceItem({ sourceItemId: '' }), /source item/);
  assert.throws(() => assertEvidenceResolvesToSourceItem({ sourceItemId: '   ' }), /source item/);
});

test('rights status is required before publishing media or substantial excerpts', () => {
  assert.throws(
    () =>
      assertRightsStatusForPublication({
        rightsStatus: 'unknown',
        contentKind: 'media',
      }),
    /resolved rights required/,
  );
  assert.throws(
    () =>
      assertRightsStatusForPublication({
        rightsStatus: 'unknown',
        contentKind: 'substantial_excerpt',
      }),
    /resolved rights required/,
  );
  assert.doesNotThrow(() =>
    assertRightsStatusForPublication({
      rightsStatus: 'public_domain',
      contentKind: 'media',
      publicationPermissions: ['display_media'],
    }),
  );
  assert.equal(canPublishWithRights({ rightsStatus: 'unknown', contentKind: 'citation' }), true);
});

test('evidence may-publish gate blocks restricted media', () => {
  const evidence: Pick<
    EvidenceRecord,
    'rightsStatus' | 'publicationPermissions' | 'prohibitedUses' | 'excerptKind' | 'storageObject'
  > = {
    rightsStatus: 'restricted',
    publicationPermissions: ['cite'],
    prohibitedUses: [],
    excerptKind: 'none',
    storageObject: 'gs://bucket/media.jpg',
  };
  assert.throws(() => assertEvidenceMayPublish(evidence), /restricted/);
});

test('source snapshots are selective rather than automatic', () => {
  assert.doesNotThrow(() =>
    assertEvidenceSourceValid({
      classification: 'primary_archival',
      policy: {
        snapshotMode: 'selective',
        rights: {
          defaultStatus: 'public_domain',
          publicationPermissions: ['cite'],
          prohibitedUses: [],
        },
      },
    }),
  );
  const capture = buildCaptureAfterDedup({
    id: 'cap_1',
    sourceItemId: 'sitm_1',
    sourceId: 'src_1',
    contentHash: hashUtf8('payload'),
    parserVersion: 'parser-1.0.0',
    retrievedAt: FIXED_NOW,
    createdAt: FIXED_NOW,
    snapshotMode: 'selective',
    snapshotStorageObject: 'gs://bucket/snap.pdf',
  });
  assert.equal(capture.snapshotMode, 'selective');
  assert.equal(capture.snapshotStorageObject, 'gs://bucket/snap.pdf');
});

test('duplicate captures are hash-deduplicated', () => {
  const hash = hashUtf8('identical-body');
  const first = { id: 'cap_a', contentHash: hash };
  const result = deduplicateCaptureByHash([first], hash);
  assert.equal(result.kind, 'duplicate');
  if (result.kind === 'duplicate') {
    assert.equal(result.existingCaptureId, 'cap_a');
  }
  const fresh = deduplicateCaptureByHash([first], hashUtf8('other-body'));
  assert.equal(fresh.kind, 'new');

  const dupCapture = buildCaptureAfterDedup({
    id: 'cap_b',
    sourceItemId: 'sitm_1',
    sourceId: 'src_1',
    contentHash: hash,
    parserVersion: 'parser-1.0.0',
    retrievedAt: FIXED_NOW,
    createdAt: FIXED_NOW,
    snapshotMode: 'selective',
    snapshotStorageObject: 'gs://bucket/should-not-store',
    dedupOfCaptureId: 'cap_a',
  });
  assert.equal(dupCapture.dedupOfCaptureId, 'cap_a');
  assert.equal(dupCapture.snapshotMode, 'none');
  assert.equal(dupCapture.snapshotStorageObject, undefined);
});

test('disabled source adapter cannot create new candidates', () => {
  const enabled = sampleSource();
  assert.equal(
    canSourceAdapterCreateCandidates(enabled, { id: enabled.killSwitchId!, enabled: false }),
    true,
  );

  const disabled = sampleSource({ adapterEnabled: false });
  assert.equal(canSourceAdapterCreateCandidates(disabled), false);
  assert.throws(() => assertSourceAdapterCanCreateCandidates(disabled), /cannot create candidates/);

  const killEngaged = sampleSource();
  assert.equal(
    canSourceAdapterCreateCandidates(killEngaged, { id: killEngaged.killSwitchId!, enabled: true }),
    false,
  );
});

test('hostname normalization and lineage root resolution', () => {
  assert.equal(normalizeHostname('https://Archives.GOV/path'), 'archives.gov');
  assert.throws(() => normalizeHostname('localhost'), /invalid/);

  assert.equal(resolveLineageRoot({ id: 'ev_root' }), 'ev_root');
  assert.equal(
    resolveLineageRoot(
      { id: 'ev_child', syndicatedFromEvidenceId: 'ev_parent' },
      { id: 'ev_parent' },
    ),
    'ev_parent',
  );
  assert.doesNotThrow(() =>
    assertLineageEndpointsDistinct({ fromEvidenceId: 'a', toEvidenceId: 'b' }),
  );
  assert.throws(
    () => assertLineageEndpointsDistinct({ fromEvidenceId: 'a', toEvidenceId: 'a' }),
    /distinct/,
  );
});

test('evidence record validation ties excerpt kind to excerpt text', () => {
  assert.doesNotThrow(() =>
    assertEvidenceRecordValid({
      sourceItemId: 'sitm_1',
      excerptKind: 'short',
      excerpt: 'A short quote.',
      rightsStatus: 'licensed',
    }),
  );
  assert.throws(
    () =>
      assertEvidenceRecordValid({
        sourceItemId: 'sitm_1',
        excerptKind: 'substantial',
        rightsStatus: 'licensed',
      }),
    /requires an excerpt/,
  );
});
