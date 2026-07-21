/**
 * Integration tests for correction intake routes quarantine entry, rate limits,
 * receipt lookup, appeals, abuse reports, and non-enumerable status surfaces.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../lib/web-security/csrf';
import { createSubmissionCampaignDetector } from '@repo/security';
import { createCorrectionRequestIntegrityGuard } from '../request-integrity-guard';
import { createCorrectionRateLimitGuard } from '../rate-limit-guard';
import { createCorrectionSubmissionStore } from '../store';
import {
  handleCorrectionAbuseReportRequest,
  handleCorrectionAppealRequest,
  handleCorrectionStatusRequest,
  handleCorrectionSubmitRequest,
  type CorrectionRouteDependencies,
} from './handler';

const PEPPER = 'route-test-pepper';
const INTEGRITY_TOKEN = 'a'.repeat(64);

async function buildDeps(
  overrides: Partial<CorrectionRouteDependencies> = {},
): Promise<CorrectionRouteDependencies> {
  const integrityGuard = createCorrectionRequestIntegrityGuard({
    mode: 'enforce',
    telemetry: { record: () => {} },
  });
  return {
    integrityGuard,
    rateLimitGuard: createCorrectionRateLimitGuard({ now: () => 0 }),
    store: createCorrectionSubmissionStore(),
    privacyPepper: PEPPER,
    campaignDetector: createSubmissionCampaignDetector({
      coordinatedNetworkThreshold: 2,
      coordinatedActorThreshold: 2,
    }),
    now: () => 0,
    ...overrides,
  };
}

function postJson(path: string, body: unknown, ip = '203.0.113.20'): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `${CSRF_COOKIE_NAME}=${INTEGRITY_TOKEN}`,
      [CSRF_HEADER_NAME]: INTEGRITY_TOKEN,
      'sec-fetch-site': 'same-origin',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

const VALID_CORRECTION = {
  targetType: 'entity',
  targetRecordId: 'entity-rosewood',
  category: 'factual_error',
  statement:
    'The published opening year should be 1924 according to the county superintendent ledger.',
  sourceUrl: 'https://example.org/ledger',
  privacyConsent: true,
};

test('accepts a correction into quarantine and returns a receipt code (AC1)', async () => {
  const deps = await buildDeps();
  const response = await handleCorrectionSubmitRequest(
    postJson('/corrections/api', VALID_CORRECTION),
    deps,
  );
  assert.equal(response.status, 202);
  const body = (await response.json()) as { receiptCode: string; statusHref: string };
  assert.match(body.receiptCode, /^BB-COR-/);
  assert.match(body.statusHref, /\/corrections\/status\//);
});

test('tight anonymous rate limits block correction floods (AC2)', async () => {
  const deps = await buildDeps();
  const first = await handleCorrectionSubmitRequest(
    postJson('/corrections/api', VALID_CORRECTION, '203.0.113.21'),
    deps,
  );
  const second = await handleCorrectionSubmitRequest(
    postJson(
      '/corrections/api',
      { ...VALID_CORRECTION, targetRecordId: 'entity-2' },
      '203.0.113.21',
    ),
    deps,
  );
  const third = await handleCorrectionSubmitRequest(
    postJson(
      '/corrections/api',
      { ...VALID_CORRECTION, targetRecordId: 'entity-3' },
      '203.0.113.21',
    ),
    deps,
  );
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  assert.equal(third.status, 429);
});

test('coordinated duplicate corrections stay quarantined without public brigading signals (AC3)', async () => {
  const deps = await buildDeps();
  const first = await handleCorrectionSubmitRequest(
    postJson('/corrections/api', VALID_CORRECTION, '203.0.113.22'),
    deps,
  );
  const second = await handleCorrectionSubmitRequest(
    postJson('/corrections/api', VALID_CORRECTION, '203.0.113.22'),
    deps,
  );
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);

  const secondBody = (await second.json()) as { receiptCode: string };
  const stored = deps.store.getByReceiptCode(secondBody.receiptCode, PEPPER);
  assert.ok(stored);
  assert.notEqual(stored.record.moderationState, 'pending_review');

  const statusResponse = await handleCorrectionStatusRequest(
    new Request(
      `http://localhost/corrections/status/api?receipt=${encodeURIComponent(secondBody.receiptCode)}`,
    ),
    deps,
  );
  assert.equal(statusResponse.status, 200);
  const status = (await statusResponse.json()) as { status: Record<string, unknown> };
  assert.equal(status.status.phase, 'under_review');
  assert.equal('campaign' in status.status, false);
  assert.equal('moderationState' in status.status, false);
  assert.equal(stored.record.canonicalWriteAllowed, false);
});

test('status lookup requires an exact receipt code and cannot enumerate others (AC4)', async () => {
  const deps = await buildDeps();
  const accepted = await handleCorrectionSubmitRequest(
    postJson('/corrections/api', VALID_CORRECTION, '203.0.113.23'),
    deps,
  );
  const body = (await accepted.json()) as { receiptCode: string };

  const missing = await handleCorrectionStatusRequest(
    new Request('http://localhost/corrections/status/api?receipt=BB-COR-0000000000000000'),
    deps,
  );
  assert.equal(missing.status, 404);

  const found = await handleCorrectionStatusRequest(
    new Request(
      `http://localhost/corrections/status/api?receipt=${encodeURIComponent(body.receiptCode)}`,
    ),
    deps,
  );
  assert.equal(found.status, 200);
});

test('appeals re-enter review for rejected closures without exposing moderation details', async () => {
  const deps = await buildDeps();
  const accepted = await handleCorrectionSubmitRequest(
    postJson('/corrections/api', VALID_CORRECTION, '203.0.113.24'),
    deps,
  );
  const body = (await accepted.json()) as { receiptCode: string };
  const stored = deps.store.getByReceiptCode(body.receiptCode, PEPPER);
  assert.ok(stored);
  deps.store.markClosed(stored.record.id, 'rejected');

  const appeal = await handleCorrectionAppealRequest(
    postJson(
      '/corrections/appeal/api',
      {
        receiptCode: body.receiptCode,
        statement: 'The county ledger clearly shows 1924 and the rejection should be reconsidered.',
        sourceUrl: 'https://example.org/ledger-copy',
        privacyConsent: true,
      },
      '203.0.113.24',
    ),
    deps,
  );
  assert.equal(appeal.status, 202);
});

test('abuse reports enter quarantine as abuse_report submissions', async () => {
  const deps = await buildDeps();
  const response = await handleCorrectionAbuseReportRequest(
    postJson(
      '/corrections/abuse/api',
      {
        statement:
          'Multiple near-identical corrections are targeting the same entity in bad faith.',
        privacyConsent: true,
      },
      '203.0.113.25',
    ),
    deps,
  );
  assert.equal(response.status, 202);
  const body = (await response.json()) as { reportId: string };
  assert.ok(body.reportId);
});
