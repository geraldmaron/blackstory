/**
 * `/v1/corrections` write handlers for api-submissions (MOB-016 / repo-zir9).
 *
 * Pure async functions over an injected `ApiRequest` + `HandlerDeps` — no `node:http` types
 * leak in here. The wire JSON matches web's corrections handler and the mobile client's
 * `CorrectionSubmissionRequest` / `CorrectionAcceptedResponse` contract. All writes stay
 * quarantine-only via `createSubmissionQuarantineService().intake()`.
 */
import { createHash } from 'node:crypto';
import { buildSurfaceHealth, parseNodeEnv } from '@repo/config';
import type { AppCheckDecision, AppCheckHeaders } from '@repo/firebase';
import { SURFACE_ID } from '../posture.js';
import { createSubmissionsApiAppCheckGuard } from '../app-check.js';
import { createSubmissionsRateLimitGuard } from '../rate-limits.js';
import {
  createInMemorySubmissionQuarantineRepository,
  createSubmissionQuarantineService,
} from '../quarantine.js';
import { validateCorrectionSubmission, type CorrectionSubmissionInput } from '../corrections/correction-intake.js';
import { buildPublicCorrectionStatus } from '../corrections/public-status.js';
import { createCorrectionReceiptStore, buildStoredCorrectionReceipt, type CorrectionReceiptStore } from '../corrections/store.js';
import { createIdempotencyCache, type IdempotencyCache } from '../corrections/idempotency-cache.js';
import { jsonError, jsonResponse, type ApiResponse } from './responses.js';

export const CORRECTION_SUBMIT_PATH = '/v1/corrections';
export const CORRECTION_STATUS_PATH = '/v1/corrections/status';
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

export type ApiRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly requestId: string;
  readonly clientIp?: string;
  readonly body?: unknown;
};

export type HandlerDeps = {
  readonly quarantineService: ReturnType<typeof createSubmissionQuarantineService>;
  readonly appCheckGuard: ReturnType<typeof createSubmissionsApiAppCheckGuard>;
  readonly rateLimitGuard: ReturnType<typeof createSubmissionsRateLimitGuard>;
  readonly store: CorrectionReceiptStore;
  readonly idempotencyCache: IdempotencyCache;
  readonly privacyPepper: string;
  readonly now?: () => number;
};

