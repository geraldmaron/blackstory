/**
 * Implements the submissions API's quarantine-only intake and moderation service.
 * App Check and quota decisions are required before untrusted content reaches storage.
 */
import { randomUUID } from 'node:crypto';
import {
  createQuarantinedSubmission,
  createSubmissionCampaignDetector,
  verifyOriginalIntegrity,
  type QuarantinedSubmissionRecord,
  type SubmissionCampaignAssessment,
  type SubmissionInput,
  type SubmissionModerationState,
} from '@black-book/security';
import { guardIntakeOperation, guardPublishAttempt } from './posture.js';

export type SubmissionSecurityContext = {
  readonly appCheckAllowed: boolean;
  readonly quotaAllowed: boolean;
  readonly submitterToken?: string;
  readonly networkToken?: string;
  readonly recentSubmissionTimestamps?: readonly number[];
};

export type ModerationActor = {
  readonly actorId: string;
  readonly role: 'moderator' | 'admin';
};

export type SubmissionAuditEvent = {
  readonly eventId: string;
  readonly submissionId: string;
  readonly action:
    'intake_accepted' | 'intake_rejected' | 'moderation_transition' | 'subject_blocked';
  readonly actorId: string;
  readonly occurredAt: string;
  readonly fromState?: SubmissionModerationState;
  readonly toState?: SubmissionModerationState;
  readonly reasonCode: string;
  readonly originalContentHash?: string;
};

export type BlockedSubject = {
  readonly token: string;
  readonly reasonCode: string;
  readonly blockedAt: string;
  readonly blockedBy: string;
};

export type SubmissionQuarantineRepository = {
  append(record: QuarantinedSubmissionRecord): void;
  get(id: string): QuarantinedSubmissionRecord | undefined;
  transition(
    id: string,
    toState: SubmissionModerationState,
  ): { readonly before: QuarantinedSubmissionRecord; readonly after: QuarantinedSubmissionRecord };
  appendAudit(event: SubmissionAuditEvent): void;
  auditFor(id: string): readonly SubmissionAuditEvent[];
  blockSubject(block: BlockedSubject): void;
  getBlockedSubject(token: string): BlockedSubject | undefined;
  list(): readonly QuarantinedSubmissionRecord[];
};

export type QuarantineIntakeRequest = {
  readonly payload: unknown;
  readonly security: SubmissionSecurityContext;
};

export type QuarantineIntakeResponse =
  | {
      readonly accepted: true;
      readonly submissionId: string;
      readonly inboxState: 'accepted';
      readonly moderationState: SubmissionModerationState;
      readonly campaign: SubmissionCampaignAssessment;
    }
  | {
      readonly accepted: false;
      readonly status: 400 | 403 | 429;
      readonly reason:
        'app_check_denied' | 'quota_denied' | 'subject_blocked' | 'validation_failed';
      readonly issues?: readonly { readonly field: string; readonly message: string }[];
    };

export type SubmissionQuarantineServiceOptions = {
  readonly repository?: SubmissionQuarantineRepository;
  readonly privacyPepper: string;
  readonly now?: () => number;
  readonly idFactory?: () => string;
};

function freezeRecord(record: QuarantinedSubmissionRecord): QuarantinedSubmissionRecord {
  return Object.freeze(record);
}

export function createInMemorySubmissionQuarantineRepository(): SubmissionQuarantineRepository {
  const records = new Map<string, QuarantinedSubmissionRecord>();
  const audits: SubmissionAuditEvent[] = [];
  const blockedSubjects = new Map<string, BlockedSubject>();

  return {
    append(record) {
      if (records.has(record.id)) {
        throw new Error('Submission id already exists.');
      }
      if (record.destination !== 'submission_quarantine' || record.canonicalWriteAllowed) {
        throw new Error('Repository accepts quarantine-only records.');
      }
      if (!verifyOriginalIntegrity(record)) {
        throw new Error('Submission original failed integrity verification.');
      }
      records.set(record.id, record);
    },
    get(id) {
      return records.get(id);
    },
    transition(id, toState) {
      const before = records.get(id);
      if (!before) {
        throw new Error('Submission not found.');
      }
      if (!verifyOriginalIntegrity(before)) {
        throw new Error('Submission original failed integrity verification.');
      }
      const after = freezeRecord({ ...before, moderationState: toState });
      if (
        after.original !== before.original ||
        after.original.contentHash !== before.original.contentHash
      ) {
        throw new Error('Moderation cannot replace the immutable original.');
      }
      records.set(id, after);
      return { before, after };
    },
    appendAudit(event) {
      audits.push(Object.freeze({ ...event }));
    },
    auditFor(id) {
      return audits.filter((event) => event.submissionId === id);
    },
    blockSubject(block) {
      blockedSubjects.set(block.token, Object.freeze({ ...block }));
    },
    getBlockedSubject(token) {
      return blockedSubjects.get(token);
    },
    list() {
      return [...records.values()];
    },
  };
}

