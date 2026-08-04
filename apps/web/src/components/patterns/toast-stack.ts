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

/**
 * Actionable toast: `null`, meaning it never expires on its own.
 *
 * A timed action toast is a deadline the reader did not agree to. Six seconds is enough for
 * someone who was already looking at that corner of the screen and reading at speed; it is not
 * enough for a reader using a screen reader, a switch, or a magnifier, all of whom need longer to
 * find the button than a sighted mouse user needs to click it. Undo in particular cannot be a race
 * — losing it means the reader's own list is wrong with no way back.
 *
 * The toast still leaves: acting on it dismisses it, so does the close button, and the stack limit
 * drops the oldest when a fourth arrives. What it will not do is disappear while being read.
 */
export const TOAST_ACTION_DURATION_MS: number | null = null;

/** Older toasts are dropped rather than stacked past this depth. */
export const TOAST_STACK_LIMIT = 3;

/** How long this toast lives, or `null` when it persists until acted on or dismissed. */
export function toastDurationMs(toast: Pick<ToastSpec, 'action'>): number | null {
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

/**
 * The newest toast carrying an action, or null. What the undo chord acts on.
 *
 * Newest rather than oldest: the reader's chord means "undo what just happened", and the stack is
 * ordered oldest-first. Nothing else in the stack is a candidate — a report-only toast has nothing
 * to run, so it is skipped rather than blocking the chord.
 */
export function latestActionableToast(stack: readonly ToastSpec[]): ToastSpec | null {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const toast = stack[index];
    if (toast?.action) return toast;
  }
  return null;
}
