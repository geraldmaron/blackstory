/**
 * Unit tests for the public "submit a lead" form-field shaping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SUBMISSION_VALIDATION_LIMITS,
  validateAndNormalizeSubmission,
} from '@repo/security';
import {
  MAX_LEAD_STATEMENT_LENGTH,
  leadStatementLength,
  validateLeadSubmission,
  type LeadSubmissionInput,
} from './lead-intake';

function baseInput(overrides: Partial<LeadSubmissionInput> = {}): LeadSubmissionInput {
  return {
    url: 'https://example.org/community-notes',
    whyItMatters: 'This documents a school building nobody else has recorded.',
    ...overrides,
  };
}

test('accepts a URL-only lead and shapes it into a contribution submission', () => {
  const result = validateLeadSubmission(baseInput());
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.payload.kind, 'contribution');
  assert.deepEqual(result.payload.sourceUrls, ['https://example.org/community-notes']);
  assert.match(result.payload.statement, /Why it matters:/);
});

test('accepts a description-only lead with no URL', () => {
  const result = validateLeadSubmission(
    baseInput({ url: undefined, description: 'An oral account passed down in my family.' }),
  );
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.payload.sourceUrls, []);
  assert.match(result.payload.statement, /An oral account passed down in my family\./);
});

test('rejects a lead with neither a URL nor a description', () => {
  const result = validateLeadSubmission(baseInput({ url: undefined }));
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.ok(result.issues.some((issue) => issue.field === 'url'));
});

test('rejects a lead whose whyItMatters is missing or too short', () => {
  const missing = validateLeadSubmission(baseInput({ whyItMatters: '' }));
  assert.equal(missing.valid, false);

  const tooShort = validateLeadSubmission(baseInput({ whyItMatters: 'short' }));
  assert.equal(tooShort.valid, false);
  if (tooShort.valid) return;
  assert.ok(tooShort.issues.some((issue) => issue.field === 'whyItMatters'));
});

test('rejects oversized fields rather than truncating silently', () => {
  const result = validateLeadSubmission(baseInput({ location: 'x'.repeat(500) }));
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.ok(result.issues.some((issue) => issue.field === 'location'));
});

test('composes location, era, and attestation into the statement when present', () => {
  const result = validateLeadSubmission(
    baseInput({ location: 'Durham, NC', era: '1920s', attestation: true }),
  );
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.match(result.payload.statement, /Location: Durham, NC/);
  assert.match(result.payload.statement, /Era: 1920s/);
  assert.match(result.payload.statement, /Contributor attestation: submitted as accurate/);
});

test('omits submitterContact when none is provided, includes it when present', () => {
  const withoutContact = validateLeadSubmission(baseInput());
  assert.equal(withoutContact.valid, true);
  if (withoutContact.valid) assert.equal('submitterContact' in withoutContact.payload, false);

  const withContact = validateLeadSubmission(baseInput({ contact: 'reachme@example.org' }));
  assert.equal(withContact.valid, true);
  if (withContact.valid) assert.equal(withContact.payload.submitterContact, 'reachme@example.org');
});

test('derives a title from the description when present, otherwise from whyItMatters', () => {
  const withDescription = validateLeadSubmission(
    baseInput({ description: 'A demolished Rosenwald school in this county.' }),
  );
  assert.equal(withDescription.valid, true);
  if (withDescription.valid) {
    assert.equal(withDescription.payload.title, 'A demolished Rosenwald school in this county.');
  }

  const withoutDescription = validateLeadSubmission(baseInput());
  assert.equal(withoutDescription.valid, true);
  if (withoutDescription.valid) {
    assert.equal(
      withoutDescription.payload.title,
      'This documents a school building nobody else has recorded.',
    );
  }
});

test('the whole-lead cap is the quarantine’s own, measured the way the quarantine measures it', () => {
  assert.equal(
    MAX_LEAD_STATEMENT_LENGTH,
    DEFAULT_SUBMISSION_VALIDATION_LIMITS.maxStatementCharacters,
  );
  // Spacing, line endings and compatibility characters the quarantine normalizes before counting.
  const messy = baseInput({
    description: '  ﬁrst\r\nline   with\tgaps and a ① ',
    whyItMatters: 'It   names the ﬁrst teacher\rat the school.  ',
    location: ' Tulsa,   Oklahoma ',
    era: '１９２１',
    attestation: true,
  });
  const intake = validateLeadSubmission(messy);
  assert.equal(intake.valid, true);
  if (!intake.valid) return;
  const quarantine = validateAndNormalizeSubmission(intake.payload);
  assert.equal(quarantine.valid, true);
  if (!quarantine.valid) return;
  assert.equal(leadStatementLength(messy), quarantine.normalized.statement.length);
  assert.notEqual(leadStatementLength(messy), intake.payload.statement.length);
});

test('a lead too long as a whole is refused in words that name the visible fields', () => {
  const fits = baseInput({ description: 'd'.repeat(3000), whyItMatters: 'w'.repeat(2900) });
  assert.equal(validateLeadSubmission(fits).valid, true);
  const result = validateLeadSubmission({ ...fits, whyItMatters: 'w'.repeat(3000) });
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.deepEqual(
    result.issues.map((issue) => issue.field),
    ['whyItMatters'],
  );
  assert.match(result.issues[0]!.message, /can hold 6,000 characters, and this is \d+ over/);
  assert.match(result.issues[0]!.message, /Shorten “What you know” or “Why it matters”/);
});

test('a field over its own limit is named the way the form labels it', () => {
  const result = validateLeadSubmission(baseInput({ location: 'x'.repeat(201) }));
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.deepEqual(result.issues, [
    { field: 'location', message: 'Keep “Where” to 200 characters or fewer.' },
  ]);
});