function requireModerator(actor: ModerationActor): void {
  if (actor.role !== 'moderator' && actor.role !== 'admin') {
    throw new Error('Moderator authorization required.');
  }
}

export function createSubmissionQuarantineService(options: SubmissionQuarantineServiceOptions) {
  const repository = options.repository ?? createInMemorySubmissionQuarantineRepository();
  const now = options.now ?? (() => Date.now());
  const idFactory = options.idFactory ?? (() => randomUUID());
  const campaignDetector = createSubmissionCampaignDetector();

  function audit(
    submissionId: string,
    action: SubmissionAuditEvent['action'],
    actorId: string,
    reasonCode: string,
    details: Pick<SubmissionAuditEvent, 'fromState' | 'toState' | 'originalContentHash'> = {},
  ): void {
    repository.appendAudit({
      eventId: idFactory(),
      submissionId,
      action,
      actorId,
      occurredAt: new Date(now()).toISOString(),
      reasonCode,
      ...details,
    });
  }

  function intake(request: QuarantineIntakeRequest): QuarantineIntakeResponse {
    guardIntakeOperation('write:quarantine');
    if (!request.security.appCheckAllowed) {
      return { accepted: false, status: 403, reason: 'app_check_denied' };
    }
    if (!request.security.quotaAllowed) {
      return { accepted: false, status: 429, reason: 'quota_denied' };
    }
    if (
      request.security.submitterToken &&
      repository.getBlockedSubject(request.security.submitterToken)
    ) {
      return { accepted: false, status: 403, reason: 'subject_blocked' };
    }

    const result = createQuarantinedSubmission(
      request.payload,
      {
        receivedAtMs: now(),
        privacyPepper: options.privacyPepper,
        ...(request.security.submitterToken
          ? { submitterToken: request.security.submitterToken }
          : {}),
        ...(request.security.networkToken ? { networkToken: request.security.networkToken } : {}),
        ...(request.security.recentSubmissionTimestamps
          ? { recentSubmissionTimestamps: request.security.recentSubmissionTimestamps }
          : {}),
      },
      campaignDetector,
    );

    if (!result.accepted) {
      return {
        accepted: false,
        status: 400,
        reason: 'validation_failed',
        issues: result.rejection.issues.map(({ field, message }) => ({ field, message })),
      };
    }

    repository.append(result.record);
    audit(result.record.id, 'intake_accepted', 'submission-api', result.record.moderationState, {
      toState: result.record.moderationState,
      originalContentHash: result.record.original.contentHash,
    });
    return {
      accepted: true,
      submissionId: result.record.id,
      inboxState: result.record.inboxState,
      moderationState: result.record.moderationState,
      campaign: result.record.campaign,
    };
  }

  return {
    repository,
    intake,
    moderate(
      actor: ModerationActor,
      submissionId: string,
      toState: SubmissionModerationState,
      reasonCode: string,
    ): QuarantinedSubmissionRecord {
      requireModerator(actor);
      const { before, after } = repository.transition(submissionId, toState);
      audit(submissionId, 'moderation_transition', actor.actorId, reasonCode, {
        fromState: before.moderationState,
        toState,
        originalContentHash: before.original.contentHash,
      });
      return after;
    },
    blockSubject(actor: ModerationActor, token: string, reasonCode: string): BlockedSubject {
      requireModerator(actor);
      if (!token.trim()) {
        throw new Error('A non-empty opaque subject token is required.');
      }
      const block = Object.freeze({
        token,
        reasonCode,
        blockedAt: new Date(now()).toISOString(),
        blockedBy: actor.actorId,
      });
      repository.blockSubject(block);
      audit(`blocked-subject:${token}`, 'subject_blocked', actor.actorId, reasonCode);
      return block;
    },
    reportAbuse(
      security: SubmissionSecurityContext,
      input: Omit<SubmissionInput, 'kind'>,
    ): QuarantineIntakeResponse {
      return intake({ payload: { ...input, kind: 'abuse_report' }, security });
    },
    assertPublicationUnavailable(): void {
      guardPublishAttempt('publish:projection');
    },
  };
}
