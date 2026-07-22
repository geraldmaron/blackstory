/**
 * Client-side validation for the correction form (MOB-016, requirement #1 & #7).
 *
 * The FIELD RULES are a faithful mirror of the web server's authoritative
 * validator (`apps/web/src/app/corrections/correction-intake.ts`
 * `validateCorrectionSubmission`): same min/max lengths, same required fields,
 * same user-facing messages, so the on-device pre-check and the server verdict
 * agree. The server ALWAYS re-validates — this is a UX fast-path, never the
 * trust boundary (threat-model T1: server authoritative on every parameter).
 *
 * One DELIBERATE strengthening over web's validator: web only checks that
 * `sourceUrl` is non-empty (deep URL/spam scoring happens server-side inside
 * `createQuarantinedSubmission`). This client additionally scheme-allowlists the
 * evidence URL to `https://` only (requirement #7 "malicious URLs in evidence
 * fields (scheme-allowlisted like MOB-014's citation handling)") — a
 * `javascript:`, `data:`, `file:`, or app-scheme URL is rejected before it can
 * be sent or rendered. This never accepts anything the server would reject; it
 * only rejects earlier and more loudly on the client.
 */
import {
  CORRECTION_CATEGORIES,
  CORRECTION_TARGET_TYPES,
  isCorrectionCategory,
  isCorrectionTargetType,
  type CorrectionCategory,
  type CorrectionTargetType,
} from './categories';
import type { CorrectionSubmissionRequest } from './contract';

// Mirrors correction-intake.ts's module constants exactly.
export const MIN_STATEMENT_LENGTH = 20;
export const MAX_FIELD_LENGTH = 4_000;
export const MAX_CONTACT_LENGTH = 320;
export const MAX_TARGET_ID_LENGTH = 128;
/** Defensive cap on the URL field (also the server field cap). */
export const MAX_SOURCE_URL_LENGTH = MAX_FIELD_LENGTH;

export type CorrectionFieldIssue = { readonly field: string; readonly message: string };

/** The raw, in-memory form state the UI binds to. All strings; unselected
 * pickers are the empty string until chosen (never pre-filled). */
export type CorrectionFormState = {
  readonly targetType: CorrectionTargetType | '';
  readonly targetRecordId: string;
  readonly category: CorrectionCategory | '';
  readonly statement: string;
  readonly sourceUrl: string;
  readonly contact: string;
  /** Affirmative, NOT pre-checked (requirement #1). */
  readonly privacyConsent: boolean;
  /** Separate, affirmative opt-in to being contacted (requirement #1). */
  readonly contactConsent: boolean;
};

export const EMPTY_CORRECTION_FORM: CorrectionFormState = {
  targetType: '',
  targetRecordId: '',
  category: '',
  statement: '',
  sourceUrl: '',
  contact: '',
  privacyConsent: false,
  contactConsent: false,
};

export type CorrectionValidation =
  | { readonly valid: true; readonly payload: CorrectionSubmissionRequest }
  | { readonly valid: false; readonly issues: readonly CorrectionFieldIssue[] };

/**
 * Scheme-allowlist an evidence URL to `https://` only. Rejects other schemes
 * (`javascript:`, `data:`, `file:`, `http:`, `blackstory:`…), embedded
 * whitespace/control characters, and anything without an `https://` host.
 * Returns the trimmed URL when safe, otherwise `null`.
 */
export function safeEvidenceUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SOURCE_URL_LENGTH) return null;
  // No control characters or whitespace anywhere in a URL.
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || code === 0x20) return null;
  }
  // Exactly the https scheme, with an authority after it.
  if (!/^https:\/\/[^/].*/i.test(trimmed)) return null;
  return trimmed;
}

function tooLong(
  value: string,
  field: string,
  max: number,
): CorrectionFieldIssue | undefined {
  return value.length > max ? { field, message: `${field} must be ${max} characters or fewer.` } : undefined;
}

/**
 * Validate the form and, when valid, produce the exact wire payload to POST.
 * The payload carries only trimmed values; optional empty fields are omitted.
 */
export function validateCorrectionForm(state: CorrectionFormState): CorrectionValidation {
  const issues: CorrectionFieldIssue[] = [];

  if (!isCorrectionTargetType(state.targetType)) {
    issues.push({ field: 'targetType', message: 'Choose what you are correcting.' });
  }
  if (!isCorrectionCategory(state.category)) {
    issues.push({ field: 'category', message: 'Choose a correction category.' });
  }
  if (!state.targetRecordId.trim()) {
    issues.push({ field: 'targetRecordId', message: 'Provide the record identifier you are correcting.' });
  }
  if (state.statement.trim().length < MIN_STATEMENT_LENGTH) {
    issues.push({
      field: 'statement',
      message: `Describe the correction in at least ${MIN_STATEMENT_LENGTH} characters.`,
    });
  }
  if (!state.privacyConsent) {
    issues.push({ field: 'privacyConsent', message: 'You must confirm the privacy notice before submitting.' });
  }

  const trimmedUrl = state.sourceUrl.trim();
  if (!trimmedUrl) {
    issues.push({ field: 'sourceUrl', message: 'Provide at least one supporting HTTPS source URL.' });
  } else if (safeEvidenceUrl(trimmedUrl) === null) {
    issues.push({ field: 'sourceUrl', message: 'Enter a valid HTTPS link (https://…).' });
  }

  // Contact is optional, but if the user typed one they must opt in to contact.
  if (state.contact.trim() && !state.contactConsent) {
    issues.push({
      field: 'contactConsent',
      message: 'Confirm you agree to be contacted, or clear the contact field.',
    });
  }

  const lengthIssues = [
    tooLong(state.targetRecordId, 'targetRecordId', MAX_TARGET_ID_LENGTH),
    tooLong(state.statement, 'statement', MAX_FIELD_LENGTH),
    tooLong(state.contact, 'contact', MAX_CONTACT_LENGTH),
    tooLong(state.sourceUrl, 'sourceUrl', MAX_SOURCE_URL_LENGTH),
  ].filter((issue): issue is CorrectionFieldIssue => issue !== undefined);
  issues.push(...lengthIssues);

  if (issues.length > 0) return { valid: false, issues };

  // Safe to narrow — the guards above proved these are set.
  const payload: CorrectionSubmissionRequest = {
    targetType: state.targetType as CorrectionTargetType,
    targetRecordId: state.targetRecordId.trim(),
    category: state.category as CorrectionCategory,
    statement: state.statement.trim(),
    sourceUrl: trimmedUrl,
    privacyConsent: true,
    ...(state.contact.trim() && state.contactConsent ? { contact: state.contact.trim() } : {}),
  };
  return { valid: true, payload };
}

/** Re-exported for form pickers so the UI never hand-rolls the option list. */
export { CORRECTION_CATEGORIES, CORRECTION_TARGET_TYPES };
