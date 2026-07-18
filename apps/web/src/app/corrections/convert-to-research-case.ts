/**
 * Typed admin hook to convert an accepted correction quarantine record into a 
 * draft research case. Operators invoke this from the admin console or CLI after reviewing the
 * quarantined submission it never writes canonical records or changes public confidence.
 *
 * Documented operator path:
 * 1. Locate the quarantined submission in `submissionInbox` (receipt code lookup is public-only;
 * operators use admin tooling with submission id).
 * 2. Call `prepareCorrectionResearchCaseConversion(submissionId, store, context)`.
 * 3. Persist returned `researchCase` via the existing research-case create gate.
 */
import { randomUUID } from 'node:crypto';
import { createResearchCase, type ResearchCaseRecord } from '@blap/domain';
import type { CorrectionSubmissionStore } from './store';

export type CorrectionResearchCaseActor = {
  readonly actorId: string;
  readonly role: 'admin' | 'moderator';
};

export type CorrectionResearchCaseConversionContext = {
  readonly actor: CorrectionResearchCaseActor;
  readonly privacyPepper: string;
  readonly now?: string;
  readonly caseTitle?: string;
};

export type CorrectionResearchCaseConversion = {
  readonly submissionId: string;
  readonly receiptCode: string;
  readonly researchCase: ResearchCaseRecord;
  readonly operatorNote: string;
};

export type CorrectionResearchCaseConversionError =
  | { readonly error: 'not_found' }
  | { readonly error: 'not_eligible'; readonly reason: string };

export function prepareCorrectionResearchCaseConversion(
  submissionId: string,
  store: CorrectionSubmissionStore,
  context: CorrectionResearchCaseConversionContext,
): CorrectionResearchCaseConversion | CorrectionResearchCaseConversionError {
  if (context.actor.role !== 'admin' && context.actor.role !== 'moderator') {
    return { error: 'not_eligible', reason: 'Moderator authorization required.' };
  }

  const stored = store.getBySubmissionId(submissionId);
  if (!stored) {
    return { error: 'not_found' };
  }
  if (stored.record.destination !== 'submission_quarantine' || stored.record.canonicalWriteAllowed) {
    return { error: 'not_eligible', reason: 'Only quarantine-only correction records can convert.' };
  }
  if (stored.record.moderationState === 'coordinated_campaign') {
    return {
      error: 'not_eligible',
      reason: 'Coordinated campaign submissions require manual triage before research conversion.',
    };
  }

  const now = context.now ?? new Date().toISOString();
  const caseId = randomUUID();
  const researchCase = createResearchCase({
    id: caseId,
    candidateId: submissionId,
    title: context.caseTitle ?? stored.record.normalized.title,
    checklist: { items: [] },
    now,
  });

  return {
    submissionId,
    receiptCode: stored.receiptCode,
    researchCase,
    operatorNote: `Research case ${caseId} opened from correction ${submissionId} by ${context.actor.actorId}.`,
  };
}
