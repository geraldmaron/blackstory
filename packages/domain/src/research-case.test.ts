/**
 * Verifies research-case states, evidence gates, queues, previews, promotion,
 * exclusion reconsideration, replacement-release retraction, and backfill scheduling.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RelevanceAssessment } from './relevance/index.js';
import {
  assignResearchCase,
  buildResearchCasePreview,
  createResearchCase,
  evaluateEvidenceChecklist,
  markResearchCasePublished,
  prepareResearchCasePromotion,
  retractResearchCase,
  routeResearchCaseQueue,
  scheduleResearchCaseBackfill,
  transitionResearchCase,
  type EvidenceChecklist,
  type EvidenceChecklistKey,
  type ResearchCaseRecord,
} from './research-case/index.js';

const NOW = '2026-07-17T04:00:00.000Z';
const LATER = '2026-07-18T04:00:00.000Z';

const ALL_KEYS: readonly EvidenceChecklistKey[] = [
  'identity',
  'relevance_assessment',
  'source_citation',
  'public_summary',
  'rights_clearance',
  'dates',
  'geography',
  'corroboration',
  'contradiction_search',
  'historical_context',
];

function checklist(completed: readonly EvidenceChecklistKey[]): EvidenceChecklist {
  const done = new Set(completed);
  return {
    items: ALL_KEYS.map((key) => ({
      key,
      complete: done.has(key),
      evidenceIds: done.has(key) ? [`evidence-${key}`] : [],
    })),
  };
}

const MINIMUM: readonly EvidenceChecklistKey[] = [
  'identity',
  'relevance_assessment',
  'source_citation',
  'public_summary',
  'rights_clearance',
];

function assessment(decision: RelevanceAssessment['decision'] = 'include'): RelevanceAssessment {
  return {
    schemaVersion: 'relevance-assessment.v1',
    candidateId: 'candidate-1',
    decision,
    compositeScore: 0.9,
    policyVersion: '1.0.0',
    passes: decision !== 'exclude',
    featureValues: [],
    gates: [],
    evidence: [],
    whyThisAppears: 'The candidate has a directly relevant documented signal.',
    distinctivenessKey: 'distinct-1',
    isDuplicate: false,
    assessedAt: NOW,
  };
}

function candidate(caseChecklist: EvidenceChecklist = checklist([])): ResearchCaseRecord {
  return createResearchCase({
    id: 'case-1',
    candidateId: 'candidate-1',
    title: 'Sparse research case',
    checklist: caseChecklist,
    now: NOW,
  });
}

function minimumRecord(): ResearchCaseRecord {
  const review = transitionResearchCase(candidate(checklist(MINIMUM)), {
    targetState: 'relevance_review',
    actorId: 'researcher-1',
    now: NOW,
    reasonCode: 'new_evidence_received',
    reason: 'Candidate entered relevance review.',
  });
  const confirmed = transitionResearchCase(review, {
    targetState: 'relevance_confirmed',
    actorId: 'researcher-1',
    now: NOW,
    reasonCode: 'relevance_confirmed',
    reason: 'The relevance assessment passed.',
    relevanceAssessment: assessment(),
  });
  return transitionResearchCase(confirmed, {
    targetState: 'minimum_record',
    actorId: 'researcher-1',
    now: NOW,
    reasonCode: 'minimum_record_complete',
    reason: 'All minimum publication fields are supported.',
  });
}

test('state machine rejects skips and requires a passing relevance decision', () => {
  const record = candidate();
  assert.throws(
    () =>
      transitionResearchCase(record, {
        targetState: 'minimum_record',
        actorId: 'researcher-1',
        now: NOW,
        reasonCode: 'minimum_record_complete',
        reason: 'Attempted skip.',
      }),
    /cannot transition/,
  );

  const review = transitionResearchCase(record, {
    targetState: 'relevance_review',
    actorId: 'researcher-1',
    now: NOW,
    reasonCode: 'new_evidence_received',
    reason: 'Review started.',
  });
  assert.throws(
    () =>
      transitionResearchCase(review, {
        targetState: 'relevance_confirmed',
        actorId: 'researcher-1',
        now: NOW,
        reasonCode: 'relevance_confirmed',
        reason: 'Invalid confirmation.',
        relevanceAssessment: assessment('exclude'),
      }),
    /passing non-excluded/,
  );
});

test('minimum record is publishable without optional enrichment', () => {
  const record = minimumRecord();
  const evaluation = evaluateEvidenceChecklist(record.checklist);
  const promotion = prepareResearchCasePromotion({
    record,
    currentClaims: [],
    candidateClaims: [
      {
        claimId: 'claim-1',
        claimVersionId: 'claim-v1',
        entityId: 'entity-1',
        predicate: 'documented',
        object: 'yes',
        proceduralStatus: 'reported',
      },
    ],
  });

  assert.equal(evaluation.level, 'minimum');
  assert.equal(evaluation.meetsMinimumRecord, true);
  assert.equal(promotion.eligible, true);
  assert.equal(promotion.preview.claims.counts.added, 1);

  const published = markResearchCasePublished(record, {
    releaseId: 'release-1',
    revision: 'revision-1',
    publishedAt: NOW,
  });
  assert.equal(published.publication?.releaseId, 'release-1');
});

test('partial and substantial enrichment require matching evidence completeness', () => {
  const minimum = minimumRecord();
  const partial = transitionResearchCase(minimum, {
    targetState: 'partial_enrichment',
    actorId: 'researcher-1',
    now: LATER,
    reasonCode: 'partial_enrichment_complete',
    reason: 'Date evidence was added.',
    checklist: checklist([...MINIMUM, 'dates']),
    evidenceIds: ['evidence-dates'],
  });
  const substantial = transitionResearchCase(partial, {
    targetState: 'substantial_enrichment',
    actorId: 'researcher-1',
    now: LATER,
    reasonCode: 'substantial_enrichment_complete',
    reason: 'All optional enrichment is complete.',
    checklist: checklist(ALL_KEYS),
  });
  assert.equal(partial.state, 'partial_enrichment');
  assert.equal(substantial.state, 'substantial_enrichment');
});

test('excluded reason remains in history and reconsideration requires new evidence', () => {
  const review = transitionResearchCase(candidate(), {
    targetState: 'relevance_review',
    actorId: 'researcher-1',
    now: NOW,
    reasonCode: 'new_evidence_received',
    reason: 'Review started.',
  });
  const excluded = transitionResearchCase(review, {
    targetState: 'excluded',
    actorId: 'researcher-1',
    now: NOW,
    reasonCode: 'outside_scope',
    reason: 'The available evidence is outside the defined scope.',
  });

  assert.throws(
    () =>
      transitionResearchCase(excluded, {
        targetState: 'relevance_review',
        actorId: 'researcher-2',
        now: LATER,
        reasonCode: 'new_evidence_received',
        reason: 'Reconsider.',
      }),
    /new evidence/,
  );

  const reconsidered = transitionResearchCase(excluded, {
    targetState: 'relevance_review',
    actorId: 'researcher-2',
    now: LATER,
    reasonCode: 'new_evidence_received',
    reason: 'A newly discovered archive supports reconsideration.',
    evidenceIds: ['archive-2'],
  });
  assert.equal(reconsidered.history[1]?.reasonCode, 'outside_scope');
  assert.equal(reconsidered.history[2]?.reasonCode, 'new_evidence_received');
});

test('queues and assignment route work without assigning merged cases', () => {
  const record = minimumRecord();
  assert.equal(routeResearchCaseQueue(record), 'publication');
  const assigned = assignResearchCase(record, {
    reviewerId: 'publisher-1',
    assignedBy: 'research-lead-1',
    assignedAt: LATER,
    priority: 'high',
  });
  assert.equal(assigned.assignment?.queue, 'publication');

  const merged = transitionResearchCase(record, {
    targetState: 'merged',
    actorId: 'researcher-1',
    now: LATER,
    reasonCode: 'merged_duplicate',
    reason: 'The records identify the same research subject.',
    mergedIntoCaseId: 'case-2',
  });
  assert.equal(routeResearchCaseQueue(merged), null);
  assert.throws(
    () =>
      assignResearchCase(merged, {
        reviewerId: 'researcher-2',
        assignedBy: 'research-lead-1',
        assignedAt: LATER,
        priority: 'low',
      }),
    /cannot be assigned/,
  );
});

test('preview reports deterministic claim changes', () => {
  const record = minimumRecord();
  const original = {
    claimId: 'claim-1',
    claimVersionId: 'v1',
    entityId: 'entity-1',
    predicate: 'status',
    object: 'old',
    proceduralStatus: 'reported',
  };
  const preview = buildResearchCasePreview({
    record,
    currentClaims: [original],
    candidateClaims: [{ ...original, claimVersionId: 'v2', object: 'new' }],
  });
  assert.equal(preview.publishable, true);
  assert.equal(preview.claims.counts.changed, 1);
});

test('retraction creates a replacement release that omits content and retains history', () => {
  const published = markResearchCasePublished(minimumRecord(), {
    releaseId: 'release-1',
    revision: 'revision-1',
    publishedAt: NOW,
  });
  const plan = retractResearchCase({
    record: published,
    entityId: 'entity-1',
    replacementReleaseId: 'release-2',
    searchIndexVersion: 'search-2',
    remainingArtifacts: [
      {
        entityId: 'entity-2',
        revision: 'revision-2',
        projection: { id: 'entity-2' },
        snapshot: { id: 'entity-2', title: 'Unaffected record' },
      },
    ],
    actorId: 'publisher-1',
    now: LATER,
    reasonCode: 'material_correction',
    reason: 'The published record requires a material correction.',
  });

  assert.equal(plan.case.state, 'retracted');
  assert.equal(plan.priorReleaseId, 'release-1');
  assert.equal(plan.replacementManifest.releaseId, 'release-2');
  assert.deepEqual(
    plan.replacementManifest.entries.map((entry) => entry.entityId),
    ['entity-2'],
  );
  assert.equal(plan.case.publication?.releaseId, 'release-1');
  assert.equal(plan.case.retraction?.replacementReleaseId, 'release-2');
});

test('retraction rejects replacement releases that still contain the entity', () => {
  const published = markResearchCasePublished(minimumRecord(), {
    releaseId: 'release-1',
    revision: 'revision-1',
    publishedAt: NOW,
  });
  assert.throws(
    () =>
      retractResearchCase({
        record: published,
        entityId: 'entity-1',
        replacementReleaseId: 'release-2',
        searchIndexVersion: 'search-2',
        remainingArtifacts: [
          {
            entityId: 'entity-1',
            revision: 'revision-1',
            projection: { id: 'entity-1' },
            snapshot: { id: 'entity-1' },
          },
        ],
        actorId: 'publisher-1',
        now: LATER,
        reasonCode: 'publication_error',
        reason: 'The release contains a publication error.',
      }),
    /must omit/,
  );
});

test('backfill schedules only missing enrichment for sparse published records', () => {
  const job = scheduleResearchCaseBackfill({
    id: 'backfill-1',
    record: minimumRecord(),
    scheduledFor: LATER,
    scheduledBy: 'research-lead-1',
    priority: 'normal',
    now: NOW,
  });
  assert.deepEqual(job.missingFields, [
    'dates',
    'geography',
    'corroboration',
    'contradiction_search',
    'historical_context',
  ]);
});
