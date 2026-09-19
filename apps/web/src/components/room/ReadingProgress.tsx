'use client';

/**
 * ReadingProgress — a hairline that fills as the reader scrolls the document.
 *
 * Design law: docs/ui/patterns-reading-room.md, design-direction-v9-surfaces.md §4 and §4.2.
 * Reference build: `.design-mocks/blackstory-atlas-v9.html`, `#docprog` (line 965) and
 * `updateProgress()` (line 5163).
 *
 * The rule belongs to the Reading surface class, not to a screen: this is
 * mounted exactly once, in `ShellPageTransition.tsx` — the one place a route's surface class is
 * already resolved for every page — rather than composed into each room's own markup. A screen
 * that wants the gauge does not import anything, and a screen that should not have one cannot
 * grow a variant of its own, because there is nowhere in a room's own code to put one.
 *
 * `display` is decided by `reading-room.css`'s `[data-surface='reading'] .ds-reading-progress`
 * rule, not by an inline style here. This component's own `surface !== 'reading'` check is a
 * second, JS-level guard — it keeps the scroll listener from ever attaching off the Reading
 * class — but the CSS selector is what actually decides whether a reader sees the bar, which is
 * where "class-wide, not per-screen" is supposed to live.
 *
 * REDUCED MOTION. The width transition reads `--ds-duration-fast`, which
 * `packages/ui/src/styles/tokens.css` already collapses to 0.01ms under
 * `prefers-reduced-motion: reduce`. That one shared token is the whole answer to "updates
 * without animation" — a second, component-owned reduced-motion check would just be a duplicate
 * subscription to a preference the design tokens already carry.
 */

import React, { useEffect, useRef } from 'react';
import type { SurfaceClass } from '../../lib/nav/surface-classes';

void React;

export type ReadingProgressProps = {
  readonly surface: SurfaceClass | null;
};

/** Below this scrollable range there is nothing to gauge; the mock treats it as flat 0%. */
const MIN_SCROLLABLE_PX = 40;

export function ReadingProgress({ surface }: ReadingProgressProps) {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (surface !== 'reading' || typeof window === 'undefined') return;

    const update = () => {
      const bar = barRef.current;
      if (!bar) return;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      bar.style.width = max > MIN_SCROLLABLE_PX ? `${(doc.scrollTop / max) * 100}%` : '0%';
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [surface]);

  if (surface !== 'reading') return null;

  return <div ref={barRef} className="ds-reading-progress" aria-hidden="true" />;
}
