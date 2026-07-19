/**
 * Shapes the public correction form into the exact `SubmissionInput` that
 * `createQuarantinedSubmission` accepts. Pure and synchronous
 * no Firebase, App Check, or rate limiting so field rules are trivially testable in isolation.
 */
import type { SubmissionInput } from '@repo/security';
import {
  CORRECTION_CATEGORY_LABELS,
  CORRECTION_TARGET_LABELS,
  isCorrectionCategory,
  isCorrectionTargetType,
  type CorrectionCategory,
  type CorrectionTargetType,
} from './categories';

const MIN_STATEMENT_LENGTH = 20;
const MAX_FIELD_LENGTH = 4_000;
const MAX_CONTACT_LENGTH = 320;
const MAX_TARGET_ID_LENGTH = 128;

export type CorrectionSubmissionInput = {
  readonly targetType: CorrectionTargetType;
  readonly targetRecordId: string;
  readonly category: CorrectionCategory;
  readonly statement: string;
  readonly sourceUrl?: string | undefined;
  readonly privacyConsent: boolean;
  readonly contact?: string | undefined;
};

export type CorrectionFieldIssue = { readonly field: string; readonly message: string };

export type CorrectionSubmissionValidation =
  | { readonly valid: true; readonly payload: SubmissionInput; readonly metadata: CorrectionSubmissionMetadata }
  | { readonly valid: false; readonly issues: readonly CorrectionFieldIssue[] };

export type CorrectionSubmissionMetadata = {
  readonly targetType: CorrectionTargetType;
  readonly category: CorrectionCategory;
  readonly classificationDispute: boolean;
};

function deriveTitle(category: CorrectionCategory, targetType: CorrectionTargetType): string {
  return `Correction: ${CORRECTION_CATEGORY_LABELS[category]} (${CORRECTION_TARGET_LABELS[targetType]})`;
}

function composeStatement(input: CorrectionSubmissionInput): string {
  const lines = [
    `Target type: ${CORRECTION_TARGET_LABELS[input.targetType]}`,
    `Target record id: ${input.targetRecordId.trim()}`,
    `Category: ${CORRECTION_CATEGORY_LABELS[input.category]}`,
    '',
    input.statement.trim(),
    '',
    'Privacy consent: contributor confirmed the privacy notice before submitting.',
  ];
  return lines.join('\n');
}

function fieldTooLong(
  value: string | undefined,
  field: string,
  max: number,
): CorrectionFieldIssue | undefined {
  if (value !== undefined && value.length > max) {
    return { field, message: `${field} must be ${max} characters or fewer.` };
  }
  return undefined;
}

/**
 * Validates and shapes the public correction form. Authoritative spam scoring, campaign
 * detection, and canonical-write guards still happen inside `createQuarantinedSubmission`.
 */
export function validateCorrectionSubmission(
  input: CorrectionSubmissionInput,
): CorrectionSubmissionValidation {
  const issues: CorrectionFieldIssue[] = [];

  if (!isCorrectionTargetType(input.targetType)) {
    issues.push({ field: 'targetType', message: 'Choose what you are correcting.' });
  }
  if (!isCorrectionCategory(input.category)) {
    issues.push({ field: 'category', message: 'Choose a correction category.' });
  }
  if (!input.targetRecordId?.trim()) {
    issues.push({ field: 'targetRecordId', message: 'Provide the record identifier you are correcting.' });
  }
  if (!input.statement?.trim() || input.statement.trim().length < MIN_STATEMENT_LENGTH) {
    issues.push({
      field: 'statement',
      message: `Describe the correction in at least ${MIN_STATEMENT_LENGTH} characters.`,
    });
  }
  if (!input.privacyConsent) {
    issues.push({
      field: 'privacyConsent',
      message: 'You must confirm the privacy notice before submitting.',
    });
  }
  if (!input.sourceUrl?.trim()) {
    issues.push({
      field: 'sourceUrl',
      message: 'Provide at least one supporting HTTPS source URL.',
    });
  }

  for (const [value, field, max] of [
    [input.targetRecordId, 'targetRecordId', MAX_TARGET_ID_LENGTH],
    [input.statement, 'statement', MAX_FIELD_LENGTH],
    [input.contact, 'contact', MAX_CONTACT_LENGTH],
  ] as const) {
    const issue = fieldTooLong(value, field, max);
    if (issue) issues.push(issue);
  }

  if (issues.length > 0) return { valid: false, issues };

  const sourceUrls = input.sourceUrl?.trim() ? [input.sourceUrl.trim()] : [];
  const payload: SubmissionInput = {
    kind: 'correction',
    title: deriveTitle(input.category, input.targetType),
    statement: composeStatement(input),
    sourceUrls,
    targetRecordId: input.targetRecordId.trim(),
    ...(input.contact?.trim() ? { submitterContact: input.contact.trim() } : {}),
  };

  return {
    valid: true,
    payload,
    metadata: {
      targetType: input.targetType,
      category: input.category,
      classificationDispute: input.category === 'classification_dispute',
    },
  };
}

