'use server';

/**
 * Server action for a submission decision: promote, reject, or mark spam.
 *
 * Every path goes through `commitSubmissionDecision`, so the role check, the actor, and the
 * audit/outbox row are not this file's decision to make or skip. The operator id is never read
 * from the form — it comes from the verified session, same reasoning as the catalog field edit's
 * `actions.ts`.
 */
import { revalidatePath } from 'next/cache';
import { commitSubmissionDecision, isSubmissionDecision } from '@/admin/lib/postgres-submissions';
import type { SubmissionDecisionState } from './decision-state';

export async function decideSubmission(
  _previous: SubmissionDecisionState,
  formData: FormData,
): Promise<SubmissionDecisionState> {
  const intakeItemId = String(formData.get('intakeItemId') ?? '').trim();
  const decisionRaw = String(formData.get('decision') ?? '');
  const reason = String(formData.get('reason') ?? '');

  if (!intakeItemId) {
    return { status: 'error', message: 'Missing submission id.' };
  }
  if (!isSubmissionDecision(decisionRaw)) {
    return { status: 'error', message: 'Choose promote, reject, or spam.' };
  }

  const result = await commitSubmissionDecision({ intakeItemId, decision: decisionRaw, reason });

  switch (result.status) {
    case 'ok':
      revalidatePath(`/admin/submissions/${intakeItemId}`);
      revalidatePath('/admin/submissions');
      return {
        status: 'decided',
        message:
          decisionRaw === 'promote'
            ? 'Promoted. A research case was opened; nothing published.'
            : decisionRaw === 'reject'
              ? 'Rejected.'
              : 'Marked spam.',
        eventId: result.eventId,
        ...(result.researchCaseId ? { researchCaseId: result.researchCaseId } : {}),
      };
    case 'unauthenticated':
      return { status: 'error', message: 'Your session expired. Sign in again to decide.' };
    case 'not_found':
      return { status: 'error', message: 'That submission no longer exists.' };
    case 'already_processed':
      return {
        status: 'error',
        message: 'This submission was already decided — reload to see the current status.',
      };
    case 'forbidden':
    case 'invalid':
    case 'failed':
      return { status: 'error', message: result.message };
  }
}
