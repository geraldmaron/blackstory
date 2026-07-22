/**
 * Shapes and validates the mobile/web correction submission body into the `SubmissionInput`
 * `createSubmissionQuarantineService().intake()` accepts (MOB-016 / repo-zir9).
 *
 * The wire shape is `CorrectionSubmissionRequest` from `apps/mobile/src/features/corrections/contract.ts`,
 * which is identical to web's `CorrectionSubmissionInput`
 * (`apps/web/src/app/corrections/correction-intake.ts`) — the field rules below mirror web's
 * validator exactly so a submission that is valid on one surface is valid on the other. Pure and
 * synchronous: no Firebase, App Check, or rate limiting here, so field rules stay trivially
 * testable in isolation. Authoritative spam scoring, campaign detection, and the
 * quarantine-only/no-canonical-write guard still happen one layer down, inside
 * `createQuarantinedSubmission` (via the quarantine service).
 */
import type { SubmissionInput } from '@repo/security';
import {
  CORRECTION_CATEGORY_LABELS,
  CORRECTION_TARGET_LABELS,
  isCorrectionCategory,
  isCorrectionTargetType,
  type CorrectionCategory,
  type CorrectionTargetType,
} from './categories.js';

const MIN_STATEMENT_LENGTH = 20;
const MAX_FIELD_LENGTH = 4_000;
const MAX_CONTACT_LENGTH = 320;
const MAX_TARGET_ID_LENGTH = 128;

/** The exact body the mobile client and web route both send (mirrors mobile's
 * `CorrectionSubmissionRequest` / web's `CorrectionSubmissionInput`). */
export type CorrectionSubmissionInput = {
  readonly targetType?: unknown;
  readonly targetRecordId?: unknown;
  readonly category?: unknown;
  readonly statement?: unknown;
  readonly sourceUrl?: unknown;
  readonly privacyConsent?: unknown;
  readonly contact?: unknown;
};

export type CorrectionFieldIssue = { readonly field: string; readonly message: string };

export type CorrectionSubmissionMetadata = {
  readonly targetType: CorrectionTargetType;
  readonly category: CorrectionCategory;
  readonly classificationDispute: boolean;
};

export type CorrectionSubmissionValidation =
  | { readonly valid: true; readonly payload: SubmissionInput; readonly metadata: CorrectionSubmissionMetadata }
  | { readonly valid: false; readonly issues: readonly CorrectionFieldIssue[] };

function deriveTitle(category: CorrectionCategory, targetType: CorrectionTargetType): string {
  return `Correction: ${CORRECTION_CATEGORY_LABELS[category]} (${CORRECTION_TARGET_LABELS[targetType]})`;
}

function composeStatement(input: {
  readonly targetType: CorrectionTargetType;
  readonly targetRecordId: string;
  readonly category: CorrectionCategory;
  readonly statement: string;
}): string {
  return [
    `Target type: ${CORRECTION_TARGET_LABELS[input.targetType]}`,
    `Target record id: ${input.targetRecordId.trim()}`,
    `Category: ${CORRECTION_CATEGORY_LABELS[input.category]}`,
    '',
    input.statement.trim(),
    '',
    'Privacy consent: contributor confirmed the privacy notice before submitting.',
  ].join('\n');
}

function fieldTooLong(
  value: unknown,
  field: string,
  max: number,
): CorrectionFieldIssue | undefined {
  if (typeof value === 'string' && value.length > max) {
    return { field, message: `${field} must be ${max} characters or fewer.` };
  }
  return undefined;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Validates and shapes an untrusted request body into the quarantine service's `SubmissionInput`.
 * Every field is read defensively (`unknown`) — the body arrives as parsed JSON from an untrusted
 * caller, never assumed to already match the wire type.
 */
export function validateCorrectionSubmission(
  input: CorrectionSubmissionInput,
): CorrectionSubmissionValidation {
  const issues: CorrectionFieldIssue[] = [];

  const targetType = input.targetType;
  const category = input.category;
  const targetRecordId = asOptionalString(input.targetRecordId);
  const statement = asOptionalString(input.statement);
  const sourceUrl = asOptionalString(input.sourceUrl);
  const contact = asOptionalString(input.contact);
  const privacyConsent = input.privacyConsent === true;

  if (!isCorrectionTargetType(targetType)) {
    issues.push({ field: 'targetType', message: 'Choose what you are correcting.' });
  }
  if (!isCorrectionCategory(category)) {
    issues.push({ field: 'category', message: 'Choose a correction category.' });
  }
  if (!targetRecordId?.trim()) {
    issues.push({ field: 'targetRecordId', message: 'Provide the record identifier you are correcting.' });
  }
  if (!statement?.trim() || statement.trim().length < MIN_STATEMENT_LENGTH) {
    issues.push({
      field: 'statement',
      message: `Describe the correction in at least ${MIN_STATEMENT_LENGTH} characters.`,
    });
  }
  if (!privacyConsent) {
    issues.push({
      field: 'privacyConsent',
      message: 'You must confirm the privacy notice before submitting.',
    });
  }
  if (!sourceUrl?.trim()) {
    issues.push({
      field: 'sourceUrl',
      message: 'Provide at least one supporting HTTPS source URL.',
    });
  }

  for (const [value, field, max] of [
    [targetRecordId, 'targetRecordId', MAX_TARGET_ID_LENGTH],
    [statement, 'statement', MAX_FIELD_LENGTH],
    [contact, 'contact', MAX_CONTACT_LENGTH],
  ] as const) {
    const issue = fieldTooLong(value, field, max);
    if (issue) issues.push(issue);
  }

  if (issues.length > 0) return { valid: false, issues };

  // The checks above guarantee these narrow to their declared types past this point.
  const safeTargetType = targetType as CorrectionTargetType;
  const safeCategory = category as CorrectionCategory;
  const safeTargetRecordId = (targetRecordId as string).trim();
  const safeStatement = statement as string;
  const safeSourceUrl = (sourceUrl as string).trim();

  const payload: SubmissionInput = {
    kind: 'correction',
    title: deriveTitle(safeCategory, safeTargetType),
    statement: composeStatement({
      targetType: safeTargetType,
      targetRecordId: safeTargetRecordId,
      category: safeCategory,
      statement: safeStatement,
    }),
    sourceUrls: [safeSourceUrl],
    targetRecordId: safeTargetRecordId,
    ...(contact?.trim() ? { submitterContact: contact.trim() } : {}),
  };

  return {
    valid: true,
    payload,
    metadata: {
      targetType: safeTargetType,
      category: safeCategory,
      classificationDispute: safeCategory === 'classification_dispute',
    },
  };
}
