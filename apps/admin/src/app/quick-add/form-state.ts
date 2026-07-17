/**
 * Shared type and initial value for the quick-add form's client/server boundary.
 *
 * Deliberately NOT inside `actions.ts`: a `'use server'` file may only export async
 * functions a plain constant or type export there silently breaks on the client bundle.
 */
import type { ResearchIntakeOutcome } from '@black-book/operator-cli';

export type QuickAddFormState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly error: string }
  | { readonly status: 'result'; readonly outcome: ResearchIntakeOutcome; readonly sessionId: string };

export const QUICK_ADD_INITIAL_STATE: QuickAddFormState = { status: 'idle' };
