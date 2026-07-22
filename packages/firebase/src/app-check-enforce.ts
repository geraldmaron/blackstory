/**
 * Verifies server-side Firebase App Check tokens with monitor/enforce rollout,
 * optional replay protection, token-safe telemetry, and optional verifier-outage
 * circuit-breaker hooks (repo-vdnm).
 */
import type { App } from 'firebase-admin/app';
import type { AppCheckCircuitBreaker } from './app-check-circuit-breaker.js';
import { getAppCheck } from 'firebase-admin/app-check';

export const APP_CHECK_HEADER = 'x-firebase-appcheck';

export type AppCheckMode = 'monitor' | 'enforce';
export type AppCheckFailureReason = 'missing_token' | 'invalid_token' | 'replayed_token';

export type VerifiedAppCheckToken = {
  readonly appId: string;
  readonly alreadyConsumed?: boolean;
};

export type AppCheckVerifier = {
  verifyToken(
    token: string,
    options: { readonly consumeAppCheckToken: boolean },
  ): Promise<VerifiedAppCheckToken>;
};

export type AppCheckTelemetryEvent = {
  readonly event: 'app_check_verification';
  readonly mode: AppCheckMode;
  readonly outcome: 'verified' | 'monitored_failure' | 'rejected' | 'trusted_service';
  readonly reason?: AppCheckFailureReason;
  readonly replayProtection: boolean;
};

export type AppCheckTelemetry = {
  record(event: AppCheckTelemetryEvent): void;
};

export type AppCheckHeaders =
  | { get(name: string): string | null }
  | Readonly<Record<string, string | readonly string[] | undefined>>;

export type TrustedServiceIdentity = {
  readonly kind: 'trusted-service';
  readonly principal: string;
  /** Must only be set after infrastructure IAM/IAP authentication succeeds. */
  readonly verified: true;
};

export type AppCheckRequest = {
  readonly headers: AppCheckHeaders;
  readonly identity?: TrustedServiceIdentity;
};

export type AppCheckDecision =
  | {
      readonly allowed: true;
      readonly verified: boolean;
      readonly mode: AppCheckMode;
      readonly appId?: string;
      readonly trustedService: boolean;
      readonly reason?: AppCheckFailureReason;
    }
  | {
      readonly allowed: false;
      readonly verified: false;
      readonly mode: 'enforce';
      readonly status: 401;
      readonly code: 'APP_CHECK_REQUIRED';
      readonly reason: AppCheckFailureReason;
      readonly trustedService: false;
    };

export type AppCheckGuardOptions = {
  readonly mode: AppCheckMode;
  readonly verifier: AppCheckVerifier;
  readonly telemetry: AppCheckTelemetry;
  /** Use only for low-volume, security-critical, or expensive operations. */
  readonly replayProtection?: boolean;
  /** Optional verifier-failure circuit breaker — records only provider throws, not missing tokens. */
  readonly circuitBreaker?: AppCheckCircuitBreaker;
};

export function parseAppCheckMode(value: string | undefined): AppCheckMode {
  if (value === undefined || value === '' || value === 'monitor') {
    return 'monitor';
  }
  if (value === 'enforce') {
    return 'enforce';
  }
  throw new Error('APP_CHECK_MODE must be "monitor" or "enforce"');
}

/**
 * Maps an *allowed* App Check decision onto `@repo/security`'s `appCheckVerified`
 * quota gate for anonymous expensive reads / mutations.
 *
 * Cryptographic verification always qualifies. Monitor-mode allow-through also
 * qualifies: monitor means observe without blocking, so the rate limiter must not
 * re-enforce a missing/invalid token as a fake `429 rate_limit_exceeded` (reason
 * `app_check_required`). Enforce-mode denials never reach this helper — the route
 * guard returns 401 first.
 */
export function appCheckSatisfiesRateLimitGate(
  decision: Extract<AppCheckDecision, { readonly allowed: true }>,
): boolean {
  return decision.verified || decision.mode === 'monitor';
}

export function createFirebaseAppCheckVerifier(app?: App): AppCheckVerifier {
  const appCheck = getAppCheck(app);
  return {
    async verifyToken(token, options) {
      const result = await appCheck.verifyToken(token, {
        consume: options.consumeAppCheckToken,
      });
      return {
        appId: result.appId,
        ...(result.alreadyConsumed === undefined
          ? {}
          : { alreadyConsumed: result.alreadyConsumed }),
      };
    },
  };
}

function readHeader(headers: AppCheckHeaders): string | undefined {
  if ('get' in headers && typeof headers.get === 'function') {
    return headers.get(APP_CHECK_HEADER) ?? undefined;
  }

  const record = headers as Readonly<Record<string, string | readonly string[] | undefined>>;
  const entry = Object.entries(record).find(([name]) => name.toLowerCase() === APP_CHECK_HEADER);
  const value = entry?.[1];
  return typeof value === 'string' ? value : value?.[0];
}

export function readAppCheckToken(headers: AppCheckHeaders): string | undefined {
  const value = readHeader(headers)?.trim();
  return value ? value : undefined;
}

function failureDecision(
  mode: AppCheckMode,
  reason: AppCheckFailureReason,
  replayProtection: boolean,
  telemetry: AppCheckTelemetry,
): AppCheckDecision {
  const enforced = mode === 'enforce';
  telemetry.record({
    event: 'app_check_verification',
    mode,
    outcome: enforced ? 'rejected' : 'monitored_failure',
    reason,
    replayProtection,
  });

  if (enforced) {
    return {
      allowed: false,
      verified: false,
      mode,
      status: 401,
      code: 'APP_CHECK_REQUIRED',
      reason,
      trustedService: false,
    };
  }
  return {
    allowed: true,
    verified: false,
    mode,
    trustedService: false,
    reason,
  };
}

export function createAppCheckGuard(
  options: AppCheckGuardOptions,
): (request: AppCheckRequest) => Promise<AppCheckDecision> {
  const replayProtection = options.replayProtection ?? false;

  return async (request) => {
    if (request.identity?.verified === true) {
      options.telemetry.record({
        event: 'app_check_verification',
        mode: options.mode,
        outcome: 'trusted_service',
        replayProtection: false,
      });
      return {
        allowed: true,
        verified: true,
        mode: options.mode,
        trustedService: true,
      };
    }

    const token = readAppCheckToken(request.headers);
    if (!token) {
      return failureDecision(options.mode, 'missing_token', replayProtection, options.telemetry);
    }

    try {
      const result = await options.verifier.verifyToken(token, {
        consumeAppCheckToken: replayProtection,
      });
      if (replayProtection && result.alreadyConsumed === true) {
        return failureDecision(options.mode, 'replayed_token', replayProtection, options.telemetry);
      }

      options.circuitBreaker?.recordVerifierSuccess();
      options.telemetry.record({
        event: 'app_check_verification',
        mode: options.mode,
        outcome: 'verified',
        replayProtection,
      });
      return {
        allowed: true,
        verified: true,
        mode: options.mode,
        appId: result.appId,
        trustedService: false,
      };
    } catch {
      options.circuitBreaker?.recordVerifierFailure();
      return failureDecision(options.mode, 'invalid_token', replayProtection, options.telemetry);
    }
  };
}
