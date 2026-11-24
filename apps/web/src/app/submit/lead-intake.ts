/**
 * Shapes a public "submit a lead" form payload into the exact `SubmissionInput` shape
 * `createQuarantinedSubmission` accepts. Pure and
 * synchronous no network calls or rate limiting so the field rules here are
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
import type { SubmissionInput } from '@repo/security';

/* Exported so the form states and checks the same limits the server enforces. */
export const MIN_WHY_IT_MATTERS_LENGTH = 10;
export const MAX_FIELD_LENGTH = 4_000;
export const MAX_SHORT_FIELD_LENGTH = 200;
export const MAX_CONTACT_LENGTH = 320;
/**
 * The quarantine's `maxStatementCharacters`, which bounds the whole composed lead. Restated
 * because the browser cannot import @repo/security (node:crypto); a test holds the two equal.
 */
export const MAX_LEAD_STATEMENT_LENGTH = 6_000;

/** "Keep “Where” to 200 characters or fewer." `what` names the field as the reader sees it. */
export function tooLongMessage(what: string, max: number): string {
  return `Keep ${what} to ${max.toLocaleString('en-US')} characters or fewer.`;
}

export const LEAD_FIELD_LIMITS = [
  ['description', '“What you know”', MAX_FIELD_LENGTH],
  ['whyItMatters', '“Why it matters”', MAX_FIELD_LENGTH],
  ['location', '“Where”', MAX_SHORT_FIELD_LENGTH],
  ['era', '“When”', MAX_SHORT_FIELD_LENGTH],
  ['contact', 'the email address', MAX_CONTACT_LENGTH],
] as const;

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

/**
 * The length the quarantine measures: the composed statement (labels, place, period and
 * attestation line included) after its text normalization. No single field's length answers it.
 */
export function leadStatementLength(input: LeadSubmissionInput): number {
  // Mirrors `normalizeText` in packages/security/src/submissions/quarantine.ts; a test compares them.
  return composeStatement(input)
    .normalize('NFKC')
    .replace(/\r\n?/gu, '\n')
    .replace(/[ \t]+/gu, ' ')
    .trim().length;
}

/** How many characters the whole lead runs past what the quarantine accepts, or 0. */
export function leadOverLength(input: LeadSubmissionInput): number {
  return Math.max(0, leadStatementLength(input) - MAX_LEAD_STATEMENT_LENGTH);
}

export function leadTooLongMessage(over: number): string {
  return `All the fields together can hold ${MAX_LEAD_STATEMENT_LENGTH.toLocaleString('en-US')} characters, and this is ${over.toLocaleString('en-US')} over. Shorten “What you know” or “Why it matters”.`;
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
      message: 'Give a link, a description, or both. One of the two is required.',
    });
  }
  if (!input.whyItMatters?.trim() || input.whyItMatters.trim().length < MIN_WHY_IT_MATTERS_LENGTH) {
    issues.push({
      field: 'whyItMatters',
      message: `Explain why this matters in at least ${MIN_WHY_IT_MATTERS_LENGTH} characters.`,
    });
  }

  for (const [field, what, max] of LEAD_FIELD_LIMITS) {
    const value = input[field];
    if (value !== undefined && value.length > max) {
      issues.push({ field, message: tooLongMessage(what, max) });
    }
  }

  if (issues.length > 0) return { valid: false, issues };

  // The quarantine would refuse this anyway; said here so it names the fields a reader can see.
  const over = leadOverLength(input);
  if (over > 0) {
    return { valid: false, issues: [{ field: 'whyItMatters', message: leadTooLongMessage(over) }] };
  }

  const payload: SubmissionInput = {
    kind: 'contribution',
    title: deriveTitle(input.description ?? input.whyItMatters),
    statement: composeStatement(input),
    sourceUrls: hasUrl ? [input.url!.trim()] : [],
    ...(input.contact?.trim() ? { submitterContact: input.contact.trim() } : {}),
  };
  return { valid: true, payload };
}
