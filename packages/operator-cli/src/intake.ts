/**
 * Core operator-proposal intake: submit a lead, register a source, or attach evidence.
 *
 * Every operation in this file lands in the *existing* BB-029 submission-quarantine pipeline
 * (`createQuarantinedSubmission` from `@black-book/security`) and, for leads, opens a real
 * BB-044 draft research case (`createResearchCase` from `@black-book/domain`). Nothing here
 * writes a canonical record, touches `evidenceSources`, mutates a research-case checklist, or
 * evaluates a promotion gate — see `../docs` in the repo root (`docs/runbooks/operator-session.md`)
 * and `promotion-boundary.test.ts` for the boundary this module cannot cross.
 *
 * "Register a source" does not write directly to the `evidenceSources` registry (BB-016):
 * enabling a source affects automated candidate generation and is gated by the source-registry
 * workflow, not by this proposer lane. Registering a source here *proposes* it into the same
 * quarantine queue a lead uses, tagged `proposalKind: 'source_registration'`, for a reviewer to
 * action through the existing registry tooling.
 *
 * "Attach evidence" does not call `transitionResearchCase` or mutate a case's evidence
 * checklist directly: that stays behind BB-044's `record_evidence` server gate
 * (`assertResearchCaseActionAuthorized`, packages/firebase/src/firestore/research-case.ts),
 * which requires a `research:write` permission this proposer-only identity does not carry.
 * This function only queues the proposed evidence against the target case id.
 */
import { randomUUID } from 'node:crypto';
import {
  createResearchCase,
  type ResearchCaseRecord,
} from '@black-book/domain';
import {
  createQuarantinedSubmission,
  createSubmissionCampaignDetector,
  type QuarantinedSubmissionRecord,
  type RejectedSubmission,
  type SubmissionIntakeContext,
} from '@black-book/security';
import { firestorePaths, type StateMutation } from '@black-book/firebase';
import { buildOperatorAuditEvent, buildOperatorOutboxMessage } from './audit.js';
import { operatorStamp, type OperatorIdentity, type OperatorStamp } from './identity.js';

export const OPERATOR_PROPOSAL_KINDS = [
  'lead',
  'source_registration',
  'evidence_attachment',
  'bulk_import_row',
] as const;

export type OperatorProposalKind = (typeof OPERATOR_PROPOSAL_KINDS)[number];

/** Only the two BB-029 kinds an operator proposer may submit; `abuse_report` is public-only. */
export type OperatorSubmissionKind = 'correction' | 'contribution';

export type OperatorSubmission = {
  readonly kind: OperatorSubmissionKind;
  readonly title: string;
  readonly statement: string;
  readonly sourceUrls: readonly string[];
  readonly targetRecordId?: string;
  readonly submitterContact?: string;
};

export type OperatorIntakeContext = {
  readonly identity: OperatorIdentity;
  /** Passed straight through to `createQuarantinedSubmission`; never logged or stored raw. */
  readonly privacyPepper: string;
  readonly nowMs?: number;
  readonly recentSubmissionTimestamps?: readonly number[];
  readonly detector?: ReturnType<typeof createSubmissionCampaignDetector>;
  readonly reason?: string;
};

export type OperatorIntakeAccepted = {
  readonly accepted: true;
  readonly proposalKind: OperatorProposalKind;
  readonly submission: QuarantinedSubmissionRecord;
  readonly researchCase?: ResearchCaseRecord;
  /** Mutations targeting only `submissionInbox` and (optionally) `researchCases` — never
   *  a canonical, published, or promotion collection. */
  readonly mutations: readonly StateMutation[];
  readonly auditEvent: ReturnType<typeof buildOperatorAuditEvent>;
  readonly outboxMessage: ReturnType<typeof buildOperatorOutboxMessage>;
  readonly operator: OperatorStamp;
};

export type OperatorIntakeRejected = {
  readonly accepted: false;
  readonly proposalKind: OperatorProposalKind;
  readonly rejection: RejectedSubmission;
};

export type OperatorIntakeOutcome = OperatorIntakeAccepted | OperatorIntakeRejected;

