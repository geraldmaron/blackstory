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

/**
 * Refuses a save made against an older copy of the record. `loaded` is the record's updatedAt
 * when the form was rendered; any write since, by a person or an agent, moves it. Without this
 * the later save silently replaces a change its author never saw.
 */
export function staleEditMessage(loaded: string, current: string): string | null {
  if (!loaded || loaded === current) return null;
  return 'This record changed after you opened it. Nothing was saved. Reload the page to see the change, then save again.';
}
