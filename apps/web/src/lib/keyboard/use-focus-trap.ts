/**
 * Focus trap for `aria-modal` dialogs, plus the `inert` half that makes the claim true.
 *
 * `aria-modal="true"` is an assertion to assistive technology, not an implementation. Without a
 * trap, Tab walks straight out of the dialog into the map behind it: a screen reader user is told
 * nothing else exists while their focus ring is sitting on a pin they cannot see. Both halves are
 * needed — the trap keeps Tab inside, and `inert` on everything else keeps the pointer, the
 * accessibility tree and the tab order agreeing with each other.
 *
 * Design law: docs/ui/design-direction-v9-atlas.md §7.
 */

import { useEffect, type RefObject } from 'react';

/**
 * Focusable candidates, in DOM order. `tabindex="-1"` is excluded on purpose: it means "focusable
 * by script, not by Tab", which is exactly the dialog container itself.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * The tabbable elements inside a container, skipping anything hidden.
 *
 * `offsetParent === null` catches `display:none` subtrees without forcing a style recalculation
 * per candidate, which matters because this runs on every Tab press.
 */
export function focusableWithin(container: HTMLElement): readonly HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  );
}

/**
 * Which element Tab should land on, given where focus is now.
 *
 * Pure and exported so the wrap-around rule is testable without a browser: the DOM work is
 * finding the list, and the decision is this function.
 */
export function nextTrapIndex(count: number, current: number, backwards: boolean): number {
  if (count === 0) return -1;
  // A focus that is not in the list at all (the dialog container itself, on open) enters at the
  // ends rather than jumping to the middle.
  if (current === -1) return backwards ? count - 1 : 0;
  return backwards ? (current - 1 + count) % count : (current + 1) % count;
}

/**
 * Move focus to an element that is not in the tab order, adding `tabindex="-1"` if it needs one.
 *
 * The focus contract has to land the reader on panel headers and dock chips, which are landmarks
 * rather than controls — they should be reachable by script after a transition, but must not add
 * a stop to every Tab cycle. `tabindex="-1"` is exactly that distinction, and setting it here
 * rather than in the panels keeps the contract in one file instead of scattered across the
 * components it moves focus between.
 *
 * Returns false when the element is not on screen, so a caller can fall back rather than silently
 * dropping focus onto `<body>`.
 */
export function focusLandmark(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
  element.focus();
  return document.activeElement === element;
}

export type FocusTrapOptions = {
  /**
   * The overlay's outermost element. Everything outside it is marked `inert` while it is open.
   *
   * Derived rather than named: the alternative is every surface that mounts a dialog remembering
   * to pass a stage element, and the one that forgets ships an `aria-modal` dialog with a live map
   * behind it. See `inertOutside` for why "outside" cannot mean "my siblings".
   */
  readonly overlayRef?: RefObject<HTMLElement | null>;
};

/**
 * Mark everything outside `overlay` inert, walking up to `<body>` and inerting siblings at each
 * level. Returns the elements it changed, for the caller to restore.
 *
 * The level walk is the part that is easy to get wrong. Inerting only the overlay's own siblings
 * looks right and tests green, but Explore mounts its map canvas from the root layout — a
 * different subtree entirely — so the dialog's siblings do not include the stage it is covering.
 * Every ancestor level has to be swept, or `aria-modal` is asserting something the document does
 * not do.
 *
 * Elements already inert are left out of the returned list, so an inner overlay closing cannot
 * un-inert the stage an outer one is still covering.
 */
export function inertOutside(overlay: HTMLElement): readonly HTMLElement[] {
  const changed: HTMLElement[] = [];
  let node: HTMLElement = overlay;
  while (node.parentElement && node !== document.body) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node) continue;
      if (!(sibling instanceof HTMLElement) || sibling.inert) continue;
      sibling.inert = true;
      changed.push(sibling);
    }
    node = node.parentElement;
  }
  return changed;
}

/**
 * Traps Tab inside `containerRef` while `active`, and marks the overlay's siblings inert.
 *
 * Restoring focus is deliberately *not* done here. Each dialog already restores to the control
 * that opened it, and the two mechanisms disagreeing about where focus belongs is worse than
 * either one alone.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options: FocusTrapOptions = {},
): void {
  const { overlayRef } = options;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const overlay = overlayRef?.current ?? null;
    const inerted = overlay ? inertOutside(overlay) : [];

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = focusableWithin(container);
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const next = nextTrapIndex(focusable.length, index, event.shiftKey);
      // Nothing focusable inside: hold focus on the container rather than letting Tab escape to
      // the stage behind, which is the exact failure the trap exists to prevent.
      event.preventDefault();
      if (next === -1) container.focus();
      else focusable[next]?.focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      for (const element of inerted) element.inert = false;
    };
  }, [active, containerRef, overlayRef]);
}
