/**
 * Correction submission + status-lookup client (MOB-016 #2, #3, #4).
 *
 * This is a self-contained, dependency-injected transport for the corrections
 * write path — it deliberately does NOT reuse the generic `createApiClient`
 * (`src/security/api-client.ts`), because that client FAILS OPEN (sends the
 * request unattested when no App Check token is available). Corrections must
 * FAIL CLOSED: per the threat-model's corrections resolution
 * (docs/mobile/security/threat-model.md, "App Check posture on MOB-016") and
 * requirement #2, a submit with no obtainable attestation token is NOT sent —
 * the user is told to try again rather than an unattested write going out.
 *
 * It reuses the exact header names the server reads (`APP_CHECK_HEADER`,
 * `CLIENT_VERSION_HEADER`) from the security module so attestation is attached
 * identically to every other request.
 *
 * Nothing in here logs the statement, contact, or receipt code, and nothing
 * places them in a URL — the submit payload and the status receipt both ride
 * the POST body. No `console.*` call exists in this module (asserted by
 * `no-sensitive-leak.test.ts`).
 */
import { APP_CHECK_HEADER, CLIENT_VERSION_HEADER } from '@/security/api-client';
import type { Connectivity } from '@/data/offline';
import type { SecretStore } from '@/data/secure-store';
import {
  CORRECTIONS_API_MAJOR,
  CORRECTION_STATUS_PATH,
  CORRECTION_SUBMIT_PATH,
  IDEMPOTENCY_KEY_HEADER,
  type CorrectionAcceptedResponse,
  type CorrectionErrorEnvelope,
  type PublicCorrectionStatus,
} from './contract';
import { deriveIdempotencyKey } from './idempotency';
import { isReceiptCodeShape, persistReceiptCode } from './receipt';
import {
  validateCorrectionForm,
  type CorrectionFieldIssue,
  type CorrectionFormState,
} from './validation';

/** Token provider — same contract as `src/security/api-client.ts`. */
export type TokenProvider = (forceRefresh?: boolean) => Promise<string | null>;

export type CorrectionClientDeps = {
  /** Submissions-surface base URL (apps/api-submissions per ADR-021 §3). */
  readonly baseUrl: string;
  /** App version string for the `X-BlackStory-Client` floor header. */
  readonly clientVersion: string;
  readonly getToken: TokenProvider;
  readonly fetch: typeof fetch;
  /** Persists the opaque receipt (SecureStore, never SQLite). */
  readonly secrets: SecretStore;
  /** Connectivity signal — corrections do NOT queue when offline. */
  readonly connectivity?: Connectivity;
  readonly apiMajor?: number;
};

export type SubmitResult =
  | { readonly status: 'accepted'; readonly receiptCode: string; readonly statusHref: string }
  | { readonly status: 'invalid'; readonly issues: readonly CorrectionFieldIssue[] }
  | { readonly status: 'app_check_unavailable' }
  | { readonly status: 'offline' }
  | { readonly status: 'rate_limited'; readonly retryAfterSeconds?: number }
  | { readonly status: 'error' };

export type StatusResult =
  | { readonly status: 'found'; readonly correction: PublicCorrectionStatus }
  | { readonly status: 'not_found' }
  | { readonly status: 'invalid_code' }
  | { readonly status: 'offline' }
  | { readonly status: 'rate_limited'; readonly retryAfterSeconds?: number }
  | { readonly status: 'error' };

