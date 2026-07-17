/**
 * Shapes a public "submit a lead" form payload into the exact `SubmissionInput` shape
 * `createQuarantinedSubmission` accepts. Pure and
 * synchronous no Firebase, no App Check, no rate limiting so the field rules here are
 * trivially testable in isolation. See `api/route.ts` for where this plugs into the real
 * quarantine intake.
 *
 * Known constraint (not something this file can fix): own validator requires at
 * least one HTTPS source URL for `kind: 'contribution'` submissions. A description-only lead
 * with no URL at all (e.g. a purely oral-history account) will pass this file's validation but
 * still be rejected by `createQuarantinedSubmission` downstream with a `source_url_invalid`
 * issue the same behavior `packages/operator-cli`'s lead intake has today. This file does not
 * duplicate or relax that rule; it surfaces the real rejection to the submitter instead.
 */
import type { SubmissionInput } from '@black-book/security';

const MIN_WHY_IT_MATTERS_LENGTH = 10;
const MAX_FIELD_LENGTH = 4_000;
const MAX_CONTACT_LENGTH = 320;

export type LeadSubmissionInput = {
  readonly url?: string | undefined;
  readonly description?: string | undefined;
  readonly whyItMatters: string;
  readonly location?: string | undefined;
  readonly era?: string | undefined;
  readonly attestation?: boolean | undefined;
  readonly contact?: string | undefined;
};

export type LeadSubmissionFieldIssue = { readonly field: string; readonly message: string };

export type LeadSubmissionValidation =
  | { readonly valid: true; readonly payload: SubmissionInput }
  | { readonly valid: false; readonly issues: readonly LeadSubmissionFieldIssue[] };

function deriveTitle(text: string, maxLength = 120): string {
  const trimmed = text.trim().replace(/\s+/gu, ' ');
  if (!trimmed) return 'Community lead';
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function composeStatement(input: LeadSubmissionInput): string {
  const lines: string[] = [];
  if (input.description?.trim()) lines.push(input.description.trim());
  lines.push(`Why it matters: ${input.whyItMatters.trim()}`);
  if (input.location?.trim()) lines.push(`Location: ${input.location.trim()}`);
  if (input.era?.trim()) lines.push(`Era: ${input.era.trim()}`);
  lines.push(
    input.attestation
      ? 'Contributor attestation: submitted as accurate to the contributor’s knowledge.'
      : 'Contributor attestation: not provided.',
  );
  return lines.join('\n\n');
}

function fieldTooLong(value: string | undefined, field: string, max: number): LeadSubmissionFieldIssue | undefined {
  if (value !== undefined && value.length > max) {
    return { field, message: `${field} must be ${max} characters or fewer.` };
  }
  return undefined;
}

/**
 * Validates and shapes the public form's fields. Field-level checks here are intentionally
 * conservative (length/presence only) — the authoritative validation, spam scoring, and
 * campaign detection all still happen inside `createQuarantinedSubmission`; this file never
 * substitutes for that.
 */
export function validateLeadSubmission(input: LeadSubmissionInput): LeadSubmissionValidation {
  const issues: LeadSubmissionFieldIssue[] = [];
  const hasUrl = Boolean(input.url?.trim());
  const hasDescription = Boolean(input.description?.trim());

  if (!hasUrl && !hasDescription) {
    issues.push({
      field: 'url',
      message: 'Provide a URL, a description, or both — at least one is required.',
    });
  }
  if (!input.whyItMatters?.trim() || input.whyItMatters.trim().length < MIN_WHY_IT_MATTERS_LENGTH) {
    issues.push({
      field: 'whyItMatters',
      message: `Explain why this matters in at least ${MIN_WHY_IT_MATTERS_LENGTH} characters.`,
    });
  }

  for (const [value, field, max] of [
    [input.description, 'description', MAX_FIELD_LENGTH],
    [input.whyItMatters, 'whyItMatters', MAX_FIELD_LENGTH],
    [input.location, 'location', 200],
    [input.era, 'era', 200],
    [input.contact, 'contact', MAX_CONTACT_LENGTH],
  ] as const) {
    const issue = fieldTooLong(value, field, max);
    if (issue) issues.push(issue);
  }

  if (issues.length > 0) return { valid: false, issues };

  const payload: SubmissionInput = {
    kind: 'contribution',
    title: deriveTitle(input.description ?? input.whyItMatters),
    statement: composeStatement(input),
    sourceUrls: hasUrl ? [input.url!.trim()] : [],
    ...(input.contact?.trim() ? { submitterContact: input.contact.trim() } : {}),
  };
  return { valid: true, payload };
}
