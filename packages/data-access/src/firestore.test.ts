/**
 * Unit tests for Firestore access guards (ADR-011 primary path).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIRESTORE_COLLECTIONS, assertNotResearchPublish, assertStaffMayPublish } from './index.ts';

test('firestore root collections cover required boundaries', () => {
  for (const name of [
    'policy',
    'researchCases',
    'canonicalEntities',
    'evidenceRecords',
    'publicationReleases',
    'publicMeta',
    'publicReleases',
    'submissionInbox',
    'auditEvents',
    'killSwitches',
  ]) {
    assert.ok((FIRESTORE_COLLECTIONS as readonly string[]).includes(name));
  }
});

test('research cannot publish', () => {
  assert.throws(() => assertStaffMayPublish({ research: true, bb_role: 'research' }));
  assert.throws(() => assertNotResearchPublish({ research: true }));
  assert.doesNotThrow(() => assertStaffMayPublish({ publication: true }));
  assert.doesNotThrow(() => assertStaffMayPublish({ admin: true }));
});
