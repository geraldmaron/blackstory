import { useEffect, useRef, type RefObject } from 'react';
import { COMPACT_MEDIA_QUERY } from '../../../lib/layout/compact-viewport';

/** Which sheet a drag handle belongs to. `record` is the record sheet; the rest are dock panels. */
export type CompactSheetKey = 'lens' | 'results' | 'decade' | 'camera' | 'record';

/** Handle selector → the sheet it moves and the key it reports when dismissed. */
const HANDLES: readonly {
  readonly handle: string;
  readonly sheet: string;
  readonly key: CompactSheetKey;
}[] = [
  { handle: '.ds-lens__head', sheet: '.ds-lens', key: 'lens' },
  { handle: '.ds-results__head', sheet: '.ds-results', key: 'results' },
  { handle: '.ds-time-panel__header', sheet: '.ds-time-panel', key: 'decade' },
  { handle: '.ds-camera__head', sheet: '.ds-camera', key: 'camera' },
  { handle: '.ds-sheet__top', sheet: '.ds-sheet', key: 'record' },
];

/** Past this, a downward drag dismisses (or drops a full sheet back to its peek). */
export const SHEET_DISMISS_PX = 80;
/** Past this, an upward drag opens the sheet to full height. */
export const SHEET_EXPAND_PX = 48;
/** A flick: fast enough to count however short it was (px per ms). */
export const SHEET_FLICK_SPEED = 0.6;

export type SheetDetent = 'peek' | 'full';

/** What a released drag does — pure, so the thresholds are unit-tested. */
export function sheetDragOutcome(
  detent: SheetDetent,
  dy: number,
  speed: number,
): 'dismiss' | 'peek' | 'full' {
  const down = dy > SHEET_DISMISS_PX || (dy > 12 && speed > SHEET_FLICK_SPEED);
  const up = dy < -SHEET_EXPAND_PX || (dy < -12 && speed > SHEET_FLICK_SPEED);
  if (detent === 'full') return down ? 'peek' : 'full';
  if (down) return 'dismiss';
  if (up) return 'full';
  return 'peek';
}

/** The vertical offset drawn while dragging: free downward, damped upward (rubber band). */
export function sheetDragOffset(dy: number): number {
  return dy >= 0 ? dy : -Math.min(60, Math.sqrt(-dy) * 6);
}

/**
 * Draggable bottom sheets on compact portrait screens — the Google/Apple Maps sheet: a grab bar
 * on top, drag down to fold it into the dock, drag up to open it to full height, flick for
 * either. Delegated from the Atlas root, so the five sheet components need no wiring of their
 * own; buttons and fields inside a header still behave as buttons and fields.
 *
 * Landscape phones dock the sheet as a left column (atlas.css), where a vertical drag would mean
 * nothing, so the hook stands down there.
 */
export function useCompactSheetDrag(
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: (key: CompactSheetKey) => void,
): void {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const compact = window.matchMedia(COMPACT_MEDIA_QUERY);
    const landscape = window.matchMedia('(orientation: landscape)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let drag: {
      pointerId: number;
      handle: HTMLElement;
      sheet: HTMLElement;
      key: CompactSheetKey;
      startY: number;
      lastY: number;
      lastT: number;
      speed: number;
    } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (!compact.matches || landscape.matches) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('button, a, input, select, textarea, [role="slider"]')) return;
      for (const entry of HANDLES) {
        const handle = target.closest<HTMLElement>(entry.handle);
        if (!handle) continue;
        const sheet = handle.closest<HTMLElement>(entry.sheet);
        if (!sheet) return;
        drag = {
          pointerId: event.pointerId,
          handle,
          sheet,
          key: entry.key,
          startY: event.clientY,
          lastY: event.clientY,
          lastT: event.timeStamp,
          speed: 0,
        };
        handle.setPointerCapture?.(event.pointerId);
        sheet.style.transition = 'none';
        return;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dt = Math.max(1, event.timeStamp - drag.lastT);
      drag.speed = Math.abs(event.clientY - drag.lastY) / dt;
      drag.lastY = event.clientY;
      drag.lastT = event.timeStamp;
      drag.sheet.style.transform = `translateY(${sheetDragOffset(event.clientY - drag.startY)}px)`;
    };

    const finish = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const { sheet, handle, key, startY, speed, lastY } = drag;
      drag = null;
      handle.releasePointerCapture?.(event.pointerId);
      const detent: SheetDetent = sheet.dataset.detent === 'full' ? 'full' : 'peek';
      // The last tracked move, not the release event's coordinates: some platforms report a
      // touch release at (0, 0), which read as a huge upward drag.
      const outcome =
        event.type === 'pointercancel' ? detent : sheetDragOutcome(detent, lastY - startY, speed);
      sheet.style.transition = reducedMotion.matches
        ? 'none'
        : 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)';
      sheet.style.transform = '';
      if (outcome === 'dismiss') {
        delete sheet.dataset.detent;
        onDismissRef.current(key);
      } else if (outcome === 'full') {
        sheet.dataset.detent = 'full';
      } else {
        delete sheet.dataset.detent;
      }
    };

    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', finish);
    root.addEventListener('pointercancel', finish);
    return () => {
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', finish);
      root.removeEventListener('pointercancel', finish);
    };
  }, [rootRef]);
}
