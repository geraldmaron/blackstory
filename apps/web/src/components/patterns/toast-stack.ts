/**
 * Toast timing and stack rules, kept pure so the dismissal contract is testable without a DOM.
 *
 * A toast that carries an action stays longer than one that only reports: the reader has to read
 * it, decide, and reach it before it leaves. See docs/ui/design-direction-v9-atlas.md §7.
 */

/*
 * Named `toast-stack` rather than `toast` because `Toast.tsx` sits beside it: on a
 * case-insensitive filesystem `./toast` and `./Toast` resolve to the same file, which made
 * `ToastStack` unimportable. Kebab-case pure module beside a PascalCase component is the
 * convention the rest of `patterns/` already follows.
 */

export type ToastAction = {
  readonly label: string;
  readonly run: () => void;
};

export type ToastSpec = {
  readonly id: string;
  readonly message: string;
  readonly action?: ToastAction;
};

/** Report-only toast. Long enough to read a short sentence. */
export const TOAST_DURATION_MS = 2600;

/** Actionable toast. Long enough to read, decide and reach the button. */
export const TOAST_ACTION_DURATION_MS = 6000;

/** Older toasts are dropped rather than stacked past this depth. */
export const TOAST_STACK_LIMIT = 3;

export function toastDurationMs(toast: Pick<ToastSpec, 'action'>): number {
  return toast.action ? TOAST_ACTION_DURATION_MS : TOAST_DURATION_MS;
}

/**
 * Newest toast last, capped at the stack limit. Re-pushing an existing id replaces that toast in
 * place so a repeated action (saving twice) refreshes its timer instead of stacking duplicates.
 */
export function pushToast(stack: readonly ToastSpec[], toast: ToastSpec): readonly ToastSpec[] {
  const withoutDuplicate = stack.filter((entry) => entry.id !== toast.id);
  return [...withoutDuplicate, toast].slice(-TOAST_STACK_LIMIT);
}

export function dismissToast(stack: readonly ToastSpec[], id: string): readonly ToastSpec[] {
  return stack.filter((entry) => entry.id !== id);
}
