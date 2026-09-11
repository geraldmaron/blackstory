/**
 * Form state for the bulk edit action. Separate from `bulk-actions.ts` because a `'use server'`
 * module may only export async functions.
 */
export type BulkEditState = {
  readonly status: 'idle' | 'applied' | 'error';
  readonly message: string;
  readonly changed?: number;
};

export const BULK_EDIT_INITIAL: BulkEditState = { status: 'idle', message: '' };
