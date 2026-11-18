/**
 * Testable core of correction intake routes. Next.js `route.ts` files stay thin because
 * the App Router type validator rejects non-handler exports from route modules.
 */
import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { clientIpFrom } from '@/lib/web-security/client-ip';
import {
  createQuarantinedSubmission,
  createSubmissionCampaignDetector,
  type QuarantinedSubmissionRecord,
} from '@repo/security';
import { requirePrivacyPepper } from '@/lib/web-security';
import { buildPublicCorrectionStatus } from '../public-status';
import {
  validateAbuseReportSubmission,
  validateAppealSubmission,
  validateCorrectionSubmission,
  type AbuseReportInput,
  type AppealSubmissionInput,
  type CorrectionSubmissionInput,
} from '../correction-intake';
import { createReceiptCode } from '../receipt-code';
import {
  buildStoredCorrection,
  type CorrectionSubmissionStore,
  type StoredCorrection,
} from '../store';
import {
  createPostgresCorrectionSubmissionStore,
  saveQuarantinedRecord,
} from '../../../lib/public-data/corrections-store';
import { notify as defaultNotify, recipientFrom, type Notifier } from '../../../lib/notify/notify';
import { CORRECTION_CATEGORY_LABELS } from '../categories';
import type { CorrectionRequestIntegrityGuard } from '../request-integrity-guard';
import type { createCorrectionRateLimitGuard } from '../rate-limit-guard';

/**
 * Monitor allow-through must satisfy the quota gate (compat with @repo/security's
 * `clientAttested` field name on rate-limit requests).
 */
function integritySatisfiesRateLimitGate(decision: {
  readonly verified: boolean;
  readonly mode: 'monitor' | 'enforce';
}): boolean {
  return decision.verified || decision.mode === 'monitor';
}

export type CorrectionRouteDependencies = {
  readonly integrityGuard: CorrectionRequestIntegrityGuard;
  readonly rateLimitGuard: ReturnType<typeof createCorrectionRateLimitGuard>;
  readonly store: CorrectionSubmissionStore;
  readonly privacyPepper: string;
  readonly campaignDetector?: ReturnType<typeof createSubmissionCampaignDetector>;
  readonly now?: () => number;
  /**
   * Persists an accepted abuse report. Abuse reports have no receipt/status scheme (no target
   * type, category, or code), so they don't go through `store`.
   * Defaults to the real Postgres writer; tests override this the same way they substitute
   * `store` for the in-memory one, rather than reaching the network.
   */
  readonly saveAbuseReport?: (record: QuarantinedSubmissionRecord) => Promise<void>;
  /** Defaults to real (env-gated) email; tests pass a recorder. */
  readonly notify?: Notifier;
};

function jsonError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return NextResponse.json({ error, ...extra }, { status });
}

