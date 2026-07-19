/**
 * Unit tests for the top-level evidence-card view-model builder, covering confidence language,
 * rights-limited excerpts, dispute presentation, and research-coverage metadata end to end from
 * a single claim input.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildEvidenceCard,
  buildEvidenceCards,
  mostRecentLastCheckedAt,
  resolveRecordSourceLineage,
  totalSourceLineageCount,
  uniqueCitationSourceCount,
} from './build-evidence-card';
import type { EvidenceClaimInput } from './types';

const BASE_CLAIM: EvidenceClaimInput = {
  id: 'claim_seed_001',
  predicate: 'founded_year',
  object: '1867',
  confidenceScore: 0.78,
  confidenceLevel: 'high',
  citation: {
    source: 'National Archives and Records Administration \u2014 Catalog (seed)',
    label: 'Primary archival',
    href: 'https://catalog.archives.gov/',
  },
};

test('builds an evidence-score label (AC1) distinct from probability language', () => {
  const card = buildEvidenceCard(BASE_CLAIM);
  assert.equal(card.confidenceLabel, 'Evidence score: high (0.78 of 1.00)');
  assert.doesNotMatch(card.confidenceLabel, /probability/i);
});

test('carries research coverage and source lineage as separate fields from confidence (AC2)', () => {
  const card = buildEvidenceCard({
    ...BASE_CLAIM,
    sourceLineage: { independentLineageCount: 2, supportingEvidenceCount: 3 },
    researchCoverage: { level: 'partial', lastCheckedAt: '2026-06-01T00:00:00.000Z' },
    relevanceNote: 'Documented tie to Reconstruction-era Black community history.',
    connectionStrengthNote: 'Directly named in the founding archival record.',
  });
  assert.equal(card.sourceLineage?.independentLineageCount, 2);
  assert.equal(card.researchCoverage?.level, 'partial');
  assert.equal(card.relevanceNote, 'Documented tie to Reconstruction-era Black community history.');
  assert.equal(card.connectionStrengthNote, 'Directly named in the founding archival record.');
  // None of these fields leak into the confidence label itself.
  assert.doesNotMatch(card.confidenceLabel, /partial|lineage|relevance|connection/i);
});

test('preserves a credible contradiction rather than silently resolving it (AC3)', () => {
  const card = buildEvidenceCard({
    ...BASE_CLAIM,
    dispute: {
      primaryValue: '1867',
      disputed: true,
      disputeNote: 'A credible alternate founding year (1868) is preserved.',
      alternates: [{ value: '1868', credible: true, kind: 'contradicting' }],
    },
  });
  assert.equal(card.dispute?.hasDispute, true);
  assert.equal(card.dispute?.alternates.length, 1);
});

test('withholds a citation link flagged as protected and never surfaces the underlying URL (AC4)', () => {
  const card = buildEvidenceCard({
    ...BASE_CLAIM,
    citation: {
      source: 'Living-person-sensitive capture',
      label: 'Protected source',
      href: 'https://internal.example.org/should-not-leak',
      protectedFromPublicLink: true,
    },
  });
  assert.equal(card.citation.href, undefined);
  assert.ok(card.citation.withheldReason);
  const serialized = JSON.stringify(card);
  assert.doesNotMatch(serialized, /internal\.example\.org/);
});

test('withholds a substantial excerpt lacking resolved rights (AC4)', () => {
  const card = buildEvidenceCard({
    ...BASE_CLAIM,
    excerpt: {
      text: 'A long passage that would exceed fair-use without resolved rights.',
      excerptKind: 'substantial',
      rightsStatus: 'restricted',
    },
  });
  assert.equal(card.excerpt?.visible, false);
});

test('passes through revision history and a retraction notice untouched', () => {
  const card = buildEvidenceCard({
    ...BASE_CLAIM,
    revisionHistory: [
      { id: 'rev_1', changedAt: '2026-05-01T00:00:00.000Z', changeKind: 'created', summary: 'Initial claim recorded.' },
      { id: 'rev_2', changedAt: '2026-06-01T00:00:00.000Z', changeKind: 'corrected', summary: 'Fixed a transcription error in the object value.' },
    ],
    retraction: {
      retractedAt: '2026-07-01T00:00:00.000Z',
      reason: 'Source item was later found to be a forged document.',
    },
  });
  assert.equal(card.revisionHistory.length, 2);
  assert.equal(card.retraction?.reason, 'Source item was later found to be a forged document.');
});

test('defaults revisionHistory to an empty array rather than undefined when omitted', () => {
  const card = buildEvidenceCard(BASE_CLAIM);
  assert.deepEqual(card.revisionHistory, []);
});

test('totalSourceLineageCount sums independent lineage counts across cards', () => {
  const cards = buildEvidenceCards([
    { ...BASE_CLAIM, id: 'a', sourceLineage: { independentLineageCount: 2 } },
    { ...BASE_CLAIM, id: 'b', sourceLineage: { independentLineageCount: 1 } },
    { ...BASE_CLAIM, id: 'c' },
  ]);
  assert.equal(totalSourceLineageCount(cards), 3);
});

test('uniqueCitationSourceCount counts distinct non-empty citation sources case-insensitively', () => {
  const cards = buildEvidenceCards([
    { ...BASE_CLAIM, id: 'a', citation: { source: 'National Archives', label: 'A' } },
    { ...BASE_CLAIM, id: 'b', citation: { source: ' national archives ', label: 'B' } },
    { ...BASE_CLAIM, id: 'c', citation: { source: 'Library of Congress', label: 'C' } },
  ]);
  assert.equal(uniqueCitationSourceCount(cards), 2);
});

test('resolveRecordSourceLineage prefers the sum of per-claim lineage counts', () => {
  const cards = buildEvidenceCards([
    { ...BASE_CLAIM, id: 'a', sourceLineage: { independentLineageCount: 2 } },
    { ...BASE_CLAIM, id: 'b', sourceLineage: { independentLineageCount: 1 } },
  ]);
  assert.deepEqual(resolveRecordSourceLineage(cards), { independentLineageCount: 3 });
});

test('resolveRecordSourceLineage falls back to distinct citation sources when lineage is absent', () => {
  const cards = buildEvidenceCards([
    { ...BASE_CLAIM, id: 'a', citation: { source: 'Source A', label: 'A' } },
    { ...BASE_CLAIM, id: 'b', citation: { source: 'Source B', label: 'B' } },
  ]);
  assert.deepEqual(resolveRecordSourceLineage(cards), { independentLineageCount: 2 });
});

test('resolveRecordSourceLineage returns undefined when there is no lineage or citation source signal', () => {
  const cards = buildEvidenceCards([
    { ...BASE_CLAIM, id: 'a', citation: { source: '   ', label: 'Empty' } },
  ]);
  assert.equal(resolveRecordSourceLineage(cards), undefined);
});

test('resolveRecordSourceLineage preserves an explicit zero count from the caller', () => {
  const cards = buildEvidenceCards([BASE_CLAIM]);
  assert.deepEqual(resolveRecordSourceLineage(cards, { independentLineageCount: 0 }), {
    independentLineageCount: 0,
  });
});

test('mostRecentLastCheckedAt picks the latest date across claim and coverage fields', () => {
  const cards = buildEvidenceCards([
    { ...BASE_CLAIM, id: 'a', lastCheckedAt: '2026-01-01T00:00:00.000Z' },
    { ...BASE_CLAIM, id: 'b', researchCoverage: { level: 'partial', lastCheckedAt: '2026-06-01T00:00:00.000Z' } },
  ]);
  assert.equal(mostRecentLastCheckedAt(cards), '2026-06-01T00:00:00.000Z');
});

test('mostRecentLastCheckedAt returns undefined when no card carries a date', () => {
  const cards = buildEvidenceCards([BASE_CLAIM]);
  assert.equal(mostRecentLastCheckedAt(cards), undefined);
});
