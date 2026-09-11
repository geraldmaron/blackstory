/**
 * Form state for inline entity edits.
 *
 * Deliberately NOT inside `actions.ts`: a `'use server'` file may only export async functions,
 * so the state type and its initial value live here (same split as quick-add's `form-state.ts`).
 */
export type EntityEditState =
  | { readonly status: 'idle' }
  | { readonly status: 'saved'; readonly message: string; readonly eventId: string }
  | { readonly status: 'error'; readonly message: string };

export const ENTITY_EDIT_INITIAL: EntityEditState = { status: 'idle' };
