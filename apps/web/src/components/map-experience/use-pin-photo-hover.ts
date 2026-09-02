/**
 * Delegated hover/focus tracking for `.ds-first-paint-pin[data-entity-id]` markup — the Door's
 * static pin plate (`FirstPaintPinPlate`). The Atlas's own MapLibre entity markers use the same
 * class and `data-entity-id`/`data-pin-name` attributes (`entity-marker-sync.ts`), but MapStage
 * owns that DOM directly and reports hover through its own `pinHover` event instead of this hook.
 *
 * `data-entity-id` carries whatever key the caller's own photo index is keyed by — an opaque
 * `pin-N` on the Door. This hook does not interpret it; it only reports the key, the pin's own
 * display name, and its client rect back to the caller.
 *
 * Never more than one card open. Hover opens after a 120ms intent delay; focus opens immediately;
 * leave/blur/Escape close immediately.
 */
'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { PIN_ARIA_LABEL_PREFIX } from '../../app/first-paint-pin-plate';

const PIN_SELECTOR = '.ds-first-paint-pin[data-entity-id]';
/** Matches `PinPhotoCard`'s doc comment and MapStage's own `PIN_HOVER_INTENT_MS`. */
const HOVER_INTENT_MS = 120;

/** `first-paint-pin-plate.tsx` already prints the pin's display name once, in its own
 * `aria-label` (`"Open {name}"`) — read it back rather than repeating the name in a second
 * `data-*` attribute, which would grow the Door's per-pin HTML for a name it already sent. */
function pinNameFromElement(el: HTMLElement): string {
  const label = el.getAttribute('aria-label') ?? '';
  return label.startsWith(PIN_ARIA_LABEL_PREFIX) ? label.slice(PIN_ARIA_LABEL_PREFIX.length) : '';
}

export type PinPhotoHoverTarget = {
  readonly key: string;
  readonly name: string;
  readonly rect: DOMRect;
};

export function usePinPhotoHoverAnchor(
  containerRef: RefObject<HTMLElement | null>,
): PinPhotoHoverTarget | null {
  const [active, setActive] = useState<PinPhotoHoverTarget | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const open = (target: HTMLElement) => {
      const key = target.dataset.entityId;
      if (!key) return;
      setActive({ key, name: pinNameFromElement(target), rect: target.getBoundingClientRect() });
    };

    const close = () => {
      clearTimer();
      setActive(null);
    };

    const matchPin = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element ? (target.closest(PIN_SELECTOR) as HTMLElement | null) : null;

    const handlePointerOver = (event: PointerEvent) => {
      const target = matchPin(event.target);
      if (!target || !container.contains(target)) return;
      clearTimer();
      timerRef.current = setTimeout(() => open(target), HOVER_INTENT_MS);
    };

    const handlePointerOut = (event: PointerEvent) => {
      const target = matchPin(event.target);
      if (!target) return;
      const related = event.relatedTarget;
      if (related instanceof Node && target.contains(related)) return;
      close();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = matchPin(event.target);
      if (!target || !container.contains(target)) return;
      clearTimer();
      open(target);
    };

    const handleFocusOut = () => close();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    container.addEventListener('pointerover', handlePointerOver);
    container.addEventListener('pointerout', handlePointerOut);
    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimer();
      container.removeEventListener('pointerover', handlePointerOver);
      container.removeEventListener('pointerout', handlePointerOut);
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef]);

  return active;
}
