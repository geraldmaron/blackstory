/**
 * Form state for the merge actions. Separate from `actions.ts` because a `'use server'` module
 * may only export async functions.
 */
export type MergeFormState = {
  readonly status: 'idle' | 'ok' | 'error';
  readonly message: string;
  /** Set on success so the page can link to the survivor. */
  readonly survivorId?: string;
};

export const MERGE_INITIAL: MergeFormState = { status: 'idle', message: '' };
