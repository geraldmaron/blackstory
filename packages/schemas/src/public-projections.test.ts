/**
 * Tests for the public entity projection Zod schema.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicEntityProjectionSchema } from './public-projections.ts';

/**
 * A read-side length check must never unpublish a record.
 *
 * `summary` was capped at 400 here while the wire contract (`entityV1Schema`) allows 5000. The
 * result was not a truncated summary: `parseEntityProjection` returned undefined and the record
 * disappeared from the API and the website both. It hit the 9 best-enriched records in the active
 * release, because richer enrichment writes longer summaries.
 */
const baseEntity = {
  id: 'ent_test_001',
  releaseId: 'release-1',
  kind: 'person',
  displayName: 'Test Person',
  nameLower: 'test person',
  summary: 'S'.repeat(140),
};

test('entity projection accepts a summary longer than the old 400-char cap', () => {
  // 613 chars: the real length of the James Baldwin summary that used to 404 the record.
  const result = publicEntityProjectionSchema.safeParse({
    ...baseEntity,
    summary: 'S'.repeat(613),
  });
  assert.equal(result.success, true);
});

test('entity projection still rejects a summary below the 120-char substance floor', () => {
  const result = publicEntityProjectionSchema.safeParse({ ...baseEntity, summary: 'Too short.' });
  assert.equal(result.success, false);
});

test('entity projection accepts a full visit block', () => {
  const result = publicEntityProjectionSchema.safeParse({
    ...baseEntity,
    visit: {
      address: {
        street: '1530 6th Avenue North',
        city: 'Birmingham',
        state: 'AL',
        postalCode: '35203',
        line: '1530 6th Avenue North, Birmingham, AL 35203',
      },
      phone: { e164: '+12053281000', display: '(205) 328-1000' },
      website: 'https://example.org',
      hours: 'Tue–Sat 10am–5pm',
      visitability: 'open_to_public',
      sources: ['claim-1'],
    },
  });
  assert.equal(result.success, true);
});

test('entity projection accepts an absent visit block', () => {
  const result = publicEntityProjectionSchema.safeParse(baseEntity);
  assert.equal(result.success, true);
});

test('entity projection rejects an invalid visit visitability value', () => {
  const result = publicEntityProjectionSchema.safeParse({
    ...baseEntity,
    visit: { visitability: 'sometimes' },
  });
  assert.equal(result.success, false);
});

test('entity claim archive fields are additive and must be complete', () => {
  const claim = {
    id: 'claim-1',
    predicate: 'founded_year',
    object: '1900',
    confidenceLevel: 'high' as const,
    citationSource: 'Example',
    citationHref: 'https://example.gov/record/1',
    citationLabel: 'Example record',
  };
  const archived = publicEntityProjectionSchema.safeParse({
    ...baseEntity,
    claims: [
      {
        ...claim,
        archivedUrl: 'https://web.archive.org/web/20260901000000/https://example.gov/record/1',
        archivedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
  });
  assert.equal(archived.success, true);
  assert.equal(
    publicEntityProjectionSchema.safeParse({
      ...baseEntity,
      claims: [{ ...claim, archivedUrl: 'https://web.archive.org/web/20260901000000/x' }],
    }).success,
    false,
  );
  assert.equal(
    publicEntityProjectionSchema.safeParse({
      ...baseEntity,
      claims: [
        {
          ...claim,
          archivedUrl: 'https://web.archive.org/web/20260901000000/https://other.gov/record/1',
          archivedAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    publicEntityProjectionSchema.safeParse({
      ...baseEntity,
      claims: [
        {
          ...claim,
          archivedUrl: 'javascript:alert(1)',
          archivedAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    }).success,
    false,
  );
});

/**
 * the vocabulary this parser accepts must not be narrower than the one the
 * database, the deriver and the UI already use. `presumed_deceased` was legal everywhere else
 * and rejected here, so the first record set to it would have 404'd rather than degraded.
 */
test('entity projection accepts the presumed_deceased living status', () => {
  const result = publicEntityProjectionSchema.safeParse({
    ...baseEntity,
    status: 'presumed_deceased',
    livingStatus: 'presumed_deceased',
  });
  assert.equal(result.success, true);
});

test('entity projection still rejects a living status outside the vocabulary', () => {
  const result = publicEntityProjectionSchema.safeParse({
    ...baseEntity,
    livingStatus: 'probably_deceased',
  });
  assert.equal(result.success, false);
});