function clientVersionHeader(version: string, apiMajor: number): string {
  return `mobile/${version}; api=${apiMajor}`;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers?.get?.('retry-after');
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

async function readEnvelope(response: Response): Promise<CorrectionErrorEnvelope | undefined> {
  try {
    return (await response.json()) as CorrectionErrorEnvelope;
  } catch {
    return undefined;
  }
}

/**
 * Submit a correction. Fails CLOSED on missing attestation, refuses to send
 * when offline, and persists the receipt to SecureStore the instant it is
 * parsed (before any UI renders) so a kill-after-write still leaves the code
 * recoverable.
 */
export async function submitCorrection(
  state: CorrectionFormState,
  deps: CorrectionClientDeps,
): Promise<SubmitResult> {
  // 1. Client-side pre-validation (server re-validates authoritatively).
  const validation = validateCorrectionForm(state);
  if (!validation.valid) {
    return { status: 'invalid', issues: validation.issues };
  }

  // 2. Offline: do NOT queue. Corrections require a live connection.
  if (deps.connectivity && !deps.connectivity.isOnline()) {
    return { status: 'offline' };
  }

  // 3. FAIL CLOSED on App Check: no obtainable token → do not send.
  //
  // LIMITED-USE / REPLAY PROTECTION (bead requirement #2 — flagged for the
  // independent security review): this attaches a STANDARD App Check token via
  // the shared `getToken` provider. A write path like corrections is the classic
  // case for a Firebase *limited-use* App Check token (single-consumption,
  // server-verified via the replay-protection API) so a lifted token cannot be
  // replayed against the submissions endpoint. Wiring that requires
  // `getLimitedUseAppCheckToken` on the client (src/security/app-check.ts, out of
  // this bead's ownership) AND consume-once verification server-side
  // (apps/api-submissions). Until both exist, replay resistance rests on: (a) the
  // strictest submissions rate-limit tier + `missing_app_check` risk shedding
  // (threat-model corrections resolution), and (b) content-hash dedup +
  // idempotency key (§idempotency.ts) bounding the damage of a replayed WRITE to
  // a duplicate quarantine entry that cannot publish. See the report's reviewer flag.
  const token = await deps.getToken(false);
  if (!token) {
    return { status: 'app_check_unavailable' };
  }

  const apiMajor = deps.apiMajor ?? CORRECTIONS_API_MAJOR;
  const idempotencyKey = deriveIdempotencyKey(validation.payload);

  let response: Response;
  try {
    response = await deps.fetch(joinUrl(deps.baseUrl, CORRECTION_SUBMIT_PATH), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [APP_CHECK_HEADER]: token,
        [CLIENT_VERSION_HEADER]: clientVersionHeader(deps.clientVersion, apiMajor),
        [IDEMPOTENCY_KEY_HEADER]: idempotencyKey,
      },
      body: JSON.stringify(validation.payload),
    });
  } catch {
    return { status: 'error' };
  }

  if (response.status === 202) {
    const body = await readEnvelope(response);
    const accepted = body as unknown as CorrectionAcceptedResponse | undefined;
    if (accepted?.accepted && typeof accepted.receiptCode === 'string' && isReceiptCodeShape(accepted.receiptCode)) {
      // Persist BEFORE returning so the receipt survives a kill-before-display.
      await persistReceiptCode(deps.secrets, accepted.receiptCode);
      return {
        status: 'accepted',
        receiptCode: accepted.receiptCode,
        statusHref: typeof accepted.statusHref === 'string' ? accepted.statusHref : '',
      };
    }
    return { status: 'error' };
  }

  if (response.status === 429) {
    return { status: 'rate_limited', ...(parseRetryAfter(response) !== undefined ? { retryAfterSeconds: parseRetryAfter(response) } : {}) };
  }

  if (response.status === 400) {
    const body = await readEnvelope(response);
    if (body?.error === 'validation_failed' && Array.isArray(body.issues)) {
      return { status: 'invalid', issues: body.issues };
    }
    return { status: 'error' };
  }

  // 401/403 app_check_required (server rejected attestation) is surfaced as the
  // same fail-closed "try again" affordance — never as an authorization state.
  if (response.status === 401 || response.status === 403) {
    return { status: 'app_check_unavailable' };
  }

  return { status: 'error' };
}

/**
 * Look up a correction's coarse public status by opaque receipt code. Reads are
 * NOT gated on App Check (mirrors web's status handler, which has no App Check
 * guard); a token is attached when available but its absence never blocks a
 * read. The receipt travels in the POST body, never a URL/query string.
 */
export async function lookupCorrectionStatus(
  receiptCode: string,
  deps: CorrectionClientDeps,
): Promise<StatusResult> {
  const code = receiptCode.trim();
  if (!isReceiptCodeShape(code)) {
    return { status: 'invalid_code' };
  }
  if (deps.connectivity && !deps.connectivity.isOnline()) {
    return { status: 'offline' };
  }

  const apiMajor = deps.apiMajor ?? CORRECTIONS_API_MAJOR;
  const token = await deps.getToken(false);

  let response: Response;
  try {
    response = await deps.fetch(joinUrl(deps.baseUrl, CORRECTION_STATUS_PATH), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [CLIENT_VERSION_HEADER]: clientVersionHeader(deps.clientVersion, apiMajor),
        ...(token ? { [APP_CHECK_HEADER]: token } : {}),
      },
      body: JSON.stringify({ receiptCode: code }),
    });
  } catch {
    return { status: 'error' };
  }

  if (response.status === 200) {
    try {
      const body = (await response.json()) as { status?: PublicCorrectionStatus };
      if (body?.status && typeof body.status.phase === 'string') {
        return { status: 'found', correction: body.status };
      }
    } catch {
      return { status: 'error' };
    }
    return { status: 'error' };
  }

  if (response.status === 404) {
    return { status: 'not_found' };
  }

  if (response.status === 429) {
    return { status: 'rate_limited', ...(parseRetryAfter(response) !== undefined ? { retryAfterSeconds: parseRetryAfter(response) } : {}) };
  }

  return { status: 'error' };
}
