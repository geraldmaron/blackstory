/**
 * Form state for a submission decision.
 *
 * Deliberately NOT inside `actions.ts`: a `'use server'` file may only export async functions,
 * so the state type and its initial value live here (same split as the catalog field edit's
 * `edit-state.ts`).
 */
export type SubmissionDecisionState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'decided';
      readonly message: string;
      readonly eventId: string;
      readonly researchCaseId?: string;
    }
  | { readonly status: 'error'; readonly message: string };

export const SUBMISSION_DECISION_INITIAL: SubmissionDecisionState = { status: 'idle' };
