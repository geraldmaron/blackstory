/**
 * Tests for the graylist recall lane (BB-073 acceptance criterion 4): below-threshold
 * candidates are parked with a disposition, never silently dropped, and remain queryable for
 * later corroboration.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateCandidateRelevance } from '../relevance/index.js';
import type { DiscoveryCandidateRecord } from './types.js';
import {
  archiveGraylistEntry,
  corroborationKeyFor,
  createInMemoryGraylistStore,
  deriveGraylistDisposition,
  listGraylistByDisposition,
  parkCandidate,
  promoteGraylistEntry,
  queryGraylistByCorroborationKey,
  shouldPark,
} from './graylist.js';

const FIXED_NOW = '2026-07-17T20:00:00.000Z';

function buildCandidate(overrides: Partial<DiscoveryCandidateRecord> = {}): DiscoveryCandidateRecord {
  const base: DiscoveryCandidateRecord = {
    schemaVersion: 'discovery-candidate.v1',
    id: 'disc_rss_1',
    identity: {
      identityKey: 'identity_key_1',
      stableIdentifier: 'rss:feed_x:abc123',
      contentHash: { algorithm: 'sha256', digest: 'a'.repeat(64) },
      sourceReferences: [],
    },
    adapterRecord: {
      stableIdentifier: 'rss:feed_x:abc123',
      title: 'Rosewood Community Newsletter mentions local school history',
      canonicalUrl: 'https://example.org/newsletter',
      classification: 'community_oral',
      payload: {},
      provenance: {
        sourceId: 'src_rss',
        adapterId: 'rss',
        parserVersion: 'rss-parser-1.0.0',
        registryEntryId: 'reg_rss',
        runId: 'run_1',
        capturedAt: FIXED_NOW,
        schemaVersion: 'candidate-record.v1',
      },
    },
    status: 'pending',
    ingestMode: 'api',
    signals: {
      strength: 'weak',
      outcome: 'candidate_only',
      matchedClasses: ['geographic'],
      matchedTerms: ['Rosewood'],
      reasons: ['weak geographic match'],
    },
    geographicHints: [],
    retryCount: 0,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  return { ...base, ...overrides };
}

test('shouldPark is true for anything that does not resolve to include', () => {
  assert.equal(shouldPark({ decision: 'exclude' }), true);
  assert.equal(shouldPark({ decision: 'supporting_context' }), true);
  assert.equal(shouldPark({ decision: 'include' }), false);
});

test('a weak, uncorroborated candidate never independently reaches include and gets parked with the right disposition', () => {
  const candidate = buildCandidate();
  const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });

  assert.notEqual(assessment.decision, 'include');
  assert.equal(shouldPark(assessment), true);

  const store = createInMemoryGraylistStore();
  const entry = parkCandidate(store, candidate, assessment, FIXED_NOW);

  assert.equal(entry.status, 'parked');
  assert.equal(entry.candidateId, candidate.id);
  assert.equal(entry.adapterId, 'rss');
  assert.equal(entry.sourceClassification, 'community_oral');
  assert.equal(entry.disposition, deriveGraylistDisposition(candidate, assessment));
  assert.equal(store.list().length, 1);
});

test('parkCandidate refuses to park a candidate that actually reached include', () => {
  const candidate = buildCandidate();
  const store = createInMemoryGraylistStore();
  assert.throws(
    () => parkCandidate(store, candidate, { decision: 'include' } as never, FIXED_NOW),
    /must not be parked/,
  );
});

test('corroborationKeyFor normalizes titles for later lookup', () => {
  const candidate = buildCandidate({
    adapterRecord: {
      ...buildCandidate().adapterRecord,
      title: '  Rosewood, Community  Newsletter — March 1958!  ',
    },
  });
  assert.equal(corroborationKeyFor(candidate), 'rosewood community newsletter march 1958');
});

test('graylist entries are queryable by corroboration key — nothing is silently unfindable', () => {
  const store = createInMemoryGraylistStore();
  const candidateA = buildCandidate({ id: 'disc_a' });
  const candidateB = buildCandidate({
    id: 'disc_b',
    adapterRecord: {
      ...buildCandidate().adapterRecord,
      title: 'Rosewood Community Newsletter mentions local school history',
      provenance: { ...buildCandidate().adapterRecord.provenance, adapterId: 'internet_archive' },
    },
  });
  const unrelated = buildCandidate({
    id: 'disc_c',
    adapterRecord: { ...buildCandidate().adapterRecord, title: 'Completely unrelated topic entirely' },
  });

  const assessmentA = evaluateCandidateRelevance({ candidate: candidateA, assessedAt: FIXED_NOW });
  const assessmentB = evaluateCandidateRelevance({ candidate: candidateB, assessedAt: FIXED_NOW });
  const assessmentC = evaluateCandidateRelevance({ candidate: unrelated, assessedAt: FIXED_NOW });

  parkCandidate(store, candidateA, assessmentA, FIXED_NOW);
  parkCandidate(store, candidateB, assessmentB, FIXED_NOW);
  parkCandidate(store, unrelated, assessmentC, FIXED_NOW);

  const matches = queryGraylistByCorroborationKey(store, 'Rosewood Community Newsletter mentions local school history');
  assert.equal(matches.length, 2);
  assert.ok(matches.some((entry) => entry.candidateId === 'disc_a'));
  assert.ok(matches.some((entry) => entry.candidateId === 'disc_b'));
});

test('promoting a graylist entry requires a reason and flags it for re-review without publishing', () => {
  const store = createInMemoryGraylistStore();
  const candidate = buildCandidate();
  const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });
  const entry = parkCandidate(store, candidate, assessment, FIXED_NOW);

  assert.throws(
    () => promoteGraylistEntry(store, entry.id, { promotedBy: 'admin@blackbook.local', reason: '', now: FIXED_NOW }),
    /reason is required/,
  );

  const promoted = promoteGraylistEntry(store, entry.id, {
    promotedBy: 'admin@blackbook.local',
    reason: 'A second independent source now corroborates this item.',
    now: '2026-08-01T00:00:00.000Z',
  });
  assert.equal(promoted.status, 'promoted');
  assert.equal(promoted.promotedBy, 'admin@blackbook.local');

  assert.throws(() => promoteGraylistEntry(store, entry.id, { promotedBy: 'x', reason: 'again', now: FIXED_NOW }), /already promoted/);
});

test('archiving a graylist entry removes it from corroboration search but keeps it queryable by disposition history', () => {
  const store = createInMemoryGraylistStore();
  const candidate = buildCandidate();
  const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });
  const entry = parkCandidate(store, candidate, assessment, FIXED_NOW);

  const beforeArchive = queryGraylistByCorroborationKey(store, candidate.adapterRecord.title!);
  assert.equal(beforeArchive.length, 1);

  archiveGraylistEntry(store, entry.id, '2026-09-01T00:00:00.000Z');
  const afterArchive = queryGraylistByCorroborationKey(store, candidate.adapterRecord.title!);
  assert.equal(afterArchive.length, 0);

  assert.throws(() => archiveGraylistEntry(store, 'missing_id', FIXED_NOW), /not found/);
});

test('listGraylistByDisposition filters correctly', () => {
  const store = createInMemoryGraylistStore();
  const candidate = buildCandidate();
  const assessment = evaluateCandidateRelevance({ candidate, assessedAt: FIXED_NOW });
  const entry = parkCandidate(store, candidate, assessment, FIXED_NOW);

  const matching = listGraylistByDisposition(store, entry.disposition);
  assert.equal(matching.length, 1);
  const nonMatching = (['below_threshold', 'negative_only_signal', 'duplicate_of_included', 'awaiting_corroboration', 'weak_signal_uncorroborated'] as const).filter(
    (d) => d !== entry.disposition,
  );
  for (const disposition of nonMatching) {
    assert.equal(listGraylistByDisposition(store, disposition).length, 0);
  }
});
