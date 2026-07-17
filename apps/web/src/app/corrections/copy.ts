/**
 * User-facing copy for the corrections experience privacy notice, status labels, and
 * form guidance. Keeps procedural tone per docs/ui/story.md (corrections are normal system
 * function, not an admission of failure).
 */

import type { PublicCorrectionPhase } from './public-status';

export const CORRECTION_PRIVACY_NOTICE = {
  title: 'Privacy and review',
  body:
    'Corrections are never published as submitted. Every submission enters a restricted quarantine queue for human review. We do not show your contact details publicly. Moderators may reach out using optional contact information you provide. Do not include anyone’s home address or other sensitive personal details about a living person unless strictly necessary for the correction.',
} as const;

export const CORRECTION_FORM_INTRO =
  'Challenge a published record, suggest missing evidence, or report a precision issue. Nothing you submit here changes the public record until it passes independent review.';

export const PUBLIC_STATUS_LABELS: Readonly<Record<PublicCorrectionPhase, string>> = {
  received: 'Received',
  under_review: 'Under review',
  closed: 'Closed',
};

export const APPEAL_ELIGIBILITY_NOTICE =
  'If your correction was closed and you believe the outcome was wrong, you may file one appeal using your receipt code. Appeals re-enter the same quarantine review lane — volume does not change confidence or publication.';

export const ABUSE_REPORT_NOTICE =
  'Report abusive or harassing correction activity. Abuse reports are reviewed separately and never expose other submitters’ identities.';
