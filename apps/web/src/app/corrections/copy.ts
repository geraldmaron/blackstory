/**
 * User-facing copy for the corrections experience privacy notice, status labels, and
 * form guidance. Keeps procedural tone per docs/ui/story.md (corrections are normal system
 * function, not an admission of failure).
 */

import type { PublicCorrectionPhase } from './public-status';

export const CORRECTION_PRIVACY_NOTICE = {
  title: 'Privacy and review',
  body: 'Corrections are never published as submitted. Every submission goes into a private queue and is read by a person. Your contact details are never shown publicly, and the optional ones are used only to follow up with you about this correction. Do not include anyone’s home address or other sensitive personal details about a living person unless strictly necessary for the correction.',
} as const;

export const PUBLIC_STATUS_LABELS: Readonly<Record<PublicCorrectionPhase, string>> = {
  received: 'Received',
  under_review: 'Under review',
  closed: 'Closed',
};

export const APPEAL_ELIGIBILITY_NOTICE =
  'If your correction was closed and you believe the outcome was wrong, you can file one appeal against your receipt code. An appeal sends it back for one more review. Volume never changes confidence or publication.';

export const ABUSE_REPORT_NOTICE =
  'Report abusive or harassing correction activity. Abuse reports are reviewed separately, and they never expose another submitter’s identity.';
