/**
 * BB-004 acceptance: real adversarial-submission fixtures from the shared threat corpus
 * (`@black-book/testing`'s BB-036 security-gate fixtures, the harmless deterministic attack
 * payloads used across this repo's API and policy contract tests) run through the exact
 * BB-029 quarantine entry point this lane's public submission path calls
 * (`createQuarantinedSubmission` from `@black-book/security`) and are confirmed to never reach
 * canonical storage or a discovery candidate. These are not synthetic fixtures written for
 * this test — they are the corpus already used to gate T-01/T-02 (resource exhaustion),
 * T-04 (mass assignment / BOLA), and T-07 (data poisoning) in `docs/security/threat-corpus.json`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MASS_ASSIGNMENT_FIXTURE,
  RESOURCE_CONSUMPTION_FIXTURES,
  SSRF_URL_FIXTURES,
  XSS_TEXT_FIXTURES,
} from '@black-book/testing';
import {
  createQuarantinedSubmission,
  createSubmissionCampaignDetector,
  type SubmissionIntakeContext,
} from '@black-book/security';

const NOW_MS = Date.parse('2026-07-17T04:00:00.000Z');

function context(overrides: Partial<SubmissionIntakeContext> = {}): SubmissionIntakeContext {
  return {
    receivedAtMs: NOW_MS,
    privacyPepper: 'test-pepper-do-not-use-in-prod',
    ...overrides,
  };
}

test('SSRF URL fixtures cannot enter quarantine as source URLs — rejected before storage', () => {
  for (const ssrfUrl of SSRF_URL_FIXTURES) {
    const result = createQuarantinedSubmission(
      {
        kind: 'contribution',
        title: 'A lead worth reviewing',
        statement:
          'This statement is long enough to pass the minimum length check on its own merits.',
        sourceUrls: [ssrfUrl],
      },
      context(),
    );
    assert.equal(result.accepted, false, `expected ${ssrfUrl} to be rejected outright`);
    if (result.accepted) continue;
    assert.ok(
      result.rejection.issues.some((issue) => issue.reason === 'source_url_invalid'),
      `expected a source_url_invalid issue for ${ssrfUrl}`,
    );
  }
});

test('XSS payloads land inert in quarantine, never as a canonical write', () => {
  for (const payload of XSS_TEXT_FIXTURES) {
    const result = createQuarantinedSubmission(
      {
        kind: 'contribution',
        title: `Lead: ${payload}`,
        statement: `${payload} — reported from a closed community group, needs independent review.`,
        sourceUrls: ['https://example.org/community-notes'],
      },
      context(),
    );
    assert.equal(result.accepted, true, `expected ${payload} to be accepted into quarantine, not silently dropped`);
    if (!result.accepted) continue;
    // The payload is stored verbatim (for moderator review) but only ever inside the
    // quarantine record — never marked eligible for a canonical or public write.
    assert.equal(result.record.destination, 'submission_quarantine');
    assert.equal(result.record.canonicalWriteAllowed, false);
    assert.ok(result.record.original.payload.statement.includes(payload));
  }
});

test('the mass-assignment fixture cannot smuggle privileged fields into quarantine', () => {
  const result = createQuarantinedSubmission(MASS_ASSIGNMENT_FIXTURE, context());
  assert.equal(result.accepted, false);
  if (result.accepted) return;
  assert.ok(result.rejection.issues.some((issue) => issue.reason === 'schema_invalid'));
  // Confirms the privileged keys themselves are the reason: a well-formed submission with the
  // same title/statement but none of the extra fields is accepted, proving the rejection was
  // about `ownerSubject`/`moderationState`/`publicationState`/`roles`, not the prose.
  const cleaned = createQuarantinedSubmission(
    {
      kind: 'contribution',
      title: MASS_ASSIGNMENT_FIXTURE.title,
      statement: MASS_ASSIGNMENT_FIXTURE.statement,
      sourceUrls: ['https://example.org/source'],
    },
    context(),
  );
  assert.equal(cleaned.accepted, true);
});

test('the oversized-statement resource-consumption fixture is rejected before storage', () => {
  const result = createQuarantinedSubmission(
    {
      kind: 'contribution',
      title: 'Oversized submission attempt',
      statement: RESOURCE_CONSUMPTION_FIXTURES.oversizedStatement,
      sourceUrls: ['https://example.org/source'],
    },
    context(),
  );
  assert.equal(result.accepted, false);
  if (result.accepted) return;
  assert.ok(
    result.rejection.issues.some(
      (issue) => issue.reason === 'oversized' || issue.reason === 'statement_invalid',
    ),
  );
});

test('a burst of near-identical submissions from one actor is flagged as a coordinated campaign, never promoted by volume', () => {
  const shared = {
    kind: 'contribution' as const,
    title: 'The same lead, resubmitted',
    statement: 'Repeated submission of the same unverified claim from the same actor cluster.',
    sourceUrls: ['https://example.org/same-source'],
  };
  const sharedDetector = createSubmissionCampaignDetector();
  let lastFlagged = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = createQuarantinedSubmission(
      shared,
      context({ submitterToken: 'actor-token-fixed', receivedAtMs: NOW_MS + attempt * 1_000 }),
      sharedDetector,
    );
    assert.equal(result.accepted, true);
    if (!result.accepted) continue;
    lastFlagged =
      result.record.moderationState === 'coordinated_campaign' ||
      result.record.moderationState === 'duplicate';
    assert.equal(result.record.canonicalWriteAllowed, false);
  }
  assert.equal(
    lastFlagged,
    true,
    'repeated identical submissions must eventually be flagged, not accumulate silently',
  );
});