const AUDIT_ACTION_BY_PROPOSAL: Record<OperatorProposalKind, 'research.created' | 'source.registered'> = {
  lead: 'research.created',
  source_registration: 'source.registered',
  evidence_attachment: 'research.created',
  bulk_import_row: 'research.created',
};

export type PrepareOperatorIntakeOptions = {
  /** Opens a real BB-044 draft research case (`state: 'candidate'`) alongside the quarantine
   *  record. Defaults to `true` for leads, `false` otherwise. */
  readonly openDraftCase?: boolean;
  readonly caseTitle?: string;
};

/**
 * Runs one operator submission through the real BB-029 quarantine intake and, optionally,
 * opens a real BB-044 draft research case. Returns data only — nothing is written until a
 * caller passes the result to `commitOperatorIntake` (`./commit.ts`).
 */
export function prepareOperatorIntake(
  proposalKind: OperatorProposalKind,
  submission: OperatorSubmission,
  context: OperatorIntakeContext,
  options: PrepareOperatorIntakeOptions = {},
): OperatorIntakeOutcome {
  const nowMs = context.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();
  const stamp = operatorStamp(context.identity);
  const intakeContext: SubmissionIntakeContext = {
    receivedAtMs: nowMs,
    submitterToken: stamp.operatorId,
    networkToken: stamp.sessionId,
    privacyPepper: context.privacyPepper,
    ...(context.recentSubmissionTimestamps
      ? { recentSubmissionTimestamps: context.recentSubmissionTimestamps }
      : {}),
  };

  const result = createQuarantinedSubmission(
    submission,
    intakeContext,
    context.detector ?? createSubmissionCampaignDetector(),
  );

  if (!result.accepted) {
    return { accepted: false, proposalKind, rejection: result.rejection };
  }

  const submissionId = result.record.id;
  const submissionPath = firestorePaths.submissionInbox(submissionId);
  const mutations: StateMutation[] = [
    {
      operation: 'create',
      path: submissionPath,
      data: {
        status: 'quarantined',
        createdBy: stamp.operatorId,
        createdAt: now,
        kind: submission.kind,
        payload: {
          ...(result.record as unknown as Readonly<Record<string, unknown>>),
          operator: stamp,
          proposalKind,
        },
        ...(submission.sourceUrls[0] ? { sourceUrl: submission.sourceUrls[0] } : {}),
      } as unknown as Readonly<Record<string, unknown>>,
    },
  ];

  const openDraftCase = options.openDraftCase ?? proposalKind === 'lead';
  let researchCase: ResearchCaseRecord | undefined;
  if (openDraftCase) {
    const caseId = randomUUID();
    researchCase = createResearchCase({
      id: caseId,
      candidateId: submissionId,
      title: options.caseTitle ?? submission.title,
      checklist: { items: [] },
      now,
    });
    mutations.push({
      operation: 'create',
      path: firestorePaths.researchCase(caseId),
      data: researchCase as unknown as Readonly<Record<string, unknown>>,
    });
  }

  const idempotencyKey = `operator-intake:${stamp.sessionId}:${submissionId}`;
  const auditEvent = buildOperatorAuditEvent({
    action: AUDIT_ACTION_BY_PROPOSAL[proposalKind],
    subject: { type: 'submissionInbox', id: submissionId, path: submissionPath },
    identity: context.identity,
    reason: context.reason ?? `Operator ${proposalKind.replace('_', ' ')} proposal.`,
    now,
    idempotencyKey,
    ...(researchCase ? { entityId: researchCase.id } : {}),
    data: { proposalKind, operator: stamp, ...(researchCase ? { researchCaseId: researchCase.id } : {}) },
  });
  const outboxMessage = buildOperatorOutboxMessage({
    auditEvent,
    topic: 'operator.submission.created',
    aggregateType: 'submissionInbox',
    aggregateId: submissionId,
    payload: { proposalKind, submissionId, ...(researchCase ? { researchCaseId: researchCase.id } : {}) },
    now,
  });

  return {
    accepted: true,
    proposalKind,
    submission: result.record,
    ...(researchCase ? { researchCase } : {}),
    mutations,
    auditEvent,
    outboxMessage,
    operator: stamp,
  };
}

