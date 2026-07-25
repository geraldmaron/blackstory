'use client';

/**
 * The single ✕ / Close control (`docs/ui/patterns-cinematic-map.md` §2 rule 4): only rendered
 * (and reachable) while Engaged, top-trailing in `.ds-cinematic-rail`, ≥44px. Relocks to Rest,
 * deselects, and restores the home camera via `useCinematicMap().close()`. `Escape` does the
 * same on web (§2 rule 4). Focus moves here on engage and back to `ExploreMapControl` on close
 * (§4) — this component owns the "focus here on engage" half; `ExploreMapControl` does not need
 * to know about Close, it just restores focus to itself when `state` leaves `engaged`.
 */
import React, { useEffect, useRef } from 'react';
import { useCinematicMap } from './CinematicMapProvider';

void React;

export type CinematicMapCloseProps = {
  readonly className?: string;
  readonly label?: string;
};

export function CinematicMapClose({ className, label = 'Close map' }: CinematicMapCloseProps) {
  const { state, close } = useCinematicMap();
  const engaged = state === 'engaged';
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (engaged) buttonRef.current?.focus();
  }, [engaged]);

  useEffect(() => {
    if (!engaged) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engaged, close]);

  if (!engaged) return null;

  const rootClass = ['ds-cinematic-close', className].filter(Boolean).join(' ');

  return (
    <button
      ref={buttonRef}
      type="button"
      className={rootClass}
      aria-label={label}
      data-cinematic-state={state}
      onClick={close}
    >
      <span aria-hidden="true">✕</span>
    </button>
  );
}
