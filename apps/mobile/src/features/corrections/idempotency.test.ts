import { deriveIdempotencyKey } from './idempotency';
import type { CorrectionSubmissionRequest } from './contract';

const payload: CorrectionSubmissionRequest = {
  targetType: 'entity',
  targetRecordId: 'ent_caam_los_angeles_001',
  category: 'factual_error',
  statement: 'The founding year is wrong and should read 1976, not 1977.',
  sourceUrl: 'https://example.org/evidence',
  privacyConsent: true,
};

describe('deriveIdempotencyKey — retry-safe replay identity (MOB-016 #3)', () => {
  it('produces the SAME key for identical content (a kill-and-retry is a replay, not a new entry)', () => {
    expect(deriveIdempotencyKey(payload)).toBe(deriveIdempotencyKey({ ...payload }));
  });

  it('is stable across whitespace-equivalent content (trim-canonicalized)', () => {
    expect(deriveIdempotencyKey({ ...payload, statement: `  ${payload.statement}  ` })).toBe(
      deriveIdempotencyKey(payload),
    );
  });

  it('changes when the correction content changes (no accidental collapse of distinct corrections)', () => {
    expect(deriveIdempotencyKey({ ...payload, statement: `${payload.statement} extra` })).not.toBe(
      deriveIdempotencyKey(payload),
    );
    expect(deriveIdempotencyKey({ ...payload, targetRecordId: 'ent_other_001' })).not.toBe(
      deriveIdempotencyKey(payload),
    );
  });

  it('has the expected opaque, prefixed shape and carries no content', () => {
    const key = deriveIdempotencyKey(payload);
    expect(key).toMatch(/^bbcor-[0-9a-f]{16}$/);
    expect(key).not.toContain('founding');
  });
});