function networkTokenFor(clientIp: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}${clientIp}`).digest('hex');
}

function readIdempotencyKey(headers: ApiRequest['headers']): string | undefined {
  const value = headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()]?.trim();
  return value ? value : undefined;
}

function toPublicStatus(stored: ReturnType<CorrectionReceiptStore['getByReceiptCode']>) {
  if (!stored) return undefined;
  return buildPublicCorrectionStatus({
    receiptCode: stored.receiptCode,
    moderationState: stored.record.moderationState,
    submittedAt: stored.record.createdAt,
    updatedAt: stored.updatedAt,
    classificationDispute: stored.classificationDispute,
    ...(stored.closureReason ? { closureReason: stored.closureReason } : {}),
    appealCount: stored.appeals.length,
  });
}

async function guardSubmitRequest(
  request: ApiRequest,
  deps: HandlerDeps,
): Promise<
  | { readonly allowed: true; readonly clientIp?: string; readonly rateKey: string }
  | { readonly allowed: false; readonly response: ApiResponse }
> {
  const appCheckDecision: AppCheckDecision = await deps.appCheckGuard({ headers: request.headers as AppCheckHeaders });
  if (!appCheckDecision.allowed) {
    return {
      allowed: false,
      response: jsonError(appCheckDecision.status, 'app_check_required', request.requestId, {
        reason: appCheckDecision.reason,
      }),
    };
  }

  const rateDecision = deps.rateLimitGuard.evaluate({
    method: request.method,
    path: request.path,
    subject: 'anonymous',
    ...(request.clientIp ? { clientIp: request.clientIp } : {}),
    appCheckVerified: appCheckDecision.verified,
  });
  if (!rateDecision) {
    return {
      allowed: false,
      response: jsonError(404, 'not_found', request.requestId),
    };
  }
  if (!rateDecision.allowed) {
    const denied = deps.rateLimitGuard.formatDeniedResponse(rateDecision);
    return {
      allowed: false,
      response: jsonResponse(denied.status, denied.body, request.requestId, denied.headers),
    };
  }

  return {
    allowed: true,
    ...(request.clientIp ? { clientIp: request.clientIp } : {}),
    rateKey: rateDecision.key,
  };
}

export function handleHealth(request: ApiRequest): ApiResponse {
  return jsonResponse(
    200,
    buildSurfaceHealth(SURFACE_ID, parseNodeEnv(process.env.NODE_ENV)),
    request.requestId,
  );
}

export async function handleCorrectionSubmit(request: ApiRequest, deps: HandlerDeps): Promise<ApiResponse> {
  const guard = await guardSubmitRequest(request, deps);
  if (!guard.allowed) return guard.response;

  try {
    if (request.body === undefined) {
      return jsonError(400, 'invalid_json', request.requestId);
    }

    const idempotencyKey = readIdempotencyKey(request.headers);
    if (idempotencyKey) {
      const cached = deps.idempotencyCache.get(idempotencyKey);
      if (cached) {
        return jsonResponse(
          202,
          {
            accepted: true,
            receiptCode: cached.receiptCode,
            statusHref: cached.statusHref,
          },
          request.requestId,
        );
      }
    }

    const validation = validateCorrectionSubmission(request.body as CorrectionSubmissionInput);
    if (!validation.valid) {
      return jsonError(400, 'validation_failed', request.requestId, { issues: validation.issues });
    }

    const intake = deps.quarantineService.intake({
      payload: validation.payload,
      security: {
        appCheckAllowed: true,
        quotaAllowed: true,
        ...(guard.clientIp ? { networkToken: networkTokenFor(guard.clientIp, deps.privacyPepper) } : {}),
      },
    });

    if (!intake.accepted) {
      if (intake.reason === 'validation_failed') {
        return jsonError(intake.status, 'validation_failed', request.requestId, { issues: intake.issues });
      }
      if (intake.reason === 'app_check_denied') {
        return jsonError(intake.status, 'app_check_required', request.requestId);
      }
      if (intake.reason === 'quota_denied') {
        return jsonError(429, 'rate_limit_exceeded', request.requestId);
      }
      return jsonError(intake.status, intake.reason, request.requestId);
    }

    const storedRecord = deps.quarantineService.repository.get(intake.submissionId);
    if (!storedRecord) {
      return jsonError(500, 'internal_error', request.requestId);
    }

    const stored = buildStoredCorrectionReceipt({
      record: storedRecord,
      pepper: deps.privacyPepper,
      targetType: validation.metadata.targetType,
      category: validation.metadata.category,
      classificationDispute: validation.metadata.classificationDispute,
    });
    deps.store.save(stored);

    const statusHref = CORRECTION_STATUS_PATH;
    if (idempotencyKey) {
      deps.idempotencyCache.set(idempotencyKey, {
        receiptCode: stored.receiptCode,
        statusHref,
        submissionId: stored.record.id,
      });
    }

    return jsonResponse(
      202,
      {
        accepted: true,
        receiptCode: stored.receiptCode,
        statusHref,
      },
      request.requestId,
    );
  } finally {
    deps.rateLimitGuard.release(guard.rateKey);
  }
}

export async function handleCorrectionStatus(request: ApiRequest, deps: HandlerDeps): Promise<ApiResponse> {
  if (request.body === undefined) {
    return jsonError(400, 'invalid_json', request.requestId);
  }

  const body = request.body as { readonly receiptCode?: unknown };
  const receiptCode = typeof body.receiptCode === 'string' ? body.receiptCode.trim() : '';
  if (!receiptCode) {
    return jsonError(400, 'receipt_required', request.requestId);
  }

  const stored = deps.store.getByReceiptCode(receiptCode, deps.privacyPepper);
  if (!stored) {
    return jsonError(404, 'not_found', request.requestId);
  }

  const status = toPublicStatus(stored);
  if (!status) {
    return jsonError(404, 'not_found', request.requestId);
  }

  return jsonResponse(200, { status }, request.requestId);
}

export function requirePrivacyPepper(environment: NodeJS.ProcessEnv = process.env): string {
  const pepper = environment.SUBMISSION_PRIVACY_PEPPER;
  if (pepper && pepper.trim()) return pepper;
  if (environment.NODE_ENV === 'production') {
    throw new Error('SUBMISSION_PRIVACY_PEPPER must be set in production');
  }
  return 'local-dev-only-pepper-do-not-use-in-production';
}

export function createDefaultHandlerDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  const repository = createInMemorySubmissionQuarantineRepository();
  const privacyPepper = requirePrivacyPepper();
  return {
    quarantineService: createSubmissionQuarantineService({ repository, privacyPepper }),
    appCheckGuard: createSubmissionsApiAppCheckGuard({ environment: { APP_CHECK_MODE: 'enforce' } }),
    rateLimitGuard: createSubmissionsRateLimitGuard({ now: () => 0 }),
    store: createCorrectionReceiptStore(),
    idempotencyCache: createIdempotencyCache(),
    privacyPepper,
    now: () => 0,
    ...overrides,
  };
}
