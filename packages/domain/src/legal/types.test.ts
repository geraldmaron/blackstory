/**
 * Tests for legal snapshot types and validation gates.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertLegalSnapshotValid } from './types.js';
import type { LegalSnapshot } from './types.js';

const BASE_SNAPSHOT: LegalSnapshot = {
  id: 'legal-test-001',
  slug: 'test-statute',
  kind: 'federal-statute',
  title: 'Test Statute',
  jurisdictionId: 'us',
  lawStatus: 'in_force',
  topics: ['constitutional'],
  citation: {
    canonicalCitation: 'Pub. L. 88-352',
    licenseTag: 'public-domain',
    archive: {
      sourceUrl: 'https://api.congress.gov/v3/law/88/pub/352',
      archivedCaptureUrl:
        'https://web.archive.org/web/20260717000000/https://api.congress.gov/v3/law/88/pub/352',
      retrievedAt: '2026-07-17T00:00:00.000Z',
    },
  },
  externalIds: [{ source: 'congress-gov-v3', externalId: '88/pub/352' }],
};

test('a well-formed legal snapshot passes validation', () => {
  assert.doesNotThrow(() => assertLegalSnapshotValid(BASE_SNAPSHOT));
});

test('legal snapshot rejects missing archive capture', () => {
  const invalid = {
    ...BASE_SNAPSHOT,
    citation: {
      ...BASE_SNAPSHOT.citation,
      archive: { ...BASE_SNAPSHOT.citation.archive, archivedCaptureUrl: '' },
    },
  };
  assert.throws(() => assertLegalSnapshotValid(invalid), /archivedCaptureUrl/);
});

test('legal snapshot rejects unknown topics', () => {
  const invalid = { ...BASE_SNAPSHOT, topics: ['unknown-topic'] as never };
  assert.throws(() => assertLegalSnapshotValid(invalid), /topic/);
});