function networkTokenFor(clientIp: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}${clientIp}`).digest('hex');
}

function toPublicStatus(stored: StoredCorrection) {
  return buildPublicCorrectionStatus({
    receiptCode: stored.receiptCode,
    ...(stored.intakeStatus ? { intakeStatus: stored.intakeStatus } : {}),
    moderationState: stored.record.moderationState,
    submittedAt: stored.record.createdAt,
    updatedAt: stored.updatedAt,
    classificationDispute: stored.classificationDispute,
    ...(stored.closureReason ? { closureReason: stored.closureReason } : {}),
    ...(stored.publicReason ? { publicReason: stored.publicReason } : {}),
    appealCount: stored.appeals.length,
  });
}

function intakeContext(deps: CorrectionRouteDependencies, clientIp?: string) {
  const nowMs = deps.now?.() ?? Date.now();
  return {
    receivedAtMs: nowMs,
    privacyPepper: deps.privacyPepper,
    ...(clientIp ? { networkToken: networkTokenFor(clientIp, deps.privacyPepper) } : {}),
  };
}

async function guardRequest(
  request: Request,
  deps: CorrectionRouteDependencies,
): Promise<
  | { readonly allowed: true; readonly clientIp?: string; readonly rateKey: string }
  | { readonly allowed: false; readonly response: Response }
> {
  const clientIp = clientIpFrom(request);
  const integrityDecision = await deps.integrityGuard({ headers: request.headers });
  if (!integrityDecision.allowed) {
    return {
      allowed: false,
      response: jsonError(integrityDecision.status, 'request_integrity_required', {
        reason: integrityDecision.reason,
      }),
    };
  }

  const rateDecision = deps.rateLimitGuard.evaluate({
    subject: 'anonymous',
    ...(clientIp ? { clientIp } : {}),
    clientAttested: integritySatisfiesRateLimitGate(integrityDecision),
  });
  if (!rateDecision.allowed) {
    const response = deps.rateLimitGuard.formatDeniedResponse(rateDecision);
    return {
      allowed: false,
      response: NextResponse.json(response.body, {
        status: response.status,
        headers: response.headers,
      }),
    };
  }

  return { allowed: true, ...(clientIp ? { clientIp } : {}), rateKey: rateDecision.key };
}

export async function handleCorrectionSubmitRequest(
  request: Request,
  deps: CorrectionRouteDependencies,
): Promise<Response> {
  const guard = await guardRequest(request, deps);
  if (!guard.allowed) return guard.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, 'invalid_json');
    }

    const validation = validateCorrectionSubmission(body as CorrectionSubmissionInput);
    if (!validation.valid) {
      return jsonError(400, 'validation_failed', { issues: validation.issues });
    }

    const result = createQuarantinedSubmission(
      validation.payload,
      intakeContext(deps, guard.clientIp),
      deps.campaignDetector ?? createSubmissionCampaignDetector(),
    );
    if (!result.accepted) {
      return jsonError(400, 'validation_failed', {
        issues: result.rejection.issues.map(({ field, message }) => ({ field, message })),
      });
    }

    const stored = buildStoredCorrection({
      record: result.record,
      pepper: deps.privacyPepper,
      targetType: validation.metadata.targetType,
      category: validation.metadata.category,
      classificationDispute: validation.metadata.classificationDispute,
    });
    await deps.store.save(stored);

    const send = deps.notify ?? defaultNotify;
    const contact = recipientFrom(validation.payload.submitterContact);
    if (contact) {
      send({
        event: 'correction.received',
        to: contact,
        data: { receiptCode: stored.receiptCode },
        idempotencyKey: `correction.received:${stored.record.id}`,
      });
    }
    send({
      event: 'owner.new_submission',
      to: 'owner',
      data: {
        kind: 'correction',
        headline: `${CORRECTION_CATEGORY_LABELS[validation.metadata.category]} on “${(body as CorrectionSubmissionInput).targetRecordId.trim().slice(0, 80)}”, receipt ${stored.receiptCode}`,
        statement: (body as CorrectionSubmissionInput).statement,
        id: stored.record.id,
      },
      idempotencyKey: `owner.new_submission:${stored.record.id}`,
    });

    return NextResponse.json(
      {
        accepted: true,
        receiptCode: stored.receiptCode,
        statusHref: `/corrections/status/${encodeURIComponent(stored.receiptCode)}`,
      },
      { status: 202 },
    );
  } finally {
    deps.rateLimitGuard.release(guard.rateKey);
  }
}

export async function handleCorrectionStatusRequest(
  request: Request,
  deps: Pick<CorrectionRouteDependencies, 'store' | 'privacyPepper'>,
): Promise<Response> {
  const url = new URL(request.url);
  const receiptCode = url.searchParams.get('receipt')?.trim();
  if (!receiptCode) {
    return jsonError(400, 'receipt_required');
  }

  const stored = await deps.store.getByReceiptCode(receiptCode, deps.privacyPepper);
  if (!stored) {
    return jsonError(404, 'not_found');
  }

  return NextResponse.json({ status: toPublicStatus(stored) }, { status: 200 });
}

export async function handleCorrectionAppealRequest(
  request: Request,
  deps: CorrectionRouteDependencies,
): Promise<Response> {
  const guard = await guardRequest(request, deps);
  if (!guard.allowed) return guard.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, 'invalid_json');
    }

    const input = body as AppealSubmissionInput & { readonly sourceUrl?: string | undefined };
    const stored = await deps.store.getByReceiptCode(
      input.receiptCode?.trim() ?? '',
      deps.privacyPepper,
    );
    if (!stored) {
      return jsonError(404, 'not_found');
    }

    const publicStatus = toPublicStatus(stored);
    if (!publicStatus.appealAvailable) {
      return jsonError(403, 'appeal_not_available');
    }

    const validation = validateAppealSubmission(input);
    if (!validation.valid) {
      return jsonError(400, 'validation_failed', { issues: validation.issues });
    }

    const appealRecord = {
      id: randomUUID(),
      statement: input.statement.trim(),
      submittedAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
    };

    const appealIntake = createQuarantinedSubmission(
      validation.payload,
      intakeContext(deps, guard.clientIp),
      deps.campaignDetector ?? createSubmissionCampaignDetector(),
    );
    if (!appealIntake.accepted) {
      return jsonError(400, 'validation_failed', {
        issues: appealIntake.rejection.issues.map(({ field, message }) => ({ field, message })),
      });
    }

    const attached = await deps.store.attachAppeal(stored.receiptCode, deps.privacyPepper, {
      ...appealRecord,
      record: appealIntake.record,
    });
    if (!attached) return jsonError(409, 'appeal_not_available');

    const send = deps.notify ?? defaultNotify;
    const contact =
      recipientFrom(input.contact) ??
      recipientFrom(stored.record.original.payload.submitterContact);
    if (contact) {
      send({
        event: 'appeal.received',
        to: contact,
        data: { receiptCode: stored.receiptCode },
        idempotencyKey: `appeal.received:${appealRecord.id}`,
      });
    }
    send({
      event: 'owner.new_submission',
      to: 'owner',
      data: {
        kind: 'appeal',
        headline: `Appeal on correction ${stored.receiptCode}`,
        statement: input.statement,
        id: stored.record.id,
      },
      idempotencyKey: `owner.new_submission:${appealRecord.id}`,
    });

    return NextResponse.json(
      {
        accepted: true,
        receiptCode: stored.receiptCode,
        appealId: appealRecord.id,
        statusHref: `/corrections/status/${encodeURIComponent(stored.receiptCode)}`,
      },
      { status: 202 },
    );
  } finally {
    deps.rateLimitGuard.release(guard.rateKey);
  }
}

export async function handleCorrectionAbuseReportRequest(
  request: Request,
  deps: CorrectionRouteDependencies,
): Promise<Response> {
  const guard = await guardRequest(request, deps);
  if (!guard.allowed) return guard.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, 'invalid_json');
    }

    const validation = validateAbuseReportSubmission(body as AbuseReportInput);
    if (!validation.valid) {
      return jsonError(400, 'validation_failed', { issues: validation.issues });
    }

    const result = createQuarantinedSubmission(
      validation.payload,
      intakeContext(deps, guard.clientIp),
      deps.campaignDetector ?? createSubmissionCampaignDetector(),
    );
    if (!result.accepted) {
      return jsonError(400, 'validation_failed', {
        issues: result.rejection.issues.map(({ field, message }) => ({ field, message })),
      });
    }

    // Abuse reports have no receipt/status scheme (nothing for a submitter to check later), so
    // they use the same durable intake writer without receipt metadata.
    await (deps.saveAbuseReport ?? saveQuarantinedRecord)(result.record);
    (deps.notify ?? defaultNotify)({
      event: 'owner.new_submission',
      to: 'owner',
      data: {
        kind: 'abuse report',
        headline: (body as AbuseReportInput).receiptCode?.trim()
          ? `Report about correction ${(body as AbuseReportInput).receiptCode?.trim()}`
          : 'Report about correction activity',
        statement: (body as AbuseReportInput).statement,
        id: result.record.id,
      },
      idempotencyKey: `owner.new_submission:${result.record.id}`,
    });

    return NextResponse.json(
      {
        accepted: true,
        reportId: result.record.id,
      },
      { status: 202 },
    );
  } finally {
    deps.rateLimitGuard.release(guard.rateKey);
  }
}

let defaultStore: CorrectionSubmissionStore | undefined;

export function getDefaultCorrectionStore(): CorrectionSubmissionStore {
  if (!defaultStore) {
    defaultStore = createPostgresCorrectionSubmissionStore();
  }
  return defaultStore;
}

let defaultGuards:
  | Pick<CorrectionRouteDependencies, 'integrityGuard' | 'rateLimitGuard' | 'campaignDetector'>
  | undefined;

export async function buildDefaultCorrectionRouteDependencies(): Promise<CorrectionRouteDependencies> {
  const { createCorrectionRateLimitGuard } = await import('../rate-limit-guard');
  const { createCorrectionRequestIntegrityGuard } = await import('../request-integrity-guard');
  defaultGuards ??= {
    integrityGuard: createCorrectionRequestIntegrityGuard(),
    rateLimitGuard: createCorrectionRateLimitGuard(),
    campaignDetector: createSubmissionCampaignDetector(),
  };
  return {
    ...defaultGuards,
    store: getDefaultCorrectionStore(),
    privacyPepper: requirePrivacyPepper(),
  };
}

export function resolveReceiptCodeFromPath(receiptCode: string): string {
  return decodeURIComponent(receiptCode).trim();
}

export async function lookupPublicStatusByReceipt(
  receiptCode: string,
  deps: Pick<CorrectionRouteDependencies, 'store' | 'privacyPepper'>,
) {
  const stored = await deps.store.getByReceiptCode(receiptCode, deps.privacyPepper);
  if (!stored) return undefined;
  return toPublicStatus(stored);
}

export function createReceiptCodeForTests(submissionId: string, pepper: string): string {
  return createReceiptCode(submissionId, pepper);
}