export type AppealSubmissionInput = {
  readonly receiptCode: string;
  readonly statement: string;
  readonly sourceUrl?: string | undefined;
  readonly privacyConsent: boolean;
  readonly contact?: string | undefined;
};

export type AppealSubmissionValidation =
  | { readonly valid: true; readonly payload: SubmissionInput }
  | { readonly valid: false; readonly issues: readonly CorrectionFieldIssue[] };

export function validateAppealSubmission(input: AppealSubmissionInput): AppealSubmissionValidation {
  const issues: CorrectionFieldIssue[] = [];
  if (!input.receiptCode?.trim()) {
    issues.push({ field: 'receiptCode', message: 'Provide your correction receipt code.' });
  }
  if (!input.statement?.trim() || input.statement.trim().length < MIN_STATEMENT_LENGTH) {
    issues.push({
      field: 'statement',
      message: `Explain your appeal in at least ${MIN_STATEMENT_LENGTH} characters.`,
    });
  }
  if (!input.privacyConsent) {
    issues.push({
      field: 'privacyConsent',
      message: 'You must confirm the privacy notice before submitting an appeal.',
    });
  }
  const statementIssue = fieldTooLong(input.statement, 'statement', MAX_FIELD_LENGTH);
  if (statementIssue) issues.push(statementIssue);
  const contactIssue = fieldTooLong(input.contact, 'contact', MAX_CONTACT_LENGTH);
  if (contactIssue) issues.push(contactIssue);

  if (issues.length > 0) return { valid: false, issues };

  const sourceUrls = input.sourceUrl?.trim() ? [input.sourceUrl.trim()] : [];
  if (sourceUrls.length === 0) {
    issues.push({
      field: 'sourceUrl',
      message: 'Provide a supporting HTTPS link to the published record or evidence you dispute.',
    });
    return { valid: false, issues };
  }

  const payload: SubmissionInput = {
    kind: 'correction',
    title: `Appeal for correction ${input.receiptCode.trim()}`,
    statement: [
      `Appeal for receipt: ${input.receiptCode.trim()}`,
      '',
      input.statement.trim(),
      '',
      'Privacy consent: contributor confirmed the privacy notice before submitting.',
    ].join('\n'),
    sourceUrls,
    ...(input.contact?.trim() ? { submitterContact: input.contact.trim() } : {}),
  };
  return { valid: true, payload };
}

export type AbuseReportInput = {
  readonly receiptCode?: string | undefined;
  readonly statement: string;
  readonly sourceUrl?: string | undefined;
  readonly privacyConsent: boolean;
  readonly contact?: string | undefined;
};

export function validateAbuseReportSubmission(input: AbuseReportInput): AppealSubmissionValidation {
  const issues: CorrectionFieldIssue[] = [];
  if (!input.statement?.trim() || input.statement.trim().length < MIN_STATEMENT_LENGTH) {
    issues.push({
      field: 'statement',
      message: `Describe the abusive activity in at least ${MIN_STATEMENT_LENGTH} characters.`,
    });
  }
  if (!input.privacyConsent) {
    issues.push({
      field: 'privacyConsent',
      message: 'You must confirm the privacy notice before submitting a report.',
    });
  }
  const statementIssue = fieldTooLong(input.statement, 'statement', MAX_FIELD_LENGTH);
  if (statementIssue) issues.push(statementIssue);
  const contactIssue = fieldTooLong(input.contact, 'contact', MAX_CONTACT_LENGTH);
  if (contactIssue) issues.push(contactIssue);

  if (issues.length > 0) return { valid: false, issues };

  const lines = [input.statement.trim()];
  if (input.receiptCode?.trim()) {
    lines.unshift(`Related correction receipt: ${input.receiptCode.trim()}`);
  }

  const payload: SubmissionInput = {
    kind: 'abuse_report',
    title: 'Correction lane abuse report',
    statement: lines.join('\n\n'),
    sourceUrls: input.sourceUrl?.trim() ? [input.sourceUrl.trim()] : [],
    ...(input.contact?.trim() ? { submitterContact: input.contact.trim() } : {}),
  };
  return { valid: true, payload };
}
