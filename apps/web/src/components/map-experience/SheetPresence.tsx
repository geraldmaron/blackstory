'use client';

/**
 * Keeps an Explore sheet (Filters, Records, When, View, the record sheet) on screen while it
 * animates away, then unmounts it.
 *
 * The sheets used to unmount the moment their panel closed, so a sheet that slid up on open
 * vanished in a single frame on close — including when a pinch on the map folds it. With this
 * wrapper a closing sheet gets `data-presence="leaving"`, runs the exit animation its layout
 * defines (atlas.css: down and out on a phone, back to the left edge on a phone on its side),
 * and is removed when that animation ends. Where a layout defines no exit animation (the desktop
 * rails) the sheet goes at once, as before.
 *
 * The wrapper is `display: contents`, so it adds no box; atlas.css allowlists its sheets for
 * pointer events alongside the direct children. A leaving sheet is `inert`: it can be seen, not
 * used.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** If the exit animation never reports finishing (a hidden tab), remove the sheet anyway. */
const LEAVE_FALLBACK_MS = 600;

export function SheetPresence({
  show,
  children,
}: {
  readonly show: boolean;
  readonly children: ReactNode;
}) {
  const [present, setPresent] = useState(show);
  const [previousShow, setPreviousShow] = useState(show);
  if (show !== previousShow) {
    setPreviousShow(show);
    if (show) setPresent(true);
  }
  const leaving = present && !show;
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!leaving) {
      // Reopened mid-exit: a sheet dismissed by a drag was left where the finger let go
      // (use-compact-sheet-drag.ts); put it back.
      const sheet = boxRef.current?.firstElementChild;
      if (sheet instanceof HTMLElement && sheet.style.transform) sheet.style.transform = '';
      return undefined;
    }
    const sheet = boxRef.current?.firstElementChild;
    const running =
      sheet && typeof sheet.getAnimations === 'function'
        ? sheet.getAnimations().filter((animation) => animation.playState === 'running')
        : [];
    if (running.length === 0) {
      setPresent(false);
      return undefined;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setPresent(false);
    };
    void Promise.all(running.map((animation) => animation.finished)).then(finish, finish);
    const fallback = window.setTimeout(finish, LEAVE_FALLBACK_MS);
    return () => {
      settled = true;
      window.clearTimeout(fallback);
    };
  }, [leaving]);

  if (!show && !present) return null;
  return (
    <div
      ref={boxRef}
      className="ds-sheet-presence"
      data-presence={leaving ? 'leaving' : 'shown'}
      inert={leaving || undefined}
    >
      {children}
    </div>
  );
}
