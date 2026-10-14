/** Real Postgres intake-to-admin regression. Opt in with a disposable local database only. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { POST as submitLead } from '../../app/submit/api/route';
import {
  handleCorrectionSubmitRequest,
  handleCorrectionStatusRequest,
  handleCorrectionAppealRequest,
  handleCorrectionAbuseReportRequest,
  type CorrectionRouteDependencies,
} from '../../app/corrections/api/handler';
import { createCorrectionRateLimitGuard } from '../../app/corrections/rate-limit-guard';
import { createCorrectionRequestIntegrityGuard } from '../../app/corrections/request-integrity-guard';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../web-security/csrf';
import { createPostgresCorrectionSubmissionStore } from './corrections-store';
import {
  __resetPostgresPoolForTests as resetPublic,
  queryPostgres as publicQuery,
} from './postgres-client';
import {
  __resetPostgresPoolForTests as resetAdmin,
  queryPostgres,
} from '../../admin/lib/canonical-postgres-client';
import {
  commitSubmissionDecision,
  getIntakeItemDetail,
  queryIntakeItemPage,
} from '../../admin/lib/postgres-submissions';

const databaseUrl = process.env.APP_INTAKE_QA_DATABASE_URL;
const skip = !databaseUrl;
const pepper = 'disposable-intake-qa-pepper';
const tag = `intake-qa-${randomUUID()}`;
const ids: string[] = [];
const savedEnvironment = { ...process.env };

before(async () => {
  if (!databaseUrl) return;
  const url = new URL(databaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'QA must use local Postgres');
  assert.equal(url.pathname, '/blackstory_intake_qa', 'QA must use the isolated intake database');
  process.env.ADMIN_DATABASE_URL = databaseUrl;
  url.searchParams.set('options', '-c role=web_public');
  process.env.DATABASE_URL = url.toString();
  process.env.DATABASE_SSL = '0';
  process.env.SUBMISSION_PRIVACY_PEPPER = pepper;
  await resetPublic();
  await resetAdmin();
});

after(async () => {
  if (!databaseUrl) return;
  // Only remove this test's rows, never sweep the database.
  await queryPostgres('DELETE FROM research.cases WHERE candidate_id = ANY($1::text[])', [ids]);
  await queryPostgres('DELETE FROM submissions.intake_items WHERE id = ANY($1::text[])', [ids]);
  await resetPublic();
  await resetAdmin();
  process.env = savedEnvironment;
});

function request(path: string, body: unknown): Request {
  const token = 'a'.repeat(64);
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `${CSRF_COOKIE_NAME}=${token}`,
      [CSRF_HEADER_NAME]: token,
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(body),
  });
}

function deps(): CorrectionRouteDependencies {
  return {
    store: createPostgresCorrectionSubmissionStore(),
    privacyPepper: pepper,
    integrityGuard: createCorrectionRequestIntegrityGuard({ mode: 'enforce' }),
    rateLimitGuard: createCorrectionRateLimitGuard(),
  };
}

async function receiptStatus(receipt: string) {
  const response = await handleCorrectionStatusRequest(
    new Request(`http://localhost/corrections/status/api?receipt=${receipt}`),
    deps(),
  );
  assert.equal(response.status, 200);
  return (await response.json()).status;
}

test(
  'accepted web lead persists in the staff queue and survives a new database connection',
  { skip },
  async () => {
    const response = await submitLead(
      request('/submit/api', {
        url: 'https://example.org/ledger',
        whyItMatters: `${tag}: documents a local school opening.`,
      }),
    );
    assert.equal(response.status, 202);
    const { submissionId } = await response.json();
    ids.push(submissionId);
    await resetPublic();
    const item = await getIntakeItemDetail(submissionId);
    assert.ok(item, '202 must mean a durable row exists for staff');
    assert.equal(item.status, 'quarantined');
    assert.equal(item.kind, 'contribution');
    const page = await queryIntakeItemPage({ search: tag, statuses: ['quarantined'] });
    assert.ok(page.rows.some((row) => row.id === submissionId));
  },
);

test(
  'correction decisions, receipt lookup, concurrent appeals and promotion share durable state',
  { skip },
  async () => {
    const response = await handleCorrectionSubmitRequest(
      request('/corrections/api', {
        targetType: 'entity',
        targetRecordId: tag,
        category: 'factual_error',
        statement: 'The county ledger dates this school opening to 1924 rather than 1923.',
        sourceUrl: 'https://example.org/ledger',
        privacyConsent: true,
      }),
      deps(),
    );
    assert.equal(response.status, 202);
    const { receiptCode } = await response.json();
    const entry = await deps().store.getByReceiptCode(receiptCode, pepper);
    assert.ok(entry);
    ids.push(entry.record.id);
    const readIdentity = async () => ({
      uid: randomUUID(),
      email: 'qa@example.invalid',
      role: 'admin' as const,
    });
    const initialPromotion = await commitSubmissionDecision(
      { intakeItemId: entry.record.id, decision: 'promote', reason: 'QA: begin research.' },
      { readIdentity },
    );
    assert.equal(initialPromotion.status, 'ok');
    const rejected = await commitSubmissionDecision(
      {
        intakeItemId: entry.record.id,
        decision: 'reject',
        reason: 'QA: verify receipt lifecycle.',
      },
      { readIdentity },
    );
    assert.equal(rejected.status, 'ok');
    await resetPublic();
    assert.equal((await receiptStatus(receiptCode)).phase, 'closed');
    assert.equal((await receiptStatus(receiptCode)).appealAvailable, true);

    const invalid = await handleCorrectionAppealRequest(
      request('/corrections/appeal/api', {
        receiptCode,
        statement: 'Please reconsider the original ledger and its opening date.',
        sourceUrl: 'http://example.org/insecure',
        privacyConsent: true,
      }),
      deps(),
    );
    assert.equal(invalid.status, 400);
    assert.equal(
      (await receiptStatus(receiptCode)).appealAvailable,
      true,
      'invalid evidence must not consume the appeal',
    );

    const appeal = () =>
      handleCorrectionAppealRequest(
        request('/corrections/appeal/api', {
          receiptCode,
          statement: 'Please reconsider the original ledger and its opening date.',
          sourceUrl: 'https://example.org/appeal-evidence',
          privacyConsent: true,
        }),
        deps(),
      );
    const concurrent = await Promise.all([appeal(), appeal()]);
    assert.equal(concurrent.filter((result) => result.status === 202).length, 1);
    assert.ok(concurrent.some((result) => [403, 409].includes(result.status)));
    assert.equal((await getIntakeItemDetail(entry.record.id))?.status, 'quarantined');
    const reopened = await deps().store.getByReceiptCode(receiptCode, pepper);
    assert.equal(reopened?.appeals.length, 1);
    assert.deepEqual(reopened?.appeals[0]?.record?.normalized.sourceUrls, [
      'https://example.org/appeal-evidence',
    ]);
    assert.equal((await receiptStatus(receiptCode)).phase, 'received');
    assert.equal((await receiptStatus(receiptCode)).appealAvailable, false);
    assert.deepEqual(reopened?.record.original, entry.record.original);

    const promoted = await commitSubmissionDecision(
      {
        intakeItemId: entry.record.id,
        decision: 'promote',
        reason: 'QA: investigate the appealed evidence.',
      },
      { readIdentity },
    );
    assert.equal(promoted.status, 'ok');
    if (promoted.status === 'ok' && initialPromotion.status === 'ok') {
      assert.equal(promoted.researchCaseId, initialPromotion.researchCaseId);
    }
    assert.equal((await receiptStatus(receiptCode)).phase, 'under_review');
    const cases = await queryPostgres('SELECT id FROM research.cases WHERE candidate_id = $1', [
      entry.record.id,
    ]);
    assert.equal(cases.length, 1);
    const audit = await queryPostgres("SELECT id FROM audit.events WHERE subject->>'id' = $1", [
      entry.record.id,
    ]);
    assert.equal(audit.length, 3);
    const resolved = await commitSubmissionDecision(
      {
        intakeItemId: entry.record.id,
        decision: 'resolve',
        reason: 'QA: verified the resulting record change.',
      },
      { readIdentity },
    );
    assert.equal(resolved.status, 'ok');
    assert.equal((await receiptStatus(receiptCode)).phase, 'closed');
    assert.equal((await receiptStatus(receiptCode)).appealAvailable, false);
    assert.equal(
      (
        await commitSubmissionDecision(
          { intakeItemId: entry.record.id, decision: 'resolve', reason: 'Repeated request.' },
          { readIdentity },
        )
      ).status,
      'already_processed',
    );
    await assert.rejects(
      publicQuery('UPDATE submissions.intake_items SET status = $1 WHERE id = $2', [
        'promoted',
        entry.record.id,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      publicQuery('SELECT id FROM canonical.entities LIMIT 1'),
      /permission denied/,
    );
  },
);

test('abuse reports land in the same staff queue', { skip }, async () => {
  const response = await handleCorrectionAbuseReportRequest(
    request('/corrections/abuse/api', {
      statement: `${tag}: repeated abusive corrections target this school record.`,
      sourceUrl: 'https://example.org/report',
      privacyConsent: true,
    }),
    deps(),
  );
  assert.equal(response.status, 202);
  const { reportId } = await response.json();
  ids.push(reportId);
  assert.equal((await getIntakeItemDetail(reportId))?.kind, 'abuse_report');
});
