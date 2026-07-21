/**
 * User-facing copy for the native corrections experience (MOB-016).
 *
 * The privacy notice, form intro, and public status labels are mirrored from the
 * web flow (`apps/web/src/app/corrections/copy.ts`) so both clients speak with
 * one voice: corrections are a normal system function, quarantine-only, and
 * volume never changes confidence or publication.
 *
 * The rate-limit / offline / App-Check messages are intentionally GENERIC and
 * NON-REVEALING (requirement #4/#7): they never disclose moderation state,
 * whether a receipt exists, or why the lane is throttled — mirroring the
 * behavior of web's `rate-limit-guard.ts` (a coarse retry response) and
 * `public-status.ts` (coarse phase only).
 */
import type { PublicCorrectionPhase } from './contract';

export const CORRECTION_PRIVACY_NOTICE = {
  title: 'Privacy and review',
  body:
    'Corrections are never published as submitted. Every submission enters a restricted quarantine queue for human review. We do not show your contact details publicly. Moderators may reach out using optional contact information you provide. Do not include anyone’s home address or other sensitive personal details about a living person unless strictly necessary for the correction.',
} as const;

export const CORRECTION_FORM_INTRO =
  'Challenge a published record, suggest missing evidence, or report a precision issue. Nothing you submit here changes the public record until it passes independent review.';

export const CONTACT_CONSENT_LABEL =
  'A moderator may contact me about this correction using the details above. (Optional — leave the contact field blank to stay anonymous.)';

export const PRIVACY_CONSENT_LABEL =
  'I have read the privacy notice and understand corrections are reviewed, not auto-published.';

export const PUBLIC_STATUS_LABELS: Readonly<Record<PublicCorrectionPhase, string>> = {
  received: 'Received',
  under_review: 'Under review',
  closed: 'Closed',
};

export const RECEIPT_SAVE_INSTRUCTIONS =
  'Save this code somewhere safe. It is the only way to check the status of your correction later — we cannot look it up for you and we never show it again.';

/** Shown for 429 on submit OR status lookup. Reveals nothing about moderation
 * state or whether a receipt exists — just "wait and retry". */
export const RATE_LIMITED_MESSAGE =
  'Too many attempts right now. Please wait a little while and try again.';

/** Client is offline. Corrections do NOT queue-and-retry silently
 * (ADR-022 §3 / threat-model corrections resolution; requirement #6/#7). */
export const OFFLINE_MESSAGE =
  'You’re offline. Corrections need a connection to submit — try again once you’re back online.';

export const GENERIC_SUBMIT_ERROR =
  'Something went wrong submitting your correction. Please try again.';

/** Status lookup: no match. Worded so it never reveals whether a code once
 * existed and was closed vs. never existed (requirement #4/#7). */
export const STATUS_NOT_FOUND_MESSAGE =
  'No correction matches that code. Check the code and try again.';

export const STATUS_INVALID_CODE_MESSAGE =
  'That doesn’t look like a correction receipt code. Codes look like BB-COR-XXXXXXXXXXXXXXXX.';

export const STATUS_VOLUME_NOTICE =
  'Volume of corrections never changes public confidence or publication. Coordinated activity is reviewed separately and is not shown here.';
