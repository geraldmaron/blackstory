/**
 * Domain tests for the UGC compliance and living-person ethics layer: per-source
 * obligations registry, evidence-pointer doctrine, deletion-sync framework, living-person
 * UGC guards, and takedown routing.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyDeletionSyncPurge,
  assertAdapterHasObligations,
  assertEvidencePointerValid,
  assertNoCrossSourceProfileAggregation,
  assertNoDeanonymization,
  assertNoFullPageFields,
  assertTakedownReasonValid,
  assertUgcLivingPersonClaimMayAdvance,
  buildEvidencePointer,
  buildTakedownRequestRecord,
  createInMemoryObligationsRegistry,
  defaultSourceObligationsSeed,
  getSourceObligationsOrThrow,
  hasSourceObligationsEntry,
  MAX_EVIDENCE_SNIPPET_CHARACTERS,
  planDeletionSyncPurge,
  registerSourceObligations,
  TAKEDOWN_ACKNOWLEDGEMENT_SLA_HOURS,
  TAKEDOWN_RESOLUTION_SLA_DAYS,
} from './index.js';

const SEED_AT = '2026-07-17T00:00:00.000Z';

// --- Per-source obligations registry (fail-closed, pattern) -------------------------

test('obligations registry rejects lookups for an unregistered source (fail-closed)', () => {
  const store = createInMemoryObligationsRegistry();
  assert.throws(() => getSourceObligationsOrThrow(store, 'unknown-adapter'), /no registered obligations entry/);
  assert.throws(() => assertAdapterHasObligations(store, 'unknown-adapter'));
  assert.equal(hasSourceObligationsEntry(store, 'unknown-adapter'), false);
});

test('default obligations seed covers Reddit, Brave, Exa, RSS, Internet Archive, and DPLA', () => {
  const store = createInMemoryObligationsRegistry(defaultSourceObligationsSeed(SEED_AT));

  const reddit = getSourceObligationsOrThrow(store, 'reddit');
  assert.equal(reddit.deletionSync.required, true);
  assert.equal(reddit.deletionSync.maxHours, 48);
  assert.equal(reddit.deletionSync.contractual, true);
  assert.equal(reddit.republicationProhibited, true);
  assert.equal(reddit.mlTrainingProhibited, true);

  const brave = getSourceObligationsOrThrow(store, 'brave_search');
  assert.equal(brave.storageRightsTierRequired, true);
  const exa = getSourceObligationsOrThrow(store, 'exa_search');
  assert.equal(exa.storageRightsTierRequired, true);

  for (const adapterId of ['rss', 'internet_archive', 'dpla']) {
    const entry = getSourceObligationsOrThrow(store, adapterId);
    assert.equal(entry.attributionRequired, true);
    assert.equal(entry.livenessRecheckRequired, true);
  }

  assert.throws(() => getSourceObligationsOrThrow(store, 'mystery_adapter'));
});

test('registering a duplicate obligations entry is rejected', () => {
  const store = createInMemoryObligationsRegistry();
  const [reddit] = defaultSourceObligationsSeed(SEED_AT);
  registerSourceObligations(store, reddit!);
  assert.throws(() => registerSourceObligations(store, reddit!), /already exists/);
});

// --- Evidence-pointer doctrine --------------------------------------------------------------

const RETRIEVAL = { retrievedAt: SEED_AT, adapterId: 'rss' };

test('a well-formed evidence pointer is accepted', () => {
  const pointer = buildEvidencePointer({
    id: 'ep-1',
    sourceUrl: 'https://example.com/article',
    snippet: 'A short excerpt describing the relevant fact in one or two sentences.',
    waybackCaptureUrl: 'https://web.archive.org/web/20260101000000/https://example.com/article',
    retrieval: RETRIEVAL,
    createdAt: SEED_AT,
  });
  assert.equal(pointer.sourceUrl, 'https://example.com/article');
  assert.ok(pointer.snippet.length <= MAX_EVIDENCE_SNIPPET_CHARACTERS);
});

test('a full-page-length snippet is rejected', () => {
  const fullPageSnippet = 'This sentence repeats far past the doctrine cap. '.repeat(20);
  assert.throws(
    () =>
      assertEvidencePointerValid({
        sourceUrl: 'https://example.com/article',
        snippet: fullPageSnippet,
        waybackCaptureUrl: 'https://web.archive.org/web/20260101000000/https://example.com/article',
      }),
    /exceeds .* characters/,
  );
});

test('a missing Wayback capture pointer is rejected', () => {
  assert.throws(
    () =>
      assertEvidencePointerValid({
        sourceUrl: 'https://example.com/article',
        snippet: 'A short excerpt.',
        waybackCaptureUrl: 'https://example.com/not-a-wayback-url',
      }),
    /Wayback/,
  );
});

test('a non-https source URL is rejected', () => {
  assert.throws(() =>
    assertEvidencePointerValid({
      sourceUrl: 'http://example.com/article',
      snippet: 'A short excerpt.',
      waybackCaptureUrl: 'https://web.archive.org/web/20260101000000/https://example.com/article',
    }),
  );
});

test('a full-page body field is rejected even alongside otherwise-valid fields', () => {
  assert.throws(
    () =>
      assertNoFullPageFields({
        sourceUrl: 'https://example.com/article',
        snippet: 'A short excerpt.',
        html: '<html>...entire page...</html>',
      }),
    /full-page field/,
  );
});

// --- Deletion-sync framework -----------------------------------------------------------------

test('a deletion-sync purge removes cascade content but the audit-of-deletion record survives without content', () => {
  const store = new Map<string, unknown>([
    ['submissionQuarantine/q1', { statement: 'sensitive user content that must be purged' }],
    ['graylist/g1', { note: 'graylisted UGC content' }],
    ['researchCases/case1/attachments/a1', { body: 'attachment content' }],
  ]);

  const plan = planDeletionSyncPurge({
    sourceId: 'reddit-source-1',
    adapterId: 'reddit',
    reason: 'reddit_contractual_deletion_sync',
    correlationId: 'corr-1',
    requestedAt: SEED_AT,
    actor: { id: 'scheduler', type: 'service' },
    cascadeTargets: [
      { kind: 'quarantine', path: 'submissionQuarantine/q1', id: 'q1' },
      { kind: 'graylist', path: 'graylist/g1', id: 'g1' },
      { kind: 'research_case_attachment', path: 'researchCases/case1/attachments/a1', id: 'a1' },
    ],
  });

  applyDeletionSyncPurge({ delete: (path) => store.delete(path) }, plan);

  assert.equal(store.size, 0);
  assert.equal(plan.record.sourceId, 'reddit-source-1');
  assert.equal(plan.record.reason, 'reddit_contractual_deletion_sync');
  assert.equal(plan.record.correlationId, 'corr-1');
  assert.equal(plan.record.purgedTargetCount, 3);
  assert.equal(plan.auditEvent.action, 'deletion.purged');
  assert.equal(plan.auditEvent.category, 'deletion');

  const serializedRecord = JSON.stringify(plan.record);
  const serializedAudit = JSON.stringify(plan.auditEvent);
  assert.equal(serializedRecord.includes('sensitive user content'), false);
  assert.equal(serializedAudit.includes('sensitive user content'), false);
});

test('a deletion-sync purge requires at least one cascade target', () => {
  assert.throws(() =>
    planDeletionSyncPurge({
      sourceId: 'reddit-source-1',
      adapterId: 'reddit',
      reason: 'reddit_contractual_deletion_sync',
      correlationId: 'corr-2',
      requestedAt: SEED_AT,
      actor: { id: 'scheduler', type: 'service' },
      cascadeTargets: [],
    }),
  );
});

// --- Living-person UGC ethics ------------------------------------------------------------------

test('cross-source aggregation of the same living-person personal-detail field is rejected', () => {
  assert.throws(
    () =>
      assertNoCrossSourceProfileAggregation('living', [
        { field: 'employer', sourceId: 'reddit', evidenceId: 'ev-1' },
        { field: 'employer', sourceId: 'rss', evidenceId: 'ev-2' },
      ]),
    /Cross-source aggregation is prohibited/,
  );
});

test('a single-source personal-detail field is allowed for a living person', () => {
  assert.doesNotThrow(() =>
    assertNoCrossSourceProfileAggregation('living', [
      { field: 'employer', sourceId: 'reddit', evidenceId: 'ev-1' },
      { field: 'employer', sourceId: 'reddit', evidenceId: 'ev-2' },
    ]),
  );
});

test('cross-source aggregation is not blocked for a deceased subject', () => {
  assert.doesNotThrow(() =>
    assertNoCrossSourceProfileAggregation('deceased', [
      { field: 'employer', sourceId: 'reddit', evidenceId: 'ev-1' },
      { field: 'employer', sourceId: 'rss', evidenceId: 'ev-2' },
    ]),
  );
});

test('a UGC-derived claim about a living person below the high-impact tier is rejected', () => {
  assert.throws(
    () =>
      assertUgcLivingPersonClaimMayAdvance({
        livingStatus: 'living',
        isUgcDerived: true,
        confidenceScore: 0.8,
      }),
    /requires confidence >= 0\.9/,
  );
});

test('a UGC-derived claim about a living person at or above the high-impact tier advances', () => {
  assert.doesNotThrow(() =>
    assertUgcLivingPersonClaimMayAdvance({
      livingStatus: 'living',
      isUgcDerived: true,
      confidenceScore: 0.92,
    }),
  );
});

test('the elevated threshold does not apply to non-UGC or non-living claims', () => {
  assert.doesNotThrow(() =>
    assertUgcLivingPersonClaimMayAdvance({
      livingStatus: 'living',
      isUgcDerived: false,
      confidenceScore: 0.5,
    }),
  );
  assert.doesNotThrow(() =>
    assertUgcLivingPersonClaimMayAdvance({
      livingStatus: 'deceased',
      isUgcDerived: true,
      confidenceScore: 0.5,
    }),
  );
});

test('deanonymization attempts against a pseudonymous UGC subject are rejected', () => {
  assert.throws(
    () =>
      assertNoDeanonymization({
        proposedAction: 'link_reddit_username_to_real_identity',
        targetsPseudonymousOrAnonymousSubject: true,
      }),
    /Deanonymization is prohibited/,
  );
});

test('non-deanonymizing actions are unaffected', () => {
  assert.doesNotThrow(() =>
    assertNoDeanonymization({
      proposedAction: 'cite_public_byline',
      targetsPseudonymousOrAnonymousSubject: false,
    }),
  );
});

// --- Public takedown/contest routing ------------------------------------------------------------

test('an invalid takedown reason is rejected', () => {
  assert.throws(() => assertTakedownReasonValid('not_a_real_reason'), /Unknown takedown reason/);
});

test('a takedown request record computes SLA deadlines and elevated priority', () => {
  const record = buildTakedownRequestRecord(
    'td-1',
    {
      targetRecordId: 'entity-1',
      reason: 'privacy_deletion_request',
      statement: 'Please remove this record; I am the living subject.',
      assertedLivingStatus: 'living',
    },
    SEED_AT,
  );

  assert.equal(record.distinctTag, 'takedown');
  assert.equal(record.bridgeSubmissionKind, 'abuse_report');
  assert.equal(record.status, 'received');
  assert.equal(record.elevatedPriority, true);
  assert.equal(
    record.sla.acknowledgeBy,
    new Date(new Date(SEED_AT).getTime() + TAKEDOWN_ACKNOWLEDGEMENT_SLA_HOURS * 3_600_000).toISOString(),
  );
  assert.equal(
    record.sla.resolveBy,
    new Date(new Date(SEED_AT).getTime() + TAKEDOWN_RESOLUTION_SLA_DAYS * 86_400_000).toISOString(),
  );
});

test('a factual-dispute takedown is not elevated priority', () => {
  const record = buildTakedownRequestRecord(
    'td-2',
    {
      targetRecordId: 'entity-2',
      reason: 'factual_dispute',
      statement: 'This claim is factually incorrect.',
    },
    SEED_AT,
  );
  assert.equal(record.elevatedPriority, false);
});
