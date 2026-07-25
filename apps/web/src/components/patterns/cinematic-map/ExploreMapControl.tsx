'use client';

/**
 * The single, always-visible "Explore the map" control (`docs/ui/patterns-cinematic-map.md`
 * §2 rule 3): copper, ≥44px touch target, `position: sticky` via `.ds-cinematic-rail`
 * (`cinematic-map.css`) so it stays reachable without scrolling. The only way into Engaged.
 *
 * Also owns the "focus back" half of the §4 accessibility contract: `CinematicMapClose` moves
 * focus to itself on engage; this component restores focus to itself the moment `state` leaves
 * `engaged` (Escape or Close), so keyboard users land back where they started.
 */
import React, { useEffect, useRef } from 'react';
import { useCinematicMap } from './CinematicMapProvider';

void React;

export type ExploreMapControlProps = {
  readonly className?: string;
  readonly label?: string;
};

export function ExploreMapControl({
  className,
  label = 'Explore the map',
}: ExploreMapControlProps) {
  const { state, engage } = useCinematicMap();
  const engaged = state === 'engaged';
  const rootClass = ['ds-explore-map-control', className].filter(Boolean).join(' ');
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const wasEngagedRef = useRef(engaged);

  useEffect(() => {
    if (wasEngagedRef.current && !engaged) {
      buttonRef.current?.focus();
    }
    wasEngagedRef.current = engaged;
  }, [engaged]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={rootClass}
      aria-pressed={engaged}
      data-cinematic-state={state}
      onClick={engage}
    >
      {label}
    </button>
  );
}
