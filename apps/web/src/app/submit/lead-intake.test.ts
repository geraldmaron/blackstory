/**
 * Unit tests for the public "submit a lead" form-field shaping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLeadSubmission, type LeadSubmissionInput } from './lead-intake';

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
