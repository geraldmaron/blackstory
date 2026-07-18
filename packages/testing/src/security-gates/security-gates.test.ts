
/**
 * local security contracts: API abuse, browser attacks, SSRF, BOLA,
 * mass assignment, resource exhaustion, suppression expiry, and release evidence.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertAdminPermission } from '../../../firebase/src/admin-auth.ts';
import {
  evaluateDailyBudget,
  evaluateExternalUrl,
  evaluateSearchQueryGuardrails,
  resolveAndPinDestination,
  validateAndNormalizeSubmission,
} from '../../../security/src/index.ts';
import {
  authorizeApiOperation,
  escapeUntrustedHtml,
  filterSubmissionPatch,
  validateBrowserMutation,
  validateReleaseSecurityEvidence,
  validateStagingDastConfiguration,
  validateSuppression,
} from './contracts.ts';
import {
  CSRF_TOKEN_FIXTURE,
  MASS_ASSIGNMENT_FIXTURE,
  RESOURCE_CONSUMPTION_FIXTURES,
  SSRF_URL_FIXTURES,
  TEST_COMMIT_SHA,
  TEST_IMAGE_DIGEST,
  XSS_TEXT_FIXTURES,
} from './fixtures.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

describe('API authorization and OWASP API abuse contracts', () => {
  it('rejects anonymous internal operations and cross-owner BOLA access', () => {
    assert.deepEqual(
      authorizeApiOperation({ kind: 'anonymous' }, { kind: 'publication_activate' }),
      { allowed: false, reason: 'authenticated_identity_required', status: 401 },
    );
    assert.deepEqual(
      authorizeApiOperation(
        { kind: 'end_user', subject: 'user-a' },
        { kind: 'submission_update', ownerSubject: 'user-b' },
      ),
      { allowed: false, reason: 'object_owner_mismatch', status: 403 },
    );
  });

  it('allows only the publication worker or MFA publication staff to activate releases', () => {
    assert.equal(
      authorizeApiOperation(
        { kind: 'service', subject: 'worker-1', service: 'research-worker' },
        { kind: 'publication_activate' },
      ).allowed,
      false,
    );
    assert.equal(
      authorizeApiOperation(
        {
          kind: 'staff',
          subject: 'publisher-1',
          roles: ['publication'],
          mfa: true,
        },
        { kind: 'publication_activate' },
      ).allowed,
      true,
    );
  });

  it('calls the Firebase administrator permission gate for end-user token rejection', () => {
    assert.throws(
      () =>
        assertAdminPermission(
          {
            uid: 'end-user',
            auth_time: 1,
            bb_roles: [],
            amr: ['pwd'],
          },
          'publication:publish',
        ),
      /administrator identity|multi-factor/iu,
    );
  });
});

describe('SSRF, XSS, CSRF, and mass-assignment fixtures', () => {
  it('rejects local, metadata, private, and loopback SSRF destinations', async () => {
    for (const url of SSRF_URL_FIXTURES) {
      const parsed = evaluateExternalUrl(url);
      if (!parsed.allowed) continue;
      const resolved = await resolveAndPinDestination(parsed.value, async (hostname) => [
        {
          address: hostname,
          family: hostname.includes(':') ? 6 : 4,
        },
      ]);
      assert.equal(resolved.allowed, false, `${url} must fail closed`);
    }
  });

  it('escapes active HTML metacharacters in every XSS fixture', () => {
    for (const fixture of XSS_TEXT_FIXTURES) {
      const escaped = escapeUntrustedHtml(fixture);
      assert.equal(/[<>"']/u.test(escaped), false, escaped);
    }
  });

  it('requires same-origin CSRF proof for browser mutations', () => {
    assert.equal(
      validateBrowserMutation({
        method: 'POST',
        origin: 'https://evil.example',
        expectedOrigin: 'https://admin.blackbook.example',
        csrfCookie: CSRF_TOKEN_FIXTURE,
        csrfHeader: CSRF_TOKEN_FIXTURE,
      }).allowed,
      false,
    );
    assert.equal(
      validateBrowserMutation({
        method: 'POST',
        origin: 'https://admin.blackbook.example',
        expectedOrigin: 'https://admin.blackbook.example',
        csrfCookie: CSRF_TOKEN_FIXTURE,
        csrfHeader: CSRF_TOKEN_FIXTURE,
      }).allowed,
      true,
    );
  });

  it('drops and reports privileged mass-assignment fields', () => {
    const result = filterSubmissionPatch(MASS_ASSIGNMENT_FIXTURE);
    assert.deepEqual(result.patch, {
      title: MASS_ASSIGNMENT_FIXTURE.title,
      statement: MASS_ASSIGNMENT_FIXTURE.statement,
    });
    assert.deepEqual(result.rejectedKeys, [
      'moderationState',
      'ownerSubject',
      'publicationState',
      'roles',
    ]);
  });
});

describe('resource-consumption controls', () => {
  it('fails closed for regex and oversized search inputs', () => {
    assert.equal(
      evaluateSearchQueryGuardrails({ q: RESOURCE_CONSUMPTION_FIXTURES.regexQuery }).allowed,
      false,
    );
    assert.equal(
      evaluateSearchQueryGuardrails({ q: RESOURCE_CONSUMPTION_FIXTURES.oversizedQuery }).allowed,
      false,
    );
  });

  it('rejects oversized submissions and hard-stops exhausted source-fetch budget', () => {
    const submission = validateAndNormalizeSubmission({
      kind: 'correction',
      title: 'Bounded title',
      statement: RESOURCE_CONSUMPTION_FIXTURES.oversizedStatement,
      sourceUrls: [],
    });
    assert.equal(submission.valid, false);
    const budget = evaluateDailyBudget({
      category: 'source_fetch',
      consumed: RESOURCE_CONSUMPTION_FIXTURES.exhaustedDailySourceFetches,
    });
    assert.equal(budget.allowed, false);
    assert.equal(budget.hardStopTriggered, true);
  });
});

describe('CI policy, suppression, DAST, and release gates', () => {
  it('requires reason, owner, and future expiration on suppressions', () => {
    assert.deepEqual(
      validateSuppression(
        {
          id: 'SUP-001',
          tool: 'trivy',
          finding: 'CVE-0000-0000',
          reason: 'Compensating control is tracked until the fixed image is available.',
          owner: 'security/alice',
          expiresAt: '2027-01-01T00:00:00.000Z',
        },
        new Date('2026-07-17T00:00:00.000Z'),
      ),
      [],
    );
    assert.deepEqual(
      validateSuppression(
        {
          id: 'SUP-002',
          tool: 'codeql',
          finding: 'js/example',
          reason: '',
          owner: 'nobody',
          expiresAt: '2026-01-01T00:00:00.000Z',
        },
        new Date('2026-07-17T00:00:00.000Z'),
      ),
      ['reason_required', 'owner_team_and_handle_required', 'expiration_not_future'],
    );
  });

  it('forbids production DAST and requires isolated staging identities', () => {
    assert.deepEqual(
      validateStagingDastConfiguration({
        baseUrl: 'https://api.staging.blackbook.example',
        identityLabel: 'ds-security-dast-pr-42',
        environment: 'staging',
      }),
      [],
    );
    assert.ok(
      validateStagingDastConfiguration({
        baseUrl: 'https://blackbook.example',
        identityLabel: 'admin',
        environment: 'production',
      }).length >= 3,
    );
  });

  it('binds deployment to the tested commit, scanned digest, signature, and artifacts', () => {
    assert.deepEqual(
      validateReleaseSecurityEvidence({
        testedCommitSha: TEST_COMMIT_SHA,
        deployedCommitSha: TEST_COMMIT_SHA,
        imageReference: `us-docker.pkg.dev/project/repo/api@${TEST_IMAGE_DIGEST}`,
        testedImageDigest: TEST_IMAGE_DIGEST,
        deployedImageDigest: TEST_IMAGE_DIGEST,
        signature: {
          verified: true,
          signedDigest: TEST_IMAGE_DIGEST,
          issuer: 'https://token.actions.githubusercontent.com',
          identity: 'https://github.com/org/repo/.github/workflows/release.yml@refs/heads/main',
        },
        artifacts: [
          { name: 'sbom.spdx.json', retainedWithRelease: true },
          { name: 'trivy-results.sarif', retainedWithRelease: true },
        ],
      }),
      [],
    );
  });

  it('keeps machine policy and suppression schema parseable and fail-closed', () => {
    const policy = JSON.parse(
      readFileSync(join(repoRoot, 'infra/github/security-gates/policy.json'), 'utf8'),
    ) as {
      severity: { productionBlocking: readonly string[] };
      release: { requireExactCommit: boolean; requireImageDigest: boolean };
    };
    const schema = JSON.parse(
      readFileSync(join(repoRoot, 'infra/github/security-gates/suppression.schema.json'), 'utf8'),
    ) as {
      required: readonly string[];
      properties: { suppressions: { items: { required: string[] } } };
    };
    assert.deepEqual(policy.severity.productionBlocking, ['critical', 'high']);
    assert.equal(policy.release.requireExactCommit, true);
    assert.equal(policy.release.requireImageDigest, true);
    assert.ok(schema.required.includes('suppressions'));
    assert.deepEqual(schema.properties.suppressions.items.required, [
      'id',
      'tool',
      'finding',
      'reason',
      'owner',
      'expiresAt',
    ]);
  });
});
