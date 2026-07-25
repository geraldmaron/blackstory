/**
 * Wraps the full-list panel and boosts background contrast once it's mostly
 * in view — the wall's ambient names have faded by then (see
 * MemorialWallAtmosphere's scroll-fade), so the long list gets a legibility
 * lift instead of competing with leftover atmosphere. No full theme toggle,
 * just a distinct background token on this zone.
 *
 * Driven by a scroll listener (rAF-throttled), not IntersectionObserver: the
 * observed panel (the full ~1,700-name list) is far taller than the
 * viewport, so a target-relative threshold would need thousands of px
 * visible at once to fire. Checking the panel's own top edge against the
 * viewport is simpler and matches the wall's scroll-fade approach.
 */
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { shouldBoostListContrast } from './memorial-list-contrast';

export type MemorialListContrastZoneProps = {
  readonly children: ReactNode;
};

export function MemorialListContrastZone({ children }: MemorialListContrastZoneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [boosted, setBoosted] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    let ticking = false;
    const check = () => {
      ticking = false;
      setBoosted(shouldBoostListContrast(node.getBoundingClientRect().top, window.innerHeight));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="ds-memorial-edition__list-zone"
      data-contrast={boosted ? 'boosted' : undefined}
    >
      {children}
    </div>
  );
}
