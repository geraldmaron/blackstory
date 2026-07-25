'use client';

/**
 * One Invite "beat" (`docs/ui/patterns-cinematic-map.md` §1 Invite row, §6 module table):
 * on scroll-into-view it calls `flyTo(preset)` + `select(entityId)` from `useCinematicMap()`.
 * Uses `IntersectionObserver`, never a scroll listener (matches the "scroll is sacred" rule —
 * §2 rule 2 — no scroll interception). Guarded so it is inert once Engaged: a beat scrolling
 * past while the reader has hands-on the map must never yank the camera out from under them.
 */
import React, { useEffect, useRef } from 'react';
import type { CameraPresetName } from '../../../lib/map-experience/camera-presets';
import { useCinematicMap } from './CinematicMapProvider';

void React;

export type MapIntroBeatProps = {
  readonly preset: CameraPresetName;
  readonly entityId: string;
  readonly children: React.ReactNode;
  readonly className?: string;
  /** Intersection threshold before the beat fires. Defaults to 0.6 (mostly in view). */
  readonly threshold?: number;
};

export function MapIntroBeat({
  preset,
  entityId,
  children,
  className,
  threshold = 0.6,
}: MapIntroBeatProps) {
  const { state, invite, flyTo, select } = useCinematicMap();
  const nodeRef = useRef<HTMLDivElement | null>(null);
  // Read inside the observer callback without re-subscribing on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    // `IntersectionObserver` invokes its callback once immediately for the element's starting
    // state, even when nothing has scrolled yet. On a beat that's already in the initial
    // viewport (short pages, tall viewports) that first callback would fly/select on first
    // paint — a page-load camera jump, not a beat "as the reader scrolls" (spec §1 Invite row,
    // §2 rule 1 "never auto-engage"). Skip that first, load-time observation; only a real
    // transition into view afterward fires the beat.
    let firstObservation = true;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (firstObservation) continue;
          if (!entry.isIntersecting) continue;
          if (stateRef.current === 'engaged') continue; // inert while engaged
          if (stateRef.current === 'rest') invite();
          flyTo(preset);
          select(entityId);
        }
        firstObservation = false;
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [preset, entityId, invite, flyTo, select, threshold]);

  const rootClass = ['ds-cinematic-beat', className].filter(Boolean).join(' ');

  return (
    <div ref={nodeRef} className={rootClass} data-cinematic-state={state}>
      {children}
    </div>
  );
}
