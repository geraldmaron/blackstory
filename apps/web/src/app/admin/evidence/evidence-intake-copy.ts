/**
 * Plain-language copy for the evidence attach desk — intent lede and numbered steps.
 */

export const EVIDENCE_ATTACH_INTENT_COPY =
  'Attach a source URL and description to an open research case. Prepare validates the proposal; commit writes to quarantine only — checklist application stays a separate research action.';

export const EVIDENCE_ATTACH_STEPS = [
  'Enter the research case id, source URL, and a short description of what the source supports.',
  'Confirm your operator id — pre-filled from your sign-in when available; used for audit.',
  'Leave commit unchecked to prepare only, or check commit to write the proposal to quarantine.',
] as const;

export function evidenceSubmitLabel(commit: boolean, pending: boolean): string {
  if (pending) return 'Working…';
  return commit ? 'Commit to quarantine' : 'Prepare evidence proposal';
}
