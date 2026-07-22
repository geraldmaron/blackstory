import {
  EMPTY_CORRECTION_FORM,
  MAX_CONTACT_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_TARGET_ID_LENGTH,
  safeEvidenceUrl,
  validateCorrectionForm,
  type CorrectionFormState,
} from './validation';

const validForm: CorrectionFormState = {
  targetType: 'entity',
  targetRecordId: 'ent_caam_los_angeles_001',
  category: 'factual_error',
  statement: 'This record lists the wrong founding year; it should read 1976, not 1977.',
  sourceUrl: 'https://example.org/evidence',
  contact: '',
  privacyConsent: true,
  contactConsent: false,
};

function issueFields(state: CorrectionFormState): string[] {
  const result = validateCorrectionForm(state);
  return result.valid ? [] : result.issues.map((i) => i.field);
}

describe('validateCorrectionForm — mirrors web correction-intake rules', () => {
  it('accepts a well-formed correction and emits the trimmed wire payload', () => {
    const result = validateCorrectionForm(validForm);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload).toMatchObject({
        targetType: 'entity',
        targetRecordId: 'ent_caam_los_angeles_001',
        category: 'factual_error',
        privacyConsent: true,
      });
      // Optional contact omitted when blank.
      expect(result.payload.contact).toBeUndefined();
    }
  });

  it('requires target type, category, record id, statement, privacy consent, and a source URL', () => {
    expect(issueFields(EMPTY_CORRECTION_FORM).sort()).toEqual(
      ['category', 'privacyConsent', 'sourceUrl', 'statement', 'targetRecordId', 'targetType'].sort(),
    );
  });

  it('enforces the 20-char minimum statement length', () => {
    expect(issueFields({ ...validForm, statement: 'too short' })).toContain('statement');
  });

  it('rejects an unchecked privacy consent (never pre-checked)', () => {
    expect(EMPTY_CORRECTION_FORM.privacyConsent).toBe(false);
    expect(issueFields({ ...validForm, privacyConsent: false })).toContain('privacyConsent');
  });

  it('requires affirmative contact consent when a contact is provided', () => {
    expect(issueFields({ ...validForm, contact: 'me@example.org', contactConsent: false })).toContain(
      'contactConsent',
    );
    const ok = validateCorrectionForm({ ...validForm, contact: 'me@example.org', contactConsent: true });
    expect(ok.valid).toBe(true);
    if (ok.valid) expect(ok.payload.contact).toBe('me@example.org');
  });

  describe('adversarial — spam / giant payload length caps (mirror server limits)', () => {
    it('rejects an over-long statement', () => {
      expect(issueFields({ ...validForm, statement: 'a'.repeat(MAX_FIELD_LENGTH + 1) })).toContain('statement');
    });
    it('rejects an over-long record id', () => {
      expect(issueFields({ ...validForm, targetRecordId: 'a'.repeat(MAX_TARGET_ID_LENGTH + 1) })).toContain(
        'targetRecordId',
      );
    });
    it('rejects an over-long contact', () => {
      expect(
        issueFields({ ...validForm, contact: `${'a'.repeat(MAX_CONTACT_LENGTH + 1)}@x`, contactConsent: true }),
      ).toContain('contact');
    });
  });

  describe('adversarial — XSS-shaped description is accepted as inert text', () => {
    it('does not reject angle-bracket / script-shaped statements (stored as inert text)', () => {
      const result = validateCorrectionForm({
        ...validForm,
        statement: '<script>alert(1)</script> the founding year is wrong and should be corrected',
      });
      expect(result.valid).toBe(true);
    });
  });
});

describe('safeEvidenceUrl — scheme allowlist (adversarial malicious URLs)', () => {
  it('accepts an https URL', () => {
    expect(safeEvidenceUrl('https://example.org/a/b?c=d')).toBe('https://example.org/a/b?c=d');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'http://example.org',
    'blackstory://open',
    '//evil.example.com',
    'https://exa mple.org',
    'https://',
  ])('rejects unsafe/non-https URL %p', (bad) => {
    expect(safeEvidenceUrl(bad)).toBeNull();
    expect(validateCorrectionForm({ ...validForm, sourceUrl: bad })).toMatchObject({ valid: false });
  });
});