function deriveTitle(text: string, maxLength = 80): string {
  const trimmed = text.trim().replace(/\s+/gu, ' ');
  if (trimmed.length <= maxLength) return trimmed || 'Untitled operator proposal';
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export type LeadInput = {
  readonly title?: string;
  readonly description: string;
  readonly url?: string;
  readonly sourceUrls?: readonly string[];
  readonly location?: string;
  readonly era?: string;
  readonly targetRecordId?: string;
  readonly submitterContact?: string;
};

function composeStatement(description: string, location?: string, era?: string): string {
  const lines = [description.trim()];
  if (location?.trim()) lines.push(`Location: ${location.trim()}`);
  if (era?.trim()) lines.push(`Era: ${era.trim()}`);
  return lines.join('\n\n');
}

function collectSourceUrls(url: string | undefined, sourceUrls: readonly string[] | undefined): string[] {
  const urls = [...(url ? [url] : []), ...(sourceUrls ?? [])];
  return [...new Set(urls)];
}

/** Pure shape builder shared by single-lead and bulk-import intake so both use one path. */
export function buildLeadSubmission(input: LeadInput): OperatorSubmission {
  return {
    kind: 'contribution',
    title: input.title?.trim() || deriveTitle(input.description),
    statement: composeStatement(input.description, input.location, input.era),
    sourceUrls: collectSourceUrls(input.url, input.sourceUrls),
    ...(input.targetRecordId ? { targetRecordId: input.targetRecordId } : {}),
    ...(input.submitterContact ? { submitterContact: input.submitterContact } : {}),
  };
}

/** Submit a lead: proposes it into quarantine and opens a real BB-044 draft research case. */
export function prepareLeadIntake(
  input: LeadInput,
  context: OperatorIntakeContext,
): OperatorIntakeOutcome {
  return prepareOperatorIntake('lead', buildLeadSubmission(input), context, {
    openDraftCase: true,
  });
}

export type SourceRegistrationInput = {
  readonly organizationName: string;
  readonly homepageUrl: string;
  readonly notes?: string;
  readonly suggestedClassification?: string;
};

/** Register a source: proposes it into quarantine for the source-registry reviewer workflow. */
export function prepareSourceRegistrationIntake(
  input: SourceRegistrationInput,
  context: OperatorIntakeContext,
): OperatorIntakeOutcome {
  const statementLines = [
    `Proposed source organization: ${input.organizationName.trim()}`,
    `Homepage: ${input.homepageUrl.trim()}`,
  ];
  if (input.suggestedClassification?.trim()) {
    statementLines.push(`Suggested classification: ${input.suggestedClassification.trim()}`);
  }
  if (input.notes?.trim()) statementLines.push(input.notes.trim());
  const submission: OperatorSubmission = {
    kind: 'contribution',
    title: deriveTitle(`Register source: ${input.organizationName}`, 200),
    statement: statementLines.join('\n\n'),
    sourceUrls: [input.homepageUrl],
  };
  return prepareOperatorIntake('source_registration', submission, context, {
    openDraftCase: false,
  });
}

export type EvidenceAttachmentInput = {
  readonly researchCaseId: string;
  readonly description: string;
  readonly sourceUrls: readonly string[];
  readonly submitterContact?: string;
};

/**
 * Attach evidence to a research case: queues the proposal against `researchCaseId`. Applying
 * it to the case's evidence checklist remains the reviewer's `record_evidence`-gated action.
 */
export function prepareEvidenceAttachmentIntake(
  input: EvidenceAttachmentInput,
  context: OperatorIntakeContext,
): OperatorIntakeOutcome {
  const submission: OperatorSubmission = {
    kind: 'contribution',
    title: deriveTitle(`Evidence for ${input.researchCaseId}: ${input.description}`, 200),
    statement: input.description,
    sourceUrls: input.sourceUrls,
    targetRecordId: input.researchCaseId,
    ...(input.submitterContact ? { submitterContact: input.submitterContact } : {}),
  };
  return prepareOperatorIntake('evidence_attachment', submission, context, {
    openDraftCase: false,
  });
}
