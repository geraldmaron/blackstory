/**
 * Corrections HTTP handler tests — quarantine intake, client attestation, rate limits,
 * idempotency, status lookup, and no canonical-write posture (MOB-016 / repo-zir9).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSubmissionsApiClientAttestationGuard } from '../client-attestation.ts';
import { createSubmissionsRateLimitGuard } from '../rate-limits.ts';
import {
  createInMemorySubmissionQuarantineRepository,
  createSubmissionQuarantineService,
} from '../quarantine.ts';
import { createCorrectionReceiptStore } from '../corrections/store.ts';
import { createIdempotencyCache } from '../corrections/idempotency-cache.ts';
import {
  CORRECTION_STATUS_PATH,
  CORRECTION_SUBMIT_PATH,
  IDEMPOTENCY_KEY_HEADER,
  handleCorrectionStatus,
  handleCorrectionSubmit,
  type ApiRequest,
  type HandlerDeps,
} from './handlers.ts';
import { dispatch } from './router.ts';

const PEPPER = 'route-test-pepper';
const CLIENT_HEADER = 'mobile/1.0.0; api=1';

const VALID_CORRECTION = {
  targetType: 'entity',
  targetRecordId: 'entity-rosewood',
  category: 'factual_error',
  statement: 'The published opening year should be 1924 according to the county superintendent ledger.',
  sourceUrl: 'https://example.org/ledger',
  privacyConsent: true,
} as const;

function buildDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  const repository = createInMemorySubmissionQuarantineRepository();
  const clientAttestationGuard = createSubmissionsApiClientAttestationGuard({
    environment: { CLIENT_ATTESTATION_MODE: 'enforce', NODE_ENV: 'production' },
    telemetry: { record: () => {} },
  });
  return {
    quarantineService: createSubmissionQuarantineService({
      repository,
      privacyPepper: PEPPER,
      now: () => 0,
    }),
    clientAttestationGuard,
    rateLimitGuard: createSubmissionsRateLimitGuard({ now: () => 0 }),
    store: createCorrectionReceiptStore(),
    idempotencyCache: createIdempotencyCache(),
    privacyPepper: PEPPER,
    now: () => 0,
    ...overrides,
  };
}

function makeRequest(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    clientIp?: string;
    requestId?: string;
  } = {},
): ApiRequest {
  return {
    method: init.method ?? 'POST',
    path,
    query: new URLSearchParams(),
    headers: Object.fromEntries(
      Object.entries(init.headers ?? { 'x-blackstory-client': CLIENT_HEADER }).map(([k, v]) => [
        k.toLowerCase(),
        v,
      ]),
    ),
    requestId: init.requestId ?? 'req_test_fixed',
    ...(init.clientIp ? { clientIp: init.clientIp } : {}),
    ...(init.body !== undefined ? { body: init.body } : {}),
  };
}

test('accepts a correction into quarantine and returns a receipt code', async () => {
  const deps = buildDeps();
  const response = await handleCorrectionSubmit(
    makeRequest(CORRECTION_SUBMIT_PATH, { body: VALID_CORRECTION, clientIp: '203.0.113.20' }),
    deps,
  );
  assert.equal(response.status, 202);
  const body = response.body as { receiptCode: string; statusHref: string; accepted: boolean };
  assert.equal(body.accepted, true);
  assert.match(body.receiptCode, /^BB-COR-/);
  assert.equal(body.statusHref, CORRECTION_STATUS_PATH);
});

test('rejects submit without client attestation', async () => {
  const deps = buildDeps();
  const response = await handleCorrectionSubmit(
    makeRequest(CORRECTION_SUBMIT_PATH, {
      body: VALID_CORRECTION,
      headers: {},
      clientIp: '203.0.113.30',
    }),
    deps,
  );
  assert.equal(response.status, 401);
  assert.equal((response.body as { error: string }).error, 'client_attestation_required');
});

test('tight anonymous rate limits block correction floods', async () => {
  const deps = buildDeps();
  const ip = '203.0.113.21';
  const first = await handleCorrectionSubmit(
    makeRequest(CORRECTION_SUBMIT_PATH, { body: VALID_CORRECTION, clientIp: ip }),
    deps,
  );
  const second = await handleCorrectionSubmit(
    makeRequest(CORRECTION_SUBMIT_PATH, {
      body: { ...VALID_CORRECTION, targetRecordId: 'entity-2' },
      clientIp: ip,
    }),
    deps,
  );
  const third = await handleCorrectionSubmit(
    makeRequest(CORRECTION_SUBMIT_PATH, {
      body: { ...VALID_CORRECTION, targetRecordId: 'entity-3' },
      clientIp: ip,
    }),
    deps,
  );
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  assert.equal(third.status, 429);
});

test('coordinated duplicate corrections stay quarantined without public brigading signals', async () => {
  const repository = createInMemorySubmissionQuarantineRepository();
  const deps = buildDeps({
    quarantineService: createSubmissionQuarantineService({
      repository,
      privacyPepper: PEPPER,
      now: () => 0,
    }),
  });
  const ip = '203.0.113.22';
  const first = await handleCorrectionSubmit(
    makeRequest(CORRECTION_SUBMIT_PATH, { body: VALID_CORRECTION, clientIp: ip }),
    deps,
  );
  const second = await handleCorrectionSubmit(
    makeRequest(CORRECTION_SUBMIT_PATH, { body: VALID_CORRECTION, clientIp: ip }),
    deps,
  );
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);

  const secondBody = second.body as { receiptCode: string };
  const stored = deps.store.getByReceiptCode(secondBody.receiptCode, PEPPER);
  assert.ok(stored);
  assert.notEqual(stored.record.moderationState, 'pending_review');
  assert.ok(
    stored.record.moderationState === 'duplicate' ||
      stored.record.moderationState === 'coordinated_campaign',
  );
  assert.equal(stored.record.canonicalWriteAllowed, false);

  const statusResponse = await handleCorrectionStatus(
    makeRequest(CORRECTION_STATUS_PATH, { body: { receiptCode: secondBody.receiptCode } }),
    deps,
  );
  assert.equal(statusResponse.status, 200);
  const status = (statusResponse.body as { status: Record<string, unknown> }).status;
  assert.equal(status.phase, 'under_review');
  assert.equal('campaign' in status, false);
  assert.equal('moderationState' in status, false);
});

test('status lookup requires an exact receipt code and cannot enumerate others', async () => {
  const deps = buildDeps();
  const accepted = await handleCorrectionSubmit(
    makeRequest(CORRECTION_SUBMIT_PATH, { body: VALID_CORRECTION, clientIp: '203.0.113.23' }),
    deps,
  );
  const body = accepted.body as { receiptCode: string };

  const missing = await handleCorrectionStatus(
    makeRequest(CORRECTION_STATUS_PATH, { body: { receiptCode: 'BB-COR-0000000000000000' } }),
    deps,
  );
  assert.equal(missing.status, 404);

  const found = await handleCorrectionStatus(
    makeRequest(CORRECTION_STATUS_PATH, { body: { receiptCode: body.receiptCode } }),
    deps,
  );
  assert.equal(found.status, 200);
});

test('idempotency header collapses retries to the same receipt without a second quarantine write', async () => {
  const deps = buildDeps();
  const key = 'bbcor-deadbeef00112233';
  const first = await handleCorrectionSubmit(
    makeRequest(CORRECTION_SUBMIT_PATH, {
      body: VALID_CORRECTION,
      clientIp: '203.0.113.24',
      headers: { 'x-blackstory-client': CLIENT_HEADER, [IDEMPOTENCY_KEY_HEADER]: key },
    }),
    deps,
  );
  const second = await handleCorrectionSubmit(
    makeRequest(CORRECTION_SUBMIT_PATH, {
      body: VALID_CORRECTION,
      clientIp: '203.0.113.24',
      headers: { 'x-blackstory-client': CLIENT_HEADER, [IDEMPOTENCY_KEY_HEADER]: key },
    }),
    deps,
  );
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  assert.deepEqual(first.body, second.body);
  assert.equal(deps.quarantineService.repository.list().length, 1);
});

test('router dispatches only the documented MOB-016 paths', async () => {
  const deps = buildDeps();
  const health = await dispatch(
    makeRequest('/v1/health', { method: 'GET', body: undefined, headers: {} }),
    deps,
  );
  assert.equal(health.status, 200);
  assert.equal((health.body as { surface: string }).surface, 'api-submissions');

  const unknown = await dispatch(makeRequest('/v1/unknown', { body: {} }), deps);
  assert.equal(unknown.status, 404);
});
